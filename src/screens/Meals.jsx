import { useState, useEffect, useRef } from "react";
import { doc, setDoc, onSnapshot, arrayUnion } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useChild } from "../hooks/useChild";
import { usePatterns } from "../hooks/usePatterns";
import { usePreferenceNotes } from "../hooks/usePreferenceNotes";
import { t, shadows } from "../styles/tokens";

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const MODEL = "openrouter/auto";

const GI_COLORS = {
  "Low":        t.green,
  "Low-Medium": t.greenDark,
  "Medium":     t.warn,
  "High":       t.err,
};

const FALLBACK_RECOMMENDATIONS = [
  {
    name: "Oat porridge with berries",
    description: "A warm low-GI breakfast that releases energy slowly.",
    gi: "Low",
    carbsEstimate: "28g",
    whyRecommended: "Oats have a low glycaemic index and help stabilise blood glucose between meals.",
    emoji: "🥣",
  },
  {
    name: "Cheese and wholegrain crackers",
    description: "A protein-rich snack that bridges meal gaps effectively.",
    gi: "Low-Medium",
    carbsEstimate: "12g",
    whyRecommended: "Protein and fat from cheese slow carbohydrate absorption and help prevent glucose drops.",
    emoji: "🧀",
  },
  {
    name: "Hummus with vegetable sticks",
    description: "A fibre-rich snack with steady energy release.",
    gi: "Low",
    carbsEstimate: "8g",
    whyRecommended: "Legume-based hummus provides sustained energy suitable for regular snack intervals.",
    emoji: "🥕",
  },
];

// ── Week grid helpers ─────────────────────────────────────────────────────────

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getISOWeekId(weekOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + weekOffset * 7);
  const dow = d.getDay() || 7; // ISO: Mon=1, Sun=7
  const thu = new Date(d);
  thu.setDate(d.getDate() - dow + 4);
  const year = thu.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const mon1 = new Date(jan4);
  mon1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
  const week = Math.floor((thu - mon1) / 604800000) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getTodayDayIndex() {
  return (new Date().getDay() + 6) % 7; // Mon=0 … Sun=6
}

function getWeekLabel(weekOffset) {
  if (weekOffset === 0)  return "This week";
  if (weekOffset === -1) return "Last week";
  if (weekOffset === 1)  return "Next week";
  const d = new Date();
  d.setDate(d.getDate() + weekOffset * 7);
  const mon = new Date(d);
  mon.setDate(d.getDate() - (d.getDay() + 6) % 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = { month: "short", day: "numeric" };
  return `${mon.toLocaleDateString([], fmt)} – ${sun.toLocaleDateString([], fmt)}`;
}

// ── AI helpers ────────────────────────────────────────────────────────────────

async function generateRecommendations(child, patterns, preferenceChunks) {
  const topPatterns = (patterns || []).slice(0, 5);
  const topPrefs    = (preferenceChunks || []).slice(0, 5);

  const userPrompt = [
    "Child profile:",
    `- Name: ${child.name}`,
    `- Diagnosis: ${child.diagnosis || "Not specified"}`,
    `- Glucose target: ${child.glucoseTargetMin || 4.0}–${child.glucoseTargetMax || 6.5} mmol/L`,
    `- Meal interval: every ${child.mealIntervalMinutes || 120} minutes`,
    "",
    topPatterns.length > 0 ? "Top glucose and meal patterns:" : "No patterns available yet.",
    ...topPatterns.map(p => `- ${p.title}: ${p.description}`),
    "",
    topPrefs.length > 0 ? "Dietary preferences and notes:" : "No dietary preferences recorded yet.",
    ...topPrefs.map(p => `- ${typeof p === "string" ? p : (p.content || "")}`),
  ].join("\n");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "HTTP-Referer":  "https://glycoguard.app",
      "X-Title":       "GlycoGuard",
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: "You are a pediatric nutrition assistant specializing in hypoglycemia management. Based on the child's glucose patterns and dietary preferences, generate exactly 5 meal or snack recommendations. Respond with ONLY a JSON array of 5 objects, each with these exact fields: name (string), description (string, one sentence), gi (string, one of: Low / Low-Medium / Medium / High), carbsEstimate (string, e.g. '12g'), whyRecommended (string, one sentence explaining why this fits the child's patterns), emoji (single relevant food emoji). No other text, no markdown fences.",
        },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  let raw = (data.choices[0].message.content || "").trim();
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    throw new Error("Not a non-empty array");
  } catch {
    return FALLBACK_RECOMMENDATIONS;
  }
}

async function generateGroceryList(mealNames) {
  if (!mealNames || mealNames.length === 0) return [];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "HTTP-Referer":  "https://glycoguard.app",
      "X-Title":       "GlycoGuard",
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: "You are a pediatric nutrition assistant. Given a list of meals for the week, generate a consolidated grocery list. Respond with ONLY a JSON array of objects, each with these exact fields: item (string), category (string, one of: Produce / Dairy / Protein / Grains / Pantry / Other), quantity (string, e.g. 'x4' or '1 dozen' or '500g'). No other text, no markdown fences.",
        },
        {
          role: "user",
          content: `This week's meals:\n${mealNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\nGenerate a grocery list.`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  let raw = (data.choices[0].message.content || "").trim();
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(item => ({ ...item, checked: false }));
    throw new Error("Not an array");
  } catch {
    return [];
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Meals() {
  const { child, childId }                     = useChild();
  const { patterns, loading: patternsLoading } = usePatterns();
  const { notes }                              = usePreferenceNotes();

  // Recommendations
  const [recs,        setRecs]        = useState([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const didGenerate = useRef(false);

  // Weekly grid
  const [weekOffset,    setWeekOffset]    = useState(0);
  const [activeDay,     setActiveDay]     = useState(null); // null | 0-6
  const [addingMealDay, setAddingMealDay] = useState(null); // null | 0-6
  const [newMealInput,  setNewMealInput]  = useState("");
  const [weekPlan,      setWeekPlan]      = useState({});   // { "0": [...], … "6": [...] }

  // Grocery list
  const [groceryItems,   setGroceryItems]   = useState([]);
  const [groceryLoading, setGroceryLoading] = useState(false);
  const [instacartMsg,   setInstacartMsg]   = useState("");

  // Computed
  const weekId      = getISOWeekId(weekOffset);
  const allWeekMeals = Object.values(weekPlan).flat().map(m => m.name);
  const hasWeekMeals = allWeekMeals.length > 0;

  // ── Live listener: mealPlan/{weekId} ───────────────────────────────────────
  useEffect(() => {
    if (!child || !childId) return;
    // Reset UI state when navigating to a different week
    setWeekPlan({});
    setActiveDay(null);
    setAddingMealDay(null);
    setNewMealInput("");
    setGroceryItems([]);
    setInstacartMsg("");
    const userId = auth.currentUser.uid;
    const ref = doc(db, "users", userId, "children", childId, "mealPlan", getISOWeekId(weekOffset));
    return onSnapshot(ref, snap => {
      setWeekPlan(snap.exists() ? (snap.data().days || {}) : {});
    });
  }, [child, childId, weekOffset]);

  // ── Generate recommendations once after patterns + child load ───────────────
  useEffect(() => {
    if (patternsLoading || !child || !childId || didGenerate.current) return;
    if (patterns.length === 0) { setRecsLoading(false); return; }
    didGenerate.current = true;
    setRecsLoading(true);
    generateRecommendations(child, patterns, notes)
      .then(setRecs)
      .catch(() => setRecs(FALLBACK_RECOMMENDATIONS))
      .finally(() => setRecsLoading(false));
  }, [patternsLoading, child, childId, patterns, notes]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleRefresh = () => {
    if (recsLoading || !child || !childId || patterns.length === 0) return;
    setRecsLoading(true);
    generateRecommendations(child, patterns, notes)
      .then(setRecs)
      .catch(() => setRecs(FALLBACK_RECOMMENDATIONS))
      .finally(() => setRecsLoading(false));
  };

  const addToMealPlan = async (rec) => {
    if (!child || !childId) return;
    const userId    = auth.currentUser.uid;
    const targetKey = String(activeDay ?? getTodayDayIndex());
    const curWeekId = getISOWeekId(activeDay !== null ? weekOffset : 0);
    const weekRef   = doc(db, "users", userId, "children", childId, "mealPlan", curWeekId);
    await setDoc(weekRef, { days: { [targetKey]: arrayUnion({ name: rec.name, addedAt: new Date().toISOString() }) } }, { merge: true });
  };

  const addMealToDay = async (dayIndex, mealName) => {
    if (!child || !childId || !mealName.trim()) return;
    const userId   = auth.currentUser.uid;
    const ref      = doc(db, "users", userId, "children", childId, "mealPlan", weekId);
    const dayKey   = String(dayIndex);
    const newEntry = { name: mealName.trim(), addedAt: new Date().toISOString() };
    await setDoc(ref, { days: { [dayKey]: arrayUnion(newEntry) } }, { merge: true });
  };

  const removeMealFromDay = async (dayIndex, mealIndex) => {
    if (!child || !childId) return;
    const userId  = auth.currentUser.uid;
    const ref     = doc(db, "users", userId, "children", childId, "mealPlan", weekId);
    const dayKey  = String(dayIndex);
    const updated = {
      ...weekPlan,
      [dayKey]: (weekPlan[dayKey] || []).filter((_, i) => i !== mealIndex),
    };
    await setDoc(ref, { days: updated });
  };

  const handleGenerateGrocery = () => {
    if (groceryLoading || !hasWeekMeals) return;
    setGroceryLoading(true);
    setGroceryItems([]);
    setInstacartMsg("");
    generateGroceryList(allWeekMeals)
      .then(setGroceryItems)
      .catch(() => setGroceryItems([]))
      .finally(() => setGroceryLoading(false));
  };

  const toggleGroceryItem = (index) => {
    setGroceryItems(prev =>
      prev.map((item, i) => i === index ? { ...item, checked: !item.checked } : item)
    );
  };



  const hasNoPatterns = !patternsLoading && patterns.length === 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .recs-hscroll::-webkit-scrollbar { display: none; }
        .day-pills-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      <div style={{ fontFamily: t.fontSans, color: t.text, paddingBottom: 32 }}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.logo}>Meal Suggestions</div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
              {child?.name ? `Personalised for ${child.name}` : "Loading…"}
            </div>
          </div>
          <button
            style={{ ...s.refreshBtn, opacity: recsLoading || hasNoPatterns ? 0.4 : 1 }}
            onClick={handleRefresh}
            disabled={recsLoading || hasNoPatterns}
            aria-label="Refresh recommendations"
          >
            ↻
          </button>
        </div>

        {hasNoPatterns ? (

          /* Empty state — no patterns yet */
          <div style={s.emptyState}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🥗</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 18, color: t.pink, marginBottom: 10 }}>
              Building your insights
            </div>
            <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.65, maxWidth: 290, textAlign: "center" }}>
              Log glucose readings, meals and symptoms for at least a week, then visit Patterns to generate insights — meal recommendations will personalise as your data grows.
            </div>
          </div>

        ) : recsLoading ? (

          /* Loading while generating */
          <div style={{ padding: "52px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🍽️</div>
            <div style={{ fontSize: 14, color: t.textMuted }}>Generating recommendations…</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 6, opacity: 0.7 }}>
              Analysing glucose patterns and preferences
            </div>
          </div>

        ) : (
          <>

            {/* ── Recommendation cards ── */}
            <div style={{ paddingTop: 16 }}>
              <div style={s.sectionHead}>
                <span style={s.sectionTitle}>Suggested meals & snacks</span>
                <span style={{ fontSize: 11, color: t.textMuted }}>{recs.length} options</span>
              </div>
              <div className="recs-hscroll" style={s.hscroll}>
                {recs.map((rec, i) => (
                  <div key={i} style={s.recCard}>
                    <div style={{ fontSize: 44, textAlign: "center", marginBottom: 10 }}>{rec.emoji}</div>
                    <div style={{ marginBottom: 4 }}>
                      <div style={s.recName}>{rec.name}</div>
                      <span style={{
                        ...s.giBadge,
                        background:  (GI_COLORS[rec.gi] || t.textMuted) + "22",
                        borderColor: (GI_COLORS[rec.gi] || t.textMuted) + "55",
                        color:        GI_COLORS[rec.gi] || t.textMuted,
                      }}>
                        {rec.gi}
                      </span>
                    </div>
                    <div style={s.carbsText}>{rec.carbsEstimate} carbs</div>
                    <div style={s.descText}>{rec.description}</div>
                    <div style={s.whyText}>{rec.whyRecommended}</div>
                    <button
                      style={s.addBtn}
                      onClick={() => addToMealPlan(rec)}
                    >
                      + Add to meal plan
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Weekly meal plan grid ── */}
            <div style={{ padding: "20px 16px 8px" }}>
              <div style={s.sectionHead}>
                <span style={s.sectionTitle}>Weekly plan grid</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button style={s.weekNav} onClick={() => setWeekOffset(w => w - 1)} aria-label="Previous week">‹</button>
                  <span style={{ fontSize: 11, color: t.textMuted, minWidth: 68, textAlign: "center" }}>
                    {getWeekLabel(weekOffset)}
                  </span>
                  <button style={s.weekNav} onClick={() => setWeekOffset(w => w + 1)} aria-label="Next week">›</button>
                </div>
              </div>

              {/* Day pill row */}
              <div className="day-pills-scroll" style={s.dayPills}>
                {DAY_NAMES.map((day, i) => {
                  const isToday   = weekOffset === 0 && i === getTodayDayIndex();
                  const isActive  = activeDay === i;
                  const hasMeals  = (weekPlan[String(i)] || []).length > 0;
                  return (
                    <button
                      key={i}
                      style={{
                        ...s.dayPill,
                        ...(isToday  ? s.dayPillToday  : {}),
                        ...(isActive ? s.dayPillActive : {}),
                      }}
                      onClick={() => { setActiveDay(isActive ? null : i); setAddingMealDay(null); setNewMealInput(""); }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600 }}>{day}</div>
                      <div style={{ height: 5, width: 5, borderRadius: "50%", background: hasMeals ? t.green : "transparent" }} />
                    </button>
                  );
                })}
              </div>

              {/* Expanded day panel */}
              {activeDay !== null && (
                <div style={s.dayExpanded}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>
                    {DAY_NAMES[activeDay]}
                    {weekOffset === 0 && activeDay === getTodayDayIndex() && (
                      <span style={{ fontSize: 10, color: t.pink, marginLeft: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px" }}>today</span>
                    )}
                  </div>

                  {(weekPlan[String(activeDay)] || []).length === 0 ? (
                    <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>No meals planned for this day.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                      {(weekPlan[String(activeDay)] || []).map((meal, mi) => (
                        <div key={mi} style={s.dayMealRow}>
                          <span style={{ fontSize: 13, color: t.text, flex: 1 }}>{meal.name}</span>
                          <button
                            style={s.removeBtnSm}
                            onClick={() => removeMealFromDay(activeDay, mi)}
                            aria-label="Remove meal"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {addingMealDay === activeDay ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        style={s.addMealInput}
                        placeholder="e.g. Oat porridge"
                        value={newMealInput}
                        onChange={e => setNewMealInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && newMealInput.trim()) {
                            addMealToDay(activeDay, newMealInput);
                            setNewMealInput("");
                            setAddingMealDay(null);
                          }
                          if (e.key === "Escape") { setAddingMealDay(null); setNewMealInput(""); }
                        }}
                        autoFocus
                      />
                      <button
                        style={s.saveMealBtn}
                        onClick={() => {
                          if (newMealInput.trim()) {
                            addMealToDay(activeDay, newMealInput);
                            setNewMealInput("");
                            setAddingMealDay(null);
                          }
                        }}
                      >
                        Save
                      </button>
                      <button
                        style={s.cancelBtn}
                        onClick={() => { setAddingMealDay(null); setNewMealInput(""); }}
                        aria-label="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button style={s.addMealDayBtn} onClick={() => setAddingMealDay(activeDay)}>
                      + Add meal
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Grocery list ── */}
            <div style={{ padding: "20px 16px 8px" }}>
              <div style={s.sectionHead}>
                <span style={s.sectionTitle}>Grocery List</span>
                <button
                  style={{ ...s.generateBtn, opacity: groceryLoading || !hasWeekMeals ? 0.4 : 1 }}
                  onClick={handleGenerateGrocery}
                  disabled={groceryLoading || !hasWeekMeals}
                >
                  {groceryLoading ? "…" : "Generate"}
                </button>
              </div>

              {!hasWeekMeals ? (
                <div style={s.planEmpty}>
                  <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.55 }}>
                    Add meals to your weekly plan to generate a grocery list.
                  </div>
                </div>
              ) : groceryLoading ? (
                <div style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: t.textMuted }}>
                  Building your list…
                </div>
              ) : groceryItems.length === 0 ? (
                <div style={s.planEmpty}>
                  <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.55 }}>
                    Tap Generate to create a shopping list from this week's meals.
                  </div>
                </div>
              ) : (
                <>
                  {["Produce", "Dairy", "Protein", "Grains", "Pantry", "Other"].map(category => {
                    const items = groceryItems
                      .map((item, originalIndex) => ({ ...item, originalIndex }))
                      .filter(item => item.category === category);
                    if (items.length === 0) return null;
                    return (
                      <div key={category} style={{ marginBottom: 16 }}>
                        <div style={s.groceryCatLabel}>{category}</div>
                        {items.map(item => (
                          <div key={item.originalIndex} style={s.groceryRow}>
                            <button
                              style={{
                                ...s.checkBox,
                                ...(item.checked ? s.checkBoxChecked : {}),
                              }}
                              onClick={() => toggleGroceryItem(item.originalIndex)}
                              aria-label={item.checked ? "Uncheck" : "Check"}
                            >
                              {item.checked ? "✓" : ""}
                            </button>
                            <span style={{ ...s.groceryItem, ...(item.checked ? s.groceryItemDone : {}) }}>
                              {item.item}
                            </span>
                            <span style={s.groceryQty}>{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  <button
                    style={s.instacartBtn}
                    onClick={() => setInstacartMsg("Instacart integration coming soon — we're working on it!")}
                  >
                    🛒 Send to Instacart
                  </button>
                  {instacartMsg && (
                    <div style={{ fontSize: 12, color: t.textMuted, textAlign: "center", marginTop: 8, fontStyle: "italic" }}>
                      {instacartMsg}
                    </div>
                  )}
                </>
              )}
            </div>

          </>
        )}

      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  // ── Shared ──
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 20px 12px",
    borderBottom: `1px solid ${t.border}`,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(12px)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  logo: {
    fontFamily: t.fontDisplay,
    fontSize: 22,
    color: t.pink,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: t.bgSurface,
    border: `1px solid ${t.border}`,
    color: t.pink,
    fontSize: 22,
    cursor: "pointer",
    fontFamily: t.fontSans,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "opacity 0.15s",
  },
  sectionHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px 10px",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "1.2px",
    color: t.textMuted,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "64px 24px 40px",
    color: t.text,
  },
  planEmpty: {
    background: t.bgSurface,
    border: `1px solid ${t.border}`,
    borderRadius: t.r.lg,
    padding: "16px 20px",
    textAlign: "center",
  },
  // ── Recommendation cards ──
  hscroll: {
    display: "flex",
    overflowX: "auto",
    gap: 14,
    padding: "4px 20px 20px",
    scrollbarWidth: "none",
    WebkitOverflowScrolling: "touch",
  },
  recCard: {
    flexShrink: 0,
    width: 220,
    background: t.bgCard,
    border: `1px solid ${t.border}`,
    borderRadius: t.r.xxl,
    padding: "18px 16px 16px",
    display: "flex",
    flexDirection: "column",
    boxShadow: shadows.card,
  },
  recName: {
    fontFamily: t.fontDisplay,
    fontSize: 16,
    color: t.text,
    lineHeight: 1.25,
    marginBottom: 6,
  },
  giBadge: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 9px",
    borderRadius: t.r.pill,
    border: "1px solid",
    letterSpacing: "0.4px",
  },
  carbsText: {
    fontSize: 12,
    fontWeight: 600,
    color: t.greenDark,
    marginBottom: 8,
    marginTop: 6,
  },
  descText: {
    fontSize: 13,
    color: t.textSecondary,
    lineHeight: 1.5,
    marginBottom: 8,
    flex: 1,
  },
  whyText: {
    fontSize: 11,
    color: t.textMuted,
    lineHeight: 1.45,
    marginBottom: 14,
    fontStyle: "italic",
  },
  addBtn: {
    padding: "9px 0",
    borderRadius: t.r.md,
    background: t.pink,
    color: t.navy,
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: t.fontSans,
    width: "100%",
    letterSpacing: "0.2px",
    transition: "opacity 0.15s",
  },
  // ── Weekly grid ──
  weekNav: {
    width: 28,
    height: 28,
    padding: 0,
    borderRadius: "50%",
    background: t.bgSurface,
    border: `1px solid ${t.border}`,
    color: t.text,
    fontSize: 18,
    cursor: "pointer",
    fontFamily: t.fontSans,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
  dayPills: {
    display: "flex",
    gap: 6,
    paddingBottom: 12,
    overflowX: "auto",
    scrollbarWidth: "none",
    WebkitOverflowScrolling: "touch",
  },
  dayPill: {
    flex: "0 0 auto",
    minWidth: 44,
    padding: "8px 6px 6px",
    borderRadius: t.r.lg,
    border: `1px solid ${t.border}`,
    background: t.bgSurface,
    color: t.textMuted,
    cursor: "pointer",
    fontFamily: t.fontSans,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  dayPillToday: {
    borderColor: `rgba(255,93,168,0.4)`,
    color: t.pink,
    background: `rgba(255,93,168,0.08)`,
  },
  dayPillActive: {
    borderColor: `rgba(255,93,168,0.6)`,
    background: `rgba(255,93,168,0.15)`,
    color: t.pink,
  },
  dayExpanded: {
    background: t.bgCard,
    border: `1px solid ${t.border}`,
    borderRadius: t.r.xl,
    padding: "14px 16px",
    marginTop: 4,
    boxShadow: shadows.card,
  },
  dayMealRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: t.bgSurface,
    borderRadius: t.r.md,
    padding: "8px 10px",
  },
  removeBtnSm: {
    width: 22,
    height: 22,
    padding: 0,
    borderRadius: "50%",
    background: t.errBg,
    border: `1px solid ${t.errBorder}`,
    color: t.err,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: t.fontSans,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    lineHeight: 1,
  },
  addMealInput: {
    flex: 1,
    background: t.bgSurface,
    border: `1px solid ${t.border}`,
    borderRadius: t.r.md,
    padding: "8px 12px",
    color: t.text,
    fontSize: 13,
    fontFamily: t.fontSans,
    outline: "none",
  },
  saveMealBtn: {
    padding: "8px 14px",
    borderRadius: t.r.md,
    background: t.pink,
    color: t.navy,
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: t.fontSans,
  },
  cancelBtn: {
    width: 30,
    height: 30,
    padding: 0,
    borderRadius: "50%",
    background: t.bgSurface,
    border: `1px solid ${t.border}`,
    color: t.textMuted,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: t.fontSans,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  addMealDayBtn: {
    padding: "8px 14px",
    borderRadius: t.r.md,
    background: `rgba(255,93,168,0.08)`,
    border: `1px solid rgba(255,93,168,0.25)`,
    color: t.pink,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: t.fontSans,
  },

  // ── Grocery list ──
  generateBtn: {
    padding: "6px 14px",
    borderRadius: t.r.md,
    background: t.pink,
    color: t.navy,
    border: "none",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: t.fontSans,
    transition: "opacity 0.15s",
  },
  groceryCatLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    color: t.textMuted,
    marginBottom: 6,
    paddingTop: 4,
  },
  groceryRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
    borderBottom: `1px solid ${t.border}`,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: t.r.sm,
    border: `1.5px solid ${t.border}`,
    background: "transparent",
    color: t.green,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: t.fontSans,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkBoxChecked: {
    borderColor: t.green,
    background: t.okBg,
  },
  groceryItem: {
    flex: 1,
    fontSize: 14,
    color: t.text,
  },
  groceryItemDone: {
    textDecoration: "line-through",
    color: t.textMuted,
  },
  groceryQty: {
    fontSize: 12,
    color: t.textMuted,
    fontWeight: 600,
    flexShrink: 0,
  },
  instacartBtn: {
    width: "100%",
    padding: "12px 0",
    borderRadius: t.r.lg,
    background: t.bgSurface,
    border: `1px solid ${t.border}`,
    color: t.textSecondary,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: t.fontSans,
    marginTop: 16,
  },
};

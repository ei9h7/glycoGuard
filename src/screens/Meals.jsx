import { useState, useEffect, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useChild } from "../hooks/useChild";
import { usePatterns } from "../hooks/usePatterns";
import { usePreferenceNotes } from "../hooks/usePreferenceNotes";

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const MODEL = "openrouter/auto";

const GI_COLORS = {
  "Low":        "#22c55e",
  "Low-Medium": "#5fa882",
  "Medium":     "#f59e0b",
  "High":       "#ef4444",
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

async function generateRecommendations(child, patterns, preferenceChunks) {
  const topPatterns = (patterns || []).slice(0, 5);
  const topPrefs    = (preferenceChunks || []).slice(0, 5);

  const userPrompt = [
    "Child profile:",
    `- Name: ${child.name}`,
    `- Diagnosis: ${child.diagnosis || "Suspected hyperinsulinism / reactive hypoglycemia"}`,
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

  // Strip markdown fences if the model ignores the instruction
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    throw new Error("Not a non-empty array");
  } catch {
    return FALLBACK_RECOMMENDATIONS;
  }
}

export default function Meals() {
  const { child, childId }                     = useChild();
  const { patterns, loading: patternsLoading } = usePatterns();
  const { notes }                              = usePreferenceNotes();

  const [recs,        setRecs]        = useState([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [mealPlan,    setMealPlan]    = useState([]);
  const didGenerate = useRef(false);

  // Live listener on mealPlan/current
  useEffect(() => {
    if (!child || !childId) return;
    const userId = auth.currentUser.uid;
    const ref = doc(db, "users", userId, "children", childId, "mealPlan", "current");
    return onSnapshot(ref, snap => {
      setMealPlan(snap.exists() ? (snap.data().meals || []) : []);
    });
  }, [child, childId]);

  // Generate once after patterns + child are loaded
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
    const userId = auth.currentUser.uid;
    const ref    = doc(db, "users", userId, "children", childId, "mealPlan", "current");
    const entry  = {
      name: rec.name, emoji: rec.emoji,
      carbsEstimate: rec.carbsEstimate, gi: rec.gi,
      addedAt: new Date().toISOString(),
    };
    await setDoc(ref, { meals: [...mealPlan, entry] });
  };

  const removeFromPlan = async (index) => {
    if (!child || !childId) return;
    const userId = auth.currentUser.uid;
    const ref    = doc(db, "users", userId, "children", childId, "mealPlan", "current");
    await setDoc(ref, { meals: mealPlan.filter((_, i) => i !== index) });
  };

  const isInPlan = (name) => mealPlan.some(m => m.name === name);

  const hasNoPatterns = !patternsLoading && patterns.length === 0;

  return (
    <>
      <style>{`.recs-hscroll::-webkit-scrollbar { display: none; }`}</style>
      <div style={{ fontFamily: "'DM Sans',sans-serif", color: "#e8dcc8", paddingBottom: 32 }}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.logo}>Meal Suggestions</div>
            <div style={{ fontSize: 11, color: "#7a8fa6", marginTop: 2 }}>
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

          /* Empty state — no patterns generated yet */
          <div style={s.emptyState}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🥗</div>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: "#f59e0b", marginBottom: 10 }}>
              Building your insights
            </div>
            <div style={{ fontSize: 13, color: "#7a8fa6", lineHeight: 1.65, maxWidth: 290, textAlign: "center" }}>
              Log glucose readings, meals and symptoms for at least a week, then visit Patterns to generate insights — meal recommendations will personalise as your data grows.
            </div>
          </div>

        ) : recsLoading ? (

          /* Loading while generating */
          <div style={{ padding: "52px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🍽️</div>
            <div style={{ fontSize: 14, color: "#7a8fa6" }}>Generating recommendations…</div>
            <div style={{ fontSize: 12, color: "#5a6f85", marginTop: 6 }}>
              Analysing glucose patterns and preferences
            </div>
          </div>

        ) : (
          <>

            {/* Horizontal scrollable recommendation cards */}
            <div style={{ paddingTop: 16 }}>
              <div style={s.sectionHead}>
                <span style={s.sectionTitle}>Suggested meals & snacks</span>
                <span style={{ fontSize: 11, color: "#7a8fa6" }}>{recs.length} options</span>
              </div>
              <div className="recs-hscroll" style={s.hscroll}>
                {recs.map((rec, i) => (
                  <div key={i} style={s.recCard}>
                    <div style={{ fontSize: 44, textAlign: "center", marginBottom: 10 }}>{rec.emoji}</div>
                    <div style={{ marginBottom: 4 }}>
                      <div style={s.recName}>{rec.name}</div>
                      <span style={{
                        ...s.giBadge,
                        background:  (GI_COLORS[rec.gi] || "#7a8fa6") + "22",
                        borderColor: (GI_COLORS[rec.gi] || "#7a8fa6") + "55",
                        color:        GI_COLORS[rec.gi] || "#7a8fa6",
                      }}>
                        {rec.gi}
                      </span>
                    </div>
                    <div style={s.carbsText}>{rec.carbsEstimate} carbs</div>
                    <div style={s.descText}>{rec.description}</div>
                    <div style={s.whyText}>{rec.whyRecommended}</div>
                    <button
                      style={{ ...s.addBtn, ...(isInPlan(rec.name) ? s.addBtnAdded : {}) }}
                      onClick={() => !isInPlan(rec.name) && addToMealPlan(rec)}
                      disabled={isInPlan(rec.name)}
                    >
                      {isInPlan(rec.name) ? "✓ Added" : "Add to meal plan"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* This week's plan */}
            <div style={{ padding: "8px 16px 8px" }}>
              <div style={s.sectionHead}>
                <span style={s.sectionTitle}>This week's plan</span>
                <span style={{ fontSize: 11, color: "#7a8fa6" }}>
                  {mealPlan.length} meal{mealPlan.length !== 1 ? "s" : ""}
                </span>
              </div>

              {mealPlan.length === 0 ? (
                <div style={s.planEmpty}>
                  <div style={{ fontSize: 11, color: "#5a6f85", lineHeight: 1.55 }}>
                    Tap "Add to meal plan" on a suggestion to build your week.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {mealPlan.map((meal, i) => (
                    <div key={i} style={s.planRow}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{meal.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#e8dcc8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {meal.name}
                        </div>
                        <div style={{ fontSize: 11, color: "#7a8fa6", marginTop: 2 }}>
                          {meal.carbsEstimate} carbs ·{" "}
                          <span style={{ color: GI_COLORS[meal.gi] || "#7a8fa6" }}>GI: {meal.gi}</span>
                        </div>
                      </div>
                      <button
                        style={s.removeBtn}
                        onClick={() => removeFromPlan(i)}
                        aria-label="Remove from plan"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </>
        )}

      </div>
    </>
  );
}

const s = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 20px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,31,53,0.85)",
    backdropFilter: "blur(12px)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  logo: {
    fontFamily: "'DM Serif Display',serif",
    fontSize: 22,
    color: "#f59e0b",
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "rgba(30,54,84,0.7)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#f59e0b",
    fontSize: 22,
    cursor: "pointer",
    fontFamily: "'DM Sans',sans-serif",
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
    color: "#7a8fa6",
  },
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
    background: "rgba(30,54,84,0.7)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: "18px 16px 16px",
    display: "flex",
    flexDirection: "column",
  },
  recName: {
    fontFamily: "'DM Serif Display',serif",
    fontSize: 16,
    color: "#e8dcc8",
    lineHeight: 1.25,
    marginBottom: 6,
  },
  giBadge: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 9px",
    borderRadius: 20,
    border: "1px solid",
    letterSpacing: "0.4px",
  },
  carbsText: {
    fontSize: 12,
    fontWeight: 600,
    color: "#7ec8a4",
    marginBottom: 8,
    marginTop: 6,
  },
  descText: {
    fontSize: 13,
    color: "#e8dcc8",
    lineHeight: 1.5,
    marginBottom: 8,
    flex: 1,
  },
  whyText: {
    fontSize: 11,
    color: "#7a8fa6",
    lineHeight: 1.45,
    marginBottom: 14,
    fontStyle: "italic",
  },
  addBtn: {
    padding: "9px 0",
    borderRadius: 10,
    background: "#f59e0b",
    color: "#0f1f35",
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans',sans-serif",
    width: "100%",
    letterSpacing: "0.2px",
    transition: "opacity 0.15s",
  },
  addBtnAdded: {
    background: "rgba(34,197,94,0.18)",
    color: "#22c55e",
    cursor: "default",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "64px 24px 40px",
    color: "#e8dcc8",
  },
  planEmpty: {
    background: "rgba(30,54,84,0.4)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: "16px 20px",
    textAlign: "center",
  },
  planRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "rgba(30,54,84,0.7)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "12px 14px",
  },
  removeBtn: {
    width: 28,
    height: 28,
    padding: 0,
    borderRadius: "50%",
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.25)",
    color: "#ef4444",
    fontSize: 18,
    cursor: "pointer",
    fontFamily: "'DM Sans',sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    lineHeight: 1,
  },
};

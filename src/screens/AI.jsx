import { useState, useEffect, useRef } from "react";
import {
  collection, query, orderBy, limit, where, getDocs, Timestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { useChild } from "../hooks/useChild";
import { searchVectors } from "../services/vectorStore";

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-20250514";

// ── Pure helpers ──────────────────────────────────────────────────────────────

function fmtTs(ts) {
  if (!ts) return "unknown";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function alertLevel(lastMeal, intervalMin) {
  if (!lastMeal?.timestamp) return "unknown";
  const elapsed = (Date.now() - lastMeal.timestamp.toDate().getTime()) / 60000;
  if (elapsed >= intervalMin) return "overdue";
  if (elapsed >= intervalMin * 0.75) return "approaching";
  return "on track";
}

function suggestions(level, child) {
  const name = child?.name || "them";
  if (level === "overdue") return [
    `What should I give ${name} right now?`,
    "What symptoms should I be watching for?",
    "When should I call emergency services?",
  ];
  if (level === "approaching") return [
    `What should I prepare for ${name}'s next snack?`,
    "What are good low-GI options to prevent a drop?",
    "How can I slow glucose absorption at this meal?",
  ];
  return [
    `Explain ${name}'s diagnosis in practical terms.`,
    "What patterns should I look for in the glucose data?",
    "What questions should I ask the endocrinologist?",
  ];
}

// ── Firestore + Pinecone context assembly ─────────────────────────────────────

async function assembleContext(child, childId, queryText) {
  const userId    = auth.currentUser.uid;
  const interval  = child.mealIntervalMinutes || 120;
  const targetMin = child.glucoseTargetMin    || 4.0;
  const targetMax = child.glucoseTargetMax    || 6.5;

  // Live data — most recent meal + glucose
  const [mealSnap, glucSnap] = await Promise.all([
    getDocs(query(
      collection(db, "users", userId, "children", childId, "mealLogs"),
      orderBy("timestamp", "desc"), limit(1)
    )),
    getDocs(query(
      collection(db, "users", userId, "children", childId, "glucoseReadings"),
      orderBy("timestamp", "desc"), limit(1)
    )),
  ]);

  const lastMeal = mealSnap.empty ? null : { id: mealSnap.docs[0].id, ...mealSnap.docs[0].data() };
  const rawGluc  = glucSnap.empty  ? null : { id: glucSnap.docs[0].id,  ...glucSnap.docs[0].data()  };

  const glucAge    = rawGluc?.timestamp
    ? Date.now() - rawGluc.timestamp.toDate().getTime() : Infinity;
  const recentGluc = glucAge < 15 * 60 * 1000 ? rawGluc : null;

  const minSinceMeal = lastMeal?.timestamp
    ? Math.floor((Date.now() - lastMeal.timestamp.toDate().getTime()) / 60000)
    : null;
  const level = alertLevel(lastMeal, interval);

  // 14-day history
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const [histGlucSnap, histMealSnap, histSympSnap] = await Promise.all([
    getDocs(query(
      collection(db, "users", userId, "children", childId, "glucoseReadings"),
      where("timestamp", ">=", Timestamp.fromDate(cutoff)),
      orderBy("timestamp", "desc")
    )),
    getDocs(query(
      collection(db, "users", userId, "children", childId, "mealLogs"),
      orderBy("timestamp", "desc"), limit(10)
    )),
    getDocs(query(
      collection(db, "users", userId, "children", childId, "symptomEvents"),
      orderBy("timestamp", "desc"), limit(10)
    )),
  ]);

  const readings   = histGlucSnap.docs.map(d => d.data());
  const vals       = readings.map(r => r.value).filter(Boolean);
  const inRange    = vals.filter(v => v >= targetMin && v <= targetMax).length;
  const glucStats  = vals.length > 0 ? {
    count: vals.length,
    avg:   (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
    high:  Math.max(...vals).toFixed(1),
    low:   Math.min(...vals).toFixed(1),
    tir:   Math.round((inRange / vals.length) * 100),
  } : null;

  const recentMeals = histMealSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const recentSymps = histSympSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Pinecone context — non-fatal
  let pineconeChunks = [];
  try {
    const hits = await searchVectors({ query: queryText, childId, topK: 5, userId });
    pineconeChunks = hits.map(h => h.content);
  } catch (e) {
    console.warn("Pinecone search skipped:", e.message);
  }

  const system = [
    "You are a knowledgeable and compassionate AI assistant for GlycoGuard, helping a caregiver manage their child's hypoglycemia and suspected congenital hyperinsulinism. Provide practical, evidence-based guidance. All glucose values are in mmol/L. Be warm, clear, and direct. Never suggest delaying emergency care when symptoms warrant it.",
    "",
    "LIVE STATE:",
    `- Minutes since last meal: ${minSinceMeal !== null ? minSinceMeal : "No meal logged"}`,
    `- Alert level: ${level}`,
    `- Last meal: ${lastMeal ? `"${lastMeal.descriptionText || "Meal"}" at ${fmtTs(lastMeal.timestamp)}` : "None logged"}`,
    `- Current glucose (within 15 min): ${recentGluc ? `${recentGluc.value} mmol/L via ${recentGluc.source || "manual"} at ${fmtTs(recentGluc.timestamp)}` : "No reading within the last 15 minutes"}`,
    "",
    "CHILD PROFILE:",
    `- Name: ${child.name}`,
    `- Date of birth: ${child.dob || "Not specified"}`,
    `- Diagnosis: ${child.diagnosis || "Suspected hyperinsulinism / reactive hypoglycemia"}`,
    `- Glucose target range: ${targetMin}–${targetMax} mmol/L`,
    `- Meal interval: every ${interval} minutes`,
    `- CGM device: ${child.cgmDevice || "Not specified"}`,
    "",
    "RECENT HISTORY (last 14 days):",
    glucStats
      ? `Glucose — ${glucStats.count} readings: avg ${glucStats.avg} mmol/L, high ${glucStats.high} mmol/L, low ${glucStats.low} mmol/L\nTime in range (${targetMin}–${targetMax} mmol/L): ${glucStats.tir}%`
      : "Glucose — no readings in the last 14 days",
    "",
    "Last 10 meals:",
    recentMeals.length > 0
      ? recentMeals.map(m =>
          `- ${fmtTs(m.timestamp)}: ${m.descriptionText || "Meal"}${m.carbsEstimate ? ` (~${m.carbsEstimate}g carbs)` : ""}`
        ).join("\n")
      : "- None logged",
    "",
    "Last 10 symptom events:",
    recentSymps.length > 0
      ? recentSymps.map(s => {
          const syms = (s.quickTapSymptoms || []).join(", ");
          const obs  = s.observationText || "";
          return `- ${fmtTs(s.timestamp)}: ${[syms, obs].filter(Boolean).join(" — ")}`;
        }).join("\n")
      : "- None logged",
    "",
    "KNOWLEDGE BASE (relevant document chunks):",
    pineconeChunks.length > 0
      ? pineconeChunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")
      : "No relevant documents found.",
  ].join("\n");

  return { system, lastMeal, recentGluc, level, minSinceMeal };
}

// ── Anthropic API call ────────────────────────────────────────────────────────

async function callClaude(system, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "x-api-key":     ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1000, system, messages }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.content[0].text;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AI() {
  const { child, childId } = useChild();

  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState("");
  const [typing,      setTyping]      = useState(false);
  const [openingDone, setOpeningDone] = useState(false);
  const [quickSugs,   setQuickSugs]   = useState([]);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Generate opening message once child data is ready
  useEffect(() => {
    if (!child || !childId || openingDone) return;
    setOpeningDone(true);
    setTyping(true);

    const initQuery = `${child.name} ${child.diagnosis || "hypoglycemia"} current status`;

    assembleContext(child, childId, initQuery)
      .then(async ({ system, level }) => {
        setQuickSugs(suggestions(level, child));
        const text = await callClaude(system, [{
          role: "user",
          content: "Generate a brief 2-3 sentence situational overview of the child's current state based on the live data, then ask how you can help. Be warm and practical. Do not use bullet points.",
        }]);
        setMessages([{ role: "assistant", content: text }]);
      })
      .catch(err => {
        console.error("Opening message failed:", err);
        setMessages([{
          role: "assistant",
          content: `Hi! I'm your GlycoGuard assistant. I'm here to help you manage ${child?.name || "your child"}'s care. What would you like to know?`,
        }]);
        setQuickSugs(suggestions("unknown", child));
      })
      .finally(() => setTyping(false));
  }, [child, childId, openingDone]);

  const hasUserMessages = messages.some(m => m.role === "user");

  const send = async (text = input.trim()) => {
    if (!text || typing || !child || !childId) return;
    setInput("");

    const userMsg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setTyping(true);

    try {
      const { system } = await assembleContext(child, childId, text);
      const reply = await callClaude(system, history);
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("Send failed:", err);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      }]);
    } finally {
      setTyping(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  if (!child) {
    return (
      <div style={{ padding: 24, color: "#7a8fa6", fontFamily: "'DM Sans', sans-serif" }}>
        Loading…
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        .ai-sug-btn:hover { background: rgba(245,158,11,0.12) !important; }
        .ai-send-btn:active { transform: scale(0.93); }
      `}</style>

      <div style={s.root}>

        {/* ── Header ── */}
        <div style={s.header}>
          <div>
            <div style={s.headerTitle}>AI Assistant</div>
            <div style={s.headerSub}>Powered by Claude · live context</div>
          </div>
          <div style={s.childPill}>
            <div style={s.avatar}>{child.name?.[0] || "?"}</div>
            <span style={s.childName}>{child.name}</span>
          </div>
        </div>

        {/* ── Messages ── */}
        <div style={s.feed}>

          {messages.map((msg, i) => (
            <div key={i} style={msg.role === "user" ? s.rowUser : s.rowBot}>
              {msg.role === "assistant" && <div style={s.botAvatar}>G</div>}
              <div style={msg.role === "user" ? s.bubbleUser : s.bubbleBot}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {typing && (
            <div style={s.rowBot}>
              <div style={s.botAvatar}>G</div>
              <div style={s.bubbleBot}>
                <div style={s.dots}>
                  <span style={{ ...s.dot, animationDelay: "0ms" }} />
                  <span style={{ ...s.dot, animationDelay: "160ms" }} />
                  <span style={{ ...s.dot, animationDelay: "320ms" }} />
                </div>
              </div>
            </div>
          )}

          {/* Quick suggestions — visible only before first user message */}
          {!hasUserMessages && !typing && quickSugs.length > 0 && (
            <div style={s.sugWrap}>
              <div style={s.sugLabel}>Suggested questions</div>
              {quickSugs.map((sug, i) => (
                <button
                  key={i}
                  className="ai-sug-btn"
                  style={s.sugBtn}
                  onClick={() => send(sug)}
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar — fixed above nav ── */}
        <div style={s.inputBar}>
          <textarea
            style={s.textarea}
            placeholder="Ask anything about symptoms, food, glucose trends…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            disabled={typing}
          />
          <button
            className="ai-send-btn"
            style={{ ...s.sendBtn, opacity: !input.trim() || typing ? 0.35 : 1 }}
            onClick={() => send()}
            disabled={!input.trim() || typing}
            aria-label="Send"
          >
            ↑
          </button>
        </div>

      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  root: {
    fontFamily: "'DM Sans', sans-serif",
    color: "#e8dcc8",
    // Extra bottom padding: input bar (~72px) sits above nav (80px already in AppShell)
    paddingBottom: 76,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,31,53,0.92)",
    backdropFilter: "blur(12px)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerTitle: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 20,
    color: "#f59e0b",
    letterSpacing: "-0.3px",
  },
  headerSub: { fontSize: 11, color: "#7a8fa6", marginTop: 2 },
  childPill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#1e3654",
    borderRadius: 20,
    padding: "6px 12px 6px 8px",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "linear-gradient(135deg,#5fa882,#f59e0b)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
    color: "#0f1f35",
  },
  childName: { fontSize: 13, fontWeight: 500, color: "#e8dcc8" },

  feed: {
    padding: "16px 16px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  rowUser: { display: "flex", justifyContent: "flex-end" },
  rowBot:  { display: "flex", alignItems: "flex-start", gap: 10 },

  botAvatar: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "linear-gradient(135deg,#f59e0b,#5fa882)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    color: "#0f1f35",
    flexShrink: 0,
    marginTop: 2,
  },

  bubbleUser: {
    background: "#f59e0b",
    color: "#0f1f35",
    padding: "10px 14px",
    borderRadius: "18px 18px 4px 18px",
    maxWidth: "82%",
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 500,
    whiteSpace: "pre-wrap",
  },
  bubbleBot: {
    background: "rgba(30,54,84,0.85)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#e8dcc8",
    padding: "12px 14px",
    borderRadius: "4px 18px 18px 18px",
    maxWidth: "86%",
    fontSize: 14,
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
  },

  dots: { display: "flex", alignItems: "center", height: 22, gap: 4 },
  dot: {
    display: "inline-block",
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#7a8fa6",
    animation: "bounce 1.2s infinite",
  },

  sugWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 4,
  },
  sugLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "1.2px",
    color: "#7a8fa6",
    paddingLeft: 2,
    marginBottom: 2,
  },
  sugBtn: {
    background: "rgba(30,54,84,0.7)",
    border: "1px solid rgba(245,158,11,0.22)",
    color: "#f59e0b",
    padding: "11px 14px",
    borderRadius: 14,
    fontSize: 13,
    lineHeight: 1.45,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "'DM Sans', sans-serif",
    transition: "background 0.15s",
  },

  // Fixed above the 80px nav bar
  inputBar: {
    position: "fixed",
    bottom: 80,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 430,
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    padding: "10px 14px",
    background: "rgba(15,31,53,0.97)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(16px)",
    zIndex: 15,
    boxSizing: "border-box",
  },
  textarea: {
    flex: 1,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: "10px 14px",
    color: "#e8dcc8",
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
    resize: "none",
    lineHeight: 1.5,
    minHeight: 42,
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "#f59e0b",
    color: "#0f1f35",
    border: "none",
    fontSize: 20,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontFamily: "'DM Sans', sans-serif",
    transition: "opacity 0.15s, transform 0.1s",
  },
};

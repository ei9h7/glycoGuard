import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useChild } from "../hooks/useChild";

const PERIODS = [
  { label: "24h", days: 1  },
  { label: "7d",  days: 7  },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
];

function fmtTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function StatsStrip({ meals }) {
  if (meals.length === 0) return null;

  const withCarbs = meals.filter(m => m.carbsEstimate > 0);
  const avgCarbs = withCarbs.length > 0
    ? Math.round(withCarbs.reduce((a, m) => a + m.carbsEstimate, 0) / withCarbs.length)
    : null;

  // Average interval between meals in this period
  const sorted = [...meals].sort((a, b) => {
    const at = a.timestamp?.toDate?.()?.getTime() || 0;
    const bt = b.timestamp?.toDate?.()?.getTime() || 0;
    return at - bt;
  });
  let avgInterval = null;
  if (sorted.length >= 2) {
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i-1].timestamp?.toDate?.()?.getTime() || 0;
      const curr = sorted[i].timestamp?.toDate?.()?.getTime() || 0;
      const gapMin = (curr - prev) / 60000;
      if (gapMin < 360) gaps.push(gapMin); // ignore gaps > 6h (overnight)
    }
    if (gaps.length > 0) avgInterval = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }

  return (
    <div style={s.statsStrip}>
      {[
        ["Total",        String(meals.length),                     "#f59e0b", "meals logged"],
        ["Avg carbs",    avgCarbs != null ? `${avgCarbs}g` : "—",  "#7ec8a4", withCarbs.length > 0 ? `from ${withCarbs.length} logs` : "none logged"],
        ["Avg interval", avgInterval != null ? `${avgInterval}m` : "—", "#5fa882", avgInterval != null ? "between meals" : "need 2+ meals"],
      ].map(([label, value, color, sub]) => (
        <div key={label} style={s.statItem}>
          <div style={{ fontSize: 10, color: "#7a8fa6", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</div>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 10, color: "#7a8fa6", marginTop: 2 }}>{sub}</div>
        </div>
      ))}
    </div>
  );
}

export default function Meals() {
  const { child, childId } = useChild();
  const [allMeals, setAllMeals] = useState([]);
  const [period,   setPeriod]   = useState(1);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!child || !childId) return;
    const userId = auth.currentUser.uid;
    const q = query(
      collection(db, "users", userId, "children", childId, "mealLogs"),
      orderBy("timestamp", "desc")
    );
    return onSnapshot(q, snap => {
      setAllMeals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [child, childId]);

  const cutoff = Date.now() - period * 24 * 60 * 60 * 1000;
  const filtered = allMeals.filter(m => {
    const t = m.timestamp?.toDate?.()?.getTime() || 0;
    return t >= cutoff;
  });

  const grouped = filtered.reduce((acc, m) => {
    const label = fmtDate(m.timestamp);
    if (!acc[label]) acc[label] = [];
    acc[label].push(m);
    return acc;
  }, {});

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: "#e8dcc8" }}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.logo}>Meal History</div>
        <div style={{ fontSize: 11, color: "#7a8fa6" }}>
          {allMeals.length} total logged
        </div>
      </div>

      {/* Period selector */}
      <div style={s.periodRow}>
        {PERIODS.map(p => (
          <button key={p.days}
            style={{ ...s.periodBtn, ...(period === p.days ? s.periodBtnActive : {}) }}
            onClick={() => setPeriod(p.days)}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#7a8fa6", fontSize: 13 }}>
          Loading meals…
        </div>
      ) : allMeals.length === 0 ? (
        <div style={s.emptyState}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No meals logged yet</div>
          <div style={{ fontSize: 13, color: "#7a8fa6" }}>Log a meal from the Home screen to get started.</div>
        </div>
      ) : (
        <>
          <StatsStrip meals={filtered} />

          <div style={s.sectionHead}>
            <span style={s.sectionTitle}>Meals</span>
            <span style={{ fontSize: 11, color: "#7a8fa6" }}>{filtered.length} in period</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: "20px 16px", fontSize: 13, color: "#7a8fa6", textAlign: "center" }}>
              No meals in this period.
            </div>
          ) : (
            <div style={{ padding: "0 16px 20px" }}>
              {Object.entries(grouped).map(([dateLabel, meals]) => (
                <div key={dateLabel} style={{ marginBottom: 20 }}>
                  <div style={s.dateLabel}>{dateLabel}</div>
                  {meals.map(m => (
                    <div key={m.id} style={s.mealRow}>
                      <div style={s.mealDot} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#e8dcc8" }}>
                            {m.descriptionText || "Meal"}
                          </span>
                          {m.carbsEstimate > 0 && (
                            <span style={s.carbBadge}>{m.carbsEstimate}g carbs</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#7a8fa6", marginTop: 3 }}>
                          {fmtTime(m.timestamp)}
                          {m.notes && ` · ${m.notes}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const s = {
  header:         { padding: "20px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(15,31,53,0.85)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 },
  logo:           { fontFamily: "'DM Serif Display',serif", fontSize: 22, color: "#f59e0b", marginBottom: 2 },
  periodRow:      { display: "flex", gap: 8, padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  periodBtn:      { flex: 1, padding: "7px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(30,54,84,0.7)", color: "#7a8fa6", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
  periodBtnActive:{ background: "rgba(245,158,11,0.15)", borderColor: "rgba(245,158,11,0.4)", color: "#f59e0b" },
  statsStrip:     { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, margin: "12px 16px 0", background: "rgba(30,54,84,0.7)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" },
  statItem:       { padding: "12px 8px", textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.06)" },
  sectionHead:    { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 10px" },
  sectionTitle:   { fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1.2px", color: "#7a8fa6" },
  dateLabel:      { fontSize: 12, fontWeight: 600, color: "#7a8fa6", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" },
  mealRow:        { display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  mealDot:        { width: 10, height: 10, borderRadius: "50%", background: "rgba(95,168,130,0.8)", border: "2px solid #5fa882", flexShrink: 0, marginTop: 4 },
  carbBadge:      { fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(126,200,164,0.15)", border: "1px solid rgba(126,200,164,0.3)", color: "#7ec8a4" },
  emptyState:     { textAlign: "center", padding: "60px 24px", color: "#e8dcc8" },
};

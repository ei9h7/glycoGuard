import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChild } from "../hooks/useChild";
import { usePatterns } from "../hooks/usePatterns";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: "glucose", label: "Glucose Patterns" },
  { key: "meal",    label: "Meal Correlations" },
  { key: "symptom", label: "Symptom Patterns"  },
];

function confidenceMeta(dataPoints) {
  if (dataPoints < 5)  return { label: "Low",    color: "#f59e0b", bg: "rgba(245,158,11,0.13)"  };
  if (dataPoints < 15) return { label: "Medium",  color: "#7ec8a4", bg: "rgba(126,200,164,0.13)" };
  return                      { label: "High",    color: "#22c55e", bg: "rgba(34,197,94,0.13)"   };
}

function fmtLastUpdated(date) {
  if (!date) return null;
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1)  return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24)       return `${h}h ago`;
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Reports() {
  const { child }    = useChild();
  const navigate     = useNavigate();
  const { patterns, lastUpdated, loading, refreshing, refresh } = usePatterns();

  const [reportMsg, setReportMsg] = useState(false);

  const handleAskAI = (pattern) => {
    navigate("/ai", {
      state: {
        prefillMessage:
          `I'd like to understand a pattern GlycoGuard detected for ${child?.name || "my child"}:\n\n` +
          `${pattern.title}\n${pattern.description}\n\n` +
          `Can you explain what this means practically and what I should do about it?`,
      },
    });
  };

  const grouped = SECTIONS.reduce((acc, sec) => {
    acc[sec.key] = patterns.filter(p => p.category === sec.key);
    return acc;
  }, {});

  const hasAny = patterns.length > 0;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .pat-card  { transition: border-color 0.15s; }
        .pat-card:hover { border-color: rgba(255,255,255,0.18) !important; }
        .pat-ask:hover  { background: rgba(245,158,11,0.2) !important; }
        .pat-refresh:hover:not(:disabled) { opacity: 0.82; }
        .pat-report:hover { border-color: rgba(255,255,255,0.18) !important; }
      `}</style>

      <div style={s.root}>

        {/* ── Header ── */}
        <div style={s.header}>
          <div>
            <div style={s.headerTitle}>Patterns</div>
            <div style={s.headerSub}>
              {loading
                ? "Analysing…"
                : lastUpdated
                  ? `Updated ${fmtLastUpdated(lastUpdated)}`
                  : "No analysis yet"}
            </div>
          </div>
          <button
            className="pat-refresh"
            style={{ ...s.refreshBtn, opacity: (refreshing || loading) ? 0.5 : 1 }}
            onClick={refresh}
            disabled={refreshing || loading}
          >
            <span style={{
              display: "inline-block",
              animation: refreshing ? "spin 0.9s linear infinite" : "none",
            }}>↻</span>
            {" "}{refreshing ? "Analysing…" : "Refresh"}
          </button>
        </div>

        <div style={s.body}>

          {/* ── Loading skeleton ── */}
          {loading && (
            <div style={s.empty}>
              <div style={s.emptyIcon}>⏳</div>
              <div style={s.emptyMuted}>Loading patterns…</div>
            </div>
          )}

          {/* ── Empty state ── */}
          {!loading && !hasAny && (
            <div style={s.empty}>
              <div style={s.emptyIcon}>🧩</div>
              <div style={s.emptyTitle}>No patterns yet</div>
              <div style={s.emptyMuted}>
                Patterns are generated from logged glucose readings, meals, and symptoms.
                Log at least a week of data, then tap Refresh to generate your first insights.
              </div>
              <button
                style={{ ...s.refreshBtn, marginTop: 8 }}
                onClick={refresh}
                disabled={refreshing}
              >
                {refreshing ? "Analysing…" : "Generate Patterns"}
              </button>
            </div>
          )}

          {/* ── Pattern sections ── */}
          {!loading && hasAny && SECTIONS.map(sec => {
            const group = grouped[sec.key];
            if (!group || group.length === 0) return null;
            return (
              <div key={sec.key} style={s.section}>
                <div style={s.sectionLabel}>{sec.label}</div>
                {group.map((pattern, i) => {
                  const conf = confidenceMeta(pattern.dataPoints);
                  return (
                    <div key={i} className="pat-card" style={s.card}>

                      <div style={s.cardTop}>
                        <div style={s.cardTitle}>{pattern.title}</div>
                        <div style={{ ...s.confBadge, color: conf.color, background: conf.bg }}>
                          {conf.label}
                        </div>
                      </div>

                      <div style={s.cardDesc}>{pattern.description}</div>

                      <div style={s.cardFoot}>
                        <span style={s.dataPoints}>
                          {pattern.dataPoints} data point{pattern.dataPoints !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <button
                        className="pat-ask"
                        style={s.askBtn}
                        onClick={() => handleAskAI(pattern)}
                      >
                        ✨ Ask AI about this
                      </button>

                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* ── Medical report placeholder ── */}
          {!loading && hasAny && (
            <div style={s.reportWrap}>
              <button
                className="pat-report"
                style={s.reportBtn}
                onClick={() => setReportMsg(true)}
              >
                📋 Create report for medical team
              </button>
              {reportMsg && (
                <div style={s.reportMsg}>
                  Medical report export is coming in Phase 3. It will generate a formatted PDF you can share directly with your endocrinologist.
                </div>
              )}
            </div>
          )}

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
    paddingBottom: 32,
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
  refreshBtn: {
    background: "#f59e0b",
    color: "#0f1f35",
    border: "none",
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    transition: "opacity 0.15s",
    whiteSpace: "nowrap",
  },

  body: {
    padding: "20px 16px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 28,
  },

  // Empty / loading
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "48px 24px",
    gap: 12,
    textAlign: "center",
  },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 20,
    color: "#e8dcc8",
  },
  emptyMuted: {
    fontSize: 14,
    color: "#7a8fa6",
    lineHeight: 1.65,
    maxWidth: 280,
  },

  // Section
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "1.2px",
    color: "#7a8fa6",
    marginBottom: 2,
  },

  // Pattern card
  card: {
    background: "rgba(30,54,84,0.7)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#e8dcc8",
    flex: 1,
    lineHeight: 1.3,
  },
  confBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 9px",
    borderRadius: 20,
    flexShrink: 0,
    letterSpacing: "0.3px",
  },
  cardDesc: {
    fontSize: 13,
    color: "#b8cce0",
    lineHeight: 1.65,
    marginBottom: 10,
  },
  cardFoot: {
    marginBottom: 10,
  },
  dataPoints: {
    fontSize: 11,
    color: "#7a8fa6",
  },
  askBtn: {
    background: "rgba(245,158,11,0.1)",
    border: "1px solid rgba(245,158,11,0.25)",
    color: "#f59e0b",
    padding: "9px 14px",
    borderRadius: 10,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    width: "100%",
    textAlign: "center",
    transition: "background 0.15s",
  },

  // Report section
  reportWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    paddingBottom: 8,
  },
  reportBtn: {
    background: "rgba(30,54,84,0.5)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#7a8fa6",
    padding: "14px",
    borderRadius: 14,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    width: "100%",
    textAlign: "center",
    transition: "border-color 0.15s",
  },
  reportMsg: {
    background: "rgba(15,31,53,0.5)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 13,
    color: "#7a8fa6",
    lineHeight: 1.65,
  },
};

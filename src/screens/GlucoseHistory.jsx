import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useChild } from "../hooks/useChild";
import { useUnits } from "../hooks/useUnits";
import { t, shadows } from "../styles/tokens";

const PERIODS = [
  { label: "24h",  days: 1  },
  { label: "7d",   days: 7  },
  { label: "14d",  days: 14 },
  { label: "30d",  days: 30 },
];

function fmtTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday:"short", month:"short", day:"numeric" });
}

function getColor(value, min, max) {
  if (value < 3.5)  return t.err;
  if (value < min)  return t.warn;
  if (value <= max) return t.green;
  return t.warn;
}

function getStatus(value, min, max) {
  if (value < 3.5)  return "Low";
  if (value < min)  return "Below target";
  if (value <= max) return "In range";
  return "Above target";
}

// ── Mini sparkline chart ──────────────────────────────────────────────────────
function GlucoseChart({ readings, min, max, fmt }) {
  if (readings.length < 2) return (
    <div style={{ height:140, display:"flex", alignItems:"center", justifyContent:"center", color:t.textMuted, fontSize:13 }}>
      Not enough data to display chart — log more readings.
    </div>
  );

  const W = 360, H = 120, PAD = { top:10, bottom:20, left:32, right:12 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const values = readings.map(r => r.value);
  const times  = readings.map(r => {
    const d = r.timestamp?.toDate ? r.timestamp.toDate() : new Date(r.timestamp);
    return d.getTime();
  });

  const minV = Math.min(2.0, ...values);
  const maxV = Math.max(10.0, ...values);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);

  const xScale = (tv) => PAD.left + ((tv - minT) / (maxT - minT || 1)) * plotW;
  const yScale = (v)  => PAD.top  + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;

  const bandTop    = yScale(max);
  const bandBottom = yScale(min);
  const bandHeight = bandBottom - bandTop;

  const sorted = [...readings].sort((a,b) => {
    const at = a.timestamp?.toDate?.()?.getTime() || 0;
    const bt = b.timestamp?.toDate?.()?.getTime() || 0;
    return at - bt;
  });

  const points  = sorted.map(r => {
    const tv = r.timestamp?.toDate ? r.timestamp.toDate().getTime() : new Date(r.timestamp).getTime();
    return `${xScale(tv)},${yScale(r.value)}`;
  });
  const linePath = `M ${points.join(" L ")}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible" }}>
      {/* Target band */}
      <rect
        x={PAD.left} y={bandTop}
        width={plotW} height={bandHeight}
        fill={`rgba(0,214,143,0.08)`}
        stroke={`rgba(0,214,143,0.25)`}
        strokeWidth={0.5}
      />
      <text x={PAD.left - 4} y={bandTop + 4}   fontSize="8" fill={t.green} textAnchor="end">{fmt(max)}</text>
      <text x={PAD.left - 4} y={bandBottom + 1} fontSize="8" fill={t.green} textAnchor="end">{fmt(min)}</text>

      {/* Grid lines */}
      {[3.5, 5.0, 7.0, 10.0].map(v => (
        <line key={v}
          x1={PAD.left} y1={yScale(v)}
          x2={PAD.left + plotW} y2={yScale(v)}
          stroke={t.border} strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}

      {/* Line */}
      <path d={linePath} fill="none" stroke={`rgba(255,93,168,0.55)`} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>

      {/* Dots */}
      {sorted.map((r, i) => {
        const tv = r.timestamp?.toDate ? r.timestamp.toDate().getTime() : new Date(r.timestamp).getTime();
        return (
          <g key={r.id || i}>
            <circle cx={xScale(tv)} cy={yScale(r.value)} r={4} fill={getColor(r.value, min, max)} stroke={t.bgCard} strokeWidth={1.5}/>
          </g>
        );
      })}

      {/* X axis labels */}
      {sorted.length > 0 && <>
        <text x={PAD.left}         y={H - 4} fontSize="8" fill={t.textMuted} textAnchor="start">{fmtTime(sorted[0].timestamp)}</text>
        <text x={PAD.left + plotW} y={H - 4} fontSize="8" fill={t.textMuted} textAnchor="end">{fmtTime(sorted[sorted.length-1].timestamp)}</text>
      </>}
    </svg>
  );
}

// ── Stats strip ───────────────────────────────────────────────────────────────
function StatsStrip({ readings, min, max, fmt, displayUnit }) {
  if (readings.length === 0) return null;

  const values  = readings.map(r => r.value);
  const avg     = values.reduce((a,b) => a + b, 0) / values.length;
  const highest = Math.max(...values);
  const lowest  = Math.min(...values);
  const inRange = values.filter(v => v >= min && v <= max).length;
  const tir     = Math.round((inRange / values.length) * 100);
  const tirColor = tir >= 70 ? t.green : tir >= 50 ? t.warn : t.err;

  return (
    <div style={s.statsStrip}>
      {[
        ["Avg",           fmt(avg),       t.pink,                         displayUnit],
        ["Time in range", `${tir}%`,      tirColor,                       `${inRange}/${values.length} readings`],
        ["High",          fmt(highest),   getColor(highest, min, max),    displayUnit],
        ["Low",           fmt(lowest),    getColor(lowest, min, max),     displayUnit],
      ].map(([label, value, color, sub]) => (
        <div key={label} style={s.statItem}>
          <div style={{ fontSize:10, color:t.textMuted, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.6px" }}>{label}</div>
          <div style={{ fontFamily:t.fontDisplay, fontSize:20, color, lineHeight:1 }}>{value}</div>
          <div style={{ fontSize:10, color:t.textMuted, marginTop:2 }}>{sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function GlucoseHistory() {
  const { child, childId } = useChild();
  const { fmt, displayUnit } = useUnits();
  const [allReadings, setAllReadings] = useState([]);
  const [period,      setPeriod]      = useState(1);
  const [loading,     setLoading]     = useState(true);

  const glucoseMin = child?.glucoseTargetMin || 4.0;
  const glucoseMax = child?.glucoseTargetMax || 6.5;

  useEffect(() => {
    if (!child || !childId) return;
    const userId = auth.currentUser.uid;
    const q = query(
      collection(db, "users", userId, "children", childId, "glucoseReadings"),
      orderBy("timestamp", "desc")
    );
    return onSnapshot(q, snap => {
      setAllReadings(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      setLoading(false);
    });
  }, [child, childId]);

  const cutoff  = Date.now() - period * 24 * 60 * 60 * 1000;
  const filtered = allReadings.filter(r => {
    const tv = r.timestamp?.toDate?.()?.getTime() || 0;
    return tv >= cutoff;
  });

  const grouped = filtered.reduce((acc, r) => {
    const label = fmtDate(r.timestamp);
    if (!acc[label]) acc[label] = [];
    acc[label].push(r);
    return acc;
  }, {});

  return (
    <div style={{ fontFamily:t.fontSans, color:t.text }}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.logo}>Glucose History</div>
        <div style={{ fontSize:11, color:t.textMuted }}>
          Target {fmt(glucoseMin)}–{fmt(glucoseMax)} {displayUnit}
        </div>
      </div>

      {/* Period selector */}
      <div style={s.periodRow}>
        {PERIODS.map(p => (
          <button key={p.days}
            style={{ ...s.periodBtn, ...(period===p.days ? s.periodBtnActive : {}) }}
            onClick={() => setPeriod(p.days)}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding:"40px 0", textAlign:"center", color:t.textMuted, fontSize:13 }}>
          Loading readings…
        </div>
      ) : allReadings.length === 0 ? (
        <div style={s.emptyState}>
          <div style={{ fontSize:40, marginBottom:12 }}>🩸</div>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:6, color:t.text }}>No readings yet</div>
          <div style={{ fontSize:13, color:t.textMuted }}>Log a glucose reading from the Home screen to get started.</div>
        </div>
      ) : (
        <>
          <StatsStrip readings={filtered} min={glucoseMin} max={glucoseMax} fmt={fmt} displayUnit={displayUnit}/>

          <div style={s.chartCard}>
            <div style={s.chartTitle}>
              {period === 1 ? "Last 24 hours" : `Last ${period} days`}
              <span style={{ color:t.textMuted, fontWeight:400 }}> · {filtered.length} reading{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            {filtered.length > 0 && (() => {
              const vals  = filtered.map(r => r.value);
              const low   = vals.filter(v => v < glucoseMin).length;
              const inR   = vals.filter(v => v >= glucoseMin && v <= glucoseMax).length;
              const high  = vals.filter(v => v > glucoseMax).length;
              const total = vals.length;
              return (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, color:t.textMuted, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.6px" }}>Time in range</div>
                  <div style={{ display:"flex", height:8, borderRadius:t.r.sm, overflow:"hidden", gap:1 }}>
                    {low  > 0 && <div style={{ flex:low,  background:t.err  }}/>}
                    {inR  > 0 && <div style={{ flex:inR,  background:t.green }}/>}
                    {high > 0 && <div style={{ flex:high, background:t.warn }}/>}
                  </div>
                  <div style={{ display:"flex", gap:12, marginTop:6 }}>
                    {[
                      [t.err,   `Low ${Math.round(low/total*100)}%`],
                      [t.green, `In range ${Math.round(inR/total*100)}%`],
                      [t.warn,  `High ${Math.round(high/total*100)}%`],
                    ].map(([color, label]) => (
                      <div key={label} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:t.textMuted }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }}/>
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <GlucoseChart readings={filtered} min={glucoseMin} max={glucoseMax} fmt={fmt}/>
          </div>

          <div style={s.sectionHead}>
            <span style={s.sectionTitle}>Readings</span>
            <span style={{ fontSize:11, color:t.textMuted }}>{allReadings.length} total</span>
          </div>

          <div style={{ padding:"0 16px 20px" }}>
            {Object.entries(grouped).map(([dateLabel, readings]) => (
              <div key={dateLabel} style={{ marginBottom:20 }}>
                <div style={s.dateLabel}>{dateLabel}</div>
                {readings.map(r => {
                  const color  = getColor(r.value, glucoseMin, glucoseMax);
                  const status = getStatus(r.value, glucoseMin, glucoseMax);
                  return (
                    <div key={r.id} style={s.readingRow}>
                      <div style={{ ...s.readingDot, background:color }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                          <span style={{ fontFamily:t.fontDisplay, fontSize:22, color }}>
                            {fmt(r.value)}
                          </span>
                          <span style={{ fontSize:11, color:t.textMuted }}>{displayUnit}</span>
                          <span style={{ fontSize:11, color, marginLeft:2 }}>· {status}</span>
                        </div>
                        <div style={{ fontSize:11, color:t.textMuted, marginTop:2 }}>
                          {fmtTime(r.timestamp)}
                          {r.source && ` · ${r.source}`}
                          {r.notes  && ` · ${r.notes}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  header:          { padding:"20px 20px 12px", borderBottom:`1px solid ${t.border}`, background:"rgba(255,255,255,0.92)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10 },
  logo:            { fontFamily:t.fontDisplay, fontSize:22, color:t.pink, marginBottom:2 },
  periodRow:       { display:"flex", gap:8, padding:"14px 16px", borderBottom:`1px solid ${t.border}` },
  periodBtn:       { flex:1, padding:"7px 0", borderRadius:t.r.md, border:`1px solid ${t.border}`, background:t.bgSurface, color:t.textMuted, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:t.fontSans },
  periodBtnActive: { background:`rgba(255,93,168,0.1)`, borderColor:`rgba(255,93,168,0.4)`, color:t.pink },
  statsStrip:      { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:1, margin:"12px 16px 0", background:t.bgCard, borderRadius:t.r.xl, border:`1px solid ${t.border}`, overflow:"hidden", boxShadow:shadows.card },
  statItem:        { padding:"12px 8px", textAlign:"center", borderRight:`1px solid ${t.border}` },
  chartCard:       { margin:"12px 16px 0", background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:t.r.xl, padding:"14px 16px", boxShadow:shadows.card },
  chartTitle:      { fontSize:13, fontWeight:600, marginBottom:12, color:t.text },
  sectionHead:     { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 20px 10px" },
  sectionTitle:    { fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:"1.2px", color:t.textMuted },
  dateLabel:       { fontSize:12, fontWeight:600, color:t.textMuted, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8, paddingBottom:6, borderBottom:`1px solid ${t.border}` },
  readingRow:      { display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${t.border}` },
  readingDot:      { width:10, height:10, borderRadius:"50%", flexShrink:0 },
  emptyState:      { textAlign:"center", padding:"60px 24px", color:t.text },
};

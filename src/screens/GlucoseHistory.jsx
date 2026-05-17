import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useChild } from "../hooks/useChild";

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
  if (value < 3.5)  return "#ef4444";
  if (value < min)  return "#f59e0b";
  if (value <= max) return "#22c55e";
  return "#f59e0b";
}

function getStatus(value, min, max) {
  if (value < 3.5)  return "Low";
  if (value < min)  return "Below target";
  if (value <= max) return "In range";
  return "Above target";
}

// ── Mini sparkline chart ──────────────────────────────────────────────────────
function GlucoseChart({ readings, min, max }) {
  if (readings.length < 2) return (
    <div style={{ height:140, display:"flex", alignItems:"center", justifyContent:"center", color:"#7a8fa6", fontSize:13 }}>
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

  const xScale = (t) => PAD.left + ((t - minT) / (maxT - minT || 1)) * plotW;
  const yScale = (v) => PAD.top  + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;

  // Target band
  const bandTop    = yScale(max);
  const bandBottom = yScale(min);
  const bandHeight = bandBottom - bandTop;

  // Line path
  const sorted = [...readings].sort((a,b) => {
    const at = a.timestamp?.toDate?.()?.getTime() || 0;
    const bt = b.timestamp?.toDate?.()?.getTime() || 0;
    return at - bt;
  });

  const points = sorted.map((r, i) => {
    const t = r.timestamp?.toDate ? r.timestamp.toDate().getTime() : new Date(r.timestamp).getTime();
    return `${xScale(t)},${yScale(r.value)}`;
  });

  const linePath = `M ${points.join(" L ")}`;

  // Y axis labels
  const yLabels = [min, max, minV, maxV].filter((v, i, a) => a.indexOf(v) === i).sort((a,b)=>a-b);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible" }}>
      {/* Target band */}
      <rect
        x={PAD.left} y={bandTop}
        width={plotW} height={bandHeight}
        fill="rgba(34,197,94,0.08)"
        stroke="rgba(34,197,94,0.2)"
        strokeWidth={0.5}
      />

      {/* Target band labels */}
      <text x={PAD.left - 4} y={bandTop + 4}    fontSize="8" fill="#22c55e" textAnchor="end">{max}</text>
      <text x={PAD.left - 4} y={bandBottom + 1}  fontSize="8" fill="#22c55e" textAnchor="end">{min}</text>

      {/* Grid lines */}
      {[3.5, 5.0, 7.0, 10.0].map(v => (
        <line key={v}
          x1={PAD.left} y1={yScale(v)}
          x2={PAD.left + plotW} y2={yScale(v)}
          stroke="rgba(255,255,255,0.04)" strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}

      {/* Line */}
      <path d={linePath} fill="none" stroke="rgba(245,158,11,0.6)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>

      {/* Dots */}
      {sorted.map((r, i) => {
        const t = r.timestamp?.toDate ? r.timestamp.toDate().getTime() : new Date(r.timestamp).getTime();
        const cx = xScale(t);
        const cy = yScale(r.value);
        const color = getColor(r.value, min, max);
        return (
          <g key={r.id || i}>
            <circle cx={cx} cy={cy} r={4} fill={color} stroke="#0f1f35" strokeWidth={1.5}/>
          </g>
        );
      })}

      {/* X axis — first and last time */}
      {sorted.length > 0 && <>
        <text x={PAD.left}         y={H - 4} fontSize="8" fill="#7a8fa6" textAnchor="start">{fmtTime(sorted[0].timestamp)}</text>
        <text x={PAD.left + plotW} y={H - 4} fontSize="8" fill="#7a8fa6" textAnchor="end">{fmtTime(sorted[sorted.length-1].timestamp)}</text>
      </>}
    </svg>
  );
}

// ── Stats strip ───────────────────────────────────────────────────────────────
function StatsStrip({ readings, min, max }) {
  if (readings.length === 0) return null;

  const values  = readings.map(r => r.value);
  const avg     = values.reduce((a,b) => a + b, 0) / values.length;
  const highest = Math.max(...values);
  const lowest  = Math.min(...values);
  const inRange = values.filter(v => v >= min && v <= max).length;
  const tir     = Math.round((inRange / values.length) * 100);
  const tirColor = tir >= 70 ? "#22c55e" : tir >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div style={s.statsStrip}>
      {[
        ["Avg",      avg.toFixed(1),        "#f59e0b", "mmol/L"],
        ["Time in range", `${tir}%`,         tirColor,  `${inRange}/${values.length} readings`],
        ["High",     highest.toFixed(1),    getColor(highest, min, max), "mmol/L"],
        ["Low",      lowest.toFixed(1),     getColor(lowest, min, max),  "mmol/L"],
      ].map(([label, value, color, sub]) => (
        <div key={label} style={s.statItem}>
          <div style={{ fontSize:10, color:"#7a8fa6", marginBottom:3, textTransform:"uppercase", letterSpacing:"0.6px" }}>{label}</div>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color, lineHeight:1 }}>{value}</div>
          <div style={{ fontSize:10, color:"#7a8fa6", marginTop:2 }}>{sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function GlucoseHistory() {
  const { child, childId } = useChild();
  const [allReadings, setAllReadings] = useState([]);
  const [period,      setPeriod]      = useState(1); // days
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

  // Filter to selected period
  const cutoff = Date.now() - period * 24 * 60 * 60 * 1000;
  const filtered = allReadings.filter(r => {
    const t = r.timestamp?.toDate?.()?.getTime() || 0;
    return t >= cutoff;
  });

  // Group by date for the list
  const grouped = filtered.reduce((acc, r) => {
    const label = fmtDate(r.timestamp);
    if (!acc[label]) acc[label] = [];
    acc[label].push(r);
    return acc;
  }, {});

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", color:"#e8dcc8" }}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.logo}>Glucose History</div>
        <div style={{ fontSize:11, color:"#7a8fa6" }}>
          Target {glucoseMin}–{glucoseMax} mmol/L
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
        <div style={{ padding:"40px 0", textAlign:"center", color:"#7a8fa6", fontSize:13 }}>
          Loading readings…
        </div>
      ) : allReadings.length === 0 ? (
        <div style={s.emptyState}>
          <div style={{ fontSize:40, marginBottom:12 }}>🩸</div>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:6 }}>No readings yet</div>
          <div style={{ fontSize:13, color:"#7a8fa6" }}>Log a glucose reading from the Home screen to get started.</div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <StatsStrip readings={filtered} min={glucoseMin} max={glucoseMax}/>

          {/* Chart */}
          <div style={s.chartCard}>
            <div style={s.chartTitle}>
              {period === 1 ? "Last 24 hours" : `Last ${period} days`}
              <span style={{ color:"#7a8fa6", fontWeight:400 }}> · {filtered.length} reading{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Time in range bar */}
            {filtered.length > 0 && (() => {
              const vals   = filtered.map(r => r.value);
              const low    = vals.filter(v => v < glucoseMin).length;
              const inR    = vals.filter(v => v >= glucoseMin && v <= glucoseMax).length;
              const high   = vals.filter(v => v > glucoseMax).length;
              const total  = vals.length;
              return (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, color:"#7a8fa6", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.6px" }}>Time in range</div>
                  <div style={{ display:"flex", height:8, borderRadius:4, overflow:"hidden", gap:1 }}>
                    {low  > 0 && <div style={{ flex:low,  background:"#ef4444" }}/>}
                    {inR  > 0 && <div style={{ flex:inR,  background:"#22c55e" }}/>}
                    {high > 0 && <div style={{ flex:high, background:"#f59e0b" }}/>}
                  </div>
                  <div style={{ display:"flex", gap:12, marginTop:6 }}>
                    {[
                      ["#ef4444", `Low ${Math.round(low/total*100)}%`],
                      ["#22c55e", `In range ${Math.round(inR/total*100)}%`],
                      ["#f59e0b", `High ${Math.round(high/total*100)}%`],
                    ].map(([color, label]) => (
                      <div key={label} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:"#7a8fa6" }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }}/>
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <GlucoseChart readings={filtered} min={glucoseMin} max={glucoseMax}/>
          </div>

          {/* Reading list grouped by date */}
          <div style={s.sectionHead}>
            <span style={s.sectionTitle}>Readings</span>
            <span style={{ fontSize:11, color:"#7a8fa6" }}>{allReadings.length} total</span>
          </div>

          <div style={{ padding:"0 16px 20px" }}>
            {Object.entries(grouped).map(([dateLabel, readings]) => (
              <div key={dateLabel} style={{ marginBottom:20 }}>
                <div style={s.dateLabel}>{dateLabel}</div>
                {readings.map((r, i) => {
                  const color  = getColor(r.value, glucoseMin, glucoseMax);
                  const status = getStatus(r.value, glucoseMin, glucoseMax);
                  return (
                    <div key={r.id} style={s.readingRow}>
                      <div style={{ ...s.readingDot, background:color }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                          <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color }}>
                            {r.value}
                          </span>
                          <span style={{ fontSize:11, color:"#7a8fa6" }}>mmol/L</span>
                          <span style={{ fontSize:11, color, marginLeft:2 }}>· {status}</span>
                        </div>
                        <div style={{ fontSize:11, color:"#7a8fa6", marginTop:2 }}>
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
  header:        { padding:"20px 20px 12px", borderBottom:"1px solid rgba(255,255,255,0.08)", background:"rgba(15,31,53,0.85)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10 },
  logo:          { fontFamily:"'DM Serif Display',serif", fontSize:22, color:"#f59e0b", marginBottom:2 },
  periodRow:     { display:"flex", gap:8, padding:"14px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)" },
  periodBtn:     { flex:1, padding:"7px 0", borderRadius:10, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(30,54,84,0.7)", color:"#7a8fa6", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  periodBtnActive:{ background:"rgba(245,158,11,0.15)", borderColor:"rgba(245,158,11,0.4)", color:"#f59e0b" },
  statsStrip:    { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:1, margin:"12px 16px 0", background:"rgba(30,54,84,0.7)", borderRadius:16, border:"1px solid rgba(255,255,255,0.08)", overflow:"hidden" },
  statItem:      { padding:"12px 8px", textAlign:"center", borderRight:"1px solid rgba(255,255,255,0.06)" },
  chartCard:     { margin:"12px 16px 0", background:"rgba(30,54,84,0.7)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:"14px 16px", backdropFilter:"blur(8px)" },
  chartTitle:    { fontSize:13, fontWeight:600, marginBottom:12, color:"#e8dcc8" },
  sectionHead:   { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 20px 10px" },
  sectionTitle:  { fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:"1.2px", color:"#7a8fa6" },
  dateLabel:     { fontSize:12, fontWeight:600, color:"#7a8fa6", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8, paddingBottom:6, borderBottom:"1px solid rgba(255,255,255,0.06)" },
  readingRow:    { display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" },
  readingDot:    { width:10, height:10, borderRadius:"50%", flexShrink:0 },
  emptyState:    { textAlign:"center", padding:"60px 24px", color:"#e8dcc8" },
};

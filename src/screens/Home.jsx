import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { upsertVector } from "../services/vectorStore";
import { useChild } from "../hooks/useChild";
import { useUnits } from "../hooks/useUnits";
import LogMealModal from "../components/LogMealModal";
import LogGlucoseModal from "../components/LogGlucoseModal";

const SYMPTOMS = [
  { id:"pale",   label:"Pallor",      icon:"😶", severity:"moderate" },
  { id:"shake",  label:"Shaking",     icon:"🥶", severity:"moderate" },
  { id:"sweat",  label:"Sweating",    icon:"💧", severity:"moderate" },
  { id:"cry",    label:"Irritable",   icon:"😢", severity:"mild"     },
  { id:"slug",   label:"Lethargic",   icon:"😴", severity:"serious"  },
  { id:"conf",   label:"Confused",    icon:"😵", severity:"serious"  },
  { id:"eye",    label:"Glassy eyes", icon:"👁️", severity:"serious"  },
  { id:"hunger", label:"Hunger",      icon:"🤤", severity:"mild"     },
  { id:"vomit",  label:"Vomiting",    icon:"🤢", severity:"serious"  },
  { id:"seize",  label:"Seizure",     icon:"⚡", severity:"critical" },
];

function pad(n) { return String(n).padStart(2, "0"); }

function fmtElapsed(ms) {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${pad(m % 60)}m` : `${m}m`;
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month:"short", day:"numeric" });
}

function GlucoseRing({ value, min = 4.0, max = 6.5, fmt, displayUnit }) {
  const R = 42, cx = 50, cy = 50, circ = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(1, (value - 2.5) / 5.5));
  const color = value < 3.5 ? "#ef4444" : value < min ? "#f59e0b" : value <= max ? "#22c55e" : "#f59e0b";
  return (
    <div style={{ position:"relative", width:100, height:100, flexShrink:0 }}>
      <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform:"rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8"/>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
          style={{ transition:"stroke-dasharray 0.8s ease" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:26, lineHeight:1, color }}>{fmt(value)}</span>
        <span style={{ fontSize:10, color:"#7a8fa6", marginTop:2 }}>{displayUnit}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { child, childId } = useChild();
  const { fmt, displayUnit } = useUnits();
  const [now, setNow] = useState(Date.now());
  const [showMealModal, setShowMealModal] = useState(false);
  const [showGlucoseModal, setShowGlucoseModal] = useState(false);

  const [lastMeal,    setLastMeal]    = useState(null);
  const [lastGlucose, setLastGlucose] = useState(null);
  const [timeline,    setTimeline]    = useState([]);

  const [activeSymptoms, setActiveSymptoms] = useState([]);
  const [obsText,        setObsText]        = useState("");
  const [savingSymptoms, setSavingSymptoms] = useState(false);
  const [symptomSaved,   setSymptomSaved]   = useState(false);

  const [savingMeal,   setSavingMeal]   = useState(false);
  const [mealSaved,    setMealSaved]    = useState(false);

  const [savingGlucose, setSavingGlucose] = useState(false);
  const [glucoseSaved,  setGlucoseSaved]  = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!child || !childId) return;
    const userId = auth.currentUser.uid;
    const q = query(
      collection(db, "users", userId, "children", childId, "mealLogs"),
      orderBy("timestamp", "desc"), limit(1)
    );
    return onSnapshot(q, snap => {
      setLastMeal(snap.empty ? null : { id:snap.docs[0].id, ...snap.docs[0].data() });
    });
  }, [child, childId]);

  useEffect(() => {
    if (!child || !childId) return;
    const userId = auth.currentUser.uid;
    const q = query(
      collection(db, "users", userId, "children", childId, "glucoseReadings"),
      orderBy("timestamp", "desc"), limit(1)
    );
    return onSnapshot(q, snap => {
      setLastGlucose(snap.empty ? null : { id:snap.docs[0].id, ...snap.docs[0].data() });
    });
  }, [child, childId]);

  useEffect(() => {
    if (!child || !childId) return;
    const userId = auth.currentUser.uid;

    const merge = (prev, newItems, type) => {
      const others = prev.filter(i => i.type !== type);
      return [...newItems, ...others].sort((a, b) => {
        const at = a.timestamp?.toDate?.() || new Date(0);
        const bt = b.timestamp?.toDate?.() || new Date(0);
        return bt - at;
      });
    };

    const mealQ = query(collection(db, "users", userId, "children", childId, "mealLogs"), orderBy("timestamp", "desc"), limit(10));
    const glucQ  = query(collection(db, "users", userId, "children", childId, "glucoseReadings"), orderBy("timestamp", "desc"), limit(10));
    const sympQ  = query(collection(db, "users", userId, "children", childId, "symptomEvents"), orderBy("timestamp", "desc"), limit(10));

    const u1 = onSnapshot(mealQ, snap => {
      const items = snap.docs.map(d => ({ id:d.id, type:"meal",    ...d.data() }));
      setTimeline(prev => merge(prev, items, "meal"));
    });
    const u2 = onSnapshot(glucQ, snap => {
      const items = snap.docs.map(d => ({ id:d.id, type:"glucose", ...d.data() }));
      setTimeline(prev => merge(prev, items, "glucose"));
    });
    const u3 = onSnapshot(sympQ, snap => {
      const items = snap.docs.map(d => ({ id:d.id, type:"symptom", ...d.data() }));
      setTimeline(prev => merge(prev, items, "symptom"));
    });

    return () => { u1(); u2(); u3(); };
  }, [child, childId]);

  const saveSymptoms = async () => {
    if (activeSymptoms.length === 0 && !obsText.trim()) return;
    setSavingSymptoms(true);
    try {
      const userId = auth.currentUser.uid;
      const ref = await addDoc(
        collection(db, "users", userId, "children", childId, "symptomEvents"),
        {
          timestamp:        serverTimestamp(),
          loggedBy:         userId,
          quickTapSymptoms: activeSymptoms,
          observationText:  obsText.trim(),
          glucoseAtTime:    lastGlucose?.value || null,
        }
      );
      if (obsText.trim()) {
        try {
          await upsertVector({
            id:      ref.id,
            content: obsText.trim(),
            userId,
            childId,
            type:    "clinical_observation",
          });
        } catch (err) {
          console.error("Vector upsert failed (symptom event saved to Firestore):", err);
        }
      }
      setActiveSymptoms([]);
      setObsText("");
      setSymptomSaved(true);
      setTimeout(() => setSymptomSaved(false), 2000);
    } catch (err) {
      console.error("Error saving symptom event:", err);
    } finally {
      setSavingSymptoms(false);
    }
  };

  const saveMeal = async (data) => {
    if (!data.description || !childId) return;
    setSavingMeal(true);
    try {
      const userId = auth.currentUser.uid;
      await addDoc(
        collection(db, "users", userId, "children", childId, "mealLogs"),
        {
          timestamp: serverTimestamp(),
          loggedBy: userId,
          descriptionText: data.description,
          carbsEstimate: data.carbs,
          notes: data.notes,
        }
      );
      setShowMealModal(false);
      setMealSaved(true);
      setTimeout(() => setMealSaved(false), 2000);
    } catch (err) {
      console.error("Error saving meal:", err);
    } finally {
      setSavingMeal(false);
    }
  };

  const saveGlucose = async (data) => {
    if (!data.value || !childId) return;
    setSavingGlucose(true);
    try {
      const userId = auth.currentUser.uid;
      await addDoc(
        collection(db, "users", userId, "children", childId, "glucoseReadings"),
        {
          timestamp: serverTimestamp(),
          loggedBy: userId,
          value: data.value,
          source: data.source,
          notes: data.notes,
        }
      );
      setShowGlucoseModal(false);
      setGlucoseSaved(true);
      setTimeout(() => setGlucoseSaved(false), 2000);
    } catch (err) {
      console.error("Error saving glucose reading:", err);
    } finally {
      setSavingGlucose(false);
    }
  };

  const interval    = (child?.mealIntervalMinutes || 120) * 60 * 1000;
  const lastMealTime = lastMeal?.timestamp?.toDate?.()?.getTime() || null;
  const elapsed      = lastMealTime ? now - lastMealTime : null;
  const pct          = elapsed ? Math.min(100, (elapsed / interval) * 100) : 0;
  const minElapsed   = elapsed ? Math.floor(elapsed / 60000) : 0;
  const intervalMin  = child?.mealIntervalMinutes || 120;
  const tc           = elapsed
    ? minElapsed >= intervalMin ? "urgent"
    : minElapsed >= intervalMin * 0.75 ? "warn" : "ok"
    : "ok";
  const alertType = tc === "urgent" ? "danger" : tc === "warn" ? "warning" : "ok";
  const alertMsg  = !elapsed
    ? { title:"No meal logged yet", body:"Log a meal to start the feed timer." }
    : tc === "urgent"
    ? { title:"⚠️ Snack overdue — act now", body:`${child?.name} is past the ${intervalMin}-minute window.` }
    : tc === "warn"
    ? { title:"Snack window approaching", body:`${intervalMin - minElapsed} min until ${intervalMin}-minute mark. Start preparing.` }
    : { title:"On track", body:`Next snack in ~${intervalMin - minElapsed} min.` };

  const glucoseMin = child?.glucoseTargetMin || 4.0;
  const glucoseMax = child?.glucoseTargetMax || 6.5;
  const gVal    = lastGlucose?.value;
  const gColor  = !gVal ? "#7a8fa6" : gVal < 3.5 ? "#ef4444" : gVal < glucoseMin ? "#f59e0b" : gVal <= glucoseMax ? "#22c55e" : "#f59e0b";
  const gStatus = !gVal ? "No reading logged" : gVal < 3.5 ? "Low — take action" : gVal < glucoseMin ? "Below target" : gVal <= glucoseMax ? "In range" : "Above target";

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontFamily:"'DM Sans',sans-serif", color:"#e8dcc8" }}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.logo}>GlycoGuard</div>
            <div style={s.headerSub}>Pediatric Hypoglycemia Manager</div>
          </div>
          <div style={s.childPill}>
            <div style={s.childAvatar}>{child?.name?.[0] || "?"}</div>
            <span style={s.childName}>{child?.name || "Child"}</span>
          </div>
        </div>

        {/* Alert banner */}
        <div style={{ ...s.alertBanner, ...(alertType==="danger"?s.alertDanger:alertType==="warning"?s.alertWarning:s.alertOk) }}>
          <div style={{ fontSize:22, flexShrink:0 }}>{alertType==="ok"?"✅":"⏱️"}</div>
          <div style={{ flex:1 }}>
            <div style={s.alertTitle}>{alertMsg.title}</div>
            <div style={s.alertBody}>{alertMsg.body}</div>
          </div>
          <button style={s.alertBtn} onClick={() => setShowMealModal(true)}>
            {alertType==="ok" ? "+ Meal" : "Log Meal"}
          </button>
        </div>

        {/* Live Status */}
        <div style={s.sectionHead}>
          <span style={s.sectionTitle}>Live Status</span>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <button style={s.sectionBtn} onClick={() => setShowGlucoseModal(true)}>+ Glucose</button>
            <button style={s.sectionBtn} onClick={() => navigate("/glucose")}>History</button>
          </div>
        </div>

        {/* Glucose card */}
        <div style={s.card}>
          {gVal
            ? <GlucoseRing value={gVal} min={glucoseMin} max={glucoseMax} fmt={fmt} displayUnit={displayUnit}/>
            : <div style={s.glucosePlaceholder}>🩸</div>
          }
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:gColor, marginBottom:4 }}>{gStatus}</div>
            <div style={{ fontSize:11, color:"#7a8fa6", marginBottom:10 }}>
              {lastGlucose
                ? `${lastGlucose.source?.toUpperCase() || "Manual"} · ${fmtDate(lastGlucose.timestamp)} at ${fmtTime(lastGlucose.timestamp)}`
                : "No glucose readings yet"}
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              <span style={s.pill}>Target {fmt(glucoseMin)}–{fmt(glucoseMax)} {displayUnit}</span>
              <span style={s.pill}>{child?.diagnosis || "Hypoglycemia"}</span>
            </div>
          </div>
        </div>

        {/* Feed timer */}
        <div style={s.timerStrip}>
          <div style={{ fontSize:28 }}>🍽️</div>
          <div>
            <div style={{ fontSize:11, color:"#7a8fa6", marginBottom:3 }}>Time since last meal</div>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:tc==="urgent"?"#ef4444":tc==="warn"?"#f59e0b":"#7ec8a4" }}>
              {elapsed ? fmtElapsed(elapsed) : "—"}
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:3, overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:3, width:`${pct}%`, transition:"width 0.5s ease", background:tc==="urgent"?"#ef4444":tc==="warn"?"#f59e0b":"#5fa882" }}/>
            </div>
            <div style={{ fontSize:10, color:"#7a8fa6", marginTop:3 }}>
              {intervalMin}-min target window
              {lastMeal && ` · Last meal ${fmtDate(lastMeal.timestamp)} at ${fmtTime(lastMeal.timestamp)}`}
            </div>
          </div>
        </div>

        {/* Symptom logging */}
        <div style={s.sectionHead}>
          <span style={s.sectionTitle}>Log Symptoms</span>
          {(activeSymptoms.length > 0 || obsText.trim()) && (
            <button style={s.sectionBtn} onClick={saveSymptoms} disabled={savingSymptoms}>
              {savingSymptoms ? "Saving…" : symptomSaved ? "✓ Saved" : `Save ${activeSymptoms.length > 0 ? activeSymptoms.length + " selected" : "note"}`}
            </button>
          )}
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", gap:8, padding:"0 16px", marginBottom:8 }}>
          {SYMPTOMS.map(sym => (
            <button key={sym.id}
              onClick={() => setActiveSymptoms(a => a.includes(sym.id) ? a.filter(x=>x!==sym.id) : [...a, sym.id])}
              style={{
                padding:"8px 14px", borderRadius:20, fontSize:13, fontWeight:500,
                border: sym.severity==="critical" ? "1px solid #ef4444"
                      : activeSymptoms.includes(sym.id) ? "1px solid #f59e0b"
                      : "1px solid rgba(255,255,255,0.08)",
                background: sym.severity==="critical" ? "rgba(239,68,68,0.15)"
                          : activeSymptoms.includes(sym.id) ? "rgba(245,158,11,0.2)"
                          : "rgba(30,54,84,0.7)",
                color: sym.severity==="critical" ? "#fca5a5"
                     : activeSymptoms.includes(sym.id) ? "#f59e0b"
                     : "#e8dcc8",
                cursor:"pointer", display:"flex", alignItems:"center", gap:6,
                fontFamily:"'DM Sans',sans-serif",
              }}>
              {sym.icon} {sym.label}
            </button>
          ))}
        </div>

        <div style={{ padding:"0 16px 4px" }}>
          <textarea
            style={s.textarea}
            placeholder="Add an observation… temperature, paramedic notes, anything you're seeing"
            value={obsText}
            onChange={e => setObsText(e.target.value)}
            rows={2}
          />
        </div>

        {/* Timeline */}
        <div style={s.sectionHead}>
          <span style={s.sectionTitle}>Today · {new Date().toLocaleDateString("en-CA", { month:"short", day:"numeric" })}</span>
        </div>

        <div style={{ padding:"0 16px 20px" }}>
          {timeline.length === 0 && (
            <div style={{ fontSize:13, color:"#7a8fa6", textAlign:"center", padding:"20px 0" }}>
              No events logged today yet.
            </div>
          )}
          {timeline.map((item, i) => (
            <div key={item.id} style={{ display:"flex", gap:14, marginBottom:16, alignItems:"flex-start" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:4 }}>
                <div style={{
                  width:10, height:10, borderRadius:"50%", flexShrink:0, border:"2px solid", marginBottom:4,
                  borderColor: item.type==="meal"?"#5fa882":item.type==="glucose"?"#f59e0b":"#ef4444",
                  background:  item.type==="meal"?"rgba(95,168,130,0.3)":item.type==="glucose"?"rgba(245,158,11,0.3)":"rgba(239,68,68,0.3)",
                }}/>
                {i < timeline.length - 1 && <div style={{ flex:1, width:1, background:"rgba(255,255,255,0.08)", minHeight:24 }}/>}
              </div>
              <div style={{ flex:1, background:"rgba(30,54,84,0.7)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"12px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>
                    {item.type==="meal"?"Meal logged":item.type==="glucose"?"Glucose reading":"Symptoms noted"}
                  </span>
                  <span style={{ fontSize:11, color:"#7a8fa6" }}>{fmtTime(item.timestamp)}</span>
                </div>
                <div style={{ fontSize:12, color:"#7a8fa6", lineHeight:1.5 }}>
                  {item.type==="meal" && (item.descriptionText || "Meal logged")}
                  {item.type==="glucose" && (
                    <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:"#f59e0b" }}>
                      {fmt(item.value)} <small style={{ fontSize:11, color:"#7a8fa6" }}>{displayUnit}</small>
                    </span>
                  )}
                  {item.type==="symptom" && [
                    item.quickTapSymptoms?.length > 0 && item.quickTapSymptoms.map(id => SYMPTOMS.find(s=>s.id===id)?.label).filter(Boolean).join(" · "),
                    item.observationText
                  ].filter(Boolean).join(" — ")}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {showMealModal && <LogMealModal open={showMealModal} onClose={() => setShowMealModal(false)} onSave={saveMeal} saving={savingMeal}/>}
      {showGlucoseModal && <LogGlucoseModal open={showGlucoseModal} onClose={() => setShowGlucoseModal(false)} onSave={saveGlucose} saving={savingGlucose}/>}
    </>
  );
}

const s = {
  header:          { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px 12px", borderBottom:"1px solid rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", background:"rgba(15,31,53,0.85)", position:"sticky", top:0, zIndex:10 },
  logo:            { fontFamily:"'DM Serif Display',serif", fontSize:20, color:"#f59e0b", letterSpacing:"-0.3px" },
  headerSub:       { fontSize:11, color:"#7a8fa6", marginTop:1 },
  childPill:       { display:"flex", alignItems:"center", gap:8, background:"#1e3654", borderRadius:20, padding:"6px 12px 6px 8px", border:"1px solid rgba(255,255,255,0.08)" },
  childAvatar:     { width:26, height:26, borderRadius:"50%", background:"linear-gradient(135deg,#5fa882,#f59e0b)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:600, color:"#0f1f35" },
  childName:       { fontSize:13, fontWeight:500, color:"#e8dcc8" },
  alertBanner:     { margin:"12px 16px 0", padding:"12px 16px", borderRadius:12, display:"flex", alignItems:"center", gap:12 },
  alertOk:         { background:"rgba(34,197,94,0.12)", border:"1px solid rgba(34,197,94,0.25)" },
  alertWarning:    { background:"rgba(245,158,11,0.15)", border:"1px solid rgba(245,158,11,0.3)" },
  alertDanger:     { background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.35)" },
  alertTitle:      { fontSize:13, fontWeight:600, color:"#e8dcc8", marginBottom:2 },
  alertBody:       { fontSize:12, color:"#7a8fa6", lineHeight:1.4 },
  alertBtn:        { background:"#f59e0b", color:"#0f1f35", border:"none", padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'DM Sans',sans-serif" },
  sectionHead:     { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 20px 10px" },
  sectionTitle:    { fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:"1.2px", color:"#7a8fa6" },
  sectionBtn:      { fontSize:12, color:"#f59e0b", cursor:"pointer", background:"none", border:"none", fontFamily:"'DM Sans',sans-serif", fontWeight:600 },
  card:            { margin:"0 16px", background:"rgba(30,54,84,0.7)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:20, display:"flex", alignItems:"center", gap:20, backdropFilter:"blur(8px)" },
  glucosePlaceholder:{ width:100, height:100, borderRadius:"50%", background:"rgba(255,255,255,0.05)", border:"2px dashed rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 },
  pill:            { fontSize:11, padding:"3px 8px", borderRadius:20, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.08)", color:"#e8dcc8" },
  timerStrip:      { margin:"12px 16px 0", background:"rgba(30,54,84,0.7)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:"14px 18px", display:"flex", alignItems:"center", gap:14, backdropFilter:"blur(8px)" },
  textarea:        { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"10px 12px", color:"#e8dcc8", fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:"none", resize:"none", lineHeight:1.5 },
};

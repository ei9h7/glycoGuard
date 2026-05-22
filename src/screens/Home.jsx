import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { upsertVector } from "../services/vectorStore";
import { useChild } from "../hooks/useChild";
import { useUnits } from "../hooks/useUnits";
import { t, shadows } from "../styles/tokens";
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

function glucoseColor(value, min, max) {
  if (!value) return t.textMuted;
  if (value < 3.5) return t.err;
  if (value < min) return t.warn;
  if (value <= max) return t.green;
  return t.warn;
}

function GlucoseRing({ value, min = 4.0, max = 6.5, fmt, displayUnit }) {
  const R = 42, cx = 50, cy = 50, circ = 2 * Math.PI * R;
  const pct   = Math.max(0, Math.min(1, (value - 2.5) / 5.5));
  const color = glucoseColor(value, min, max);
  return (
    <div style={{ position:"relative", width:100, height:100, flexShrink:0 }}>
      <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform:"rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={t.border} strokeWidth="8"/>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
          style={{ transition:"stroke-dasharray 0.8s ease" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontFamily:t.fontDisplay, fontSize:26, lineHeight:1, color }}>{fmt(value)}</span>
        <span style={{ fontSize:10, color:t.textMuted, marginTop:2 }}>{displayUnit}</span>
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
  const [savingGlucose, setSavingGlucose] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
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
  const gColor  = glucoseColor(gVal, glucoseMin, glucoseMax);
  const gStatus = !gVal ? "No reading logged" : gVal < 3.5 ? "Low — take action" : gVal < glucoseMin ? "Below target" : gVal <= glucoseMax ? "In range" : "Above target";

  const timerColor = tc === "urgent" ? t.err : tc === "warn" ? t.warn : t.green;

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontFamily:t.fontSans, color:t.text }}>

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
        <div style={{
          ...s.alertBanner,
          ...(alertType==="danger" ? s.alertDanger : alertType==="warning" ? s.alertWarning : s.alertOk),
        }}>
          <div style={{ fontSize:22, flexShrink:0 }}>{alertType==="ok" ? "✅" : "⏱️"}</div>
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
            <div style={{ fontSize:11, color:t.textMuted, marginBottom:10 }}>
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
            <div style={{ fontSize:11, color:t.textMuted, marginBottom:3 }}>Time since last meal</div>
            <div style={{ fontFamily:t.fontDisplay, fontSize:22, color:timerColor }}>
              {elapsed ? fmtElapsed(elapsed) : "—"}
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ height:6, background:t.bgSurface, borderRadius:3, overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:3, width:`${pct}%`, transition:"width 0.5s ease", background:timerColor }}/>
            </div>
            <div style={{ fontSize:10, color:t.textMuted, marginTop:3 }}>
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
                padding:"8px 14px", borderRadius:t.r.pill, fontSize:13, fontWeight:500,
                border: sym.severity==="critical" ? `1px solid ${t.errBorder}`
                      : activeSymptoms.includes(sym.id) ? `1px solid ${t.pink}`
                      : `1px solid ${t.border}`,
                background: sym.severity==="critical" ? t.errBg
                          : activeSymptoms.includes(sym.id) ? `rgba(255,93,168,0.1)`
                          : t.bgCard,
                color: sym.severity==="critical" ? t.err
                     : activeSymptoms.includes(sym.id) ? t.pink
                     : t.text,
                cursor:"pointer", display:"flex", alignItems:"center", gap:6,
                fontFamily:t.fontSans,
                boxShadow: shadows.card,
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
            <div style={{ fontSize:13, color:t.textMuted, textAlign:"center", padding:"20px 0" }}>
              No events logged today yet.
            </div>
          )}
          {timeline.map((item, i) => (
            <div key={item.id} style={{ display:"flex", gap:14, marginBottom:16, alignItems:"flex-start" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:4 }}>
                <div style={{
                  width:10, height:10, borderRadius:"50%", flexShrink:0, border:"2px solid", marginBottom:4,
                  borderColor: item.type==="meal" ? t.green : item.type==="glucose" ? t.pink : t.err,
                  background:  item.type==="meal" ? `rgba(0,214,143,0.15)` : item.type==="glucose" ? `rgba(255,93,168,0.15)` : t.errBg,
                }}/>
                {i < timeline.length - 1 && <div style={{ flex:1, width:1, background:t.border, minHeight:24 }}/>}
              </div>
              <div style={{ flex:1, background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:t.r.lg, padding:"12px 14px", boxShadow:shadows.card }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:t.text }}>
                    {item.type==="meal" ? "Meal logged" : item.type==="glucose" ? "Glucose reading" : "Symptoms noted"}
                  </span>
                  <span style={{ fontSize:11, color:t.textMuted }}>{fmtTime(item.timestamp)}</span>
                </div>
                <div style={{ fontSize:12, color:t.textMuted, lineHeight:1.5 }}>
                  {item.type==="meal" && (item.descriptionText || "Meal logged")}
                  {item.type==="glucose" && (
                    <span style={{ fontFamily:t.fontDisplay, fontSize:20, color:t.pink }}>
                      {fmt(item.value)} <small style={{ fontSize:11, color:t.textMuted }}>{displayUnit}</small>
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
  header:       { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px 12px", borderBottom:`1px solid ${t.border}`, background:"rgba(255,255,255,0.92)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10 },
  logo:         { fontFamily:t.fontDisplay, fontSize:20, color:t.pink, letterSpacing:"-0.3px" },
  headerSub:    { fontSize:11, color:t.textMuted, marginTop:1 },
  childPill:    { display:"flex", alignItems:"center", gap:8, background:t.bgSurface, borderRadius:t.r.pill, padding:"6px 12px 6px 8px", border:`1px solid ${t.border}` },
  childAvatar:  { width:26, height:26, borderRadius:"50%", background:`linear-gradient(135deg,${t.green},${t.pink})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:600, color:t.navy },
  childName:    { fontSize:13, fontWeight:500, color:t.text },
  alertBanner:  { margin:"12px 16px 0", padding:"12px 16px", borderRadius:t.r.lg, display:"flex", alignItems:"center", gap:12 },
  alertOk:      { background:t.okBg,   border:`1px solid ${t.okBorder}` },
  alertWarning: { background:t.warnBg, border:`1px solid ${t.warnBorder}` },
  alertDanger:  { background:t.errBg,  border:`1px solid ${t.errBorder}` },
  alertTitle:   { fontSize:13, fontWeight:600, color:t.text, marginBottom:2 },
  alertBody:    { fontSize:12, color:t.textMuted, lineHeight:1.4 },
  alertBtn:     { background:t.pink, color:t.navy, border:"none", padding:"6px 12px", borderRadius:t.r.sm, fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", fontFamily:t.fontSans },
  sectionHead:  { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 20px 10px" },
  sectionTitle: { fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:"1.2px", color:t.textMuted },
  sectionBtn:   { fontSize:12, color:t.pink, cursor:"pointer", background:"none", border:"none", fontFamily:t.fontSans, fontWeight:600 },
  card:         { margin:"0 16px", background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:t.r.xxl, padding:20, display:"flex", alignItems:"center", gap:20, boxShadow:shadows.card },
  glucosePlaceholder: { width:100, height:100, borderRadius:"50%", background:t.bgSurface, border:`2px dashed ${t.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 },
  pill:         { fontSize:11, padding:"3px 8px", borderRadius:t.r.pill, background:t.bgSurface, border:`1px solid ${t.border}`, color:t.textSecondary },
  timerStrip:   { margin:"12px 16px 0", background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:t.r.xl, padding:"14px 18px", display:"flex", alignItems:"center", gap:14, boxShadow:shadows.card },
  textarea:     { width:"100%", background:t.bgSurface, border:`1px solid ${t.border}`, borderRadius:t.r.md, padding:"10px 12px", color:t.text, fontSize:13, fontFamily:t.fontSans, outline:"none", resize:"none", lineHeight:1.5 },
};

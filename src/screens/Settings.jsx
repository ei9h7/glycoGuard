import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../firebase";
import { useChild } from "../hooks/useChild";
import { useAuth } from "../hooks/useAuth";

const CGM_OPTIONS = [
  "None / Not using CGM",
  "FreeStyle Libre 2",
  "FreeStyle Libre 3+",
  "Dexcom G6",
  "Dexcom G7",
  "Medtronic",
  "Other",
];

const DIAGNOSIS_OPTIONS = [
  "Reactive Hypoglycemia",
  "Congenital Hyperinsulinism (CHI)",
  "Suspected Hyperinsulinism",
  "Ketotic Hypoglycemia",
  "Idiopathic Hypoglycemia",
  "Other / Under Investigation",
];

export default function Settings() {
  const { user } = useAuth();
  const { child, childId } = useChild();

  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");

  const [form, setForm] = useState(null);

  const startEdit = () => {
    setForm({
      name:           child?.name           || "",
      dob:            child?.dob            || "",
      diagnosis:      child?.diagnosis      || "",
      glucoseMin:     String(child?.glucoseTargetMin  || "4.0"),
      glucoseMax:     String(child?.glucoseTargetMax  || "6.5"),
      mealInterval:   String(child?.mealIntervalMinutes || "120"),
      cgmDevice:      child?.cgmDevice      || "None / Not using CGM",
    });
    setEditing(true);
    setError("");
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm(null);
    setError("");
  };

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    try {
      const userId = auth.currentUser.uid;
      await updateDoc(doc(db, "users", userId, "children", childId), {
        name:                form.name.trim(),
        dob:                 form.dob,
        diagnosis:           form.diagnosis,
        glucoseTargetMin:    parseFloat(form.glucoseMin),
        glucoseTargetMax:    parseFloat(form.glucoseMax),
        mealIntervalMinutes: parseInt(form.mealInterval),
        cgmDevice:           form.cgmDevice,
        updatedAt:           serverTimestamp(),
      });
      setEditing(false);
      setForm(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (!child) return (
    <div style={{ padding:24, color:"#7a8fa6", fontSize:13 }}>Loading profile…</div>
  );

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", color:"#e8dcc8", paddingBottom:32 }}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.logo}>Settings</div>
      </div>

      {/* Child profile card */}
      <div style={s.sectionHead}>
        <span style={s.sectionTitle}>Child Profile</span>
        {!editing && (
          <button style={s.actionBtn} onClick={startEdit}>Edit</button>
        )}
      </div>

      {!editing ? (
        /* Read-only view */
        <div style={s.card}>
          <div style={s.profileRow}>
            <div style={s.avatar}>{child.name?.[0] || "?"}</div>
            <div>
              <div style={{ fontSize:18, fontFamily:"'DM Serif Display',serif" }}>{child.name}</div>
              <div style={{ fontSize:12, color:"#7a8fa6", marginTop:2 }}>{child.diagnosis}</div>
            </div>
            {saved && <div style={{ marginLeft:"auto", fontSize:12, color:"#7ec8a4" }}>✓ Saved</div>}
          </div>

          {[
            ["🎂", "Date of birth",      child.dob || "—"],
            ["🎯", "Glucose target",     `${child.glucoseTargetMin} – ${child.glucoseTargetMax} mmol/L`],
            ["⏱️", "Meal interval",      `Every ${child.mealIntervalMinutes} minutes`],
            ["💉", "CGM device",         child.cgmDevice || "None"],
          ].map(([icon, label, value]) => (
            <div key={label} style={s.detailRow}>
              <span style={{ fontSize:16, flexShrink:0 }}>{icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:"#7a8fa6", marginBottom:2 }}>{label}</div>
                <div style={{ fontSize:14 }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Edit form */
        <div style={{ padding:"0 16px" }}>
          <div style={s.group}>
            <label style={s.label}>Child's first name</label>
            <input style={s.input} type="text" value={form.name} onChange={set("name")} required/>
          </div>

          <div style={s.group}>
            <label style={s.label}>Date of birth</label>
            <input style={s.input} type="date" value={form.dob} onChange={set("dob")}/>
          </div>

          <div style={s.group}>
            <label style={s.label}>Diagnosis / suspected condition</label>
            <select style={s.input} value={form.diagnosis} onChange={set("diagnosis")}>
              <option value="" disabled>Select a condition</option>
              {DIAGNOSIS_OPTIONS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div style={s.group}>
            <label style={s.label}>Glucose target range (mmol/L)</label>
            <div style={{ display:"flex", gap:10 }}>
              <div style={{ flex:1 }}>
                <div style={s.sublabel}>Minimum</div>
                <input style={s.input} type="number" step="0.1" min="1" max="5" value={form.glucoseMin} onChange={set("glucoseMin")}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={s.sublabel}>Maximum</div>
                <input style={s.input} type="number" step="0.1" min="4" max="15" value={form.glucoseMax} onChange={set("glucoseMax")}/>
              </div>
            </div>
          </div>

          <div style={s.group}>
            <label style={s.label}>Maximum time between meals</label>
            <select style={s.input} value={form.mealInterval} onChange={set("mealInterval")}>
              <option value="90">Every 1.5 hours</option>
              <option value="120">Every 2 hours</option>
              <option value="150">Every 2.5 hours</option>
              <option value="180">Every 3 hours</option>
            </select>
          </div>

          <div style={s.group}>
            <label style={s.label}>CGM device</label>
            <select style={s.input} value={form.cgmDevice} onChange={set("cgmDevice")}>
              {CGM_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {error && <div style={s.error}>{error}</div>}

          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button style={s.btnSecondary} onClick={cancelEdit}>Cancel</button>
            <button style={s.btn} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {/* Account section */}
      <div style={s.sectionHead}>
        <span style={s.sectionTitle}>Account</span>
      </div>

      <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:10 }}>
        <div style={s.card}>
          <div style={s.detailRow}>
            <span style={{ fontSize:16 }}>📧</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:"#7a8fa6", marginBottom:2 }}>Signed in as</div>
              <div style={{ fontSize:14 }}>{user?.email || "—"}</div>
            </div>
          </div>
        </div>

        <button style={s.signOutBtn} onClick={handleSignOut}>
          Sign out
        </button>
      </div>

      {/* Coming soon */}
      <div style={s.sectionHead}>
        <span style={s.sectionTitle}>Coming Soon</span>
      </div>

      <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:10 }}>
        {[
          ["👨‍👩‍👧", "Co-parent sharing",     "Invite a co-parent and set data permissions"],
          ["➕",    "Add another child",     "Support for multiple children"],
          ["🔔",    "Notification settings", "Customise alerts and reminders"],
          ["📏",    "Unit preference",       "Switch between mmol/L and mg/dL"],
        ].map(([icon, title, desc]) => (
          <div key={title} style={{ ...s.card, opacity:0.5 }}>
            <div style={s.detailRow}>
              <span style={{ fontSize:16 }}>{icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:500 }}>{title}</div>
                <div style={{ fontSize:12, color:"#7a8fa6", marginTop:2 }}>{desc}</div>
              </div>
              <span style={{ color:"#7a8fa6", fontSize:12 }}>Coming soon</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

const s = {
  header:      { padding:"20px 20px 12px", borderBottom:"1px solid rgba(255,255,255,0.08)", background:"rgba(15,31,53,0.85)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10 },
  logo:        { fontFamily:"'DM Serif Display',serif", fontSize:22, color:"#f59e0b" },
  sectionHead: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"24px 20px 10px" },
  sectionTitle:{ fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:"1.2px", color:"#7a8fa6" },
  actionBtn:   { fontSize:12, color:"#f59e0b", background:"none", border:"none", fontFamily:"'DM Sans',sans-serif", fontWeight:600, cursor:"pointer" },
  card:        { margin:"0 16px", background:"rgba(30,54,84,0.7)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:"14px 16px", backdropFilter:"blur(8px)" },
  profileRow:  { display:"flex", alignItems:"center", gap:12, marginBottom:16, paddingBottom:16, borderBottom:"1px solid rgba(255,255,255,0.08)" },
  avatar:      { width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#5fa882,#f59e0b)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, color:"#0f1f35", flexShrink:0 },
  detailRow:   { display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" },
  group:       { marginBottom:16 },
  label:       { display:"block", fontSize:13, fontWeight:600, marginBottom:6, color:"#e8dcc8" },
  sublabel:    { fontSize:11, color:"#7a8fa6", marginBottom:4 },
  input:       { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"11px 14px", color:"#e8dcc8", fontSize:14, fontFamily:"'DM Sans',sans-serif", outline:"none" },
  btn:         { flex:2, background:"#f59e0b", color:"#0f1f35", border:"none", borderRadius:10, padding:"11px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  btnSecondary:{ flex:1, background:"transparent", color:"#e8dcc8", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"11px", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  error:       { fontSize:13, color:"#ef4444", marginBottom:10 },
  signOutBtn:  { width:"100%", padding:"12px", borderRadius:12, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", color:"#fca5a5", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
};

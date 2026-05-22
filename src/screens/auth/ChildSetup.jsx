import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { t } from "../../styles/tokens";

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

export default function ChildSetup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const [form, setForm] = useState({
    name:           "",
    dob:            "",
    diagnosis:      "",
    diagnosisOther: "",
    glucoseMin:     "4.0",
    glucoseMax:     "6.5",
    mealInterval:   "120",
    cgmDevice:      "None / Not using CGM",
  });

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError(""); setLoading(true);
  try {
    const userId = auth.currentUser.uid;
    const childData = {
      name:                form.name.trim(),
      dob:                 form.dob,
      diagnosis:           form.diagnosis === "Other / Under Investigation"
                             ? form.diagnosisOther
                             : form.diagnosis,
      glucoseTargetMin:    parseFloat(form.glucoseMin),
      glucoseTargetMax:    parseFloat(form.glucoseMax),
      mealIntervalMinutes: parseInt(form.mealInterval),
      cgmDevice:           form.cgmDevice,
      createdAt:           serverTimestamp(),
      updatedAt:           serverTimestamp(),
    };
    await addDoc(collection(db, "users", userId, "children"), childData);
    // Force a full page reload to avoid race condition with onSnapshot
    window.location.href = "/";
  } catch (err) {
    console.error(err);
    setError("Something went wrong saving the profile. Please try again.");
  } finally {
    setLoading(false);
  }
};

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.logo}>GlycoGuard</div>
        <div style={s.title}>Set up your child's profile</div>
        <div style={s.sub}>This helps GlycoGuard personalise alerts, recommendations, and reports.</div>
      </div>

      <form onSubmit={handleSubmit} style={s.form}>

        <div style={s.group}>
          <label style={s.label}>Child's first name</label>
          <input style={s.input} type="text" placeholder="Child's first name"
            value={form.name} onChange={set("name")} required />
        </div>

        <div style={s.group}>
          <label style={s.label}>Date of birth</label>
          <input style={s.input} type="date"
            value={form.dob} onChange={set("dob")} required />
        </div>

        <div style={s.group}>
          <label style={s.label}>Diagnosis / suspected condition</label>
          <select style={s.input} value={form.diagnosis} onChange={set("diagnosis")} required>
            <option value="" disabled>Select a condition</option>
            {DIAGNOSIS_OPTIONS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {form.diagnosis === "Other / Under Investigation" && (
          <div style={s.group}>
            <label style={s.label}>Please describe</label>
            <input style={s.input} type="text" placeholder="Describe the condition"
              value={form.diagnosisOther} onChange={set("diagnosisOther")} required />
          </div>
        )}

        <div style={s.group}>
          <label style={s.label}>Glucose target range (mmol/L)</label>
          <div style={{ display:"flex", gap:10 }}>
            <div style={{ flex:1 }}>
              <div style={s.sublabel}>Minimum</div>
              <input style={s.input} type="number" step="0.1" min="1" max="5"
                value={form.glucoseMin} onChange={set("glucoseMin")} required />
            </div>
            <div style={{ flex:1 }}>
              <div style={s.sublabel}>Maximum</div>
              <input style={s.input} type="number" step="0.1" min="4" max="15"
                value={form.glucoseMax} onChange={set("glucoseMax")} required />
            </div>
          </div>
          <div style={s.hint}>Default 4.0 – 6.5. Adjust to match your medical team's guidance.</div>
        </div>

        <div style={s.group}>
          <label style={s.label}>Maximum time between meals / snacks</label>
          <select style={s.input} value={form.mealInterval} onChange={set("mealInterval")}>
            <option value="90">Every 1.5 hours</option>
            <option value="120">Every 2 hours</option>
            <option value="150">Every 2.5 hours</option>
            <option value="180">Every 3 hours</option>
          </select>
          <div style={s.hint}>GlycoGuard will alert you before this window closes.</div>
        </div>

        <div style={s.group}>
          <label style={s.label}>CGM device (if any)</label>
          <select style={s.input} value={form.cgmDevice} onChange={set("cgmDevice")}>
            {CGM_OPTIONS.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <button style={s.btn} type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save & continue →"}
        </button>

        <div style={s.note}>
          You can edit any of these details later in Settings.
        </div>

      </form>
    </div>
  );
}

const s = {
  wrap:     { minHeight:"100vh", background:t.bg, color:t.text, fontFamily:t.fontSans, overflowY:"auto" },
  header:   { padding:"32px 24px 0", maxWidth:480, margin:"0 auto" },
  logo:     { fontFamily:t.fontDisplay, fontSize:22, color:t.pink, marginBottom:16 },
  title:    { fontFamily:t.fontDisplay, fontSize:26, lineHeight:1.2, marginBottom:8, color:t.text },
  sub:      { fontSize:13, color:t.textMuted, lineHeight:1.6, marginBottom:8 },
  form:     { padding:"24px 24px 48px", maxWidth:480, margin:"0 auto", display:"flex", flexDirection:"column", gap:20 },
  group:    { display:"flex", flexDirection:"column", gap:6 },
  label:    { fontSize:13, fontWeight:600, color:t.text },
  sublabel: { fontSize:11, color:t.textMuted, marginBottom:4 },
  hint:     { fontSize:11, color:t.textMuted, marginTop:4, lineHeight:1.5 },
  input:    { background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:t.r.md, padding:"11px 14px", color:t.text, fontSize:14, fontFamily:t.fontSans, outline:"none", width:"100%" },
  btn:      { background:t.pink, color:t.navy, border:"none", borderRadius:t.r.md, padding:"13px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:t.fontSans, marginTop:4 },
  error:    { fontSize:13, color:t.err, textAlign:"center" },
  note:     { fontSize:12, color:t.textMuted, textAlign:"center" },
};

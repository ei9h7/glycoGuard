import { useState, useRef } from "react";
import { supabase } from "../supabase";
import { useChild } from "../hooks/useChild";
import { useAuth } from "../hooks/useAuth";
import { useUnits } from "../hooks/useUnits";
import { useAI } from "../hooks/useAI";
import { useNotifications } from "../hooks/useNotifications";
import { usePreferenceNotes } from "../hooks/usePreferenceNotes";
import { useDocuments } from "../hooks/useDocuments";
import { t, shadows } from "../styles/tokens";
import { runCoParentMatch } from "../services/coParentMatch";

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
  const { unit, setUnit } = useUnits();
  const { aiEnabled, setAIEnabled } = useAI();
  const {
    supported: notifSupported,
    permission: notifPermission,
    enabled: notifEnabled,
    enable: enableNotifications,
    disable: disableNotifications,
  } = useNotifications();
  const { notes, loading: notesLoading, addNote, removeNote } = usePreferenceNotes();
  const { documents, loading: docsLoading, uploadDocument, removeDocument } = useDocuments();

  const labInputRef    = useRef(null);
  const letterInputRef = useRef(null);

  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState("");
  const [noteText,   setNoteText]   = useState("");
  const [noteAdding, setNoteAdding] = useState(false);
  const [uploading,  setUploading]  = useState(null); // 'lab_result' | 'provider_note' | null

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
      coParentEmail:  child?.coParentEmail  || "",
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
      const userId = user.uid;
      const coParentEmail = form.coParentEmail.toLowerCase().trim();
      const { error: updateErr } = await supabase.from("children").update({
        name:                  form.name.trim(),
        dob:                   form.dob,
        diagnosis:             form.diagnosis,
        glucose_target_min:    parseFloat(form.glucoseMin),
        glucose_target_max:    parseFloat(form.glucoseMax),
        meal_interval_minutes: parseInt(form.mealInterval),
        cgm_device:            form.cgmDevice,
        co_parent_email:       coParentEmail || null,
        updated_at:            new Date().toISOString(),
      }).eq("id", childId);
      if (updateErr) throw updateErr;
      runCoParentMatch(userId, childId, { ...child, coParentEmail }).catch(console.error);
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
    await supabase.auth.signOut();
  };

  const handleFileChange = async (type, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(type);
    try {
      await uploadDocument(file, type);
    } catch (err) {
      console.error("Document upload failed:", err);
    } finally {
      setUploading(null);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setNoteAdding(true);
    try {
      await addNote(noteText);
      setNoteText("");
    } finally {
      setNoteAdding(false);
    }
  };

  if (!child) return (
    <div style={{ padding:24, color:t.textMuted, fontSize:13 }}>Loading profile…</div>
  );

  return (
    <div style={{ fontFamily:t.fontSans, color:t.text, paddingBottom:32 }}>

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
              <div style={{ fontSize:18, fontFamily:t.fontDisplay }}>{child.name}</div>
              <div style={{ fontSize:12, color:t.textMuted, marginTop:2 }}>{child.diagnosis}</div>
            </div>
            {saved && <div style={{ marginLeft:"auto", fontSize:12, color:t.green }}>✓ Saved</div>}
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
                <div style={{ fontSize:11, color:t.textMuted, marginBottom:2 }}>{label}</div>
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

          <div style={s.group}>
            <label style={s.label}>Co-parent email (optional)</label>
            <input style={s.input} type="email" placeholder="co-parent@example.com"
              value={form.coParentEmail} onChange={set("coParentEmail")} />
            <div style={{ fontSize:11, color:t.textMuted, marginTop:4, lineHeight:1.5 }}>
              If your co-parent uses GlycoGuard with the same child's name and birthday, you'll be automatically connected.
            </div>
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

      {/* Display preferences */}
      <div style={s.sectionHead}>
        <span style={s.sectionTitle}>Display</span>
      </div>

      <div style={{ padding: "0 16px" }}>
        <div style={s.card}>
          <div style={{ ...s.detailRow, borderBottom: "none", paddingBottom: 0 }}>
            <span style={{ fontSize: 16 }}>📏</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Glucose units</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[["mmol", "mmol/L"], ["mgdl", "mg/dL"]].map(([val, label]) => (
                  <button key={val}
                    style={{
                      ...s.unitBtn,
                      ...(unit === val ? s.unitBtnActive : {}),
                    }}
                    onClick={() => setUnit(val)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preference Notes */}
      <div style={s.sectionHead}>
        <span style={s.sectionTitle}>AI Context Notes</span>
      </div>

      <div style={{ padding: "0 16px" }}>
        <div style={s.card}>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
            Notes saved here give the AI assistant context about {child.name} — food preferences, known triggers, clinical observations.
          </div>

          <textarea
            style={{ ...s.input, resize: "none", height: 80, paddingTop: 10, boxSizing: "border-box" }}
            placeholder={`e.g. ${child.name} refuses dairy. Tends to crash after juice.`}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <button
            style={{ ...s.btn, marginTop: 8, width: "100%", opacity: noteText.trim() ? 1 : 0.45 }}
            disabled={!noteText.trim() || noteAdding}
            onClick={handleAddNote}
          >
            {noteAdding ? "Saving…" : "Save note"}
          </button>

          {notesLoading ? (
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 14 }}>Loading…</div>
          ) : notes.length > 0 && (
            <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 14, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {notes.map(note => (
                <div key={note.id} style={s.noteRow}>
                  <div style={{ flex: 1, fontSize: 13, color: t.text, lineHeight: 1.5 }}>{note.content}</div>
                  <button style={s.deleteBtn} onClick={() => removeNote(note.id)} aria-label="Delete note">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Medical Documents */}
      <div style={s.sectionHead}>
        <span style={s.sectionTitle}>Medical Documents</span>
      </div>

      <div style={{ padding: "0 16px" }}>
        <div style={s.card}>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
            Upload PDFs to give the AI assistant access to lab results and provider letters.
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ ...s.uploadBtn, opacity: uploading ? 0.5 : 1 }}
              disabled={!!uploading}
              onClick={() => labInputRef.current?.click()}
            >
              {uploading === "lab_result" ? "Uploading…" : "📋 Lab Result"}
            </button>
            <button
              style={{ ...s.uploadBtn, opacity: uploading ? 0.5 : 1 }}
              disabled={!!uploading}
              onClick={() => letterInputRef.current?.click()}
            >
              {uploading === "provider_note" ? "Uploading…" : "📄 Provider Letter"}
            </button>
          </div>

          <input ref={labInputRef}    type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => handleFileChange("lab_result",    e)}/>
          <input ref={letterInputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => handleFileChange("provider_note", e)}/>

          {docsLoading ? (
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 14 }}>Loading…</div>
          ) : documents.length > 0 && (
            <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 14, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {documents.map(d => (
                <div key={d.id} style={s.docRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.filename}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <span style={{ ...s.typeBadge, ...(d.type === "lab_result" ? s.typeBadgeLab : s.typeBadgeLetter) }}>
                        {d.type === "lab_result" ? "Lab Result" : "Provider Letter"}
                      </span>
                      <span style={{ fontSize: 11, color: t.textMuted }}>
                        {d.createdAt?.toDate?.().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) ?? "—"}
                      </span>
                    </div>
                  </div>
                  <button style={s.deleteBtn} onClick={() => removeDocument(d.id)} aria-label="Delete document">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Features */}
      <div style={s.sectionHead}>
        <span style={s.sectionTitle}>AI Features</span>
      </div>

      <div style={{ padding: "0 16px" }}>
        <div style={s.card}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 16, marginTop: 2 }}>🤖</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>AI-powered features</div>
              <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
                Meal analysis, pattern recognition, recommendations and AI assistant
              </div>
            </div>
            <button
              style={{
                ...s.toggleTrack,
                background: aiEnabled ? t.pink : t.border,
              }}
              onClick={() => setAIEnabled(!aiEnabled)}
              aria-label={aiEnabled ? "Disable AI features" : "Enable AI features"}
            >
              <div style={{
                ...s.toggleThumb,
                transform: aiEnabled ? "translateX(20px)" : "translateX(2px)",
              }} />
            </button>
          </div>
          {!aiEnabled && (
            <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
              You can re-enable AI features at any time.
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div style={s.sectionHead}>
        <span style={s.sectionTitle}>Notifications</span>
      </div>

      <div style={{ padding: "0 16px" }}>
        <div style={s.card}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 16, marginTop: 2 }}>🔔</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Feed timer reminders</div>
              <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
                {!notifSupported
                  ? "Browser notifications aren't supported on this device."
                  : notifPermission === "denied"
                  ? "Notifications are blocked for this site — enable them in your browser settings."
                  : "Get a browser notification when the feed window is approaching or overdue"}
              </div>
            </div>
            {notifSupported && notifPermission !== "denied" && (
              <button
                style={{ ...s.toggleTrack, background: notifEnabled ? t.pink : t.border }}
                onClick={() => (notifEnabled ? disableNotifications() : enableNotifications())}
                aria-label={notifEnabled ? "Disable feed timer reminders" : "Enable feed timer reminders"}
              >
                <div style={{ ...s.toggleThumb, transform: notifEnabled ? "translateX(20px)" : "translateX(2px)" }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Account section */}
      <div style={s.sectionHead}>
        <span style={s.sectionTitle}>Account</span>
      </div>

      <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:10 }}>
        <div style={s.card}>
          <div style={s.detailRow}>
            <span style={{ fontSize:16 }}>📧</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:t.textMuted, marginBottom:2 }}>Signed in as</div>
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
          ["➕",    "Add another child",     "Support for multiple children"],
        ].map(([icon, title, desc]) => (
          <div key={title} style={{ ...s.card, opacity:0.5 }}>
            <div style={s.detailRow}>
              <span style={{ fontSize:16 }}>{icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:500 }}>{title}</div>
                <div style={{ fontSize:12, color:t.textMuted, marginTop:2 }}>{desc}</div>
              </div>
              <span style={{ color:t.textMuted, fontSize:12 }}>Coming soon</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

const s = {
  header:         { padding:"20px 20px 12px", borderBottom:`1px solid ${t.border}`, background:"rgba(255,255,255,0.92)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10 },
  logo:           { fontFamily:t.fontDisplay, fontSize:22, color:t.pink },
  sectionHead:    { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"24px 20px 10px" },
  sectionTitle:   { fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:"1.2px", color:t.textMuted },
  actionBtn:      { fontSize:12, color:t.pink, background:"none", border:"none", fontFamily:t.fontSans, fontWeight:600, cursor:"pointer" },
  card:           { margin:"0 16px", background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:t.r.xl, padding:"14px 16px", boxShadow:shadows.card },
  profileRow:     { display:"flex", alignItems:"center", gap:12, marginBottom:16, paddingBottom:16, borderBottom:`1px solid ${t.border}` },
  avatar:         { width:44, height:44, borderRadius:"50%", background:`linear-gradient(135deg,${t.green},${t.pink})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, color:t.navy, flexShrink:0 },
  detailRow:      { display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${t.border}` },
  group:          { marginBottom:16 },
  label:          { display:"block", fontSize:13, fontWeight:600, marginBottom:6, color:t.text },
  sublabel:       { fontSize:11, color:t.textMuted, marginBottom:4 },
  input:          { width:"100%", background:t.bgSurface, border:`1px solid ${t.border}`, borderRadius:t.r.md, padding:"11px 14px", color:t.text, fontSize:14, fontFamily:t.fontSans, outline:"none" },
  btn:            { flex:2, background:t.pink, color:t.navy, border:"none", borderRadius:t.r.md, padding:"11px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:t.fontSans },
  btnSecondary:   { flex:1, background:"transparent", color:t.textSecondary, border:`1px solid ${t.border}`, borderRadius:t.r.md, padding:"11px", fontSize:13, cursor:"pointer", fontFamily:t.fontSans },
  error:          { fontSize:13, color:t.err, marginBottom:10 },
  signOutBtn:     { width:"100%", padding:"12px", borderRadius:t.r.lg, background:t.errBg, border:`1px solid ${t.errBorder}`, color:t.err, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:t.fontSans },
  unitBtn:        { flex:1, padding:"8px 0", borderRadius:t.r.md, border:`1px solid ${t.border}`, background:t.bgSurface, color:t.textMuted, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:t.fontSans },
  unitBtnActive:  { background:`rgba(255,93,168,0.1)`, borderColor:`rgba(255,93,168,0.4)`, color:t.pink },
  noteRow:        { display:"flex", alignItems:"flex-start", gap:10, padding:"8px 12px", background:t.bgSurface, borderRadius:t.r.md, border:`1px solid ${t.border}` },
  deleteBtn:      { background:"none", border:"none", color:t.textMuted, fontSize:14, cursor:"pointer", padding:"2px 4px", lineHeight:1, flexShrink:0, fontFamily:t.fontSans },
  uploadBtn:      { flex:1, padding:"10px 8px", borderRadius:t.r.md, border:`1px solid ${t.border}`, background:t.bgSurface, color:t.text, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:t.fontSans },
  docRow:         { display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:t.bgSurface, borderRadius:t.r.md, border:`1px solid ${t.border}` },
  typeBadge:      { fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:t.r.pill, letterSpacing:"0.4px", textTransform:"uppercase" },
  typeBadgeLab:   { background:`rgba(0,214,143,0.12)`, color:t.greenDark },
  typeBadgeLetter:{ background:`rgba(255,93,168,0.1)`,  color:t.pink },
  toggleTrack:    { position:"relative", width:44, height:24, borderRadius:t.r.pill, border:"none", cursor:"pointer", padding:0, flexShrink:0, transition:"background 0.2s" },
  toggleThumb:    { position:"absolute", top:2, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"transform 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" },
};

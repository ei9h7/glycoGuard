import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useNavigate, Link } from "react-router-dom";
import { t } from "../../styles/tokens";
import GlycoGuardLogo from "../../components/GlycoGuardLogo";

export default function Register() {
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: name });
      await setDoc(doc(db, "users", user.uid), {
        displayName:    name,
        email:          email,
        unitPreference: "mmol",
        createdAt:      serverTimestamp(),
      });
      navigate("/");
    } catch (err) {
      setError(err.message.includes("email-already-in-use")
        ? "An account with this email already exists."
        : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={{ marginBottom: 8 }}>
        <GlycoGuardLogo height={56} />
      </div>
      <div style={s.sub}>Create your account</div>
      <form onSubmit={handleSubmit} style={s.form}>
        <input style={s.input} type="text"     placeholder="Your name" value={name}     onChange={e=>setName(e.target.value)}     required />
        <input style={s.input} type="email"    placeholder="Email"     value={email}    onChange={e=>setEmail(e.target.value)}    required />
        <input style={s.input} type="password" placeholder="Password (min 6 characters)" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required />
        {error && <div style={s.error}>{error}</div>}
        <button style={s.btn} type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>
      <div style={s.footer}>
        Already have an account? <Link to="/login" style={s.link}>Sign in</Link>
      </div>
    </div>
  );
}

const s = {
  wrap:  { minHeight:"100vh", background:t.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:t.fontSans, color:t.text },
  sub:   { fontSize:13, color:t.textMuted, marginBottom:40 },
  form:  { width:"100%", maxWidth:340, display:"flex", flexDirection:"column", gap:12 },
  input: { background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:t.r.md, padding:"11px 14px", color:t.text, fontSize:14, fontFamily:t.fontSans, outline:"none" },
  btn:   { background:t.pink, color:t.navy, border:"none", borderRadius:t.r.md, padding:"12px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:t.fontSans, marginTop:4 },
  error: { fontSize:13, color:t.err, textAlign:"center" },
  footer:{ marginTop:24, fontSize:13, color:t.textMuted },
  link:  { color:t.pink, textDecoration:"none" },
};

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { useNavigate, Link } from "react-router-dom";
import { t } from "../../styles/tokens";
import GlycoGuardLogo from "../../components/GlycoGuardLogo";

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={{ marginBottom: 8 }}>
        <GlycoGuardLogo height={56} />
      </div>
      <div style={s.sub}>Pediatric Hypoglycemia Manager</div>
      <form onSubmit={handleSubmit} style={s.form}>
        <input style={s.input} type="email"    placeholder="Email"    value={email}    onChange={e=>setEmail(e.target.value)}    required />
        <input style={s.input} type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
        {error && <div style={s.error}>{error}</div>}
        <button style={s.btn} type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
      <div style={s.footer}>
        Don't have an account? <Link to="/register" style={s.link}>Create one</Link>
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

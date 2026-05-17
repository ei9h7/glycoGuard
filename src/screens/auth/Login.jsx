import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { useNavigate, Link } from "react-router-dom";

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
      <div style={s.logo}>GlycoGuard</div>
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
  wrap:  { minHeight:"100vh", background:"#0f1f35", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"'DM Sans',sans-serif" },
  logo:  { fontFamily:"'DM Serif Display',serif", fontSize:32, color:"#f59e0b", marginBottom:6 },
  sub:   { fontSize:13, color:"#7a8fa6", marginBottom:40 },
  form:  { width:"100%", maxWidth:340, display:"flex", flexDirection:"column", gap:12 },
  input: { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"11px 14px", color:"#e8dcc8", fontSize:14, fontFamily:"'DM Sans',sans-serif", outline:"none" },
  btn:   { background:"#f59e0b", color:"#0f1f35", border:"none", borderRadius:10, padding:"12px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", marginTop:4 },
  error: { fontSize:13, color:"#ef4444", textAlign:"center" },
  footer:{ marginTop:24, fontSize:13, color:"#7a8fa6" },
  link:  { color:"#f59e0b", textDecoration:"none" },
};

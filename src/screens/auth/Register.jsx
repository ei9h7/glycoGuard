import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useNavigate, Link } from "react-router-dom";

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
      <div style={s.logo}>GlycoGuard</div>
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

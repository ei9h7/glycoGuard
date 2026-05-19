import { useEffect, useRef } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { useChild } from "../hooks/useChild";
import { generatePatterns } from "../services/patternEngine";

const NAV = [
  { to: "/",         icon: "🏠", label: "Home"      },
  { to: "/meals",    icon: "🍽️", label: "Meals"     },
  { to: "/reports",  icon: "🧩", label: "Patterns"  },
  { to: "/ai",       icon: "✨", label: "Assistant" },
  { to: "/settings", icon: "⚙️", label: "Settings"  },
];

const s = {
  app: {
    background: "#0f1f35", minHeight: "100vh", color: "#e8dcc8",
    display: "flex", flexDirection: "column",
    maxWidth: 430, margin: "0 auto", fontFamily: "'DM Sans', sans-serif",
    position: "relative",
  },
  screen: { flex: 1, overflowY: "auto", paddingBottom: 80 },
  nav: {
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: "100%", maxWidth: 430,
    background: "rgba(15,31,53,0.95)", borderTop: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(20px)", display: "flex", zIndex: 20, padding: "8px 0",
  },
  navItem: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
    gap: 3, padding: "6px 4px", cursor: "pointer", color: "#7a8fa6",
    textDecoration: "none", fontSize: 10, fontWeight: 500,
  },
};

export default function AppShell() {
  const { user }           = useAuth();
  const { child, childId } = useChild();
  const checkedRef         = useRef(false);

  // Once per session: refresh patterns in background if stale (>6 hours)
  useEffect(() => {
    if (!user || !child || !childId || checkedRef.current) return;
    checkedRef.current = true;

    const SIX_HOURS = 6 * 60 * 60 * 1000;
    (async () => {
      try {
        const ref  = doc(db, "users", user.uid, "children", childId, "patternSummary", "latest");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const ts = snap.data().generatedAt?.toDate?.();
          if (ts && Date.now() - ts.getTime() < SIX_HOURS) return;
        }
        generatePatterns(user.uid, childId, child).catch(e =>
          console.warn("Background pattern refresh failed:", e.message)
        );
      } catch (e) {
        console.warn("Pattern staleness check failed:", e.message);
      }
    })();
  }, [user, child, childId]);

  return (
    <div style={s.app}>
      <div style={s.screen}>
        <Outlet />
      </div>
      <nav style={s.nav}>
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"}
            style={({ isActive }) => ({
              ...s.navItem,
              color: isActive ? "#f59e0b" : "#7a8fa6",
            })}>
            <span style={{ fontSize: 20 }}>{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

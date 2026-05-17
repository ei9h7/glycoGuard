import { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

const NAV = [
  { to: "/",        icon: "🏠", label: "Home"      },
  { to: "/meals",   icon: "🍽️", label: "Meals"     },
  { to: "/reports", icon: "📊", label: "Reports"   },
  { to: "/ai",      icon: "✨", label: "Assistant" },
  { to: "/settings",icon: "⚙️", label: "Settings"  },
];

const styles = {
  app: {
    background: "#0f1f35", minHeight: "100vh", color: "#e8dcc8",
    display: "flex", flexDirection: "column",
    maxWidth: 430, margin: "0 auto", fontFamily: "'DM Sans', sans-serif",
    position: "relative",
  },
  screen: { flex: 1, overflowY: "auto", paddingBottom: 80 },
  header: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "16px 16px 0",
    position: "sticky",
    top: 0,
    zIndex: 15,
    background: "rgba(15,31,53,0.95)",
    backdropFilter: "blur(12px)",
  },
  logoutButton: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#94a3b8",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 600,
    transition: "background 150ms ease, border-color 150ms ease, color 150ms ease",
  },
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
  const [logoutHover, setLogoutHover] = useState(false);
  const logoutStyle = {
    ...styles.logoutButton,
    background: logoutHover ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)",
    borderColor: logoutHover ? "rgba(245,158,11,0.24)" : "rgba(255,255,255,0.12)",
    color: logoutHover ? "#fbbf24" : "#94a3b8",
  };

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <button
          style={logoutStyle}
          type="button"
          onMouseEnter={() => setLogoutHover(true)}
          onMouseLeave={() => setLogoutHover(false)}
          onClick={() => signOut(auth)}>
          Logout
        </button>
      </div>
      <div style={styles.screen}>
        <Outlet />
      </div>
      <nav style={styles.nav}>
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"}
            style={({ isActive }) => ({
              ...styles.navItem,
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

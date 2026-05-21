import { useEffect, useRef, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
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

const FEEDBACK_URL = "https://forms.gle/pGMjXHD6M7Mbh68m9";

const ROUTE_LABELS = {
  "/":         "Home",
  "/meals":    "Meals",
  "/reports":  "Patterns",
  "/ai":       "AI Assistant",
  "/settings": "Settings",
  "/glucose":  "Glucose History",
};

function FeedbackModal({ onClose, routePath }) {
  const label = ROUTE_LABELS[routePath] || routePath;

  const handleOpen = () => {
    window.open(FEEDBACK_URL, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />

        <div style={s.sheetTitle}>Share Feedback</div>
        <div style={s.sheetBody}>
          You're using an early build of GlycoGuard. Your feedback directly shapes what gets built next. Takes about 60 seconds.
        </div>

        <div style={s.routeRow}>
          <span style={s.routeLabel}>Current screen</span>
          <span style={s.routeValue}>{label}</span>
        </div>

        <button style={s.primaryBtn} onClick={handleOpen}>
          Open Feedback Form →
        </button>
        <button style={s.secondaryBtn} onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  );
}

export default function AppShell() {
  const { user }           = useAuth();
  const { child, childId } = useChild();
  const checkedRef         = useRef(false);
  const location           = useLocation();
  const [showFeedback, setShowFeedback] = useState(false);

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

      {/* Floating feedback button */}
      <button
        style={s.fab}
        onClick={() => setShowFeedback(true)}
        aria-label="Share feedback"
      >
        <span style={{ fontSize: 18 }}>💬</span>
      </button>

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

      {showFeedback && (
        <FeedbackModal
          onClose={() => setShowFeedback(false)}
          routePath={location.pathname}
        />
      )}
    </div>
  );
}

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

  // ── Floating action button ──
  fab: {
    position: "fixed",
    bottom: 90,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "rgba(15,31,53,0.9)",
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: 19,
    padding: 0,
  },

  // ── Feedback modal ──
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    zIndex: 40,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 430,
    background: "#162840",
    borderRadius: "20px 20px 0 0",
    border: "1px solid rgba(255,255,255,0.08)",
    borderBottom: "none",
    padding: "12px 24px 40px",
    display: "flex",
    flexDirection: "column",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    background: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 22,
    color: "#f59e0b",
    marginBottom: 10,
  },
  sheetBody: {
    fontSize: 14,
    color: "#7a8fa6",
    lineHeight: 1.6,
    marginBottom: 20,
  },
  routeRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(30,54,84,0.7)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: "10px 14px",
    marginBottom: 20,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "1px",
    color: "#7a8fa6",
  },
  routeValue: {
    fontSize: 13,
    fontWeight: 600,
    color: "#e8dcc8",
  },
  primaryBtn: {
    width: "100%",
    padding: "13px 0",
    borderRadius: 12,
    background: "#f59e0b",
    color: "#0f1f35",
    border: "none",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: 10,
    letterSpacing: "0.2px",
  },
  secondaryBtn: {
    width: "100%",
    padding: "12px 0",
    borderRadius: 12,
    background: "transparent",
    color: "#7a8fa6",
    border: "1px solid rgba(255,255,255,0.08)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
};

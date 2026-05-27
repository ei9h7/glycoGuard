import { useEffect, useRef, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { useChild } from "../hooks/useChild";
import { useAI } from "../hooks/useAI";
import { generatePatterns } from "../services/patternEngine";
import { t, shadows } from "../styles/tokens";

const NAV = [
  { to: "/",         icon: "🏠", label: "Home"      },
  { to: "/meals",    icon: "🍽️", label: "Meals"     },
  { to: "/reports",  icon: "🧩", label: "Patterns"  },
  { to: "/ai",       icon: "✨", label: "Assistant" },
  { to: "/sharing",  icon: "🤝", label: "Hub"      },
  { to: "/settings", icon: "⚙️", label: "Settings"  },
];

const FEEDBACK_URL = "https://forms.gle/pGMjXHD6M7Mbh68m9";

// ── AI opt-in modal ───────────────────────────────────────────────────────────

function AIOptInModal({ onEnable, onDecline }) {
  return (
    <div style={s.backdrop}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />

        <div style={{ fontSize: 40, textAlign: "center", marginBottom: 14 }}>✨</div>

        <div style={s.sheetTitle}>AI-powered features</div>
        <div style={s.sheetBody}>
          GlycoGuard uses AI to analyse meal photos, recognise glucose patterns, and give
          personalised recommendations. Your data stays private and is only used to help
          you manage your child's care. You can change this at any time in Settings.
        </div>

        <button style={s.primaryBtn} onClick={onEnable}>
          Enable AI
        </button>
        <button style={s.secondaryBtn} onClick={onDecline}>
          Not right now
        </button>
      </div>
    </div>
  );
}

const ROUTE_LABELS = {
  "/":         "Home",
  "/meals":    "Meals",
  "/reports":  "Patterns",
  "/ai":       "AI Assistant",
  "/sharing":  "Sharing",
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
  const { user }                              = useAuth();
  const { child, childId }                   = useChild();
  const { aiEnabled, aiNeverSet, setAIEnabled, loading: aiLoading } = useAI();
  const checkedRef                           = useRef(false);
  const location                             = useLocation();
  const [showFeedback, setShowFeedback]      = useState(false);

  // Filter nav: hide AI Assistant when AI features are disabled
  const visibleNav = NAV.filter(n => n.to !== "/ai" || aiEnabled !== false);

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
        {visibleNav.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"}
            style={({ isActive }) => ({
              ...s.navItem,
              color: isActive ? t.pink : t.textMuted,
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

      {/* One-time AI opt-in modal — shows when aiEnabled has never been set */}
      {!aiLoading && aiNeverSet && (
        <AIOptInModal
          onEnable={()  => setAIEnabled(true)}
          onDecline={() => setAIEnabled(false)}
        />
      )}
    </div>
  );
}

const s = {
  app: {
    background: t.bg,
    minHeight: "100vh",
    color: t.text,
    display: "flex",
    flexDirection: "column",
    maxWidth: 430,
    margin: "0 auto",
    fontFamily: t.fontSans,
    position: "relative",
  },
  screen: { flex: 1, overflowY: "auto", paddingBottom: 80 },
  nav: {
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: "100%", maxWidth: 430,
    background: "rgba(255,255,255,0.97)",
    borderTop: `1px solid ${t.border}`,
    backdropFilter: "blur(20px)",
    display: "flex", zIndex: 20, padding: "8px 0",
    boxShadow: "0 -1px 8px rgba(26,46,59,0.06)",
  },
  navItem: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
    gap: 3, padding: "6px 4px", cursor: "pointer",
    textDecoration: "none", fontSize: 10, fontWeight: 500,
  },

  // ── Floating action button ──
  fab: {
    position: "fixed",
    bottom: 90,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: t.r.pill,
    background: t.bgCard,
    border: `1px solid ${t.border}`,
    backdropFilter: "blur(12px)",
    boxShadow: shadows.card,
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
    background: "rgba(26,46,59,0.4)",
    zIndex: 40,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 430,
    background: t.bgCard,
    borderRadius: `${t.r.xxl} ${t.r.xxl} 0 0`,
    border: `1px solid ${t.border}`,
    borderBottom: "none",
    padding: "12px 24px 40px",
    display: "flex",
    flexDirection: "column",
    boxShadow: shadows.modal,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: t.r.pill,
    background: t.border,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: t.fontDisplay,
    fontSize: 22,
    color: t.pink,
    marginBottom: 10,
  },
  sheetBody: {
    fontSize: 14,
    color: t.textMuted,
    lineHeight: 1.6,
    marginBottom: 20,
  },
  routeRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: t.bgSurface,
    border: `1px solid ${t.border}`,
    borderRadius: t.r.md,
    padding: "10px 14px",
    marginBottom: 20,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "1px",
    color: t.textMuted,
  },
  routeValue: {
    fontSize: 13,
    fontWeight: 600,
    color: t.text,
  },
  primaryBtn: {
    width: "100%",
    padding: "13px 0",
    borderRadius: t.r.lg,
    background: t.pink,
    color: t.navy,
    border: "none",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: t.fontSans,
    marginBottom: 10,
    letterSpacing: "0.2px",
  },
  secondaryBtn: {
    width: "100%",
    padding: "12px 0",
    borderRadius: t.r.lg,
    background: "transparent",
    color: t.textMuted,
    border: `1px solid ${t.border}`,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: t.fontSans,
  },
};

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useAuth } from "../hooks/useAuth";
import { useChild } from "../hooks/useChild";
import { t, shadows } from "../styles/tokens";

const CATEGORIES = [
  { key: "glucose",   label: "Glucose readings" },
  { key: "meals",     label: "Meals" },
  { key: "symptoms",  label: "Symptoms" },
  { key: "documents", label: "Documents & lab results" },
  { key: "patterns",  label: "Patterns & insights" },
  { key: "aiHistory", label: "AI chat history" },
];

export default function Sharing() {
  const { user } = useAuth();
  const { child, childId } = useChild();
  const navigate = useNavigate();

  const [coParentChild,   setCoParentChild]   = useState(null);
  const [coParentLoading, setCoParentLoading] = useState(false);

  const isConnected = child?.coParentStatus === "connected";
  const isPending   = child?.coParentStatus === "pending";

  useEffect(() => {
    if (!isConnected || !child?.coParentUid || !child?.coParentChildId) return;
    setCoParentLoading(true);
    supabase.from("children").select("*").eq("id", child.coParentChildId).maybeSingle()
      .then(({ data }) => setCoParentChild(data ? {
        name: data.name,
        sharing: data.sharing,
      } : null))
      .catch(console.error)
      .finally(() => setCoParentLoading(false));
  }, [child?.coParentUid, child?.coParentChildId, isConnected]);

  const handleToggle = async (category) => {
    if (!childId || !user) return;
    const current = child?.sharing?.[category] ?? false;
    const nextSharing = { ...(child?.sharing || {}), [category]: !current };
    await supabase.from("children").update({ sharing: nextSharing }).eq("id", childId).catch(console.error);
  };

  if (!child) return (
    <div style={{ padding: 24, color: t.textMuted, fontSize: 13 }}>Loading…</div>
  );

  const activeCategories = CATEGORIES.filter(cat =>
    (child?.sharing?.[cat.key] ?? false) &&
    (coParentChild?.sharing?.[cat.key] ?? false)
  );

  return (
    <div style={{ fontFamily: t.fontSans, color: t.text, paddingBottom: 32 }}>

      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.logo}>Sharing Hub</div>
      </div>

      {/* ── Section 1: Connection status ── */}
      <div style={s.sectionHead}>
        <span style={s.sectionTitle}>Co-parent Connection</span>
      </div>

      <div style={{ padding: "0 16px" }}>
        {isConnected ? (
          <div style={s.card}>
            <div style={s.statusRow}>
              <span style={{ ...s.dot, background: t.ok }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Connected</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{child.coParentEmail}</div>
              </div>
            </div>
          </div>
        ) : isPending ? (
          <div style={{ ...s.card, borderColor: t.warnBorder, background: t.warnBg }}>
            <div style={s.statusRow}>
              <span style={{ ...s.dot, background: t.warn }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.warn }}>Waiting for co-parent to join</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{child.coParentEmail}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 10, lineHeight: 1.6, borderTop: `1px solid ${t.warnBorder}`, paddingTop: 10 }}>
              Once your co-parent creates a GlycoGuard account and adds your email as their co-parent email, you'll be automatically connected.
            </div>
          </div>
        ) : (
          <div style={s.card}>
            <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
              No co-parent email set yet. Add one in Settings and GlycoGuard will automatically connect you when your co-parent joins.
            </div>
            <button style={s.linkBtn} onClick={() => navigate("/settings")}>
              Go to Settings →
            </button>
          </div>
        )}
      </div>

      {/* ── Section 2: My sharing consent ── */}
      {isConnected && (
        <>
          <div style={s.sectionHead}>
            <span style={s.sectionTitle}>My Sharing</span>
          </div>

          <div style={{ padding: "0 16px" }}>
            <div style={s.card}>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
                Choose what your co-parent can see. You can change these at any time.
              </div>

              {CATEGORIES.map((cat, i) => {
                const isOn = child?.sharing?.[cat.key] ?? false;
                return (
                  <div key={cat.key} style={{
                    ...s.toggleRow,
                    borderBottom: i < CATEGORIES.length - 1 ? `1px solid ${t.border}` : "none",
                  }}>
                    <span style={{ fontSize: 14, flex: 1, color: t.text }}>{cat.label}</span>
                    <button
                      style={{ ...s.toggle, background: isOn ? t.pink : t.border }}
                      onClick={() => handleToggle(cat.key)}
                      aria-label={`Toggle ${cat.label}`}
                    >
                      <span style={{
                        ...s.toggleThumb,
                        transform: isOn ? "translateX(18px)" : "translateX(0)",
                      }} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Section 3: Co-parent's consent (read-only) ── */}
      {isConnected && (
        <>
          <div style={s.sectionHead}>
            <span style={s.sectionTitle}>Co-parent's Sharing</span>
          </div>

          <div style={{ padding: "0 16px" }}>
            <div style={s.card}>
              {coParentLoading ? (
                <div style={{ fontSize: 12, color: t.textMuted }}>Loading…</div>
              ) : CATEGORIES.map((cat, i) => {
                const myOn    = child?.sharing?.[cat.key] ?? false;
                const theirOn = coParentChild?.sharing?.[cat.key] ?? false;
                const bothOn  = myOn && theirOn;

                const statusLabel = !myOn     ? "You have this off"
                  :                 !theirOn  ? "Awaiting their consent"
                  :                             "Active";
                const statusColor = bothOn ? t.ok : t.textMuted;
                const dotColor    = bothOn ? t.ok : "#C4C4C4";

                return (
                  <div key={cat.key} style={{
                    ...s.toggleRow,
                    borderBottom: i < CATEGORIES.length - 1 ? `1px solid ${t.border}` : "none",
                  }}>
                    <span style={{ ...s.dot, background: dotColor, flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: t.text }}>{cat.label}</div>
                      <div style={{ fontSize: 11, color: statusColor, marginTop: 2 }}>{statusLabel}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Section 4: What's shared right now ── */}
      {isConnected && (
        <>
          <div style={s.sectionHead}>
            <span style={s.sectionTitle}>Shared Right Now</span>
          </div>

          <div style={{ padding: "0 16px" }}>
            <div style={s.card}>
              {activeCategories.length === 0 ? (
                <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
                  No categories are currently shared. Both you and your co-parent need to enable a category for it to be active.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
                    Both parents have consented to share the following:
                  </div>
                  {activeCategories.map((cat, i) => (
                    <div key={cat.key} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 0",
                      borderBottom: i < activeCategories.length - 1 ? `1px solid ${t.border}` : "none",
                    }}>
                      <span style={{ ...s.dot, background: t.ok, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, color: t.text }}>{cat.label}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}

const s = {
  header:       { padding: "20px 20px 12px", borderBottom: `1px solid ${t.border}`, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 },
  logo:         { fontFamily: t.fontDisplay, fontSize: 22, color: t.pink },
  sectionHead:  { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 20px 10px" },
  sectionTitle: { fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1.2px", color: t.textMuted },
  card:         { background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: t.r.xl, padding: "14px 16px", boxShadow: shadows.card },
  statusRow:    { display: "flex", alignItems: "center", gap: 12 },
  dot:          { width: 10, height: 10, borderRadius: "50%", display: "inline-block" },
  toggleRow:    { display: "flex", alignItems: "center", gap: 12, padding: "12px 0" },
  toggle:       { width: 40, height: 22, borderRadius: t.r.pill, border: "none", cursor: "pointer", position: "relative", flexShrink: 0, padding: 2, display: "flex", alignItems: "center", transition: "background 0.2s" },
  toggleThumb:  { width: 18, height: 18, borderRadius: "50%", background: "#fff", display: "block", transition: "transform 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.18)", flexShrink: 0 },
  linkBtn:      { background: "none", border: "none", color: t.pink, fontFamily: t.fontSans, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 0 0", display: "block" },
};

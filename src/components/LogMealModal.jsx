import { useEffect, useState } from "react";
import { t, shadows } from "../styles/tokens";

export default function LogMealModal({ open, onClose, onSave, saving }) {
  const [description, setDescription] = useState("");
  const [carbs, setCarbs] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setDescription("");
      setCarbs("");
      setNotes("");
    }
  }, [open]);

  if (!open) return null;

  const parsedCarbs = carbs.trim() ? Number(carbs) : null;
  const saveDisabled = saving || !description.trim();

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Log Meal</span>
          <button style={styles.closeButton} onClick={onClose} type="button">✕</button>
        </div>

        <label style={styles.label} htmlFor="meal-description">Meal description</label>
        <input
          id="meal-description"
          style={styles.input}
          placeholder="Breakfast, snack, juice, etc."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <label style={styles.label} htmlFor="meal-carbs">Estimated carbs (optional)</label>
        <input
          id="meal-carbs"
          style={styles.input}
          type="number"
          min="0"
          step="0.1"
          placeholder="e.g. 10.5"
          value={carbs}
          onChange={(event) => setCarbs(event.target.value)}
        />

        <label style={styles.label} htmlFor="meal-notes">Notes (optional)</label>
        <textarea
          id="meal-notes"
          style={styles.textarea}
          placeholder="Additional details or context"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
        />

        <div style={styles.actions}>
          <button style={styles.secondaryButton} onClick={onClose} type="button">Cancel</button>
          <button
            style={{
              ...styles.primaryButton,
              opacity: saveDisabled ? 0.6 : 1,
              cursor: saveDisabled ? "not-allowed" : "pointer",
            }}
            onClick={() => onSave({ description: description.trim(), carbs: parsedCarbs, notes: notes.trim() || null })}
            disabled={saveDisabled}
            type="button"
          >
            {saving ? "Saving…" : "Save meal"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(26,46,59,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 50,
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    borderRadius: t.r.xxl,
    background: t.bgCard,
    border: `1px solid ${t.border}`,
    padding: 24,
    boxShadow: shadows.modal,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: t.text,
    fontFamily: t.fontSans,
  },
  closeButton: {
    border: "none",
    background: "transparent",
    color: t.textMuted,
    fontSize: 18,
    cursor: "pointer",
  },
  label: {
    display: "block",
    marginBottom: 6,
    color: t.textMuted,
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontFamily: t.fontSans,
  },
  input: {
    width: "100%",
    marginBottom: 16,
    padding: "12px 14px",
    borderRadius: t.r.lg,
    border: `1px solid ${t.border}`,
    background: t.bgSurface,
    color: t.text,
    fontSize: 14,
    outline: "none",
    fontFamily: t.fontSans,
  },
  textarea: {
    width: "100%",
    marginBottom: 20,
    padding: "12px 14px",
    borderRadius: t.r.lg,
    border: `1px solid ${t.border}`,
    background: t.bgSurface,
    color: t.text,
    fontSize: 14,
    outline: "none",
    resize: "vertical",
    minHeight: 90,
    fontFamily: t.fontSans,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  secondaryButton: {
    border: `1px solid ${t.border}`,
    background: "transparent",
    color: t.textMuted,
    padding: "10px 16px",
    borderRadius: t.r.lg,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: t.fontSans,
  },
  primaryButton: {
    border: "none",
    background: t.pink,
    color: t.navy,
    padding: "10px 16px",
    borderRadius: t.r.lg,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: t.fontSans,
  },
};

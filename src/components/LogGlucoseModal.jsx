import { useEffect, useState } from "react";

export default function LogGlucoseModal({ open, onClose, onSave, saving }) {
  const [value, setValue] = useState("");
  const [source, setSource] = useState("manual");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setValue("");
      setSource("manual");
      setNotes("");
    }
  }, [open]);

  if (!open) return null;

  const parsedValue = value.trim() ? Number(value) : null;
  const saveDisabled = saving || !value.trim();

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Log Glucose</span>
          <button style={styles.closeButton} onClick={onClose} type="button">✕</button>
        </div>

        <label style={styles.label} htmlFor="glucose-value">Glucose reading (mmol/L)</label>
        <input
          id="glucose-value"
          style={styles.input}
          type="number"
          min="0"
          step="0.1"
          placeholder="e.g. 5.2"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />

        <label style={styles.label} htmlFor="glucose-source">Source</label>
        <select
          id="glucose-source"
          style={styles.input}
          value={source}
          onChange={(event) => setSource(event.target.value)}
        >
          <option value="manual">Manual entry</option>
          <option value="meter">Glucose meter</option>
          <option value="cgm">Continuous glucose monitor</option>
        </select>

        <label style={styles.label} htmlFor="glucose-notes">Notes (optional)</label>
        <textarea
          id="glucose-notes"
          style={styles.textarea}
          placeholder="Additional context or observations"
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
            onClick={() => onSave({ value: parsedValue, source, notes: notes.trim() || null })}
            disabled={saveDisabled}
            type="button"
          >
            {saving ? "Saving…" : "Save reading"}
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
    background: "rgba(15, 23, 42, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 50,
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    background: "#0f1f35",
    border: "1px solid rgba(255,255,255,0.08)",
    padding: 24,
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
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
    color: "#f8fafc",
  },
  closeButton: {
    border: "none",
    background: "transparent",
    color: "#94a3b8",
    fontSize: 18,
    cursor: "pointer",
  },
  label: {
    display: "block",
    marginBottom: 6,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  input: {
    width: "100%",
    marginBottom: 16,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#f8fafc",
    fontSize: 14,
    outline: "none",
    fontFamily: "'DM Sans', sans-serif",
  },
  textarea: {
    width: "100%",
    marginBottom: 20,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#f8fafc",
    fontSize: 14,
    outline: "none",
    resize: "vertical",
    minHeight: 90,
    fontFamily: "'DM Sans', sans-serif",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  secondaryButton: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "#94a3b8",
    padding: "10px 16px",
    borderRadius: 14,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  primaryButton: {
    border: "none",
    background: "#f59e0b",
    color: "#0f172a",
    padding: "10px 16px",
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
  },
};

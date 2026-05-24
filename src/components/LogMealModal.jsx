import React, { useState, useRef } from "react";
import { t, shadows } from "../styles/tokens";
import analyzeMealPhoto from "../services/mealPhotoAnalysis";
import { useChild } from "../hooks/useChild";

export default function LogMealModal({ open, onClose, onSave, saving }) {
  const { child } = useChild();
  const [description, setDescription] = useState("");
  const [carbs, setCarbs] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoAnalysis, setPhotoAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  const fileInputRef = useRef();

  React.useEffect(() => {
    if (open) {
      setDescription("");
      setCarbs("");
      setNotes("");
      setPhotoFile(null);
      setPhotoPreview(null);
      setPhotoAnalysis(null);
      setAnalysisLoading(false);
      setAnalysisError(null);
    }
  }, [open]);

  if (!open) return null;

  const parsedCarbs = carbs.trim() ? Number(carbs) : null;
  const saveDisabled = saving || (!description.trim() && !photoAnalysis);

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setAnalysisError(null);
    setPhotoPreview(null);
    setPhotoAnalysis(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setPhotoPreview(ev.target.result);
      setAnalysisLoading(true);
      try {
        const base64 = ev.target.result.split(",")[1];
        const mimeType = file.type;
        const result = await analyzeMealPhoto(base64, mimeType, child);

        setAnalysisLoading(false);

        // New: result may be { error: string } instead of null
        if (!result || result.error) {
          setAnalysisError(result?.error || "Could not analyse photo — please fill in manually");
          return;
        }

        setPhotoAnalysis(result);
        if (!description) setDescription(result.description ?? "");
        setCarbs(result.carbsEstimate != null ? String(result.carbsEstimate) : "");

      } catch (err) {
        setAnalysisError(`Error: ${err.message}`);
        setAnalysisLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Log Meal</span>
          <button style={styles.closeButton} onClick={onClose} type="button">✕</button>
        </div>

        {/* Camera/Photo Button */}
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            style={{
              background: t.pink,
              color: "#fff",
              borderRadius: 8,
              border: "none",
              padding: "10px 18px",
              fontSize: 20,
              cursor: "pointer",
              marginBottom: 6,
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            📷 Add Photo
          </button>
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            ref={fileInputRef}
            onChange={handlePhotoChange}
          />
          {photoPreview && (
            <div style={{ margin: "8px 0", display: "flex", alignItems: "center" }}>
              <img
                src={photoPreview}
                alt="Meal preview"
                style={{
                  height: 80,
                  border: `2px solid ${t.border}`,
                  borderRadius: 8,
                  marginRight: 12,
                }}
              />
              <a
                href="#"
                style={{ fontSize: 13, color: "#555", textDecoration: "underline" }}
                onClick={e => {
                  e.preventDefault();
                  setPhotoFile(null);
                  setPhotoPreview(null);
                  setPhotoAnalysis(null);
                  setAnalysisError(null);
                }}
              >✕ Remove photo</a>
            </div>
          )}
          {analysisLoading && (
            <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 6 }}>
              Analysing photo…
            </div>
          )}
          {photoAnalysis && (photoAnalysis.ingredients?.length > 0 || photoAnalysis.concerns?.length > 0) && (
            <div
              style={{
                background: photoAnalysis.concerns?.length > 0 ? t.warnBg : t.okBg,
                color: photoAnalysis.concerns?.length > 0 ? t.warn : t.ok,
                border: `1px solid ${photoAnalysis.concerns?.length > 0 ? t.warnBorder : t.okBorder}`,
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
                fontSize: 14,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div><strong>Ingredients:</strong> {photoAnalysis.ingredients?.join(", ") || "–"}</div>
              {photoAnalysis.concerns?.length > 0 && (
                <div>
                  <strong>⚠️ Concerns:</strong>{" "}
                  <span style={{ color: t.warn }}>
                    {photoAnalysis.concerns.join(", ")}
                  </span>
                </div>
              )}
              {photoAnalysis.confidence && (
                <div style={{ fontSize: 12, color: t.textMuted }}>
                  Confidence: {photoAnalysis.confidence}
                </div>
              )}
            </div>
          )}
          {analysisError && (
            <div style={{
              color: t.err,
              background: t.errBg,
              border: `1px solid ${t.errBorder}`,
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 13,
              marginBottom: 8,
            }}>
              {analysisError}
            </div>
          )}
        </div>

        {/* Description */}
        <label style={styles.label} htmlFor="meal-description">Meal description</label>
        <input
          id="meal-description"
          style={styles.input}
          placeholder="Breakfast, snack, juice, etc."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        {/* Estimated carbs */}
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

        {/* Notes */}
        <label style={styles.label} htmlFor="meal-notes">Notes (optional)</label>
        <textarea
          id="meal-notes"
          style={styles.textarea}
          placeholder="Additional details or context"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
        />

        {/* Actions */}
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
    maxHeight: "85vh",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
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
    boxSizing: "border-box",
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
    boxSizing: "border-box",
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

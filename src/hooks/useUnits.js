import { useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./useAuth";

const MG_PER_MMOL = 18.0182;

export function useUnits() {
  const { user } = useAuth();
  const [unit, setUnitState] = useState("mmol");

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    return onSnapshot(ref, snap => {
      const pref = snap.data()?.unitPreference;
      if (pref) setUnitState(pref);
    });
  }, [user]);

  const setUnit = async (newUnit) => {
    if (!user) return;
    setUnitState(newUnit);
    await updateDoc(doc(db, "users", user.uid), { unitPreference: newUnit });
  };

  // mmol/L → display unit (number)
  const convert = (mmolValue) => {
    if (mmolValue == null) return null;
    return unit === "mgdl"
      ? Math.round(mmolValue * MG_PER_MMOL)
      : mmolValue;
  };

  // mmol/L → formatted string
  const fmt = (mmolValue) => {
    const v = convert(mmolValue);
    if (v == null) return "—";
    return unit === "mgdl" ? String(v) : v.toFixed(1);
  };

  const displayUnit = unit === "mgdl" ? "mg/dL" : "mmol/L";

  return { unit, setUnit, convert, fmt, displayUnit };
}

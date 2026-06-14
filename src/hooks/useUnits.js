import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useAuth } from "./useAuth";

const MG_PER_MMOL = 18.0182;

export function useUnits() {
  const { user } = useAuth();
  const [unit, setUnitState] = useState("mmol");

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data } = await supabase.from("profiles").select("unit_preference").eq("id", user.uid).maybeSingle();
      if (data?.unit_preference) setUnitState(data.unit_preference);
    };
    load();

    const channel = supabase
      .channel(`profile-units-${user.uid}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.uid}` }, (payload) => {
        if (payload.new?.unit_preference) setUnitState(payload.new.unit_preference);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  const setUnit = async (newUnit) => {
    if (!user) return;
    setUnitState(newUnit);
    await supabase.from("profiles").update({ unit_preference: newUnit }).eq("id", user.uid);
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

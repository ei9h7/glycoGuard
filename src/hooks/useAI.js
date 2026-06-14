import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useAuth } from "./useAuth";

/**
 * useAI — reads and writes the ai_enabled preference from profiles.
 *
 * aiEnabled  — boolean for rendering (true for existing users who never set this field)
 * aiNeverSet — true when the field has never been explicitly written; triggers the opt-in modal
 * loading    — true until the first row fetch resolves
 * setAIEnabled(bool) — writes the value immediately
 */
export function useAI() {
  const { user }                       = useAuth();
  const [aiEnabled, setAIEnabledLocal] = useState(true);   // ?? true: existing users default enabled
  const [aiNeverSet, setAINeverSet]    = useState(false);  // starts false — no modal flash on load
  const [loading, setLoading]          = useState(true);

  useEffect(() => {
    if (!user) return;

    const apply = (row) => {
      setAINeverSet(row?.ai_enabled == null);
      setAIEnabledLocal(row?.ai_enabled ?? true);
      setLoading(false);
    };

    supabase.from("profiles").select("ai_enabled").eq("id", user.uid).maybeSingle()
      .then(({ data }) => apply(data));

    const channel = supabase
      .channel(`profile-ai-${user.uid}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.uid}` }, (payload) => apply(payload.new))
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  const setAIEnabled = async (value) => {
    if (!user) return;
    setAIEnabledLocal(value);
    setAINeverSet(false);
    await supabase.from("profiles").update({ ai_enabled: value }).eq("id", user.uid);
  };

  return { aiEnabled, aiNeverSet, setAIEnabled, loading };
}

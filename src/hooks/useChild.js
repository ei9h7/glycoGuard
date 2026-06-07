import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { mapChild } from "../services/dbMappers";
import { useAuth } from "./useAuth";

export function useChild() {
  const { user, loading: authLoading } = useAuth();
  const [child,   setChild]   = useState(null);
  const [childId, setChildId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChild(null);
      setChildId(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    const load = async () => {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .eq("owner_id", user.uid)
        .limit(1)
        .maybeSingle();
      if (error) console.error("useChild fetch error:", error);
      setChild(mapChild(data));
      setChildId(data?.id ?? null);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`children-owner-${user.uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "children", filter: `owner_id=eq.${user.uid}` }, load)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, authLoading]);

  return { child, childId, loading };
}

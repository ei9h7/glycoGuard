import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import { useAuth } from "./useAuth";
import { useChild } from "./useChild";
import { generatePatterns } from "../services/patternEngine";

const SIX_HOURS = 6 * 60 * 60 * 1000;

export function usePatterns() {
  const { user }           = useAuth();
  const { child, childId } = useChild();

  const [patterns,    setPatterns]    = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const didAutoRefresh = useRef(false);

  // Live subscription on pattern_summaries row for this child
  useEffect(() => {
    if (!user || !childId) { setLoading(false); return; }

    const apply = (row) => {
      if (row) {
        setPatterns(row.patterns || []);
        setLastUpdated(row.generated_at ? new Date(row.generated_at) : null);
      } else {
        setPatterns([]);
        setLastUpdated(null);
      }
      setLoading(false);
    };

    supabase.from("pattern_summaries").select("*").eq("child_id", childId).maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("usePatterns fetch error:", error);
        apply(data);
      });

    const channel = supabase
      .channel(`pattern-summary-${childId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pattern_summaries", filter: `child_id=eq.${childId}` },
        (payload) => apply(payload.new))
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, childId]);

  // Auto-refresh once after initial load if data is stale or missing
  useEffect(() => {
    if (loading || didAutoRefresh.current || !user || !child || !childId) return;
    didAutoRefresh.current = true;

    if (!lastUpdated || Date.now() - lastUpdated.getTime() > SIX_HOURS) {
      generatePatterns(user.uid, childId, child).catch(e =>
        console.warn("Auto pattern refresh failed:", e.message)
      );
    }
  }, [loading, user, child, childId, lastUpdated]);

  const refresh = useCallback(async () => {
    if (!user || !child || !childId || refreshing) return;
    setRefreshing(true);
    try {
      await generatePatterns(user.uid, childId, child);
    } catch (e) {
      console.error("Pattern refresh failed:", e.message);
    } finally {
      setRefreshing(false);
    }
  }, [user, child, childId, refreshing]);

  return { patterns, lastUpdated, loading, refreshing, refresh };
}

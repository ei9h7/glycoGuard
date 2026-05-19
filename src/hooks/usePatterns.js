import { useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
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

  // Live listener on patternSummary/latest
  useEffect(() => {
    if (!user || !childId) { setLoading(false); return; }

    const ref = doc(db, "users", user.uid, "children", childId, "patternSummary", "latest");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPatterns(data.patterns || []);
        const ts = data.generatedAt?.toDate ? data.generatedAt.toDate() : null;
        setLastUpdated(ts);
      } else {
        setPatterns([]);
        setLastUpdated(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("usePatterns snapshot error:", err);
      setLoading(false);
    });

    return unsub;
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

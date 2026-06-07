import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { mapGlucoseReading, mapMealLog, mapSymptomEvent } from "../services/dbMappers";
import { useChild } from "./useChild";
import { useAuth } from "./useAuth";

const TABLE_MAPPERS = {
  glucose_readings: mapGlucoseReading,
  meal_logs:        mapMealLog,
  symptom_events:   mapSymptomEvent,
};

/*
 * useSharedCollection — internal hook.
 *
 * Fetches + subscribes to one's own rows for {table}, plus the co-parent's rows
 * when:
 *   - coParentStatus === 'connected'
 *   - child.sharing[category] === true   (current user has consented)
 *   - coParentChild.sharing[category] === true  (co-parent has consented)
 *
 * Each record is tagged with _from: 'mine' | 'coparent'.
 * Co-parent row IDs are prefixed with 'cp_' to avoid collisions with own IDs.
 */
function useSharedCollection(table, category) {
  const { user } = useAuth();
  const { child, childId } = useChild();
  const mapRow = TABLE_MAPPERS[table];

  const [myData,    setMyData]    = useState([]);
  const [coData,    setCoData]    = useState([]);
  const [coSharing, setCoSharing] = useState(null); // null = not yet fetched
  const [myLoading, setMyLoading] = useState(true);

  const connected = child?.coParentStatus === "connected";
  const myOn      = child?.sharing?.[category] === true;
  const coOn      = coSharing?.[category] === true;
  const active    = connected && myOn && coOn;

  // Fetch the co-parent's sharing consent map once per connection state change.
  useEffect(() => {
    if (!connected || !child?.coParentUid || !child?.coParentChildId) {
      setCoSharing(null);
      return;
    }
    supabase.from("children").select("sharing").eq("id", child.coParentChildId).maybeSingle()
      .then(({ data }) => setCoSharing(data?.sharing ?? {}))
      .catch(() => setCoSharing({}));
  }, [connected, child?.coParentUid, child?.coParentChildId]);

  // Own rows: fetch + realtime subscription.
  useEffect(() => {
    if (!user || !childId) return;

    const load = async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("child_id", childId)
        .order("timestamp", { ascending: false });
      if (!error) setMyData((data || []).map(r => ({ id: r.id, _from: "mine", ...mapRow(r) })));
      setMyLoading(false);
    };
    load();

    const channel = supabase
      .channel(`${table}-mine-${childId}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter: `child_id=eq.${childId}` }, load)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, childId, table]);

  // Co-parent rows: only when both sides have mutually consented for this category.
  useEffect(() => {
    if (!active || !child?.coParentChildId) {
      setCoData([]);
      return;
    }
    const coChildId = child.coParentChildId;

    const load = async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("child_id", coChildId)
        .order("timestamp", { ascending: false });
      if (!error) setCoData((data || []).map(r => ({ id: `cp_${r.id}`, _from: "coparent", ...mapRow(r) })));
    };
    load();

    const channel = supabase
      .channel(`${table}-coparent-${coChildId}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter: `child_id=eq.${coChildId}` }, load)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [active, child?.coParentChildId, table]);

  const merged = [...myData, ...coData].sort((a, b) => {
    const at = a.timestamp?.toDate?.()?.getTime() ?? 0;
    const bt = b.timestamp?.toDate?.()?.getTime() ?? 0;
    return bt - at;
  });

  return { data: merged, loading: myLoading };
}

export function useSharedGlucose() {
  const { data, loading } = useSharedCollection("glucose_readings", "glucose");
  return { readings: data, loading };
}

export function useSharedMeals() {
  const { data, loading } = useSharedCollection("meal_logs", "meals");
  return { meals: data, loading };
}

export function useSharedSymptoms() {
  const { data, loading } = useSharedCollection("symptom_events", "symptoms");
  return { symptoms: data, loading };
}

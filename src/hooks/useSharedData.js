import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, getDoc, doc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useChild } from "./useChild";

/*
 * useSharedCollection — internal hook.
 *
 * Sets up two real-time listeners: one for the current user's data, one for the
 * co-parent's data. The co-parent listener is only active when:
 *   - coParentStatus === 'connected' (both sides ran coParentMatch successfully)
 *   - child.sharing[category] === true   (current user has consented)
 *   - coParentChild.sharing[category] === true  (co-parent has consented)
 *
 * Falls back gracefully to current-user-only data when no co-parent connection
 * exists or the category is not mutually consented.
 *
 * Each record is tagged with _from: 'mine' | 'coparent'.
 * Co-parent doc IDs are prefixed with 'cp_' to avoid collisions with own IDs.
 */
function useSharedCollection(collectionName, category) {
  const { child, childId } = useChild();

  const [myData,    setMyData]    = useState([]);
  const [coData,    setCoData]    = useState([]);
  const [coSharing, setCoSharing] = useState(null); // null = not yet fetched
  const [myLoading, setMyLoading] = useState(true);

  const connected = child?.coParentStatus === "connected";
  const myOn      = child?.sharing?.[category] === true;
  const coOn      = coSharing?.[category] === true;
  const active    = connected && myOn && coOn;

  // Fetch the co-parent's sharing consent map once per connection state change.
  // A full listener isn't warranted here — consent changes are infrequent and
  // the Sharing screen handles real-time display of that state.
  useEffect(() => {
    if (!connected || !child?.coParentUid || !child?.coParentChildId) {
      setCoSharing(null);
      return;
    }
    getDoc(doc(db, "users", child.coParentUid, "children", child.coParentChildId))
      .then(snap => setCoSharing(snap.exists() ? (snap.data().sharing ?? {}) : {}))
      .catch(() => setCoSharing({}));
  }, [connected, child?.coParentUid, child?.coParentChildId]);

  // Real-time listener for the current user's collection.
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !childId) return;
    const q = query(
      collection(db, "users", uid, "children", childId, collectionName),
      orderBy("timestamp", "desc")
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setMyData(snap.docs.map(d => ({ id: d.id, _from: "mine", ...d.data() })));
        setMyLoading(false);
      },
      () => setMyLoading(false)
    );
    return unsub;
  }, [childId, collectionName]);

  // Real-time listener for the co-parent's collection.
  // Only runs when both parents have consented for this category.
  useEffect(() => {
    if (!active || !child?.coParentUid || !child?.coParentChildId) {
      setCoData([]);
      return;
    }
    const q = query(
      collection(db, "users", child.coParentUid, "children", child.coParentChildId, collectionName),
      orderBy("timestamp", "desc")
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setCoData(snap.docs.map(d => ({ id: `cp_${d.id}`, _from: "coparent", ...d.data() })));
      },
      () => setCoData([])
    );
    return unsub;
  }, [active, child?.coParentUid, child?.coParentChildId, collectionName]);

  const merged = [...myData, ...coData].sort((a, b) => {
    const at = a.timestamp?.toDate?.()?.getTime() ?? 0;
    const bt = b.timestamp?.toDate?.()?.getTime() ?? 0;
    return bt - at;
  });

  return { data: merged, loading: myLoading };
}

export function useSharedGlucose() {
  const { data, loading } = useSharedCollection("glucoseReadings", "glucose");
  return { readings: data, loading };
}

export function useSharedMeals() {
  const { data, loading } = useSharedCollection("mealLogs", "meals");
  return { meals: data, loading };
}

export function useSharedSymptoms() {
  const { data, loading } = useSharedCollection("symptomEvents", "symptoms");
  return { symptoms: data, loading };
}

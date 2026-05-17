import { useState, useEffect } from "react";
import { collection, query, limit, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
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
    const q = query(
      collection(db, "users", user.uid, "children"),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const doc = snap.docs[0];
        setChild({ id: doc.id, ...doc.data() });
        setChildId(doc.id);
      } else {
        setChild(null);
        setChildId(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("useChild snapshot error:", error);
      setLoading(false);
    });
    return unsub;
  }, [user, authLoading]);

  return { child, childId, loading };
}
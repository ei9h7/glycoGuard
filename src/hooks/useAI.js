import { useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./useAuth";

/**
 * useAI — reads and writes the aiEnabled preference from users/{userId}.
 *
 * aiEnabled  — boolean for rendering (true for existing users who never set this field)
 * aiNeverSet — true when the field has never been explicitly written; triggers the opt-in modal
 * loading    — true until the first Firestore snapshot resolves
 * setAIEnabled(bool) — writes the value immediately to Firestore
 */
export function useAI() {
  const { user }                       = useAuth();
  const [aiEnabled, setAIEnabledLocal] = useState(true);   // ?? true: existing users default enabled
  const [aiNeverSet, setAINeverSet]    = useState(false);  // starts false — no modal flash on load
  const [loading, setLoading]          = useState(true);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    return onSnapshot(ref, snap => {
      const data = snap.data() ?? {};
      setAINeverSet(!("aiEnabled" in data));
      setAIEnabledLocal(data.aiEnabled ?? true);
      setLoading(false);
    });
  }, [user]);

  const setAIEnabled = async (value) => {
    if (!user) return;
    setAIEnabledLocal(value);
    setAINeverSet(false);
    await updateDoc(doc(db, "users", user.uid), { aiEnabled: value });
  };

  return { aiEnabled, aiNeverSet, setAIEnabled, loading };
}

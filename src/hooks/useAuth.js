import { useState, useEffect } from "react";
import { supabase } from "../supabase";

// Normalizes the Supabase user object to also expose `.uid` (Firebase's field
// name), so the ~30 existing `user.uid` call sites across the app keep working
// without a sweeping rename during the Firebase → Supabase migration.
function normalize(user) {
  if (!user) return null;
  return { ...user, uid: user.id, displayName: user.user_metadata?.full_name ?? user.user_metadata?.displayName ?? null };
}

export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(normalize(session?.user));
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(normalize(session?.user));
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}

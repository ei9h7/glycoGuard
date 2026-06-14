import { useState, useEffect } from "react";
import { supabase } from "../supabase";

// Normalizes the Supabase user object to also expose `.uid` (Firebase's field
// name), so the ~30 existing `user.uid` call sites across the app keep working
// without a sweeping rename during the Firebase → Supabase migration.
function normalize(user) {
  if (!user) return null;
  return { ...user, uid: user.id, displayName: user.user_metadata?.full_name ?? user.user_metadata?.displayName ?? null };
}

// Ensures a profiles row exists for the authenticated user. Needed because
// signUp() may not return an active session (email confirmation enabled),
// so the profile can't be created at signup time — it's created on first
// authenticated session instead.
async function ensureProfile(user) {
  if (!user) return;
  const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existing) return;
  await supabase.from("profiles").insert({
    id:              user.id,
    display_name:    user.user_metadata?.full_name ?? user.user_metadata?.displayName ?? null,
    unit_preference: "mmol",
  });
}

export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(normalize(session?.user));
      setLoading(false);
      if (session?.user) ensureProfile(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(normalize(session?.user));
      setLoading(false);
      if (session?.user) ensureProfile(session.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}

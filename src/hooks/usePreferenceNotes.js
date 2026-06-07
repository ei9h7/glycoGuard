import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { mapPreferenceNote } from "../services/dbMappers";
import { useAuth } from "./useAuth";
import { useChild } from "./useChild";
import { upsertVector, deleteVector } from "../services/vectorStore";

// Preference notes are stored in TWO places:
// 1. Postgres — for listing, editing, deleting (structured metadata)
// 2. Pinecone — for semantic retrieval by the AI (the actual text embedding)
// The Postgres row ID is used as the Pinecone vector ID to keep them in sync.

export function usePreferenceNotes() {
  const { user } = useAuth();
  const { childId } = useChild();
  const [notes,   setNotes]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("preference_notes")
        .select("*")
        .eq("child_id", childId)
        .order("created_at", { ascending: false });
      if (!error) setNotes((data || []).map(r => ({ id: r.id, ...mapPreferenceNote(r) })));
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`preference-notes-${childId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "preference_notes", filter: `child_id=eq.${childId}` }, load)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [childId]);

  const addNote = async (content) => {
    if (!content.trim() || !childId) return;
    const userId = user.uid;

    const { data: row, error } = await supabase
      .from("preference_notes")
      .insert({ content: content.trim(), logged_by: userId, child_id: childId })
      .select()
      .single();
    if (error) { console.error("Failed to save preference note:", error); return; }

    try {
      await upsertVector({
        id:      row.id,
        content: content.trim(),
        userId,
        childId,
        type:    "preference_note",
        tags:    ["preference", "dietary"],
      });
    } catch (err) {
      console.error("Vector upsert failed (note saved to Postgres):", err);
    }

    return row.id;
  };

  const removeNote = async (noteId) => {
    await supabase.from("preference_notes").delete().eq("id", noteId);
    try {
      await deleteVector(noteId);
    } catch (err) {
      console.error("Vector delete failed:", err);
    }
  };

  return { notes, loading, addNote, removeNote };
}

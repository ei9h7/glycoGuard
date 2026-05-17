import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useChild } from "./useChild";
import { upsertVector, deleteVector } from "../services/vectorStore";

// Preference notes are stored in TWO places:
// 1. Firestore — for listing, editing, deleting (structured metadata)
// 2. Pinecone — for semantic retrieval by the AI (the actual text embedding)
// The Firestore doc ID is used as the Pinecone vector ID to keep them in sync.

export function usePreferenceNotes() {
  const { childId } = useChild();
  const [notes,   setNotes]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) return;
    const userId = auth.currentUser.uid;
    const q = query(
      collection(db, "users", userId, "children", childId, "preferenceNotes"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, snap => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [childId]);

  const addNote = async (content) => {
    if (!content.trim() || !childId) return;
    const userId = auth.currentUser.uid;

    // Write to Firestore first to get the ID
    const ref = await addDoc(
      collection(db, "users", userId, "children", childId, "preferenceNotes"),
      {
        content:   content.trim(),
        createdAt: serverTimestamp(),
        loggedBy:  userId,
      }
    );

    // Embed and upsert to Pinecone using the Firestore doc ID
    try {
      await upsertVector({
        id:      ref.id,
        content: content.trim(),
        userId,
        childId,
        type:    "preference_note",
        tags:    ["preference", "dietary"],
      });
    } catch (err) {
      console.error("Vector upsert failed (note saved to Firestore):", err);
      // Non-fatal — note is still saved to Firestore, vector can be re-synced later
    }

    return ref.id;
  };

  const removeNote = async (noteId) => {
    const userId = auth.currentUser.uid;
    await deleteDoc(doc(db, "users", userId, "children", childId, "preferenceNotes", noteId));
    try {
      await deleteVector(noteId);
    } catch (err) {
      console.error("Vector delete failed:", err);
    }
  };

  return { notes, loading, addNote, removeNote };
}

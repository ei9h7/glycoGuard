import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useChild } from "./useChild";
import { extractTextFromPDF, chunkText } from "../services/pdfExtractor";
import { upsertVector, deleteVector } from "../services/vectorStore";

// Documents are stored in TWO places:
// 1. Firestore — metadata + extracted text (filename, type, extractedText, createdAt)
// 2. Pinecone — extracted text embedding for AI retrieval
// The Firestore doc ID is used as the Pinecone vector ID to keep them in sync.

export function useDocuments() {
  const { childId } = useChild();
  const [documents, setDocuments] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!childId) return;
    const userId = auth.currentUser.uid;
    const q = query(
      collection(db, "users", userId, "children", childId, "documents"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, snap => {
      setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [childId]);

  const uploadDocument = async (file, type) => {
    if (!file || !childId) return;
    const userId = auth.currentUser.uid;

    // Extract text first — fail fast before touching Firestore
    const extractedText = await extractTextFromPDF(file);
    const chunks = chunkText(extractedText);

    // Write Firestore record
    const docRef = doc(collection(db, "users", userId, "children", childId, "documents"));
    const docId  = docRef.id;

    await setDoc(docRef, {
      filename:      file.name,
      type,
      extractedText,
      chunkCount:    chunks.length,
      createdAt:     serverTimestamp(),
      loggedBy:      userId,
    });

    // Embed and upsert each chunk to Pinecone — non-fatal
    try {
      for (let i = 0; i < chunks.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 500));
        await upsertVector({
          id:         `${docId}-${i}`,
          content:    chunks[i],
          userId,
          childId,
          type,
          sourceFile:  file.name,
          chunkIndex:  i,
          totalChunks: chunks.length,
        });
      }
    } catch (err) {
      console.error("Vector upsert failed (document saved to Firestore):", err);
    }

    return docId;
  };

  const removeDocument = async (docId) => {
    const userId = auth.currentUser.uid;
    const record = documents.find(d => d.id === docId);

    await deleteDoc(doc(db, "users", userId, "children", childId, "documents", docId));

    try {
      if (record?.chunkCount) {
        for (let i = 0; i < record.chunkCount; i++) {
          await deleteVector(`${docId}-${i}`);
        }
      } else {
        // Legacy documents upserted under the bare docId
        await deleteVector(docId);
      }
    } catch (err) {
      console.error("Vector delete failed:", err);
    }
  };

  return { documents, loading, uploadDocument, removeDocument };
}

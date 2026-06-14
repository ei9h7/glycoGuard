import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { mapDocument } from "../services/dbMappers";
import { useAuth } from "./useAuth";
import { useChild } from "./useChild";
import { extractTextFromPDF, chunkText } from "../services/pdfExtractor";
import { upsertVector, deleteVector } from "../services/vectorStore";

// Documents are stored in TWO places:
// 1. Postgres — metadata + extracted text (filename, type, extractedText, createdAt)
// 2. Pinecone — extracted text embedding for AI retrieval
// The Postgres row ID is used as the Pinecone vector ID prefix to keep them in sync.

export function useDocuments() {
  const { user } = useAuth();
  const { childId } = useChild();
  const [documents, setDocuments] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!childId) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("child_id", childId)
        .order("created_at", { ascending: false });
      if (!error) setDocuments((data || []).map(r => ({ id: r.id, ...mapDocument(r) })));
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`documents-${childId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `child_id=eq.${childId}` }, load)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [childId]);

  const uploadDocument = async (file, type) => {
    if (!file || !childId) return;
    const userId = user.uid;

    // Extract text first — fail fast before touching the database
    const extractedText = await extractTextFromPDF(file);
    const chunks = chunkText(extractedText);

    const { data: row, error } = await supabase
      .from("documents")
      .insert({
        filename:       file.name,
        type,
        extracted_text: extractedText,
        chunk_count:    chunks.length,
        logged_by:      userId,
        child_id:       childId,
      })
      .select()
      .single();
    if (error) throw error;
    const docId = row.id;

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
      console.error("Vector upsert failed (document saved to Postgres):", err);
    }

    return docId;
  };

  const removeDocument = async (docId) => {
    const record = documents.find(d => d.id === docId);

    await supabase.from("documents").delete().eq("id", docId);

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

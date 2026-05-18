// src/services/vectorStore.js
//
// Direct API implementation for dev — calls Voyage AI and Pinecone
// from the frontend. Safe for single-user dev with private repo.
//
// TODO: swap to Firebase Cloud Functions before multi-user production deploy.
// The interface (upsertVector, searchVectors, deleteVector) stays identical —
// only this file changes when we make that swap.

const VOYAGE_API_KEY  = import.meta.env.VITE_VOYAGE_API_KEY;
const PINECONE_API_KEY = import.meta.env.VITE_PINECONE_API_KEY;
const PINECONE_INDEX   = import.meta.env.VITE_PINECONE_INDEX || "glycoguard-dev";

// Pinecone serverless host — get this from your index page in the Pinecone console
// Looks like: https://glycoguard-dev-xxxxxxxxxxxx.svc.aped-xxxx-xxxx.pinecone.io
const PINECONE_HOST = import.meta.env.VITE_PINECONE_HOST;

// ── Embedding ─────────────────────────────────────────────────────────────────
async function getEmbedding(text) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "voyage-code-3",
      input: [text],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voyage API error: ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

// ── upsertVector ──────────────────────────────────────────────────────────────
export async function upsertVector({ id, content, childId, type, tags = [], sourceFile = null, userId }) {
  if (!PINECONE_HOST) throw new Error("VITE_PINECONE_HOST is not set — check your .env");

  const embedding = await getEmbedding(content);

  const res = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key":      PINECONE_API_KEY,
    },
    body: JSON.stringify({
      vectors: [{
        id,
        values: embedding,
        metadata: Object.fromEntries(
          Object.entries({
            userId,
            childId,
            type,
            content,
            sourceFile,
            tags,
            timestamp: new Date().toISOString(),
          }).filter(([, v]) => v != null)
        ),
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinecone upsert error: ${err}`);
  }

  return { success: true, id };
}

// ── searchVectors ─────────────────────────────────────────────────────────────
export async function searchVectors({ query, childId, topK = 5, type = null, userId }) {
  if (!PINECONE_HOST) throw new Error("VITE_PINECONE_HOST is not set — check your .env");

  const embedding = await getEmbedding(query);

  const filter = { userId: { "$eq": userId }, childId: { "$eq": childId } };
  if (type) filter.type = { "$eq": type };

  const res = await fetch(`${PINECONE_HOST}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key":      PINECONE_API_KEY,
    },
    body: JSON.stringify({
      vector:          embedding,
      topK,
      filter,
      includeMetadata: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinecone query error: ${err}`);
  }

  const data = await res.json();
  return data.matches.map(m => ({
    id:        m.id,
    score:     m.score,
    content:   m.metadata.content,
    type:      m.metadata.type,
    tags:      m.metadata.tags,
    timestamp: m.metadata.timestamp,
  }));
}

// ── deleteVector ──────────────────────────────────────────────────────────────
export async function deleteVector(id) {
  if (!PINECONE_HOST) throw new Error("VITE_PINECONE_HOST is not set — check your .env");

  const res = await fetch(`${PINECONE_HOST}/vectors/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key":      PINECONE_API_KEY,
    },
    body: JSON.stringify({ ids: [id] }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinecone delete error: ${err}`);
  }

  return { success: true };
}
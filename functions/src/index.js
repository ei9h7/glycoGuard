const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions }   = require("firebase-functions/v2");
const { initializeApp }      = require("firebase-admin/app");
const { Pinecone }           = require("@pinecone-database/pinecone");
const fetch                  = require("node-fetch");

initializeApp();
setGlobalOptions({ region: "us-central1" });

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPinecone() {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) throw new HttpsError("internal", "Pinecone API key not configured");
  return new Pinecone({ apiKey });
}

async function getEmbedding(text) {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new HttpsError("internal", "Voyage API key not configured");

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "voyage-3-lite",
      input: [text],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new HttpsError("internal", `Voyage API error: ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

function assertAuth(context) {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  return context.auth.uid;
}

// ── embedAndUpsert ────────────────────────────────────────────────────────────
// Embeds text and stores it in Pinecone with metadata
// Called when: preference note saved, symptom observation saved,
//              lab result uploaded, provider letter uploaded
//
// data: {
//   id:       string   — unique doc ID (Firestore doc ID recommended)
//   content:  string   — the text to embed
//   childId:  string
//   type:     "preference_note" | "clinical_observation" | "lab_result" |
//             "provider_note" | "pattern_summary" | "uploaded_document"
//   tags?:    string[]
//   sourceFile?: string
// }

exports.embedAndUpsert = onCall(async (request) => {
  const userId = assertAuth(request);
  const { id, content, childId, type, tags = [], sourceFile = null } = request.data;

  if (!id || !content || !childId || !type) {
    throw new HttpsError("invalid-argument", "id, content, childId, and type are required.");
  }

  const embedding = await getEmbedding(content);

  const pc    = getPinecone();
  const index = pc.index(process.env.PINECONE_INDEX || "glycoguard-dev");

  await index.upsert([{
    id,
    values: embedding,
    metadata: {
      userId,
      childId,
      type,
      content,           // stored for retrieval without re-embedding
      sourceFile,
      tags,
      timestamp: new Date().toISOString(),
    },
  }]);

  return { success: true, id };
});

// ── semanticSearch ────────────────────────────────────────────────────────────
// Embeds a query and searches Pinecone, filtered to the calling user's child
//
// data: {
//   query:    string
//   childId:  string
//   topK?:    number  (default 5)
//   type?:    string  (optional filter by document type)
// }

exports.semanticSearch = onCall(async (request) => {
  const userId = assertAuth(request);
  const { query, childId, topK = 5, type = null } = request.data;

  if (!query || !childId) {
    throw new HttpsError("invalid-argument", "query and childId are required.");
  }

  const embedding = await getEmbedding(query);

  const pc    = getPinecone();
  const index = pc.index(process.env.PINECONE_INDEX || "glycoguard-dev");

  const filter = { userId: { $eq: userId }, childId: { $eq: childId } };
  if (type) filter.type = { $eq: type };

  const results = await index.query({
    vector:          embedding,
    topK,
    filter,
    includeMetadata: true,
  });

  return {
    matches: results.matches.map(m => ({
      id:       m.id,
      score:    m.score,
      content:  m.metadata.content,
      type:     m.metadata.type,
      tags:     m.metadata.tags,
      timestamp:m.metadata.timestamp,
    })),
  };
});

// ── deleteVector ──────────────────────────────────────────────────────────────
// Removes a vector by ID — called when a note or document is deleted
//
// data: { id: string }

exports.deleteVector = onCall(async (request) => {
  assertAuth(request);
  const { id } = request.data;

  if (!id) throw new HttpsError("invalid-argument", "id is required.");

  const pc    = getPinecone();
  const index = pc.index(process.env.PINECONE_INDEX || "glycoguard-dev");

  await index.deleteOne(id);
  return { success: true };
});

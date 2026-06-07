const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions }   = require("firebase-functions/v2");
const { defineSecret }       = require("firebase-functions/params");
const { initializeApp }      = require("firebase-admin/app");
const { Pinecone }           = require("@pinecone-database/pinecone");
const fetch                  = require("node-fetch");

initializeApp();
setGlobalOptions({ region: "us-central1" });

// Secrets must be explicitly bound to each function (via the `secrets` option
// below) for firebase-functions v2 to populate process.env at runtime — they
// are set with `firebase functions:secrets:set <NAME>`.
const VOYAGE_API_KEY   = defineSecret("VOYAGE_API_KEY");
const PINECONE_API_KEY = defineSecret("PINECONE_API_KEY");
const PINECONE_INDEX   = defineSecret("PINECONE_INDEX");
const OPENROUTER_API_KEY = defineSecret("OPENROUTER_API_KEY");

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

exports.embedAndUpsert = onCall(
  { secrets: [VOYAGE_API_KEY, PINECONE_API_KEY, PINECONE_INDEX] },
  async (request) => {
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
  }
);

// ── semanticSearch ────────────────────────────────────────────────────────────
// Embeds a query and searches Pinecone, filtered to the calling user's child
//
// data: {
//   query:    string
//   childId:  string
//   topK?:    number  (default 5)
//   type?:    string  (optional filter by document type)
// }

exports.semanticSearch = onCall(
  { secrets: [VOYAGE_API_KEY, PINECONE_API_KEY, PINECONE_INDEX] },
  async (request) => {
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
  }
);

// ── deleteVector ──────────────────────────────────────────────────────────────
// Removes a vector by ID — called when a note or document is deleted
//
// data: { id: string }

exports.deleteVector = onCall(
  { secrets: [PINECONE_API_KEY, PINECONE_INDEX] },
  async (request) => {
  assertAuth(request);
  const { id } = request.data;

  if (!id) throw new HttpsError("invalid-argument", "id is required.");

  const pc    = getPinecone();
  const index = pc.index(process.env.PINECONE_INDEX || "glycoguard-dev");

  await index.deleteOne(id);
  return { success: true };
  }
);

// ── aiChat ────────────────────────────────────────────────────────────────────
// Proxies OpenRouter chat completions so the API key stays server-side.
//
// data: {
//   messages:     { role: string, content: string }[]
//   systemPrompt?: string   — prepended as a system message if provided
//   maxTokens?:   number    — default 1000
// }

exports.aiChat = onCall(
  { secrets: [OPENROUTER_API_KEY] },
  async (request) => {
  assertAuth(request);
  const { messages, systemPrompt, maxTokens = 1000 } = request.data;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new HttpsError("invalid-argument", "messages array is required.");
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new HttpsError("internal", "OpenRouter API key not configured");

  const payload = {
    model:      "openrouter/auto",
    max_tokens: maxTokens,
    messages:   systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages,
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer":  "https://glycoguard.app",
      "X-Title":       "GlycoGuard",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new HttpsError("internal", `OpenRouter error: ${err}`);
  }

  const data = await res.json();
  return { content: data.choices[0].message.content };
  }
);

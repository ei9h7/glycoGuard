// src/services/vectorStore.js
//
// Thin client wrappers around the Firebase Cloud Functions that handle
// embedding and vector storage server-side. API keys never reach the browser.
// The exported interface (upsertVector, searchVectors, deleteVector) is
// identical to the old direct-API implementation so callers need no changes.

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

const embedAndUpsertFn = httpsCallable(functions, "embedAndUpsert");
const semanticSearchFn = httpsCallable(functions, "semanticSearch");
const deleteVectorFn   = httpsCallable(functions, "deleteVector");

export async function upsertVector({ id, content, childId, type, tags = [], sourceFile = null }) {
  const result = await embedAndUpsertFn({ id, content, childId, type, tags, sourceFile });
  return result.data;
}

export async function searchVectors({ query, childId, topK = 5, type = null }) {
  const result = await semanticSearchFn({ query, childId, topK, type });
  return result.data.matches;
}

export async function deleteVector(id) {
  const result = await deleteVectorFn({ id });
  return result.data;
}

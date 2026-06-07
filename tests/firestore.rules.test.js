// tests/firestore.rules.test.js
//
// Firestore security rules tests, run against the Firestore emulator via
// `npm run test:rules` (which wraps this in `firebase emulators:exec`).

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { beforeAll, afterAll, afterEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));

const OWNER_UID = "owner-uid";
const OWNER_EMAIL = "owner@example.com";
const COPARENT_UID = "coparent-uid";
const COPARENT_EMAIL = "coparent@example.com";
const STRANGER_UID = "stranger-uid";
const CHILD_ID = "child-1";
const COPARENT_CHILD_ID = "child-2";

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "glycoguard-rules-test",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// ── Seed helpers (bypass rules via an admin context) ─────────────────────────

function baseChild(overrides = {}) {
  return {
    name: "Test Child",
    diagnosis: "Hyperinsulinism",
    glucoseTargetMin: 4.0,
    glucoseTargetMax: 8.0,
    coParentStatus: "none",
    coParentUid: null,
    coParentChildId: null,
    coParentEmail: null,
    sharing: {
      glucose: false,
      meals: false,
      symptoms: false,
      documents: false,
      patterns: false,
    },
    createdAt: Timestamp.now(),
    ...overrides,
  };
}

async function seedChild(uid, childId, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `users/${uid}/children/${childId}`), baseChild(overrides));
  });
}

async function seedRateLimits(uid, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `_rateLimits/${uid}`), {
      glucoseCount: 0,
      glucoseWindow: Timestamp.now(),
      mealCount: 0,
      mealWindow: Timestamp.now(),
      symptomCount: 0,
      symptomWindow: Timestamp.now(),
      documentCount: 0,
      documentWindow: Timestamp.now(),
      prefNoteCount: 0,
      prefNoteWindow: Timestamp.now(),
      ...overrides,
    });
  });
}

function ownerCtx() {
  return testEnv.authenticatedContext(OWNER_UID, { email: OWNER_EMAIL });
}
function coParentCtx() {
  return testEnv.authenticatedContext(COPARENT_UID, { email: COPARENT_EMAIL });
}
function strangerCtx() {
  return testEnv.authenticatedContext(STRANGER_UID, { email: "stranger@example.com" });
}

// ── users/{uid} ───────────────────────────────────────────────────────────────

describe("users/{uid}", () => {
  it("lets a user create their own profile with valid fields", async () => {
    const db = ownerCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}`), {
        displayName: "Alex Parent",
        unitPreference: "mmol",
        createdAt: serverTimestamp(),
      })
    );
  });

  it("rejects profile creation with an invalid unitPreference", async () => {
    const db = ownerCtx().firestore();
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}`), {
        displayName: "Alex Parent",
        unitPreference: "furlongs",
        createdAt: serverTimestamp(),
      })
    );
  });

  it("rejects another user reading or writing someone else's profile", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${OWNER_UID}`), {
        displayName: "Alex Parent",
        unitPreference: "mmol",
        createdAt: Timestamp.now(),
      });
    });

    const db = strangerCtx().firestore();
    await assertFails(getDoc(doc(db, `users/${OWNER_UID}`)));
    await assertFails(updateDoc(doc(db, `users/${OWNER_UID}`), { displayName: "Hacked" }));
  });

  it("never allows account deletion via client rules", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${OWNER_UID}`), {
        displayName: "Alex Parent",
        unitPreference: "mmol",
        createdAt: Timestamp.now(),
      });
    });

    const db = ownerCtx().firestore();
    await assertFails(deleteDoc(doc(db, `users/${OWNER_UID}`)));
  });
});

// ── users/{uid}/children/{childId} ────────────────────────────────────────────

describe("children", () => {
  it("lets the owner create a child with valid fields", async () => {
    const db = ownerCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`), {
        name: "Jamie",
        diagnosis: "Hyperinsulinism",
        glucoseTargetMin: 4.0,
        glucoseTargetMax: 8.0,
        coParentStatus: "none",
        sharing: { glucose: false, meals: false, symptoms: false, documents: false, patterns: false },
        createdAt: serverTimestamp(),
      })
    );
  });

  it("rejects child creation with invalid glucose targets (min >= max)", async () => {
    const db = ownerCtx().firestore();
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`), {
        name: "Jamie",
        diagnosis: "Hyperinsulinism",
        glucoseTargetMin: 9.0,
        glucoseTargetMax: 8.0,
        coParentStatus: "none",
        sharing: { glucose: false, meals: false, symptoms: false, documents: false, patterns: false },
        createdAt: serverTimestamp(),
      })
    );
  });

  it("rejects child creation with an empty name", async () => {
    const db = ownerCtx().firestore();
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`), {
        name: "",
        diagnosis: "Hyperinsulinism",
        glucoseTargetMin: 4.0,
        glucoseTargetMax: 8.0,
        coParentStatus: "none",
        sharing: { glucose: false, meals: false, symptoms: false, documents: false, patterns: false },
        createdAt: serverTimestamp(),
      })
    );
  });

  it("lets the owner read, update and delete their own child", async () => {
    await seedChild(OWNER_UID, CHILD_ID);
    const db = ownerCtx().firestore();
    await assertSucceeds(getDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`)));
    await assertSucceeds(updateDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`), { diagnosis: "Updated diagnosis" }));
    await assertSucceeds(deleteDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`)));
  });

  it("rejects a stranger reading or writing another user's child", async () => {
    await seedChild(OWNER_UID, CHILD_ID);
    const db = strangerCtx().firestore();
    await assertFails(getDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`)));
    await assertFails(updateDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`), { diagnosis: "Hacked" }));
    await assertFails(deleteDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`)));
  });

  it("lets a connected co-parent read the child doc", async () => {
    await seedChild(OWNER_UID, CHILD_ID, {
      coParentStatus: "connected",
      coParentUid: COPARENT_UID,
      coParentChildId: COPARENT_CHILD_ID,
    });
    const db = coParentCtx().firestore();
    await assertSucceeds(getDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`)));
  });

  it("rejects a non-co-parent reading the child doc", async () => {
    await seedChild(OWNER_UID, CHILD_ID); // coParentStatus: 'none'
    const db = coParentCtx().firestore();
    await assertFails(getDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`)));
  });

  describe("cross-user co-parent linking write", () => {
    it("allows the matching-email user to set only the linking fields", async () => {
      await seedChild(OWNER_UID, CHILD_ID, { coParentEmail: COPARENT_EMAIL });
      const db = coParentCtx().firestore();
      await assertSucceeds(
        updateDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`), {
          coParentUid: COPARENT_UID,
          coParentChildId: COPARENT_CHILD_ID,
          coParentStatus: "connected",
        })
      );
    });

    it("rejects the linking write when the requester's email does not match coParentEmail", async () => {
      await seedChild(OWNER_UID, CHILD_ID, { coParentEmail: "someone-else@example.com" });
      const db = coParentCtx().firestore();
      await assertFails(
        updateDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`), {
          coParentUid: COPARENT_UID,
          coParentChildId: COPARENT_CHILD_ID,
          coParentStatus: "connected",
        })
      );
    });

    it("rejects a linking write that also touches unrelated fields", async () => {
      await seedChild(OWNER_UID, CHILD_ID, { coParentEmail: COPARENT_EMAIL });
      const db = coParentCtx().firestore();
      await assertFails(
        updateDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`), {
          coParentUid: COPARENT_UID,
          coParentChildId: COPARENT_CHILD_ID,
          coParentStatus: "connected",
          name: "Renamed by co-parent",
        })
      );
    });

    it("rejects a linking write that tries to set someone else's uid", async () => {
      await seedChild(OWNER_UID, CHILD_ID, { coParentEmail: COPARENT_EMAIL });
      const db = coParentCtx().firestore();
      await assertFails(
        updateDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}`), {
          coParentUid: STRANGER_UID,
          coParentChildId: COPARENT_CHILD_ID,
          coParentStatus: "connected",
        })
      );
    });
  });
});

// ── glucoseReadings ───────────────────────────────────────────────────────────

describe("glucoseReadings", () => {
  beforeAll(() => {});

  async function setup() {
    await seedChild(OWNER_UID, CHILD_ID, {
      coParentStatus: "connected",
      coParentUid: COPARENT_UID,
      coParentChildId: COPARENT_CHILD_ID,
    });
    await seedRateLimits(OWNER_UID);
  }

  it("lets the owner create a valid reading", async () => {
    await setup();
    const db = ownerCtx().firestore();
    await assertSucceeds(
      addDoc(collection(db, `users/${OWNER_UID}/children/${CHILD_ID}/glucoseReadings`), {
        value: 5.5,
        loggedBy: OWNER_UID,
        timestamp: serverTimestamp(),
      })
    );
  });

  it("rejects a reading with an out-of-range value", async () => {
    await setup();
    const db = ownerCtx().firestore();
    await assertFails(
      addDoc(collection(db, `users/${OWNER_UID}/children/${CHILD_ID}/glucoseReadings`), {
        value: 100.0,
        loggedBy: OWNER_UID,
        timestamp: serverTimestamp(),
      })
    );
  });

  it("rejects a reading where loggedBy doesn't match the requester", async () => {
    await setup();
    const db = ownerCtx().firestore();
    await assertFails(
      addDoc(collection(db, `users/${OWNER_UID}/children/${CHILD_ID}/glucoseReadings`), {
        value: 5.5,
        loggedBy: STRANGER_UID,
        timestamp: serverTimestamp(),
      })
    );
  });

  it("rejects a stranger creating or reading readings for another user's child", async () => {
    await setup();
    const db = strangerCtx().firestore();
    await assertFails(
      addDoc(collection(db, `users/${OWNER_UID}/children/${CHILD_ID}/glucoseReadings`), {
        value: 5.5,
        loggedBy: STRANGER_UID,
        timestamp: serverTimestamp(),
      })
    );
    await assertFails(getDocs(collection(db, `users/${OWNER_UID}/children/${CHILD_ID}/glucoseReadings`)));
  });

  it("makes readings immutable after creation", async () => {
    await setup();
    let readingRef;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      readingRef = doc(collection(ctx.firestore(), `users/${OWNER_UID}/children/${CHILD_ID}/glucoseReadings`));
      await setDoc(readingRef, { value: 5.5, loggedBy: OWNER_UID, timestamp: Timestamp.now() });
    });
    const db = ownerCtx().firestore();
    await assertFails(updateDoc(doc(db, readingRef.path), { value: 6.0 }));
  });

  describe("co-parent read with sharing consent", () => {
    it("allows the co-parent to read when sharing is mutually enabled", async () => {
      await seedChild(OWNER_UID, CHILD_ID, {
        coParentStatus: "connected",
        coParentUid: COPARENT_UID,
        coParentChildId: COPARENT_CHILD_ID,
        sharing: { glucose: true, meals: false, symptoms: false, documents: false, patterns: false },
      });
      await seedChild(COPARENT_UID, COPARENT_CHILD_ID, {
        coParentStatus: "connected",
        coParentUid: OWNER_UID,
        coParentChildId: CHILD_ID,
        sharing: { glucose: true, meals: false, symptoms: false, documents: false, patterns: false },
      });

      const db = coParentCtx().firestore();
      await assertSucceeds(getDocs(collection(db, `users/${OWNER_UID}/children/${CHILD_ID}/glucoseReadings`)));
    });

    it("rejects the co-parent read when consent isn't mutual", async () => {
      // Owner has shared, but co-parent has not reciprocated.
      await seedChild(OWNER_UID, CHILD_ID, {
        coParentStatus: "connected",
        coParentUid: COPARENT_UID,
        coParentChildId: COPARENT_CHILD_ID,
        sharing: { glucose: true, meals: false, symptoms: false, documents: false, patterns: false },
      });
      await seedChild(COPARENT_UID, COPARENT_CHILD_ID, {
        coParentStatus: "connected",
        coParentUid: OWNER_UID,
        coParentChildId: CHILD_ID,
        sharing: { glucose: false, meals: false, symptoms: false, documents: false, patterns: false },
      });

      const db = coParentCtx().firestore();
      await assertFails(getDocs(collection(db, `users/${OWNER_UID}/children/${CHILD_ID}/glucoseReadings`)));
    });

    it("rejects the co-parent read when not yet connected", async () => {
      await seedChild(OWNER_UID, CHILD_ID, {
        coParentStatus: "pending",
        coParentUid: COPARENT_UID,
        coParentChildId: COPARENT_CHILD_ID,
        sharing: { glucose: true, meals: false, symptoms: false, documents: false, patterns: false },
      });
      await seedChild(COPARENT_UID, COPARENT_CHILD_ID, {
        coParentStatus: "pending",
        coParentUid: OWNER_UID,
        coParentChildId: CHILD_ID,
        sharing: { glucose: true, meals: false, symptoms: false, documents: false, patterns: false },
      });

      const db = coParentCtx().firestore();
      await assertFails(getDocs(collection(db, `users/${OWNER_UID}/children/${CHILD_ID}/glucoseReadings`)));
    });
  });

  describe("rate limiting", () => {
    it("blocks creation once the hourly cap is hit within the current window", async () => {
      await seedChild(OWNER_UID, CHILD_ID);
      await seedRateLimits(OWNER_UID, { glucoseCount: 100, glucoseWindow: Timestamp.now() });

      const db = ownerCtx().firestore();
      await assertFails(
        addDoc(collection(db, `users/${OWNER_UID}/children/${CHILD_ID}/glucoseReadings`), {
          value: 5.5,
          loggedBy: OWNER_UID,
          timestamp: serverTimestamp(),
        })
      );
    });

    it("allows creation when under the cap", async () => {
      await seedChild(OWNER_UID, CHILD_ID);
      await seedRateLimits(OWNER_UID, { glucoseCount: 5, glucoseWindow: Timestamp.now() });

      const db = ownerCtx().firestore();
      await assertSucceeds(
        addDoc(collection(db, `users/${OWNER_UID}/children/${CHILD_ID}/glucoseReadings`), {
          value: 5.5,
          loggedBy: OWNER_UID,
          timestamp: serverTimestamp(),
        })
      );
    });

    it("allows creation once the rate-limit window has expired, even at the cap", async () => {
      await seedChild(OWNER_UID, CHILD_ID);
      const longAgo = Timestamp.fromMillis(Date.now() - 2 * 3600 * 1000); // 2 hours ago
      await seedRateLimits(OWNER_UID, { glucoseCount: 100, glucoseWindow: longAgo });

      const db = ownerCtx().firestore();
      await assertSucceeds(
        addDoc(collection(db, `users/${OWNER_UID}/children/${CHILD_ID}/glucoseReadings`), {
          value: 5.5,
          loggedBy: OWNER_UID,
          timestamp: serverTimestamp(),
        })
      );
    });
  });
});

// ── _rateLimits/{uid} ─────────────────────────────────────────────────────────

describe("_rateLimits/{uid}", () => {
  it("lets a user read, create and update only their own counter doc", async () => {
    const db = ownerCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `_rateLimits/${OWNER_UID}`), {
        glucoseCount: 0,
        glucoseWindow: serverTimestamp(),
        mealCount: 0,
        mealWindow: serverTimestamp(),
        symptomCount: 0,
        symptomWindow: serverTimestamp(),
        documentCount: 0,
        documentWindow: serverTimestamp(),
        prefNoteCount: 0,
        prefNoteWindow: serverTimestamp(),
      })
    );
    await assertSucceeds(getDoc(doc(db, `_rateLimits/${OWNER_UID}`)));
    await assertSucceeds(updateDoc(doc(db, `_rateLimits/${OWNER_UID}`), { glucoseCount: 1 }));
  });

  it("rejects another user reading or writing someone else's counter doc", async () => {
    await seedRateLimits(OWNER_UID);
    const db = strangerCtx().firestore();
    await assertFails(getDoc(doc(db, `_rateLimits/${OWNER_UID}`)));
    await assertFails(updateDoc(doc(db, `_rateLimits/${OWNER_UID}`), { glucoseCount: 999 }));
  });

  it("never allows deleting a counter doc", async () => {
    await seedRateLimits(OWNER_UID);
    const db = ownerCtx().firestore();
    await assertFails(deleteDoc(doc(db, `_rateLimits/${OWNER_UID}`)));
  });
});

// ── mealLogs (spot-check the shared read/create/immutability pattern) ────────

describe("mealLogs", () => {
  it("lets the owner create a valid meal log and rejects oversized descriptions", async () => {
    await seedChild(OWNER_UID, CHILD_ID);
    await seedRateLimits(OWNER_UID);
    const db = ownerCtx().firestore();

    await assertSucceeds(
      addDoc(collection(db, `users/${OWNER_UID}/children/${CHILD_ID}/mealLogs`), {
        descriptionText: "Scrambled eggs and toast",
        carbsEstimate: 20,
        loggedBy: OWNER_UID,
        timestamp: serverTimestamp(),
      })
    );

    await assertFails(
      addDoc(collection(db, `users/${OWNER_UID}/children/${CHILD_ID}/mealLogs`), {
        descriptionText: "x".repeat(501),
        loggedBy: OWNER_UID,
        timestamp: serverTimestamp(),
      })
    );
  });

  it("only allows co-parent reads when 'meals' sharing is mutually enabled", async () => {
    await seedChild(OWNER_UID, CHILD_ID, {
      coParentStatus: "connected",
      coParentUid: COPARENT_UID,
      coParentChildId: COPARENT_CHILD_ID,
      sharing: { glucose: false, meals: true, symptoms: false, documents: false, patterns: false },
    });
    await seedChild(COPARENT_UID, COPARENT_CHILD_ID, {
      coParentStatus: "connected",
      coParentUid: OWNER_UID,
      coParentChildId: CHILD_ID,
      sharing: { glucose: false, meals: true, symptoms: false, documents: false, patterns: false },
    });

    const db = coParentCtx().firestore();
    await assertSucceeds(getDocs(collection(db, `users/${OWNER_UID}/children/${CHILD_ID}/mealLogs`)));
  });
});

// ── preferenceNotes (no co-parent sharing category) ───────────────────────────

describe("preferenceNotes", () => {
  it("never allows a connected co-parent to read preference notes", async () => {
    await seedChild(OWNER_UID, CHILD_ID, {
      coParentStatus: "connected",
      coParentUid: COPARENT_UID,
      coParentChildId: COPARENT_CHILD_ID,
      sharing: { glucose: true, meals: true, symptoms: true, documents: true, patterns: true },
    });
    await seedChild(COPARENT_UID, COPARENT_CHILD_ID, {
      coParentStatus: "connected",
      coParentUid: OWNER_UID,
      coParentChildId: CHILD_ID,
      sharing: { glucose: true, meals: true, symptoms: true, documents: true, patterns: true },
    });
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${OWNER_UID}/children/${CHILD_ID}/preferenceNotes/note-1`), {
        content: "Prefers oat milk",
        loggedBy: OWNER_UID,
        createdAt: Timestamp.now(),
      });
    });

    const db = coParentCtx().firestore();
    await assertFails(getDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}/preferenceNotes/note-1`)));
  });
});

// ── patternSummary (locked to literal "latest" doc id) ─────────────────────────

describe("patternSummary", () => {
  it("rejects writes to any document id other than 'latest'", async () => {
    await seedChild(OWNER_UID, CHILD_ID);
    const db = ownerCtx().firestore();
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}/patternSummary/not-latest`), {
        patterns: [],
      })
    );
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/children/${CHILD_ID}/patternSummary/latest`), {
        patterns: [],
      })
    );
  });
});

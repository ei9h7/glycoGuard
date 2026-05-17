# GlycoGuard — Architecture

## Overview

GlycoGuard is a mobile-first React web application (with a planned native port) for managing pediatric hypoglycemia. The architecture is designed around three core constraints:

1. **Real-time sync** — co-parents on separate devices, different households, must see the same data
1. **AI context richness** — the AI assistant needs both structured time-series data and unstructured clinical observations to be genuinely useful
1. **Low friction entry** — every logging interaction must be faster than not logging at all

-----

## Tech Stack

### Frontend

- **React 18** — component framework
- **Vite** — build tool and dev server
- **React Router** — navigation (to be added Phase 1)
- **Deployed:** GitHub Pages (public prototype) → Firebase Hosting (dev/production)

### Backend / Infrastructure

- **Firebase Auth** — authentication (email/password → Google → Apple)
- **Firestore** — structured real-time database
- **Firebase Storage** — file uploads (PDFs, meal photos)
- **Vector Store** — unstructured semantic search (Pinecone or Firebase Vector Search — TBD)
- **Anthropic API** — Claude for AI assistant, meal analysis, pattern recognition

### Dev Environment

- VSCode + WSL2 Ubuntu
- Private repo: `glycoGuard-dev`
- Public repo: `glycoGuard` (GitHub Pages, prototype only)

-----

## Data Architecture

### Two-Store Hybrid Model

The core insight: user data is not one thing. It is structured time-series data (glucose, meals, symptoms with timestamps) AND unstructured natural language (lab reports, preference notes, clinical observations). These require different storage and retrieval strategies.

```
User Query / App Load
        │
        ├─── Firestore ──────────────── Structured Data
        │    └── glucose readings        (queried directly,
        │    └── meal logs               filtered by date/
        │    └── symptom events          child/type)
        │    └── child profiles
        │    └── user preferences
        │
        └─── Vector Store ───────────── Unstructured Data
             └── lab result PDFs         (semantic search,
             └── provider letters        retrieve relevant
             └── free-text notes         chunks only)
             └── preference notes
             └── clinical observations
             └── pattern summaries
```

Both stores feed into the AI context window on demand — structured data as formatted summaries, vector store results as retrieved chunks.

-----

## Firestore Schema

```
users/
  {userId}/
    profile:
      email, displayName, createdAt, unitPreference (mmol|mgdl)
    
    children/
      {childId}/
        name, dob, diagnosis, suspectedCondition
        glucoseTargetMin, glucoseTargetMax
        mealIntervalMinutes
        cgmDevice
        createdAt, updatedAt

        glucoseReadings/
          {readingId}/
            value, unit, source (cgm|fingerprick|lab)
            timestamp, notes

        mealLogs/
          {mealId}/
            timestamp, loggedBy (userId)
            descriptionText
            photoBeforeUrl, photoAfterUrl
            aiAnalysis: { foods[], calories, carbs, protein, fat, gi }
            manualCorrection
            carbsEstimate, caloriesEstimate

        symptomEvents/
          {eventId}/
            timestamp, loggedBy
            quickTapSymptoms: []   // structured clicks
            observationText        // free text / voice transcription
            glucoseAtTime
            resolvedAt, resolutionNotes

        mealPlan/
          {weekId}/
            days: { mon: [], tue: [], ... }
            generatedAt, approvedByUser

    coParents/
      {linkId}/
        linkedUserId, linkedEmail
        sharePermissions:
          meals, glucose, symptoms, notes, location
        status (pending|active|revoked)
```

-----

## Vector Store Schema

Each document stored as an embedding with metadata for filtering:

```
{
  userId: string,
  childId: string,
  type: "lab_result" | "provider_note" | "preference_note" | 
        "clinical_observation" | "pattern_summary" | "uploaded_document",
  content: string,          // the text that gets embedded
  sourceFile: string,       // original filename if uploaded
  timestamp: datetime,
  tags: []                  // e.g. ["endocrinology", "glucose", "morning"]
}
```

**Retrieval strategy:** on AI query, semantic search filtered by `userId` + `childId`, top-k results injected into system prompt alongside Firestore summary.

-----

## Symptom Logging — Three Layer Model

Designed around the reality that logging happens in very different contexts:

|Layer    |Mechanism                          |Storage             |Use case                              |
|---------|-----------------------------------|--------------------|--------------------------------------|
|Quick tap|Bubble buttons (predicted + common)|Firestore structured|Routine episodes, fast entry          |
|Open text|Free text field                    |Vector store        |Nuanced observations, anything unusual|
|Voice    |Speech-to-text → text field        |Vector store        |Hands-free during active episode      |

All three are timestamped and attached to the same symptom event record. Quick-tap selections go to Firestore as an array; text/voice goes to vector store as a clinical observation document.

**Example clinical observation (vector store):**

> “Temperature 35.2, paramedic on scene said GCS 10, fingerprick came in at 5.6, suspected absent seizure. Episode lasted approximately 4 minutes. Resolved without intervention.”

This is stored verbatim, timestamped, and retrievable by the AI when building provider reports or analyzing patterns.

-----

## AI Context Assembly

When a user interacts with the AI assistant or the app loads a recommendation screen:

1. **Fetch child profile** from Firestore (glucose targets, meal interval, diagnosis)
1. **Fetch recent structured data** from Firestore (last 7–14 days of glucose, meals, symptoms)
1. **Query vector store** with semantic search relevant to the current query
1. **Assemble system prompt:**
   
   ```
   [Child profile]
   [Recent glucose summary]
   [Recent meal summary]
   [Recent symptom events]
   [Retrieved vector chunks: lab results, preference notes, observations]
   [Current query / context]
   ```
1. **Call Anthropic API** with assembled context
1. **Return response** to user

-----

## Preference Notes — UX Rationale

Dietary preferences, restrictions, and behavioural observations are stored as free-text vector documents rather than structured form fields. Rationale:

- Structured forms create friction and rarely capture nuance
- Natural language is faster to enter and richer in content
- “He won’t eat anything green, hates texture, daycare won’t allow nuts, goes through phases of only wanting beige food” is more useful than checkboxes
- Vector retrieval surfaces relevant preferences at the right moment without surfacing everything always

Users can type or speak preferences in plain language. The system stores them as dated documents. The AI retrieves the relevant ones when generating meal recommendations.

-----

## Co-parent Data Sharing

- Each co-parent has their own account and logs independently
- Sharing is one-directional by default — no requirement for both parties to cooperate
- Permissions are per-category (meals, glucose, symptoms, notes, location) and toggled independently
- Shared data is read-only for the receiving party
- Both parties’ logs merge into a unified timeline for the child

-----

## Unit Preference

- Global setting per user account: `mmol/L` or `mg/dL`
- All values stored in Firestore as `mmol/L` (canonical)
- Conversion applied at display layer only
- `mg/dL = mmol/L × 18.0182`

-----

## Environment Variables (.env — never committed)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_ANTHROPIC_API_KEY=
VITE_PINECONE_API_KEY=
VITE_PINECONE_INDEX=
```

-----

## Security Notes

- `.env` is in `.gitignore` — never committed to either repo
- Public repo (`glycoGuard`) contains zero credentials, zero Firebase config
- Private repo (`glycoGuard-dev`) contains all dev credentials via `.env`
- Production credentials managed via GitHub Secrets / Firebase environment config
- Co-parent data access enforced via Firestore security rules (users can only read data they have explicit permission grants for)
- Vector store queries always filtered by `userId` — no cross-user data leakage
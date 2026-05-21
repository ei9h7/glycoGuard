# GlycoGuard — Stack & Decisions

Running record of technology choices, versions, and the reasoning behind each decision. Referenced at the start of every dev session to avoid re-litigating settled decisions.

-----

## Frontend

|Technology  |Version|Decision      |Rationale                                    |
|------------|-------|--------------|---------------------------------------------|
|React       |18.2.0 |Decided       |Industry standard, large ecosystem           |
|Vite        |5.2.0  |Decided       |Fast builds, simple config, excellent DX     |
|React Router|6.x    |To add Phase 1|Client-side routing for auth/protected routes|
|Tailwind CSS|TBD    |Considering   |Evaluate at Phase 1                          |

-----

## Backend / Infrastructure

|Technology      |Decision  |Rationale                                                             |
|----------------|----------|----------------------------------------------------------------------|
|Firebase Auth   |Decided   |Email/password to start, Google + Apple later. Required for App Store.|
|Firestore       |Decided   |Real-time sync across devices and co-parents. Flexible schema.        |
|Firebase Storage|Decided   |Meal photos, uploaded PDFs. Integrates with Firestore security rules. |
|Firebase Hosting|Superseded|Replaced by Vercel for deployment.                                    |
|Vercel          |Decided   |Production deployment. Production: glycoguard.app · Preview: glycoguard-dev.vercel.app|
|Vector Store    |Decided   |Pinecone serverless, AWS us-east-1, purpose-built, mature, excellent filtering.|
|Cloud Functions |Scaffolded|Not yet deployed. Will handle API keys for production multi-user deploy.|

### Vector Store Evaluation

**Pinecone** — purpose-built, mature, excellent filtering, generous free tier. External dependency.

**Firebase Vector Search** — single ecosystem, simpler security rules. Newer, less mature.

Leaning Pinecone for capability. Revisit at Phase 2 start.

-----

## AI

|Technology          |Decision|Rationale                                                    |
|--------------------|--------|-------------------------------------------------------------|
|OpenRouter          |Decided |AI gateway with auto-routing; currently routes to claude-sonnet-4-20250514; model flexibility, cost control, no vendor lock-in|
|Voyage AI embeddings|Decided |voyage-code-3, 1024 dimensions; used for all vector upserts and searches|
|PDF text extraction |Decided |pdfjs-dist for extractTextFromPDF; 500-word chunks with 50-word overlap|
|Speech-to-text      |Phase 2 |Web Speech API (browser-native, free) for voice symptom entry|
|Meal photo analysis |Phase 3 |Claude vision — before/after photo comparison via OpenRouter|

-----

## Dev Environment

|Tool              |Status            |Notes                               |
|------------------|------------------|------------------------------------|
|VSCode            |Active            |Primary editor                      |
|WSL2 Ubuntu       |Active            |Dev runtime                         |
|Claude (claude.ai)|Active            |AI pair programming, file generation|
|Claude Code       |When budget allows|CLI for direct project file access  |

-----

## Repositories

|Repo          |Visibility|Purpose                                           |
|--------------|----------|--------------------------------------------------|
|glycoGuard    |Public    |Prototype only. GitHub Pages. No credentials ever.|
|glycoGuard-dev|Private   |All development. Firebase config in .env.         |

### Branch Strategy (glycoGuard-dev)

- main — stable, deployable
- dev — active development
- feature/* — individual features
- ai-integration — API key features, not merged to public until auth is ready

-----

## Data Decisions

|Decision              |Choice                         |Rationale                                                |
|----------------------|-------------------------------|---------------------------------------------------------|
|Canonical glucose unit|mmol/L                         |Always stored as mmol/L. Converted at display layer only.|
|Unit conversion factor|mg/dL = mmol/L x 18.0182       |Standard conversion                                      |
|Unit preference       |Per user account, global toggle|Consistency across all screens                           |
|Structured data       |Firestore                      |Time-series, queryable, real-time                        |
|Unstructured data     |Vector store (Pinecone)        |Lab results, notes, observations, preferences, patterns  |
|Pattern storage       |Firestore + Pinecone           |Structured summaries in Firestore; embeddings in Pinecone for retrieval|
|File storage          |Firebase Storage               |Meal photos, uploaded PDFs                               |
|PDF chunking strategy |500 words, 50-word overlap     |Balance between context preservation and retrieval granularity|
|Embedding service     |Voyage AI voyage-code-3        |1024 dimensions, purpose-built for code/document embeddings|

-----

## Production Deployment & Key Management

**Current state (dev):** All API keys are VITE_-prefixed and called directly from the browser. This is safe for single-user development with a private repository, but must not go to production.

**Production path:** Firebase Cloud Functions are scaffolded in `functions/` and must be deployed before any multi-user production release. The service interfaces (`vectorStore.js`, `patternEngine.js`) are designed to make this swap a one-file change:
- All OpenRouter calls → Cloud Function
- All Voyage AI embedding calls → Cloud Function  
- All Pinecone vector operations → Cloud Function

This keeps API keys server-side and makes key rotation transparent to the client.

-----

## Key UX Decisions

|Decision                                      |Rationale                                                                               |
|----------------------------------------------|----------------------------------------------------------------------------------------|
|Symptom logging: quick-tap + open text + voice|Three contexts need three entry modes. Routine = tap. Nuanced = text. Emergency = voice.|
|Preference notes as free text not form fields |Less friction. Richer data. Natural language beats checkboxes.                          |
|Co-parent sync is one-directional by default  |Does not require cooperation between parties.                                           |
|Canonical units, convert at display           |Single source of truth. Unit preference is a view concern not a data concern.           |

-----

## Ruled Out

|Technology                              |Reason                                                                              |
|----------------------------------------|------------------------------------------------------------------------------------|
|localStorage for user data              |No cross-device sync. Breaks co-parent feature entirely.                            |
|Structured forms for dietary preferences|Too much friction. Natural language + vector retrieval is better UX and richer data.|
|Custom backend API server               |Firebase handles auth, data, storage. No custom backend needed at this stage.       |

-----

## Locked Versions

```
react: ^18.2.0
react-dom: ^18.2.0
vite: ^5.2.0
@vitejs/plugin-react: ^4.2.1
```
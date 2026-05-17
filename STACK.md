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
|Firebase Hosting|Phase 1   |Will replace GitHub Pages. Better performance, custom domain.         |
|Vector Store    |Evaluating|Pinecone vs Firebase Vector Search — decision at Phase 2 start.       |

### Vector Store Evaluation

**Pinecone** — purpose-built, mature, excellent filtering, generous free tier. External dependency.

**Firebase Vector Search** — single ecosystem, simpler security rules. Newer, less mature.

Leaning Pinecone for capability. Revisit at Phase 2 start.

-----

## AI

|Technology          |Decision|Rationale                                                    |
|--------------------|--------|-------------------------------------------------------------|
|Anthropic Claude API|Decided |claude-sonnet-4-20250514 for assistant and meal analysis     |
|Speech-to-text      |Phase 2 |Web Speech API (browser-native, free) for voice symptom entry|
|Meal photo analysis |Phase 2 |Claude vision — before/after photo comparison                |

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
|Unstructured data     |Vector store                   |Lab results, notes, observations, preferences            |
|File storage          |Firebase Storage               |Meal photos, uploaded PDFs                               |

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
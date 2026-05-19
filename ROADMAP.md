# GlycoGuard — Roadmap

## Status Key

- ✅ Done
- 🔨 In progress
- 📋 Planned
- 💡 Identified / not yet scoped

-----

## Phase 0 — Public Prototype

*Goal: Validate concept, gather early feedback*

|Feature                     |Status|Notes                                   |
|----------------------------|------|----------------------------------------|
|UI prototype (all 5 screens)|✅ Done|Live at ei9h7.github.io/glycoGuard      |
|GitHub Pages deployment     |✅ Done|Auto-deploys from public repo main      |
|Feedback form integration   |✅ Done|Google Form, floating FAB button        |
|Public README               |✅ Done|                                        |
|Reddit / community seeding  |✅ Done|#3 post of day on r/reactivehypoglycemia|

-----

## Phase 1 — Foundation

*Goal: Real app with auth, data storage, and core logging*

|Feature                    |Status   |Notes                                               |
|---------------------------|---------|----------------------------------------------------|
|Private dev repo setup     |✅ Done  |glycoGuard-dev, WSL2/VSCode workflow                |
|Firebase project setup     |✅ Done  |Auth + Firestore + Storage                          |
|User authentication        |✅ Done  |Email/password login with auth guard                |
|Child profile (create/edit)|✅ Done  |Name, DOB, diagnosis, glucose targets, meal interval|
|Manual glucose logging     |✅ Done  |Fingerprick/manual readings stored in Firestore     |
|Symptom logging            |✅ Done  |Quick-tap symptoms + note capture                   |
|Feed timer (functional)    |✅ Done  |Based on last logged meal; push notifications pending|
|Meal logging (manual)      |✅ Done  |Text description, timestamp, manual macro entry     |
|Basic glucose history view |✅ Done  |List view available under Glucose history screen    |
|mmol/L ↔ mg/dL toggle      |✅ Done   |User feedback item — global unit preference, toggle in Settings|
|Meal history view           |✅ Done   |List view, stats strip, period selector             |

-----

## Phase 2 — Intelligence Layer

*Goal: AI recommendations, pattern recognition, vector store*

End of Phase 2 — Open Source Transition
- Merge glycoGuard-dev into glycoGuard public repo
- Generic .env.example with setup instructions (including `VITE_OPENROUTER_API_KEY`)
- Contributing guidelines
- MIT license
- Updated README with full setup walkthrough
- Remove/genericise any personal references in code and docs
- Update CLAUDE.md to reflect OpenRouter replacing direct Anthropic API calls

|Feature                      |Status      |Notes                                                                                              |
|-----------------------------|------------|---------------------------------------------------------------------------------------------------|
|Vector store setup           |✅ Done     |Pinecone serverless, voyage-code-3 embeddings, 1024 dimensions                                    |
|Free-text preference notes   |✅ Done     |usePreferenceNotes.js — plain language notes stored in Firestore + Pinecone                        |
|Lab result PDF upload        |✅ Done     |pdfExtractor.js — text extraction + 500-word overlapping chunks upserted to Pinecone              |
|Provider letter upload       |✅ Done     |Same pipeline as lab results via useDocuments.js                                                   |
|Open symptom text entry      |✅ Done     |Free-text observation field on Home screen vectorised on save                                      |
|AI assistant (live data)     |✅ Done     |AI.jsx — live Firestore context + Pinecone RAG, opening message, conversation history; routed via OpenRouter (openrouter/auto)|
|AI meal recommendations      |🔨 Partial  |Covered by the AI assistant; a dedicated recommendations screen is still planned                   |
|AI pattern recognition       |🔨 Partial  |The assistant can surface patterns from history; a dedicated pattern screen is still planned        |
|Meal photo analysis          |📋 Planned  |Before/after photos, portion estimation via Claude vision API                                      |
|Proactive alerts             |📋 Planned  |Predict reactive windows before they happen                                                        |

-----

## Phase 3 — Connected Data

*Goal: CGM integration, co-parent sync, reports*

|Feature                       |Status      |Notes                                        |
|------------------------------|------------|---------------------------------------------|
|FreeStyle Libre 3+ integration|📋 Planned   |LibreLink API or NFC read                    |
|Dexcom integration            |📋 Planned   |Dexcom developer API                         |
|Co-parent account linking     |📋 Planned   |Granular per-category sharing controls       |
|Co-parent independent logging |📋 Planned   |Both parties log independently, data merges  |
|Medical report export         |📋 Planned   |Selectable data, PDF, formatted for providers|
|Selectable report recipients  |📋 Planned   |User feedback item                           |
|Daycare/caregiver view        |📋 Planned   |Limited read-only access, simplified UI      |
|Provider portal               |💡 Identified|Read access for medical team                 |

-----

## Phase 4 — Meal Planning & Grocery

*Goal: Full meal planning engine with family integration*

|Feature                      |Status   |Notes                                          |
|-----------------------------|---------|-----------------------------------------------|
|Weekly meal planning         |📋 Planned|AI-recommended + user-entered                  |
|Family meal integration      |📋 Planned|Plans that work for whole family not just child|
|Dietary restrictions engine  |📋 Planned|Religious, allergy, daycare, travel modes      |
|Grocery list generation      |📋 Planned|Auto-generated from meal plan                  |
|Instacart API integration    |📋 Planned|One-tap grocery order                          |
|Short/long term meal planning|📋 Planned|Day view + week view + custom range            |

-----

## Phase 5 — Native App & Scale

*Goal: App Store release, production infrastructure*

|Feature                    |Status      |Notes                                        |
|---------------------------|------------|---------------------------------------------|
|React Native port          |💡 Identified|iOS + Android native                         |
|Apple Sign In              |💡 Identified|Required for App Store                       |
|Push notifications (native)|💡 Identified|Feed reminders, glucose alerts               |
|Apple Health integration   |💡 Identified|                                             |
|Google Fit integration     |💡 Identified|                                             |
|HIPAA compliance review    |💡 Identified|Required before medical provider data sharing|
|Multi-child support        |💡 Identified|Families with more than one affected child   |

-----

## Feedback Log

|Date   |Source|Feedback                                                  |Status   |
|-------|------|----------------------------------------------------------|---------|
|2026-05|User  |mmol/L ↔ mg/dL unit toggle needed for US users            |📋 Phase 1|
|2026-05|User  |Selectable reports — choose what to send to which provider|📋 Phase 3|
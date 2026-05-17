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
|mmol/L ↔ mg/dL toggle      |📋 Planned|User feedback item — global unit preference         |

-----

## Phase 2 — Intelligence Layer

*Goal: AI recommendations, pattern recognition, vector store*

|Feature                      |Status   |Notes                                                       |
|-----------------------------|---------|------------------------------------------------------------|
|Vector store setup           |📋 Planned|Pinecone or Firebase vector search                          |
|Free-text preference notes   |📋 Planned|Plain language dietary/behavioural notes stored in vector DB|
|Lab result PDF upload        |📋 Planned|Parsed and stored in vector store, referenceable by AI      |
|Provider letter upload       |📋 Planned|Same pipeline as lab results                                |
|Open symptom text/voice entry|📋 Planned|Timestamped clinical notes to vector store                  |
|AI meal recommendations      |📋 Planned|Based on glucose trends + child history                     |
|AI pattern recognition       |📋 Planned|Recurring dip windows, meal correlations                    |
|AI assistant (live data)     |📋 Planned|Full context from Firestore + vector store                  |
|Meal photo analysis          |📋 Planned|Before/after photos, portion estimation                     |
|Proactive alerts             |📋 Planned|Predict reactive windows before they happen                 |

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
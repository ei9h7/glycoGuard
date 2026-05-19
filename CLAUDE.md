# GlycoGuard — Claude Code Context

This file is read automatically by Claude Code at the start of every session.
It contains everything needed to work on this codebase without re-explaining context.

---

## What This App Is

GlycoGuard is a mobile-first React web app for managing hypoglycemia in young children —
particularly reactive hypoglycemia and congenital hyperinsulinism (CHI).

Built by a parent of a child with suspected hyperinsulinism. Every design decision is
informed by lived experience. This is personal, practical, and being built to eventually
help other families facing the same situation.

The child this was built around is named Henry, age 3y 3mo, suspected hyperinsulinism
and reactive hypoglycemia. He uses a FreeStyle Libre 3+ CGM and needs to eat every 2 hours.

---

## Current State

Phase 1 is complete. Phase 2 substantially complete with remaining items in backlog.

### Phase 1 — complete

- ✅ Firebase Auth — email/password login and registration
- ✅ Child profile — create on first login, edit in Settings
- ✅ Home screen — live feed timer, glucose display, symptom logging, timeline
- ✅ Meal logging modal — description, carbs, notes → Firestore
- ✅ Glucose logging modal — value, source, notes → Firestore
- ✅ Glucose history screen — chart, stats strip, time in range bar, reading list
- ✅ Meal history screen — stats strip, period selector, grouped date list
- ✅ mmol/L ↔ mg/dL toggle — global unit preference stored in user doc, toggle in Settings
- ✅ Settings screen — child profile edit, display units toggle, sign out
- ✅ useAuth hook — Firebase auth state listener
- ✅ useChild hook — Firestore child document listener
- ✅ useUnits hook — reads/writes unitPreference from users/{userId}, provides fmt/convert/displayUnit

### Phase 2 — substantially complete

- ✅ Vector store — Pinecone serverless with voyage-code-3 embeddings (1024 dimensions)
- ✅ Free-text preference notes — usePreferenceNotes.js, stored in Firestore + Pinecone
- ✅ PDF document upload — pdfExtractor.js extracts text and chunks it (500-word chunks, 50-word overlap); useDocuments.js upserts each chunk as a separate vector with a 500 ms delay between upserts
- ✅ Symptom observation text → vector store — free-text observations on Home screen vectorised on save
- ✅ AI assistant screen — AI.jsx, uses OpenRouter with auto-routing, assembles live Firestore context + Pinecone RAG before every call; opening situational message on load; conversation history; quick suggestions before first user message
- ✅ Pattern recognition engine — patternEngine.js generates insights from 30 days of glucose, meal, and symptom data; auto-refreshes if stale >6 hours; manual refresh available; stored in Firestore + Pinecone; Reports screen displays patterns grouped by category with confidence indicators

Not yet built (see ROADMAP.md):
- Dedicated meal recommendation screen (partially covered by AI assistant)
- Meal photo analysis
- Proactive alerts
- Co-parent sharing
- Pattern report export
- CGM integration

---

## Tech Stack

- React 18 + Vite
- React Router v6
- Firebase (Auth + Firestore + Storage)
- OpenRouter — AI gateway with auto-routing, claude-sonnet-4-20250514 via openrouter/auto; replaces direct Anthropic API calls
- Voyage AI — voyage-code-3 embeddings, 1024 dimensions, used for all vector upserts and searches
- Pinecone — serverless vector store, AWS us-east-1, 1024 dimensions, index `glycoguard-dev`
- No CSS framework — inline styles throughout, design tokens via JS constants
- WSL2 Ubuntu / GitHub Codespaces dev environment

Never introduce: Tailwind (not decided yet), Redux, CSS modules, or any new major
dependencies without checking STACK.md first.

---

## Repo Structure

```
src/
  firebase.js              — Firebase init, exports auth/db/storage
  main.jsx                 — React entry point, BrowserRouter
  App.jsx                  — Routes, ProtectedRoute, ChildGuard
  hooks/
    useAuth.js             — { user, loading } from Firebase Auth
    useChild.js            — { child, childId, loading } from Firestore
    useUnits.js            — { fmt, convert, displayUnit } unit preference hook
    useDocuments.js        — PDF upload, chunk upsert to Pinecone, Firestore metadata
    usePreferenceNotes.js  — Free-text preference/dietary notes → Firestore + Pinecone
    usePatterns.js         — Pattern engine hooks: fetch patterns, refresh if stale >6 hours
  services/
    vectorStore.js         — Pinecone + Voyage AI: upsertVector, searchVectors, deleteVector
    pdfExtractor.js        — extractTextFromPDF (pdfjs-dist), chunkText (500w / 50w overlap)
    patternEngine.js       — Pattern analysis: 30-day glucose/meal/symptom insights
  components/
    AppShell.jsx           — Nav bar + Outlet layout wrapper
    LogMealModal.jsx       — Meal logging modal (callback pattern)
    LogGlucoseModal.jsx    — Glucose logging modal (callback pattern)
  screens/
    auth/
      Login.jsx            — Email/password login
      Register.jsx         — Registration + Firestore user doc creation
      ChildSetup.jsx       — First-time child profile creation
    Home.jsx               — Main dashboard screen
    GlucoseHistory.jsx     — Glucose chart + stats + reading list
    Meals.jsx              — Placeholder
    Reports.jsx            — Pattern summaries grouped by category with confidence indicators
    AI.jsx                 — AI assistant: live context assembly, Pinecone RAG, conversation
    Settings.jsx           — Child profile edit + sign out

functions/
  Cloud Functions scaffolded (not yet deployed) for production key management
```

---

## Firestore Data Structure

```
users/{userId}/
  profile: { email, displayName, unitPreference, createdAt }
  children/{childId}/
    name, dob, diagnosis, glucoseTargetMin, glucoseTargetMax,
    mealIntervalMinutes, cgmDevice, createdAt, updatedAt
    glucoseReadings/{readingId}/
      value (mmol/L), source, timestamp, loggedBy, notes
    mealLogs/{mealId}/
      descriptionText, carbsEstimate, timestamp, loggedBy, notes
    symptomEvents/{eventId}/
      quickTapSymptoms[], observationText, timestamp, loggedBy, glucoseAtTime
```

All glucose values stored in mmol/L (canonical). Unit conversion happens at display
layer only. mg/dL = mmol/L × 18.0182.

---

## Design System

Colors (use these, never introduce new ones without good reason):
```
--navy:   #0f1f35   (background)
--navy2:  #162840   (modal background)
--navy3:  #1e3654   (card background)
--amber:  #f59e0b   (primary action, highlights)
--red:    #ef4444   (danger, low glucose)
--green:  #22c55e   (in range, success)
--sage:   #5fa882   (secondary positive)
--sage2:  #7ec8a4   (lighter sage)
--text:   #e8dcc8   (primary text)
--muted:  #7a8fa6   (secondary text)
--border: rgba(255,255,255,0.08)
--card:   rgba(30,54,84,0.7)
```

Typography:
- UI font: DM Sans (loaded via Google Fonts in index.html)
- Display font: DM Serif Display (headings, numbers, logo)
- All inline styles use fontFamily: "'DM Sans', sans-serif" or "'DM Serif Display', serif"

Patterns:
- Modals use callback pattern — onSave(data) prop, save logic lives in parent
- Cards: background var(--card), border 1px solid var(--border), borderRadius 16-20px
- Section headers: 12px, uppercase, letterSpacing 1.2px, color #7a8fa6
- Primary buttons: background #f59e0b, color #0f1f35, borderRadius 10px
- No CSS files — all styles are inline JS objects at bottom of each component file

---

## Key Conventions

- Always use `useChild()` to get child data — never query Firestore for child directly
- Always use `auth.currentUser.uid` for the userId in Firestore paths
- Firestore paths always follow: `users/{userId}/children/{childId}/{collection}`
- Never store sensitive data in localStorage
- Never commit .env — credentials live in .env only
- Component files export one default component, styles object `s` or `styles` at bottom
- Keep save logic in the screen component, not inside modals

---

## What Not To Do

- Do not re-litigate stack decisions in STACK.md
- Do not introduce Tailwind, Redux, or a custom backend API
- Do not use localStorage for any user data
- Do not change the Firestore schema without checking ARCHITECTURE.md
- Do not add Google Analytics or any tracking
- Do not break the modal callback pattern (onSave, onClose props)
- Do not remove the DM Sans / DM Serif Display font pairing

---

## Environment Variables

All in .env (never committed):
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_OPENROUTER_API_KEY        — OpenRouter API key, used by AI assistant screen (routes to claude-sonnet-4-20250514)
VITE_VOYAGE_API_KEY            — Voyage AI key, used for all embeddings (voyage-code-3, 1024 dimensions)
VITE_PINECONE_API_KEY          — Pinecone API key
VITE_PINECONE_HOST             — Pinecone serverless host URL (from index page in console, AWS us-east-1)
VITE_PINECONE_INDEX            — Pinecone index name (default: glycoguard-dev)
```

**Security note:** These keys are currently VITE_-prefixed and called directly from the
browser — safe for single-user dev with a private repo. Firebase Cloud Functions are
scaffolded in `functions/` but not yet deployed. Before any multi-user production deploy,
all OpenRouter, Voyage AI, and Pinecone calls must move to Cloud Functions so keys are
never exposed to the client. The service interfaces (upsertVector, searchVectors,
callClaude) are designed to make this swap a one-file change.

---

## Public Repo

There is a separate PUBLIC repo (glycoGuard) that contains only the prototype.
GitHub Pages serves from that repo. Never push dev code, credentials, or Firebase
config to the public repo. Only clean, credential-free prototype code goes there.

---

## The Bigger Picture

This app will eventually include:
- Vector store (Pinecone) for unstructured data — lab results, preference notes,
  clinical observations in plain language
- AI assistant with full child context assembled from Firestore + vector store
- CGM integration (FreeStyle Libre 3+ first, then Dexcom)
- Co-parent sharing with per-category permissions
- Meal photo analysis via Claude vision API
- Medical report export (PDF, formatted for endocrinologists)
- Grocery list generation + Instacart API

See ROADMAP.md for phased breakdown and ARCHITECTURE.md for data design decisions.

---

*This file should be updated whenever significant new features are built or
architectural decisions are made. Keep it accurate — it is the single source of
truth for any AI assistant working in this codebase.*

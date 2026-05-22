# Contributing to GlycoGuard

## Welcome

GlycoGuard is a mobile-first web app for managing hypoglycemia in young children — particularly reactive hypoglycemia and congenital hyperinsulinism (CHI). It was built by a parent of a child with suspected hyperinsulinism and reactive hypoglycemia, living this situation day-to-day. Every design decision is informed by that experience, and it's open to contributors who want to help make it better for every family facing the same challenges.

The medical accuracy of recommendations, alert thresholds, and clinical language in this app matters — these features are used by families managing a serious condition in real time. If you have relevant medical or clinical expertise, your input is especially welcome. Please open an issue or reach out before making changes to glucose thresholds, clinical terminology, or AI guidance prompts.

Contributions of all kinds are welcome:

- **Bug fixes** — especially anything affecting data integrity or the feed timer
- **CGM integrations** — FreeStyle Libre, Dexcom, or other device APIs
- **UI improvements** — the app is mobile-first; anything that makes it faster or clearer under stress is valuable
- **Translations** — the app currently has no i18n layer; adding one is a meaningful contribution
- **Medical accuracy reviews** — if you are a clinician or researcher with relevant expertise, we welcome review of the pattern recognition logic, glucose thresholds, and AI assistant guidance
- **Accessibility** — the app is used by exhausted parents at 3am; usability improvements matter

---

## Getting Started

1. **Fork the repo** on GitHub, then clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/glycoGuard-dev.git
   cd glycoGuard-dev
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your own API keys. See the setup sections below for each service — all have free tiers sufficient for development.

   > **GitHub Codespaces users:** You can set your API keys as Codespaces secrets (GitHub → Settings → Codespaces → Secrets) using the exact `VITE_` prefixed names from `.env.example`. The devcontainer will detect them on first launch and generate your `.env` automatically — no manual copy needed.

4. **Start the dev server:**
   ```bash
   npm run dev
   ```

5. **Open the app** at [http://localhost:5173](http://localhost:5173)

---

## Firebase Setup

GlycoGuard uses Firebase for authentication, database, and file storage.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project
2. **Authentication** — Enable the Email/Password sign-in provider under Build → Authentication → Sign-in method
3. **Firestore** — Create a database under Build → Firestore Database. Start in test mode for local development
4. **App config** — Go to Project Settings → Your Apps → Add a web app. Copy the config values into your `.env`:
   ```
   VITE_FIREBASE_API_KEY
   VITE_FIREBASE_AUTH_DOMAIN
   VITE_FIREBASE_PROJECT_ID
   VITE_FIREBASE_STORAGE_BUCKET
   VITE_FIREBASE_MESSAGING_SENDER_ID
   VITE_FIREBASE_APP_ID
   ```

---

## Pinecone Setup

GlycoGuard uses Pinecone as a serverless vector store for semantic search over clinical notes, lab results, preference notes, and pattern summaries.

1. Create a free account at [app.pinecone.io](https://app.pinecone.io)
2. Create a new **serverless index** with these settings:
   - Dimensions: `1024`
   - Metric: `Cosine`
   - Cloud: `AWS`, Region: `us-east-1`
3. From the index detail page, copy the **Host URL** and your **API key** into `.env`:
   ```
   VITE_PINECONE_API_KEY
   VITE_PINECONE_HOST
   VITE_PINECONE_INDEX
   ```

---

## Voyage AI Setup

GlycoGuard uses Voyage AI's `voyage-code-3` model (1024 dimensions) for all vector embeddings.

1. Create a free account at [dashboard.voyageai.com](https://dashboard.voyageai.com)
2. Generate an API key and copy it into `.env`:
   ```
   VITE_VOYAGE_API_KEY
   ```

> **Note:** The free tier allows 3 requests per minute without billing. For normal development use, add a payment method to unlock standard rate limits — the 200M free token allowance still applies and is more than enough for development.

---

## OpenRouter Setup

GlycoGuard uses OpenRouter as an AI gateway, routing requests to Claude for the AI assistant, meal recommendations, and grocery list generation.

1. Create a free account at [openrouter.ai](https://openrouter.ai)
2. Go to Keys and generate an API key, then copy it into `.env`:
   ```
   VITE_OPENROUTER_API_KEY
   ```

> **Note:** Free models are available on OpenRouter for development. The app uses `openrouter/auto` routing, which selects the best available model. For production-quality responses, add credits to your account.

---

## Code Conventions

- **React 18 functional components only** — no class components
- **Inline styles only** — no CSS files, no Tailwind, no CSS modules. All styles are JS objects at the bottom of each component file, named `s` or `styles`
- **Design tokens** — use the colour palette and component conventions defined in `src/styles/tokens.js`. See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for the full design system documentation including colour tokens, typography, spacing, and component conventions. Do not introduce new colours without a clear reason
- **Glucose units** — all values are stored in Firestore as `mmol/L`. Conversion to `mg/dL` happens at the display layer only, via the `useUnits()` hook. Never store `mg/dL` values
- **Firestore paths** — always follow the pattern `users/{userId}/children/{childId}/{collection}`. Never query Firestore for child data directly; use the `useChild()` hook
- **New hooks** go in `src/hooks/`. New services (API clients, data processors) go in `src/services/`
- **Modal pattern** — modals receive `onSave(data)` and `onClose()` props. Save logic lives in the parent screen component, not inside the modal

---

## Submitting a PR

- **Branch from `dev`**, not `main`. The `main` branch reflects what is deployed to production
- **One feature or fix per PR** — keep diffs focused and reviewable
- **Update CLAUDE.md** if you add new files, change the architecture, or make decisions that a future AI assistant working in the codebase should know about
- **Test on a mobile viewport** — use browser devtools at 375px width. The app is mobile-first and should feel native at that size
- Write a clear PR description explaining what changed and why

---

## Areas We Need Help

These are the areas where outside contribution would have the most impact:

- **CGM integrations** — FreeStyle Libre (LibreLink API or NFC read) and Dexcom (developer API) are the priority. Real-time glucose without manual entry changes everything
- **Native app** — an Expo/React Native port is planned for Phase 5. The component structure is designed to make this straightforward
- **Medical accuracy review** — the pattern recognition logic, glucose thresholds, and AI assistant guidance would benefit from clinical review
- **Translations** — the app has no i18n layer yet. Adding one (and providing the first non-English translation) is a high-value contribution
- **Accessibility** — the app is used in high-stress situations, often one-handed, often at night. Screen reader support, larger tap targets, and better contrast are all worthwhile

---

*GlycoGuard is a management and tracking tool for caregivers. It is not a medical device and does not provide medical advice. All contributors should keep this in mind when working on features that surface clinical information.*

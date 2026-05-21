# GlycoGuard

### Pediatric Hypoglycemia Management for Parents

GlycoGuard is a mobile-first application designed to help parents manage hypoglycemia in young children — particularly reactive hypoglycemia and conditions like congenital hyperinsulinism (CHI).

-----

## The Problem

A child with reactive hypoglycemia or hyperinsulinism needs to eat on a strict schedule. Miss the window and you’re not managing a situation — you’re reacting to one. Current tools weren’t built for this: CGM apps show data but don’t connect it to meals or behaviour, food trackers don’t understand glycemic context, and nothing accounts for the reality of co-parenting across two households or handing off to a daycare worker who doesn’t know the child’s patterns.

GlycoGuard was built out of that gap, by a parent living it.

-----

## What It Does

- **Feed timer** — real-time countdown to the next meal window with escalating alerts as the deadline approaches
- **Glucose tracking** — manual entry (fingerprick, CGM, lab) with visual trend display
- **Symptom logging** — one-tap symptom capture with AI-predicted likely symptoms based on timing and history
- **Meal logging** — photo-based AI analysis (before and after) to estimate what was consumed, with manual correction
- **Meal planning** — AI-recommended meals based on the child’s individual glucose patterns, with weekly planning, dietary preferences, and grocery list generation
- **Co-parent sharing** — granular data sharing controls that work independently of whether both parties are communicating
- **Medical reports** — exportable summaries formatted for endocrinologists, GPs, and hospital visits
- **AI assistant** — conversational interface with full access to the child’s history for pattern analysis and real-time recommendations

-----

## Current Status

This repository contains the **public prototype** — an interactive demonstration of the intended experience and design direction. The private development build is significantly further ahead.

### Public prototype

|Feature                          |Status          |
|---------------------------------|----------------|
|UI prototype (all 5 screens)     |✅ Live          |
|Feedback form integration        |✅ Live          |

### Development build

|Feature                          |Status           |
|---------------------------------|-----------------|
|User authentication              |✅ Built          |
|Child profile management         |✅ Built          |
|Manual glucose logging           |✅ Built          |
|Symptom logging                  |✅ Built          |
|Meal logging                     |✅ Built          |
|Feed timer (live countdown)      |✅ Built          |
|Glucose history + chart          |✅ Built          |
|Meal history                     |✅ Built          |
|mmol/L ↔ mg/dL unit toggle       |✅ Built          |
|Vector store (Pinecone + Voyage) |✅ Built          |
|Free-text preference notes       |✅ Built          |
|PDF upload (lab results, letters)|✅ Built          |
|Clinical observation text storage|✅ Built          |
|AI assistant with live context   |✅ Built          |
|OpenRouter AI integration        |✅ Built          |
|Pattern recognition engine       |✅ Built          |
|AI meal recommendations          |✅ Built          |
|Meal recommendations screen      |✅ Built          |
|Weekly meal plan grid            |✅ Built          |
|Grocery list generation          |✅ Built          |
|Vercel deployment                |✅ Live — [glycoguard.app](https://glycoguard.app)|
|AI meal photo analysis           |📋 Planned        |
|Proactive alerts                 |📋 Planned        |
|CGM integration (FreeStyle Libre)|📋 Planned        |
|Co-parent sync                   |📋 Planned        |
|Pattern report export            |📋 Planned        |
|Medical report export            |📋 Planned        |
|Grocery API (Instacart)          |📋 Planned        |
|iOS / Android native app         |📋 Planned        |

-----

## Getting Started (Development)

### Prerequisites

- Node.js 18+
- A [Firebase](https://firebase.google.com) account (free)
- A [Pinecone](https://app.pinecone.io) account (free)
- A [Voyage AI](https://dashboard.voyageai.com) account (free)
- An [OpenRouter](https://openrouter.ai) account (free)

### 1. Clone and install

```bash
git clone https://github.com/ei9h7/glycoGuard-dev.git
cd glycoGuard-dev
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in each value using the steps below.

### 3. Firebase setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Email/Password** sign-in under Authentication → Sign-in method
3. Create a **Firestore database** (start in test mode for local dev)
4. Go to Project Settings → Your Apps → add a web app → copy the config values into `.env`

### 4. Pinecone setup

1. Create a new **serverless index** at [app.pinecone.io](https://app.pinecone.io) with:
   - Dimensions: `1024` · Metric: `Cosine` · Cloud: `AWS us-east-1`
2. Copy your **API key** and the index **Host URL** into `.env`

### 5. Voyage AI setup

1. Sign in at [dashboard.voyageai.com](https://dashboard.voyageai.com)
2. Generate an API key and copy it into `.env`

> The free tier allows 3 RPM without billing. Add a payment method for standard rate limits — the 200M free token allowance still applies.

### 6. OpenRouter setup

1. Sign in at [openrouter.ai](https://openrouter.ai) → Keys
2. Generate an API key and copy it into `.env`

> Free models are available. Add credits for production-quality Claude responses.

### 7. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 8. First run

Register an account, create a child profile (name, diagnosis, glucose targets, meal interval), then start logging meals and glucose readings. After a week of data, visit the Reports screen to generate pattern insights, which will personalise the meal recommendations on the Meals screen.

-----

## Security

All API keys in this project are prefixed with `VITE_`, which means Vite bundles them into the browser JavaScript. **This is intentional for single-user development with a private repository** — your keys are not exposed publicly if the repo is private.

**Before deploying to production with multiple users:**

1. Deploy the Firebase Cloud Functions scaffolded in the `functions/` folder
2. Move all OpenRouter, Voyage AI, and Pinecone calls into those functions so API keys never reach the browser
3. Remove `VITE_OPENROUTER_API_KEY`, `VITE_VOYAGE_API_KEY`, and `VITE_PINECONE_API_KEY` from your Vercel/hosting environment variables

The service interfaces (`vectorStore.js`, `patternEngine.js`) are designed to make this swap a one-file change per service.

-----

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and contribution guidelines. We welcome contributions in CGM integration, native app development, medical accuracy review, and translations.

-----

## Try the Prototype

**<https://ei9h7.github.io/glycoGuard/>**

The prototype is fully interactive. Explore all five screens, try logging a meal, enter a glucose reading, and use the AI Assistant tab to see a preview of what the assistant will be capable of in the full release.

Feedback is built into the app — tap the 💬 button in the bottom right corner of any screen.

-----

## Feedback

A feedback button is built into the app on every screen. We're in active development and every piece of feedback shapes what gets built next.

-----

## Background

GlycoGuard was created by a parent of a child with suspected hyperinsulinism and reactive hypoglycemia. The design is informed by lived experience managing the condition day-to-day — including co-parenting across two households, navigating daycare handoffs, and preparing for medical appointments with incomplete data.

The goal is a tool that works the way parents actually need it to: proactive rather than reactive, built around the individual child’s patterns, and useful across every person involved in that child’s care.

-----

## Feedback & Contact

This project is in active development. If you are a parent, caregiver, or medical professional with experience managing pediatric hypoglycemia or hyperinsulinism, your input is genuinely valuable.

- **In-app feedback:** 💬 button on any screen at the prototype link above
- **Issues:** Use the GitHub Issues tab for bugs or feature suggestions
- **General contact:** Open an issue tagged `[feedback]`

-----

## Tech Stack

- React 18
- Vite
- Firebase (Auth + Firestore + Storage)
- OpenRouter (AI gateway, routes to claude-sonnet-4-20250514)
- Voyage AI (voyage-code-3 embeddings, 1024 dimensions)
- Pinecone (serverless vector store, AWS us-east-1)
- Deployed via Vercel — [glycoguard.app](https://glycoguard.app)

-----

*This application is a management and tracking tool for caregivers. It is not a medical device and does not provide medical advice. Always follow the guidance of your child’s medical team.*

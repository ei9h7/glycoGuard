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
|AI assistant with live context   |✅ Built          |
|AI meal recommendations          |🔨 Partial — covered by assistant; dedicated screen planned|
|AI meal photo analysis           |📋 Planned        |
|Proactive alerts                 |📋 Planned        |
|CGM integration (FreeStyle Libre)|📋 Planned        |
|Co-parent sync                   |📋 Planned        |
|Medical report export            |📋 Planned        |
|Grocery API (Instacart)          |📋 Planned        |
|iOS / Android native app         |📋 Planned        |

-----

## Try the Prototype

**<https://ei9h7.github.io/glycoGuard/>**

The prototype is fully interactive. Explore all five screens, try logging a meal, enter a glucose reading, and use the AI Assistant tab to see a preview of what the assistant will be capable of in the full release.

Feedback is built into the app — tap the 💬 button in the bottom right corner of any screen.

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
- Deployed via GitHub Actions → GitHub Pages

-----

*This application is a management and tracking tool for caregivers. It is not a medical device and does not provide medical advice. Always follow the guidance of your child’s medical team.*

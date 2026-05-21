#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
EXAMPLE_FILE="$REPO_ROOT/.env.example"

# ── Already exists ─────────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  echo "✓ .env already exists — skipping setup"
  exit 0
fi

# ── Check for Codespaces secrets ───────────────────────────────────────────────
# Codespaces secrets are injected as environment variables. If the user has set
# their API keys as Codespaces secrets (Settings > Codespaces > Secrets) using
# the same VITE_ names, we can generate .env automatically.

SECRETS_FOUND=false

for var in \
  VITE_FIREBASE_API_KEY \
  VITE_FIREBASE_AUTH_DOMAIN \
  VITE_FIREBASE_PROJECT_ID \
  VITE_FIREBASE_STORAGE_BUCKET \
  VITE_FIREBASE_MESSAGING_SENDER_ID \
  VITE_FIREBASE_APP_ID \
  VITE_OPENROUTER_API_KEY \
  VITE_VOYAGE_API_KEY \
  VITE_PINECONE_API_KEY \
  VITE_PINECONE_HOST \
  VITE_PINECONE_INDEX; do
  if [ -n "${!var:-}" ]; then
    SECRETS_FOUND=true
    break
  fi
done

# ── Generate .env from secrets ─────────────────────────────────────────────────
if [ "$SECRETS_FOUND" = true ]; then
  echo "# Auto-generated from Codespaces secrets by .devcontainer/setup.sh" > "$ENV_FILE"
  echo "# Do not commit this file." >> "$ENV_FILE"
  echo "" >> "$ENV_FILE"

  for var in \
    VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID \
    VITE_OPENROUTER_API_KEY \
    VITE_VOYAGE_API_KEY \
    VITE_PINECONE_API_KEY \
    VITE_PINECONE_HOST \
    VITE_PINECONE_INDEX; do
    echo "${var}=${!var:-}" >> "$ENV_FILE"
  done

  echo "✓ .env generated from Codespaces secrets"
  exit 0
fi

# ── Fall back to .env.example ──────────────────────────────────────────────────
if [ -f "$EXAMPLE_FILE" ]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo ""
  echo "──────────────────────────────────────────────────────"
  echo "  .env created from .env.example"
  echo ""
  echo "  Fill in your API keys before running the app:"
  echo "    \$REPO_ROOT/.env"
  echo ""
  echo "  You need accounts (all free) at:"
  echo "    Firebase:   https://console.firebase.google.com"
  echo "    Pinecone:   https://app.pinecone.io"
  echo "    Voyage AI:  https://dashboard.voyageai.com"
  echo "    OpenRouter: https://openrouter.ai"
  echo ""
  echo "  Then run:  npm run dev"
  echo "──────────────────────────────────────────────────────"
else
  echo "⚠ .env.example not found — cannot create .env"
  echo "  Create .env manually based on the README."
  exit 1
fi

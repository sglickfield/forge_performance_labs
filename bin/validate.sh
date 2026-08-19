#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "🔍 Step 1: Running Linter..."
npm run lint

echo "📐 Step 2: Running Type Checker..."
npm run typecheck

echo "🧪 Step 3: Running Unit Test Suite..."
npm run test

echo "✅ All guardrails passed successfully!"

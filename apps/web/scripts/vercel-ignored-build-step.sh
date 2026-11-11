#!/bin/sh
#
# Vercel Ignored Build Step for the app project (Root Directory apps/web).
# Command: sh scripts/vercel-ignored-build-step.sh
#
# Lists the paths this app is built from; the shared logic lives in
# scripts/vercel-ignored-build-step.sh at the repository root.

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 1

exec sh "$root/scripts/vercel-ignored-build-step.sh" \
  apps/web \
  packages/ui

#!/bin/sh
#
# Shared Vercel "Ignored Build Step" logic. Each Vercel project calls this
# through a wrapper in its own root directory that names the paths it is
# built from:
#
#   app           -> apps/web/scripts/vercel-ignored-build-step.sh
#   landing page  -> apps/landing-page/scripts/vercel-ignored-build-step.sh
#
# Usage: vercel-ignored-build-step.sh <path>...
#
# Vercel builds on exit 1 and skips on exit 0. Whenever the answer is
# uncertain (missing history, git errors) this script builds.

set -u

build() { echo "Ignored build step: building, $1"; exit 1; }
skip() { echo "Ignored build step: skipping, $1"; exit 0; }

# Only production deploys build. Preview deploys (every other branch) skip.
if [ "${VERCEL_ENV:-}" != "production" ]; then
  skip "not production (VERCEL_ENV=${VERCEL_ENV:-unset})"
fi

[ "$#" -gt 0 ] || build "no project paths given"

root=$(git rev-parse --show-toplevel 2>/dev/null) || build "not a git checkout"
cd "$root" || build "cannot enter $root"

# Files at the repository root that change every workspace's install or build.
set -- "$@" package.json yarn.lock .yarnrc.yml .yarn .nvmrc

has_commit() { git cat-file -e "$1^{commit}" 2>/dev/null; }

# Compare against the project's last successful deployment when Vercel
# provides it and it is in the (shallow) clone, which covers a push of
# several commits at once. Otherwise look at HEAD's own changes.
prev_sha=${VERCEL_GIT_PREVIOUS_SHA:-}
if [ -n "$prev_sha" ] && has_commit "$prev_sha"; then
  from=$prev_sha
  label="since last deployment ${prev_sha}"
else
  from=HEAD^
  label="in $(git rev-parse --short HEAD 2>/dev/null || echo HEAD)"
fi

has_commit "$from" || build "parent of HEAD is not in the clone"

git diff --quiet "$from" HEAD -- "$@"
case $? in
  0) skip "no changes to $* ${label}" ;;
  1) build "changes to project paths ${label}" ;;
  *) build "git diff failed" ;;
esac

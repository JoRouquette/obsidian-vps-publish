#!/usr/bin/env bash
#
# Compatibility wrapper around the portable Node CI pipeline.
#

set -euo pipefail

node scripts/ci-pipeline.mjs "$@"

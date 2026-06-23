#!/usr/bin/env bash
# tools/mirror/regenerate.sh — SOURCE UNIQUE de la logique de régénération des miroirs.
# Appelé À LA FOIS par la validation locale (apply-mirror-sync.sh) et par la CI
# (.github/workflows/sync-mirrors.yml), pour garantir un comportement identique.
#
# Usage : tools/mirror/regenerate.sh <repo> <out_dir>
#   <repo>   ∈ core-domain | core-application | vps-publish
#   <out_dir> dossier de sortie (recréé)
#
# Principe : un miroir auto-suffisant = scaffolding standalone (gabarits capturés)
#            + code source du monorepo + libs vendorées + CI miroir read-only.
set -euo pipefail

repo="${1:?repo manquant}"
out="${2:?out_dir manquant}"

# Racine du monorepo = deux niveaux au-dessus de ce script (tools/mirror/).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TPL="$ROOT/tools/mirror/templates/$repo"
CI="$ROOT/tools/mirror/ci"

[ -d "$TPL" ] || { echo "❌ gabarit introuvable : $TPL" >&2; exit 1; }

rm -rf "$out"
mkdir -p "$out"

# 1) Scaffolding standalone (gabarits capturés depuis le miroir live)
cp -a "$TPL/." "$out/"

# 2) Code source + artefacts dynamiques, depuis la source unique du monorepo
case "$repo" in
  core-domain)
    cp -a "$ROOT/libs/core-domain/src" "$out/src"
    ;;
  core-application)
    cp -a "$ROOT/libs/core-application/src" "$out/src"
    mkdir -p "$out/libs/core-domain"
    cp -a "$ROOT/libs/core-domain/src" "$out/libs/core-domain/src"
    ;;
  vps-publish)
    cp -a "$ROOT/apps/obsidian-vps-publish/src" "$out/src"
    for f in manifest.json manifest-beta.json versions.json styles.css; do
      if [ -f "$ROOT/apps/obsidian-vps-publish/$f" ]; then
        cp -a "$ROOT/apps/obsidian-vps-publish/$f" "$out/$f"
      fi
    done
    mkdir -p "$out/libs/core-domain" "$out/libs/core-application"
    cp -a "$ROOT/libs/core-domain/src"      "$out/libs/core-domain/src"
    cp -a "$ROOT/libs/core-application/src"  "$out/libs/core-application/src"
    ;;
  *)
    echo "❌ repo inconnu : $repo (attendu : core-domain|core-application|vps-publish)" >&2
    exit 1
    ;;
esac

# 3) CI miroir read-only (remplace tout .github hérité d'un gabarit)
rm -rf "$out/.github"
mkdir -p "$out/.github/workflows"
cp -a "$CI/$repo-release.yml" "$out/.github/workflows/release.yml"
if [ "$repo" = "vps-publish" ] && [ -f "$CI/vps-publish-test.yml" ]; then
  cp -a "$CI/vps-publish-test.yml" "$out/.github/workflows/test.yml"
fi

# 4) Garde-fou : pas de semantic-release standalone dans les miroirs
rm -f "$out/.releaserc.json"

echo "✅ régénéré : $repo -> $out"

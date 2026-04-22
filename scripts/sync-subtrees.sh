#!/bin/bash
# scripts/sync-subtrees.sh
# Synchronise les 3 subtrees vers leurs repos séparés GitHub.
#
# IMPORTANT: git subtree ne fonctionne pas depuis un bare repo worktree.
# Ce script crée automatiquement un clone temporaire pour contourner cette limitation.
#
# Usage:
#   bash scripts/sync-subtrees.sh              # Sync les 3 subtrees
#   bash scripts/sync-subtrees.sh vps-publish  # Sync uniquement le plugin

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TMPDIR_BASE="${TMPDIR:-/tmp}"
CLONE_DIR="$TMPDIR_BASE/monorepo-subtree-sync-$$"

# Détecter si on est dans un bare repo worktree
IS_BARE_WORKTREE=false
GIT_COMMON_DIR=$(git -C "$REPO_ROOT" rev-parse --git-common-dir 2>/dev/null || echo "")
if [[ "$GIT_COMMON_DIR" == *".bare"* ]]; then
  IS_BARE_WORKTREE=true
fi

# Préparer le répertoire de travail (clone temp si bare worktree)
setup_workdir() {
  if [ "$IS_BARE_WORKTREE" = true ]; then
    echo "Bare repo détecté — clone temporaire dans $CLONE_DIR..."
    git init "$CLONE_DIR" --quiet
    git -C "$CLONE_DIR" remote add origin "$GIT_COMMON_DIR"
    git -C "$CLONE_DIR" fetch origin refs/heads/main:refs/remotes/origin/main --no-tags --quiet
    git -C "$CLONE_DIR" checkout -b main origin/main --quiet
    git -C "$CLONE_DIR" remote add vps-publish https://github.com/JoRouquette/vps-publish.git
    git -C "$CLONE_DIR" remote add vps-publish-core-domain https://github.com/JoRouquette/vps-publish-core-domain.git
    git -C "$CLONE_DIR" remote add vps-publish-core-application https://github.com/JoRouquette/vps-publish-core-application.git
    WORKDIR="$CLONE_DIR"
  else
    WORKDIR="$REPO_ROOT"
  fi
}

cleanup() {
  if [ "$IS_BARE_WORKTREE" = true ] && [ -d "$CLONE_DIR" ]; then
    rm -rf "$CLONE_DIR"
    echo "Clone temporaire supprimé."
  fi
}
trap cleanup EXIT

# Fonction de push par subtree (split + push)
push_subtree() {
  local prefix="$1"
  local remote="$2"
  local branch_name="tmp-subtree-sync-${remote}-$$"

  echo "Splitting $prefix..."
  git -C "$WORKDIR" subtree split --prefix="$prefix" -b "$branch_name" 2>&1 | tail -1
  echo "Pushing to $remote..."
  git -C "$WORKDIR" push "$remote" "$branch_name":main
  git -C "$WORKDIR" branch -D "$branch_name"
}

TARGET="${1:-all}"

setup_workdir

case "$TARGET" in
  vps-publish)
    echo "Syncing apps/obsidian-vps-publish -> vps-publish..."
    push_subtree "apps/obsidian-vps-publish" "vps-publish"
    echo "vps-publish synced."
    ;;
  core-domain)
    echo "Syncing libs/core-domain -> vps-publish-core-domain..."
    push_subtree "libs/core-domain" "vps-publish-core-domain"
    echo "core-domain synced."
    ;;
  core-application)
    echo "Syncing libs/core-application -> vps-publish-core-application..."
    push_subtree "libs/core-application" "vps-publish-core-application"
    echo "core-application synced."
    ;;
  all)
    echo "Syncing all 3 subtrees..."
    push_subtree "apps/obsidian-vps-publish" "vps-publish"
    echo "1/3 vps-publish done."
    push_subtree "libs/core-domain" "vps-publish-core-domain"
    echo "2/3 core-domain done."
    push_subtree "libs/core-application" "vps-publish-core-application"
    echo "3/3 core-application done."
    echo "All subtrees synced."
    ;;
  *)
    echo "Usage: $0 [vps-publish|core-domain|core-application|all]"
    exit 1
    ;;
esac

# Git Subtree Workflow

## Structure

Ce monorepo synchronise 3 packages vers des repos GitHub séparés via git subtree :

| Dossier monorepo | Repo séparé |
|---|---|
| `apps/obsidian-vps-publish/` | https://github.com/JoRouquette/vps-publish |
| `libs/core-domain/` | https://github.com/JoRouquette/vps-publish-core-domain |
| `libs/core-application/` | https://github.com/JoRouquette/vps-publish-core-application |

## Workflow quotidien

1. Développer dans le monorepo comme d'habitude
2. Commit et push vers `obsidian-vps-publish` (ce repo)
3. Pour synchroniser vers les repos séparés :

```bash
bash scripts/sync-subtrees.sh           # Sync les 3 d'un coup
bash scripts/sync-subtrees.sh vps-publish       # Sync uniquement le plugin
bash scripts/sync-subtrees.sh core-domain       # Sync uniquement core-domain
bash scripts/sync-subtrees.sh core-application  # Sync uniquement core-application
```

## Limitation : bare repo + worktree

Ce monorepo utilise un bare repo + linked worktrees, **incompatible avec `git subtree` directement**.

`scripts/sync-subtrees.sh` gère ça automatiquement :
- Détecte si on est dans un bare worktree
- Crée un clone temporaire si nécessaire
- Nettoie le clone après le sync

Si tu veux syncer manuellement sans le script, tu dois cloner d'abord :

```bash
BARE="C:/Users/jonathan.rouquette/.projects/obsidian-vps-publish/.bare"
TMPDIR=$(mktemp -d)
git init "$TMPDIR"
git -C "$TMPDIR" remote add origin "$BARE"
git -C "$TMPDIR" fetch origin refs/heads/main:refs/remotes/origin/main --no-tags
git -C "$TMPDIR" checkout -b main origin/main
git -C "$TMPDIR" remote add vps-publish https://github.com/JoRouquette/vps-publish.git
# ... ajouter les autres remotes ...
git -C "$TMPDIR" subtree split --prefix=apps/obsidian-vps-publish -b tmp-split
git -C "$TMPDIR" push vps-publish tmp-split:main
git -C "$TMPDIR" branch -D tmp-split
rm -rf "$TMPDIR"
```

## Note sur --squash

`--squash` n'est **pas supporté** avec `git subtree push` dans la version Git actuelle (Windows Git).
Le script utilise `git subtree split` + `git push` à la place, ce qui pousse l'historique complet filtré.

Si tu veux squasher l'historique dans les repos séparés, fais-le manuellement avec `git rebase -i` dans les repos cibles.

## Remotes configurés dans le bare repo

```bash
git -C C:/Users/jonathan.rouquette/.projects/obsidian-vps-publish/.bare remote -v
# vps-publish https://github.com/JoRouquette/vps-publish.git
# vps-publish-core-domain https://github.com/JoRouquette/vps-publish-core-domain.git
# vps-publish-core-application https://github.com/JoRouquette/vps-publish-core-application.git
```

## Règles importantes

- Tu développes **toujours** dans le monorepo
- Les repos séparés sont **en écriture depuis le monorepo uniquement** (sauf urgence)
- Pour une release : sync le monorepo → sync les subtrees → crée les GitHub Releases depuis les repos séparés
- Si un repo séparé a des commits directs (hotfix), les intégrer dans le monorepo via PR avant le prochain sync subtree

# Contributing

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Semantic release derives version bumps and changelogs from commit types:

| Type | Bump | Example |
|---|---|---|
| `feat:` | minor | `feat(settings): add SSH key path option` |
| `fix:` | patch | `fix(upload): retry on 503` |
| `feat!:` / `BREAKING CHANGE:` | major | `feat!: remove legacy sync endpoint` |
| `chore:`, `docs:`, `refactor:`, `test:` | none | — |

## Workflow

1. Fork and create a branch from `main`
2. Make your changes; keep commits atomic and well-scoped
3. Run `npm run lint && npm run test` before pushing
4. Open a pull request — CI will run lint, tests, and build

## Code style

Enforced automatically by ESLint + Prettier. Run `npm run lint:fix` to auto-fix.

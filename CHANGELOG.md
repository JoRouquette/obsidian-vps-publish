## <small>3.0.2 (2025-11-27)</small>

* Merge branch 'hotfix/activate-pipeline' ([c9f5d84](https://github.com/JoRouquette/obsidian-vps-publish/commit/c9f5d84))
* refactor(plugin): rename publish-to-personal-vps to obsidian-vps-publish everywhere ([5c84080](https://github.com/JoRouquette/obsidian-vps-publish/commit/5c84080))

## <small>3.0.1 (2025-11-27)</small>

- Merge branch 'fix/actions' into release ([63d7d21](https://github.com/JoRouquette/obsidian-vps-publish/commit/63d7d21))
- Merge branch 'fix/release-pipeline' into release ([d545e0e](https://github.com/JoRouquette/obsidian-vps-publish/commit/d545e0e))
- Merge branch 'fix/test' into release ([8592bfe](https://github.com/JoRouquette/obsidian-vps-publish/commit/8592bfe))
- Merge branch 'release' ([0eb276e](https://github.com/JoRouquette/obsidian-vps-publish/commit/0eb276e))
- Merge branch 'release' ([2130c7e](https://github.com/JoRouquette/obsidian-vps-publish/commit/2130c7e))
- fix(ci): ensure plugin build exists before packaging in release pipeline ([a80521a](https://github.com/JoRouquette/obsidian-vps-publish/commit/a80521a))
- test(site-index-templates): use Slug.from for slug in renderFolderIndex test ([f423ab0](https://github.com/JoRouquette/obsidian-vps-publish/commit/f423ab0))
- test(site-index-templates): use Slug.from for slug in renderFolderIndex test ([e2cdc26](https://github.com/JoRouquette/obsidian-vps-publish/commit/e2cdc26))
- chore(ci): refactor and rename GitHub Actions workflows ([6fd1c19](https://github.com/JoRouquette/obsidian-vps-publish/commit/6fd1c19))
- chore(ci): unify and refactor GitHub Actions workflows ([849ad65](https://github.com/JoRouquette/obsidian-vps-publish/commit/849ad65))

## 3.0.0 (2025-11-27)

- Merge branch 'feat/ajout-plugin-in-workspace' into release ([19b076b](https://github.com/JoRouquette/obsidian-vps-publish/commit/19b076b))
- Merge branch 'fix/packaging' into release ([82c4595](https://github.com/JoRouquette/obsidian-vps-publish/commit/82c4595))
- Merge branch 'release' ([b11425f](https://github.com/JoRouquette/obsidian-vps-publish/commit/b11425f))
- Merge branch 'release' ([5e863db](https://github.com/JoRouquette/obsidian-vps-publish/commit/5e863db))
- refactor!: migrate folder sanitization to array of rules, update content sanitizer ([d7cd502](https://github.com/JoRouquette/obsidian-vps-publish/commit/d7cd502))
- refactor(core,plugin): modularize note parsing pipeline and settings UI ([c6fa555](https://github.com/JoRouquette/obsidian-vps-publish/commit/c6fa555))
- refactor(site,core): move catalog queries and manifest types to core libs ([ce7fa88](https://github.com/JoRouquette/obsidian-vps-publish/commit/ce7fa88))
- test: add Jest config and test setup ([ef66dab](https://github.com/JoRouquette/obsidian-vps-publish/commit/ef66dab))
- test(core-application): add vault-parsing pipeline tests and update test fixtures ([972dcc0](https://github.com/JoRouquette/obsidian-vps-publish/commit/972dcc0))
- test(obsidian-vps-publish): migrate tests to .test.ts, add missing coverage ([ce2d360](https://github.com/JoRouquette/obsidian-vps-publish/commit/ce2d360))
- refactor: migrate plugin to standalone TypeScript and improve test coverage ([36873e3](https://github.com/JoRouquette/obsidian-vps-publish/commit/36873e3))
- refactor: migrate to kebab-case file naming for consistency ([6f69787](https://github.com/JoRouquette/obsidian-vps-publish/commit/6f69787))
- refactor: move publish entities and ports to dedicated folders ([f742735](https://github.com/JoRouquette/obsidian-vps-publish/commit/f742735))
- refactor: normalize plugin naming and session flow ([cc5146b](https://github.com/JoRouquette/obsidian-vps-publish/commit/cc5146b))
- refactor: plugin software architecture ([249648a](https://github.com/JoRouquette/obsidian-vps-publish/commit/249648a))
- refactor: remove vpsConfig from note and related tests, update slug to use Slug value object ([48e92b0](https://github.com/JoRouquette/obsidian-vps-publish/commit/48e92b0))
- refactor(core): migrate to kebab-case file naming for all entities, ports, and usecases ([4de1e7e](https://github.com/JoRouquette/obsidian-vps-publish/commit/4de1e7e))
- feat(settings): add default sanitization rule banner and disable editing for default rule ([1b4c48c](https://github.com/JoRouquette/obsidian-vps-publish/commit/1b4c48c))
- fix(packaging): update script paths for correct workspace and app root resolution ([fe32b34](https://github.com/JoRouquette/obsidian-vps-publish/commit/fe32b34))
- chore: add plugin to nx monorepo ([64b6ff3](https://github.com/JoRouquette/obsidian-vps-publish/commit/64b6ff3))
- chore: correction pipeline ([f58a6da](https://github.com/JoRouquette/obsidian-vps-publish/commit/f58a6da))
- chore: correction pipeline ([103ea8e](https://github.com/JoRouquette/obsidian-vps-publish/commit/103ea8e))
- chore: update gitignore ([31e7f08](https://github.com/JoRouquette/obsidian-vps-publish/commit/31e7f08))
- ci: enforce lint and tests on merge ([0c89653](https://github.com/JoRouquette/obsidian-vps-publish/commit/0c89653))

### BREAKING CHANGE

- FolderConfig.sanitization is now an array of rules (SanitizationRules[]), not
  a single object.

## 2.0.0 (2025-11-25)

- fix(routes,uploads): correct asset upload param, improve route building logs, update file storage ([5a79d64](https://github.com/JoRouquette/obsidian-vps-publish/commit/5a79d64))
- Merge branch 'chore/migrate-to-nx' into release ([0e96c53](https://github.com/JoRouquette/obsidian-vps-publish/commit/0e96c53))
- Merge branch 'feature/add-batched-upload' into release ([7c77f8c](https://github.com/JoRouquette/obsidian-vps-publish/commit/7c77f8c))
- Merge branch 'fix/issues-semantic-versionning' into release ([f3d3bb9](https://github.com/JoRouquette/obsidian-vps-publish/commit/f3d3bb9))
- Merge branch 'fix/issues-with-routes-and-uploads' into release ([cbc5806](https://github.com/JoRouquette/obsidian-vps-publish/commit/cbc5806))
- Merge branch 'fix/tests-and-linting' into release ([18ee3ba](https://github.com/JoRouquette/obsidian-vps-publish/commit/18ee3ba))
- Merge branch 'release' ([197dba7](https://github.com/JoRouquette/obsidian-vps-publish/commit/197dba7))
- Merge branch 'release' ([63defbe](https://github.com/JoRouquette/obsidian-vps-publish/commit/63defbe))
- Merge branch 'release' ([82fb8d9](https://github.com/JoRouquette/obsidian-vps-publish/commit/82fb8d9))
- refactor(architecture)!: introduce CQRS handlers and feature ports ([eb7eddd](https://github.com/JoRouquette/obsidian-vps-publish/commit/eb7eddd))
- chore: change logger level ([67b19d6](https://github.com/JoRouquette/obsidian-vps-publish/commit/67b19d6))
- chore: fix build configuration ([0951cf7](https://github.com/JoRouquette/obsidian-vps-publish/commit/0951cf7))
- chore: proper docker config ([3796aa0](https://github.com/JoRouquette/obsidian-vps-publish/commit/3796aa0))
- chore: updating pre-push to include tests ([ae4bc7f](https://github.com/JoRouquette/obsidian-vps-publish/commit/ae4bc7f))
- chore(backend): add session lifecycle and filesystem repository ([b9323f6](https://github.com/JoRouquette/obsidian-vps-publish/commit/b9323f6))
- chore(ci): update release workflows to use Node.js 22.14.0 and optimize npm install ([105fa01](https://github.com/JoRouquette/obsidian-vps-publish/commit/105fa01))
- chore(lint): enforce layered eslint rules and add pre-push hook ([ca23781](https://github.com/JoRouquette/obsidian-vps-publish/commit/ca23781))
- chore(lint): migrate to flat config, add Nx plugin and enforce module boundaries ([cf43dcf](https://github.com/JoRouquette/obsidian-vps-publish/commit/cf43dcf))
- chore(publishing): add batched note upload and session-based manifest updates ([be2038f](https://github.com/JoRouquette/obsidian-vps-publish/commit/be2038f))
- test: implement jest.config.cjs files and update tsconfig files to reference them ([936a9af](https://github.com/JoRouquette/obsidian-vps-publish/commit/936a9af))
- test(core-domain): add unit tests for Asset, Manifest, Note, and Session entities ([761a975](https://github.com/JoRouquette/obsidian-vps-publish/commit/761a975))
- test(core-domain): refactor SessionError tests and update coverage config ([bb8991d](https://github.com/JoRouquette/obsidian-vps-publish/commit/bb8991d))
- test(node): add coverage for infra components ([83d8a6e](https://github.com/JoRouquette/obsidian-vps-publish/commit/83d8a6e))
- test(site): add unit coverage for queries and infra ([dde8fa5](https://github.com/JoRouquette/obsidian-vps-publish/commit/dde8fa5))
- refactor: migrate monorepo to nx workspace ([7696edb](https://github.com/JoRouquette/obsidian-vps-publish/commit/7696edb))
- refactor: rename NotesIndexPort to ManifestPort and update manifest structure ([23af6cc](https://github.com/JoRouquette/obsidian-vps-publish/commit/23af6cc))
- refactor: simplify note and manifest models, remove unused fields and utilities ([5fbf829](https://github.com/JoRouquette/obsidian-vps-publish/commit/5fbf829))
- refactor: unify content API, update config, and improve structure ([1822936](https://github.com/JoRouquette/obsidian-vps-publish/commit/1822936))
- refactor(backend): unify note and asset index ports, rename files and update use cases ([73c16a3](https://github.com/JoRouquette/obsidian-vps-publish/commit/73c16a3))
- refactor(core): update SiteIndexPort and PublishNotesUseCase to support logger injection ([7c25075](https://github.com/JoRouquette/obsidian-vps-publish/commit/7c25075))
- feat(backend): refactor publishing and session flows, update note and asset handling ([5eb4ffe](https://github.com/JoRouquette/obsidian-vps-publish/commit/5eb4ffe))
- fix: resolve static file serving, proxy config, and manifest loading ([d121460](https://github.com/JoRouquette/obsidian-vps-publish/commit/d121460))
- fix: simplify asset upload flow and DTOs ([8786b8b](https://github.com/JoRouquette/obsidian-vps-publish/commit/8786b8b))
- ci: unify env file naming, update Docker Compose and CI for multi-env support ([1554ee6](https://github.com/JoRouquette/obsidian-vps-publish/commit/1554ee6))

### BREAKING CHANGE

- legacy StoragePort/IndexPort and Upload\*UseCase paths have been removed or moved,
  impacting imports and tests.

## 1.2.0 (2025-11-17)

- chore:start implementing a better viewer ([e2940e8](https://github.com/JoRouquette/obsidian-vps-publish/commit/e2940e8))
- Merge branch 'feature/better-viewer' into release ([a1fd2ea](https://github.com/JoRouquette/obsidian-vps-publish/commit/a1fd2ea))
- Merge branch 'release' ([8ef89bf](https://github.com/JoRouquette/obsidian-vps-publish/commit/8ef89bf))
- fix: remove trailing slash from note URL in PublishNotesUseCase ([dd9950f](https://github.com/JoRouquette/obsidian-vps-publish/commit/dd9950f))
- fix(api): add health check endpoint and controller ([e0b1dee](https://github.com/JoRouquette/obsidian-vps-publish/commit/e0b1dee))
- fix(backend): add status field to /ping endpoint response in express app ([0ec4f16](https://github.com/JoRouquette/obsidian-vps-publish/commit/0ec4f16))
- fix(express): serve Angular UI and content directory as static assets ([0dc030d](https://github.com/JoRouquette/obsidian-vps-publish/commit/0dc030d))
- fix(logging): make logger optional and add structured logging to backend ([a1cfb14](https://github.com/JoRouquette/obsidian-vps-publish/commit/a1cfb14))
- build: add husky ([9eb7156](https://github.com/JoRouquette/obsidian-vps-publish/commit/9eb7156))
- build: complete dockerfile ([9b4820e](https://github.com/JoRouquette/obsidian-vps-publish/commit/9b4820e))
- feat(backend): add asset upload API, refactor storage ports, improve test setup ([7c2568f](https://github.com/JoRouquette/obsidian-vps-publish/commit/7c2568f))
- feat(ci): add GitHub Actions workflow to build and push Docker image ([6f930ee](https://github.com/JoRouquette/obsidian-vps-publish/commit/6f930ee))
- feat(docker): add assets volume and ASSETS_ROOT env to docker-compose.yml ([cc412ea](https://github.com/JoRouquette/obsidian-vps-publish/commit/cc412ea))
- feat(logging): add structured logger and propagate context across backend ([a3a114a](https://github.com/JoRouquette/obsidian-vps-publish/commit/a3a114a))
- feat(viewer): improve markdown layout and styling, add OnPush change detection ([2cf24a4](https://github.com/JoRouquette/obsidian-vps-publish/commit/2cf24a4))

## <small>1.1.5 (2025-11-13)</small>

- test: sementic commit message ([b3b460c](https://github.com/JoRouquette/obsidian-vps-publish/commit/b3b460c))
- fix: better release file ([c0fa39d](https://github.com/JoRouquette/obsidian-vps-publish/commit/c0fa39d))
- fix: injection issue locally ([83f31eb](https://github.com/JoRouquette/obsidian-vps-publish/commit/83f31eb))
- fix: vault explorer style and navigation ([faca1d4](https://github.com/JoRouquette/obsidian-vps-publish/commit/faca1d4))
- chore: add content to dockerignore ([626c9f0](https://github.com/JoRouquette/obsidian-vps-publish/commit/626c9f0))
- chore: add content to dockerignore ([3557163](https://github.com/JoRouquette/obsidian-vps-publish/commit/3557163))
- chore(release): 1.1.5 [skip ci] ([7bdd0e4](https://github.com/JoRouquette/obsidian-vps-publish/commit/7bdd0e4))
- chore(release): 1.1.5 [skip ci] ([a1808bd](https://github.com/JoRouquette/obsidian-vps-publish/commit/a1808bd))
- chore(release): 1.1.5 [skip ci] ([5d4fb78](https://github.com/JoRouquette/obsidian-vps-publish/commit/5d4fb78))
- style: improve display of main and vault-explorer grid area ([90ffd1b](https://github.com/JoRouquette/obsidian-vps-publish/commit/90ffd1b))
- refactor: update for improved file upload and explorer UI ([0871361](https://github.com/JoRouquette/obsidian-vps-publish/commit/0871361))

## <small>1.1.5 (2025-11-13)</small>

- style: improve display of main and vault-explorer grid area ([90ffd1b](https://github.com/JoRouquette/obsidian-vps-publish/commit/90ffd1b))
- chore: add content to dockerignore ([626c9f0](https://github.com/JoRouquette/obsidian-vps-publish/commit/626c9f0))
- chore: add content to dockerignore ([3557163](https://github.com/JoRouquette/obsidian-vps-publish/commit/3557163))
- chore(release): 1.1.5 [skip ci] ([a1808bd](https://github.com/JoRouquette/obsidian-vps-publish/commit/a1808bd))
- chore(release): 1.1.5 [skip ci] ([5d4fb78](https://github.com/JoRouquette/obsidian-vps-publish/commit/5d4fb78))
- fix: injection issue locally ([83f31eb](https://github.com/JoRouquette/obsidian-vps-publish/commit/83f31eb))
- fix: vault explorer style and navigation ([faca1d4](https://github.com/JoRouquette/obsidian-vps-publish/commit/faca1d4))
- refactor: update for improved file upload and explorer UI ([0871361](https://github.com/JoRouquette/obsidian-vps-publish/commit/0871361))

## <small>1.1.5 (2025-11-13)</small>

- fix: injection issue locally ([83f31eb](https://github.com/JoRouquette/obsidian-vps-publish/commit/83f31eb))
- fix: vault explorer style and navigation ([faca1d4](https://github.com/JoRouquette/obsidian-vps-publish/commit/faca1d4))
- chore: add content to dockerignore ([626c9f0](https://github.com/JoRouquette/obsidian-vps-publish/commit/626c9f0))
- chore: add content to dockerignore ([3557163](https://github.com/JoRouquette/obsidian-vps-publish/commit/3557163))
- chore(release): 1.1.5 [skip ci] ([5d4fb78](https://github.com/JoRouquette/obsidian-vps-publish/commit/5d4fb78))
- refactor: update for improved file upload and explorer UI ([0871361](https://github.com/JoRouquette/obsidian-vps-publish/commit/0871361))

## <small>1.1.5 (2025-11-12)</small>

- refactor: update for improved file upload and explorer UI ([0871361](https://github.com/JoRouquette/obsidian-vps-publish/commit/0871361))
- fix: injection issue locally ([83f31eb](https://github.com/JoRouquette/obsidian-vps-publish/commit/83f31eb))
- chore: add content to dockerignore ([626c9f0](https://github.com/JoRouquette/obsidian-vps-publish/commit/626c9f0))
- chore: add content to dockerignore ([3557163](https://github.com/JoRouquette/obsidian-vps-publish/commit/3557163))

## <small>1.1.4 (2025-11-11)</small>

- build: better docker ([e7ef3ae](https://github.com/JoRouquette/obsidian-vps-publish/commit/e7ef3ae))
- fix: site navigation throughout rendered markdown ([37ffbb0](https://github.com/JoRouquette/obsidian-vps-publish/commit/37ffbb0))
- Merge branch 'main' of https://github.com/JoRouquette/obsidian-vps-publish ([d242256](https://github.com/JoRouquette/obsidian-vps-publish/commit/d242256))
- chore: complete fix ([1085f2e](https://github.com/JoRouquette/obsidian-vps-publish/commit/1085f2e))

## <small>1.1.3 (2025-11-11)</small>

- fix: grid layout ([c447992](https://github.com/JoRouquette/obsidian-vps-publish/commit/c447992))

## <small>1.1.2 (2025-11-10)</small>

- fix: publish-frontend issues ([f761f1c](https://github.com/JoRouquette/obsidian-vps-publish/commit/f761f1c))
- Merge branch 'main' of https://github.com/JoRouquette/obsidian-vps-publish ([ef1350c](https://github.com/JoRouquette/obsidian-vps-publish/commit/ef1350c))
- chore: add favicon ([dde94b4](https://github.com/JoRouquette/obsidian-vps-publish/commit/dde94b4))

## <small>1.1.1 (2025-11-10)</small>

- fix: complete theming and grid ([ad07ee5](https://github.com/JoRouquette/obsidian-vps-publish/commit/ad07ee5))

## 1.1.0 (2025-11-10)

- feat: add theming and gridstyle ([53219e5](https://github.com/JoRouquette/obsidian-vps-publish/commit/53219e5))
- fix: docker and api routes ([9001a9f](https://github.com/JoRouquette/obsidian-vps-publish/commit/9001a9f))
- build: updating docker configuration ([e4b1617](https://github.com/JoRouquette/obsidian-vps-publish/commit/e4b1617))
- docs: update README ([1c492b5](https://github.com/JoRouquette/obsidian-vps-publish/commit/1c492b5))

## 1.0.0 (2025-11-10)

- ci: add semver and conventionnal commits ([fb0ba94](https://github.com/JoRouquette/obsidian-vps-publish/commit/fb0ba94))
- build!: software architecture changes ([9b3875a](https://github.com/JoRouquette/obsidian-vps-publish/commit/9b3875a))
- feat: add complete upload ([0485d9d](https://github.com/JoRouquette/obsidian-vps-publish/commit/0485d9d))
- feat: add docker integration ([f301843](https://github.com/JoRouquette/obsidian-vps-publish/commit/f301843))
- feat: add site index ([9281e0a](https://github.com/JoRouquette/obsidian-vps-publish/commit/9281e0a))
- feat: allow for complete overide of site structure ([fd8e1b7](https://github.com/JoRouquette/obsidian-vps-publish/commit/fd8e1b7))
- feat: better static site ([f24588b](https://github.com/JoRouquette/obsidian-vps-publish/commit/f24588b))
- docs: add README ([bfec9af](https://github.com/JoRouquette/obsidian-vps-publish/commit/bfec9af))
- test: add several tests ([91f603d](https://github.com/JoRouquette/obsidian-vps-publish/commit/91f603d))
- chore: initialize repository ([72b3934](https://github.com/JoRouquette/obsidian-vps-publish/commit/72b3934))

### BREAKING CHANGE

- The project structure has changed significantly.
  All backend code now resides in the `backend/` directory, and frontend
  code is in the root `src/` directory. Import paths, build scripts, and
  deployment processes must be updated accordingly.

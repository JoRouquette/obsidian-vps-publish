# Server-Side Rendering (SSR) Guide

This document explains how to use and deploy the SSR-enabled Angular application (`apps/site`).

## Overview

The Angular application now supports **Server-Side Rendering (SSR)** for:

- **Improved SEO**: Search engines receive fully-rendered HTML
- **Faster First Paint**: Users see content before JavaScript loads
- **Social Media Sharing**: Rich previews with pre-rendered meta tags
- **Accessibility**: Content visible even without JavaScript

## Architecture

SSR implementation uses **Angular Universal** with the following components:

- `apps/site/src/main.ts` - Client-side bootstrap (browser)
- `apps/site/src/main.server.ts` - Server-side bootstrap (Node.js)
- `apps/site/src/app.config.server.ts` - Server-specific configuration
- `apps/site/src/server.ts` - Express server for SSR
- `apps/site/tsconfig.server.json` - TypeScript config for server build

## Development

### Running SSR Dev Server

```bash
# Start SSR development server
npm run start site:ssr

# Or using Nx directly
npx nx serve-ssr site
```

The SSR dev server runs on `http://localhost:4200` with live reload.

### Running Client-Only (SPA) Mode

```bash
# Standard client-side development server
npm run start site

# Or using Nx
npx nx serve site
```

## Building for Production

### Build SSR Application

```bash
# Build both client and server bundles
npx nx build site --configuration=production
```

Output structure:

```
dist/apps/site/
├── browser/              # Client-side files (static assets)
│   ├── index.csr.html   # Client-side rendering version (CSR fallback)
│   ├── index.server.html # Server-side rendering template
│   ├── main-*.js        # Application bundles
│   ├── styles-*.css     # Compiled styles
│   └── assets/          # Static assets
└── server/               # Server-side bundle
    ├── main.server.mjs  # Angular server bootstrap
    ├── server.mjs       # Express server entry point
    └── chunk-*.mjs      # Server-side chunks
```

**Note**: The `index.csr.html` file is the client-side only version. When deploying without SSR (like in our current Docker setup), this file should be renamed to `index.html` to serve as the main entry point.

### Running Production SSR Server

```bash
# Navigate to server bundle
cd dist/apps/site/server

# Run the Express server
node server.mjs
```

Server listens on port `4000` by default (override with `PORT` env variable).

## SSR-Safe Coding Practices

### Platform Detection

Always check if code is running in browser before accessing browser-only APIs:

```typescript
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';

constructor(@Inject(PLATFORM_ID) private platformId: object) {}

someMethod() {
  if (isPlatformBrowser(this.platformId)) {
    // Safe to use window, document, localStorage
    const saved = localStorage.getItem('key');
  }
}
```

### Browser API Usage

❌ **Unsafe** (crashes on server):

```typescript
// Don't access window/document directly
const width = window.innerWidth;
document.querySelector('.my-element');
localStorage.setItem('key', 'value');
```

✅ **Safe** (SSR-compatible):

```typescript
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';

constructor(@Inject(PLATFORM_ID) private platformId: object) {}

getWidth(): number {
  if (isPlatformBrowser(this.platformId)) {
    return window.innerWidth;
  }
  return 1024; // Default for SSR
}
```

### Services with Browser Dependencies

Example: `ThemeService` with localStorage access

```typescript
@Injectable({ providedIn: 'root' })
export class ThemeService {
  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  init() {
    if (!isPlatformBrowser(this.platformId)) {
      // SSR: use default theme
      this.setTheme('light');
      return;
    }

    // Browser: read from localStorage
    const saved = localStorage.getItem('theme');
    this.setTheme(saved || 'light');
  }
}
```

## Client Hydration

The application uses **client hydration** to reuse server-rendered DOM:

```typescript
// apps/site/src/presentation/app.config.ts
import { provideClientHydration } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...
    provideClientHydration(), // ✅ Enables hydration
  ],
};
```

Hydration benefits:

- ✅ Reuses server-rendered HTML (faster)
- ✅ Preserves DOM structure (no flicker)
- ✅ Attaches event listeners to existing elements

## Deployment

### Current Docker Setup (Static CSR)

The current Docker deployment serves the **client-side rendered** version (not using the SSR Express server):

**How it works:**

1. Build creates both `browser/` (CSR) and `server/` (SSR) bundles
2. Dockerfile copies `browser/` contents to `/ui`
3. Renames `index.csr.html` → `index.html` for static serving
4. Express backend serves `/ui` files statically
5. Angular runs client-side hydration for performance

**Dockerfile snippet:**

```dockerfile
# Extract browser build for static serving
RUN set -eux; \
    BDIR="$(find /app/dist/apps/site -type d -name browser -print -quit)"; \
    cp -r "$BDIR/"* "${UI_ROOT}/"; \
    # Rename CSR file for static serving
    if [ -f "${UI_ROOT}/index.csr.html" ]; then \
        mv "${UI_ROOT}/index.csr.html" "${UI_ROOT}/index.html"; \
    fi
```

This approach provides:

- ✅ **Fast builds** - No SSR runtime overhead
- ✅ **SEO-ready** - Client hydration optimizes initial render
- ✅ **Simple deployment** - Static files only
- ✅ **Future-proof** - SSR bundles available if needed

### Future: Full SSR Docker Deployment

To enable true SSR in Docker, modify the Dockerfile's CMD:

```dockerfile
# Instead of serving API only
CMD ["node", "dist/apps/node/main.js"]

# Run SSR server (serves both API and SSR)
CMD ["node", "dist/apps/site/server/server.mjs"]
```

This would require architectural changes to merge the API and SSR servers.

### Docker

The project's Dockerfile already builds the SSR application. Update the runtime stage to serve SSR:

```dockerfile
# Run SSR server instead of static files
CMD ["node", "dist/apps/site/server/server.mjs"]
```

### Environment Variables

- `PORT` - Server port (default: 4000)
- `NODE_ENV` - Environment mode (`production`, `development`)

### Nginx Reverse Proxy

If using Nginx in front of the Node.js server:

```nginx
server {
  listen 80;
  server_name example.com;

  location / {
    proxy_pass http://localhost:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }

  # Serve static assets directly (optional optimization)
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    root /app/dist/apps/site/browser;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

## Troubleshooting

### "window is not defined" Error

**Cause**: Code accessing `window` during SSR

**Fix**: Wrap in `isPlatformBrowser` check:

```typescript
if (isPlatformBrowser(this.platformId)) {
  // window access here
}
```

### "localStorage is not defined"

**Cause**: Direct localStorage access on server

**Fix**: Use platform check or try-catch:

```typescript
private loadFromStorage(): string | null {
  if (!isPlatformBrowser(this.platformId)) {
    return null;
  }
  return localStorage.getItem('key');
}
```

### "document is not defined"

**Cause**: DOM manipulation during SSR

**Fix**: Move DOM logic to `ngAfterViewInit` with platform check:

```typescript
ngAfterViewInit() {
  if (isPlatformBrowser(this.platformId)) {
    document.querySelector('.my-element');
  }
}
```

### Styles Not Applied on Server

**Cause**: Missing `inlineStyleLanguage` in build config

**Fix**: Verify `project.json` has:

```json
{
  "build": {
    "options": {
      "inlineStyleLanguage": "scss"
    }
  }
}
```

## Testing SSR

### Manual Testing

1. Build production bundle: `npx nx build site --configuration=production`
2. Run SSR server: `node dist/apps/site/server/server.mjs`
3. Visit `http://localhost:4000`
4. **View Page Source**: Should show fully-rendered HTML (not just `<app-root>`)

### Curl Test

```bash
# Should return rendered HTML, not loading spinner
curl http://localhost:4000 | grep -i "content"
```

### Lighthouse

Use Lighthouse to verify SSR benefits:

```bash
npx lighthouse http://localhost:4000 --view
```

Expect improved **Time to First Contentful Paint** and **SEO score**.

## Migration Notes

### Updated Files

The following files were modified to enable SSR:

- `apps/site/src/presentation/app.config.ts` - Added `provideClientHydration()`
- `apps/site/src/presentation/services/theme.service.ts` - Added `isPlatformBrowser` checks
- `apps/site/src/presentation/shell/shell.component.ts` - Protected browser APIs
- `apps/site/project.json` - Added `server`, `ssr`, and `serve-ssr` targets

### Backward Compatibility

The application remains fully compatible with client-side-only (SPA) mode:

```bash
# Standard SPA mode (no SSR)
npx nx serve site

# Build SPA only (comment out server/ssr in project.json)
npx nx build site
```

## References

- [Angular SSR Guide](https://angular.io/guide/ssr)
- [Angular Universal](https://github.com/angular/universal)
- [Nx Angular SSR](https://nx.dev/recipes/angular/angular-standalone)

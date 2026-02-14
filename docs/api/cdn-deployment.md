# CDN Deployment Guide

## Purpose

This document provides comprehensive guidance for deploying the obsidian-vps-publish application behind a Content Delivery Network (CDN). CDNs improve performance by caching static content at edge locations closer to users, reducing latency and server load.

The application includes built-in cache headers optimized for CDN deployment, supporting both browser caching and CDN-specific directives.

---

## When to Use

Deploy behind a CDN when:

- **Global audience**: Users distributed across multiple geographic regions benefit from edge caching
- **High traffic**: CDN reduces origin server load by serving cached content from edge locations
- **Static content heavy**: Large images, PDFs, fonts, and other assets benefit most from CDN caching
- **Performance critical**: Sub-second page load times are required for optimal user experience
- **DDoS protection**: CDN providers offer built-in protection against distributed attacks
- **Cost optimization**: Reduced bandwidth costs on origin server by offloading traffic to CDN

**Do NOT use CDN** when:

- Development environment with frequent content changes (caching adds complexity)
- Single-region audience with origin server in same region (minimal latency benefit)
- Highly dynamic content that changes every request (CDN caching ineffective)
- Privacy-sensitive content that must not be cached on third-party servers

---

## Key Concepts

### Cache Strategy

The application uses a **multi-tier caching strategy** optimized for CDN deployment:

#### 1. Asset Caching (Immutable Content)

**Target**: Static assets with content-based hashes (images, PDFs, fonts, CSS, JS)

```http
Cache-Control: public, max-age=31536000, immutable
```

- **`max-age=31536000`**: 365 days (1 year) browser cache
- **`immutable`**: Browser never revalidates (asset paths include content hash)
- **CDN behavior**: Edge caches for 1 year, serves without origin contact

**Location**: `/assets/**/*` (all files in ASSETS_ROOT)

**Rationale**: Assets are content-addressed (hash in manifest), changing content = new hash = new URL → safe to cache forever.

#### 2. HTML Content (Moderate Caching)

**Target**: Rendered Markdown pages (`*.html`)

```http
Cache-Control: public, max-age=300, must-revalidate
ETag: "abc123..."
Last-Modified: Wed, 21 Oct 2024 07:28:00 GMT
```

- **`max-age=300`**: 5 minutes browser cache
- **`must-revalidate`**: After expiration, browser MUST revalidate with server
- **`ETag`**: Enables conditional requests (If-None-Match)
- **`Last-Modified`**: Enables conditional requests (If-Modified-Since)
- **CDN behavior**: Edge caches for 5 minutes, then revalidates with origin

**Location**: `CONTENT_ROOT/**/*.html`

**Rationale**: HTML changes when content is published, short cache ensures users see updates within 5 minutes while reducing origin requests.

#### 3. Manifest (Short-lived Cache)

**Target**: Catalog manifest (`_manifest.json`)

```http
Cache-Control: public, max-age=60, must-revalidate
ETag: "def456..."
```

- **`max-age=60`**: 1 minute browser cache
- **`must-revalidate`**: Revalidation required after expiration
- **CDN behavior**: Edge caches for 1 minute, frequent revalidation

**Location**: `CONTENT_ROOT/_manifest.json`

**Rationale**: Manifest changes on every publish, shortest cache ensures navigation index updates quickly.

#### 4. SEO Files (Long-lived Cache)

**Target**: sitemap.xml, robots.txt

```http
Cache-Control: public, max-age=3600, s-maxage=86400
```

- **`max-age=3600`**: 1 hour browser cache
- **`s-maxage=86400`**: 24 hours CDN cache (CDN-specific directive)
- **CDN behavior**: Edge caches for 24 hours, browsers cache for 1 hour

**Location**: `/sitemap.xml`, `/robots.txt`, `/rss.xml`

**Rationale**: SEO crawlers tolerate stale data, longer CDN cache reduces origin load from frequent bot requests.

#### 5. UI Assets (Deployment-versioned)

**Target**: Angular SPA bundles (CSS, JS files)

```http
Cache-Control: public, max-age=3600
```

- **`max-age=3600`**: 1 hour browser cache
- **CDN behavior**: Edge caches for 1 hour
- **`index.html`**: `max-age=300` (5 minutes) to ensure users get updated SPA quickly

**Location**: `UI_ROOT/**/*` (typically `/ui/browser/`)

**Rationale**: Angular bundles are versioned via filename hashes (`main.abc123.js`), moderate cache balances freshness and performance.

---

### ETags and Conditional Requests

The application generates **strong ETags** based on file content hash:

```typescript
// Backend automatically generates ETag for static files
ETag: 'abc123...';
```

When browser sends conditional request:

```http
GET /page.html
If-None-Match: "abc123..."
```

If content unchanged, server responds:

```http
HTTP/1.1 304 Not Modified
Cache-Control: public, max-age=300, must-revalidate
ETag: "abc123..."
```

**Benefits**:

- Bandwidth reduction (no body sent for 304)
- CDN efficiency (edge revalidates with origin using ETags)
- Immediate updates (when ETag changes, CDN fetches new content)

---

## Configuration

### Environment Variables

No CDN-specific environment variables required. The application uses cache headers automatically.

**Optional**: Adjust cache durations by modifying `apps/node/src/infra/http/express/app.ts`:

```typescript
// apps/node/src/infra/http/express/app.ts (lines 115-135)

// Assets: Immutable content (1 year cache)
app.use(
  '/assets',
  express.static(ASSETS_ROOT, {
    etag: true,
    lastModified: true,
    maxAge: '1y', // Adjust here: '1y', '6M', '30d', etc.
    cacheControl: true,
    setHeaders: (res, filePath) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  })
);

// HTML content: Moderate cache (5 minutes)
if (filePath.endsWith('.html')) {
  res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
  // Adjust max-age: 60 (1min), 300 (5min), 600 (10min), 3600 (1h)
}

// Manifest: Short cache (1 minute)
if (filePath.endsWith('_manifest.json')) {
  res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
  // Adjust max-age: 30 (30s), 60 (1min), 120 (2min)
}
```

---

### CDN Provider Setup

#### Cloudflare (Recommended)

**Step 1**: Add site to Cloudflare

1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Add your domain (e.g., `notes.example.com`)
3. Update DNS nameservers to Cloudflare's NS records

**Step 2**: Configure Caching

1. Navigate to **Caching → Configuration**
2. **Browser Cache TTL**: Respect Existing Headers (recommended)
3. **Caching Level**: Standard
4. **Cache By Query String**: Ignore Query String (default)
5. **Edge Cache TTL**:
   - Respect Origin headers (recommended for this app)
   - Or set custom: 2 hours (balances freshness + performance)

**Step 3**: Create Page Rules (optional for fine-tuning)

| URL Pattern                         | Settings                                                 |
| ----------------------------------- | -------------------------------------------------------- |
| `*notes.example.com/assets/*`       | Cache Level: Cache Everything, Edge Cache TTL: 1 month   |
| `*notes.example.com/_manifest.json` | Cache Level: Cache Everything, Edge Cache TTL: 1 minute  |
| `*notes.example.com/*.html`         | Cache Level: Cache Everything, Edge Cache TTL: 5 minutes |
| `*notes.example.com/api/*`          | Cache Level: Bypass                                      |

**Step 4**: Purge Cache After Publishing

Option A: Purge everything (simplest)

```bash
# Using Cloudflare API
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

Option B: Purge specific files (precise)

```bash
# Purge manifest + updated pages
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "files": [
      "https://notes.example.com/_manifest.json",
      "https://notes.example.com/updated-page.html"
    ]
  }'
```

Option C: Purge by tag (requires tagging response headers)

```typescript
// Add to response headers in app.ts
res.setHeader('Cache-Tag', `session:${sessionId}`);
```

```bash
# Purge all responses with tag
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"tags":["session:abc123"]}'
```

**Step 5**: Enable Optimizations

1. **Speed → Optimization**
   - Auto Minify: HTML, CSS, JS (optional, Angular already minified)
   - Brotli compression: On (better than gzip)
   - HTTP/2: On
   - HTTP/3 (QUIC): On

2. **SSL/TLS**: Full (Strict) mode (encrypts origin traffic)

---

#### AWS CloudFront

**Step 1**: Create Distribution

1. Sign in to [AWS Console](https://console.aws.amazon.com/cloudfront/)
2. Create distribution → Web
3. **Origin Domain**: Your VPS IP or domain (`notes-origin.example.com`)
4. **Origin Protocol Policy**: HTTPS Only
5. **Viewer Protocol Policy**: Redirect HTTP to HTTPS

**Step 2**: Configure Cache Behavior

Default Cache Behavior:

- **Allowed HTTP Methods**: GET, HEAD (read-only)
- **Cache Based on Selected Request Headers**: None (Use Origin Cache Headers)
- **Object Caching**: Use Origin Cache Headers (respects `Cache-Control`)
- **Query String Forwarding**: None (unless using query params)
- **Compress Objects Automatically**: Yes
- **Viewer Certificate**: Custom SSL Certificate (use ACM)

**Additional Cache Behaviors** (create in order):

| Path Pattern      | Cache Policy                                        |
| ----------------- | --------------------------------------------------- |
| `/api/*`          | Caching Disabled (API endpoints always hit origin)  |
| `/assets/*`       | CachingOptimized (1 year TTL, respect immutable)    |
| `/_manifest.json` | Custom (Min TTL: 0, Max TTL: 60, Default TTL: 60)   |
| `/*.html`         | Custom (Min TTL: 0, Max TTL: 300, Default TTL: 300) |

**Step 3**: Invalidation After Publishing

```bash
# Invalidate specific paths
aws cloudfront create-invalidation \
  --distribution-id E1234ABCD5678 \
  --paths "/_manifest.json" "/updated-page.html"

# Invalidate all content (costs apply after 1000/month)
aws cloudfront create-invalidation \
  --distribution-id E1234ABCD5678 \
  --paths "/*"
```

**Cost Optimization**: Use versioned URLs instead of invalidation (change URL when content changes).

---

#### Fastly

**Step 1**: Create Service

1. Sign up at [fastly.com](https://fastly.com)
2. Create service → Web Service
3. **Origin**: Your VPS domain (`notes-origin.example.com`)
4. **Protocol**: HTTPS

**Step 2**: Configure VCL (Varnish Configuration Language)

Fastly uses VCL for advanced caching logic:

```vcl
# Custom VCL for obsidian-vps-publish

sub vcl_recv {
  # Bypass cache for API endpoints
  if (req.url ~ "^/api/") {
    return(pass);
  }

  # Force cache for static assets
  if (req.url ~ "^/assets/") {
    return(lookup);
  }
}

sub vcl_backend_response {
  # Respect origin cache headers by default
  # No modification needed - app sends correct headers

  # Optional: Override for assets (force longer cache)
  if (bereq.url ~ "^/assets/") {
    set beresp.ttl = 365d;
    set beresp.http.Cache-Control = "public, max-age=31536000, immutable";
  }
}

sub vcl_deliver {
  # Add header to identify cache hit/miss (debugging)
  if (obj.hits > 0) {
    set resp.http.X-Cache = "HIT";
  } else {
    set resp.http.X-Cache = "MISS";
  }
}
```

**Step 3**: Purge Content

```bash
# Purge specific URL
curl -X PURGE https://notes.example.com/_manifest.json \
  -H "Fastly-Key: YOUR_API_KEY"

# Purge all content (instant purge)
curl -X POST "https://api.fastly.com/service/{service_id}/purge_all" \
  -H "Fastly-Key: YOUR_API_KEY"
```

**Instant purge**: Fastly supports instant purge (< 150ms globally), no waiting.

---

### Nginx Reverse Proxy with Caching

If using Nginx as reverse proxy (before CDN or standalone):

```nginx
# /etc/nginx/sites-available/notes.example.com

proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=notes_cache:10m max_size=1g inactive=7d;

server {
    listen 443 ssl http2;
    server_name notes.example.com;

    ssl_certificate /etc/letsencrypt/live/notes.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/notes.example.com/privkey.pem;

    # Backend application
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Enable caching
        proxy_cache notes_cache;
        proxy_cache_valid 200 5m; # Cache successful responses for 5 minutes
        proxy_cache_valid 404 1m; # Cache 404 for 1 minute
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_background_update on;
        proxy_cache_lock on;

        # Respect origin Cache-Control
        proxy_cache_revalidate on;

        # Add cache status header (debugging)
        add_header X-Cache-Status $upstream_cache_status;

        # Bypass cache for API endpoints
        if ($request_uri ~ "^/api/") {
            set $no_cache "1";
        }
        proxy_no_cache $no_cache;
        proxy_cache_bypass $no_cache;
    }

    # Static assets: aggressive caching
    location /assets/ {
        proxy_pass http://localhost:3000;
        proxy_cache notes_cache;
        proxy_cache_valid 200 365d; # 1 year
        proxy_ignore_headers Cache-Control Expires; # Override origin
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header X-Cache-Status $upstream_cache_status;
    }
}
```

**Purge cache** (requires `ngx_cache_purge` module):

```bash
# Purge specific URL
curl -X PURGE https://notes.example.com/_manifest.json
```

Or restart Nginx to clear cache:

```bash
sudo rm -rf /var/cache/nginx/*
sudo systemctl reload nginx
```

---

## Usage

### Development Workflow

**During local development**, disable CDN or use short TTLs:

```typescript
// Temporarily reduce cache for development
// apps/node/src/infra/http/express/app.ts

if (process.env.NODE_ENV === 'development') {
  // Override cache headers for dev
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    next();
  });
}
```

**Or** use Cloudflare Development Mode:

1. Cloudflare Dashboard → Caching → Configuration
2. Enable "Development Mode" (disables caching for 3 hours)

---

### Production Deployment

**1. Initial Setup**

Deploy application to VPS:

```bash
# Build production artifacts
npm run build

# Deploy to VPS via Docker
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Configure CDN (Cloudflare example):

```bash
# Point DNS to Cloudflare
# A record: notes.example.com → your-vps-ip

# Enable Cloudflare proxy (orange cloud icon)
```

**2. Verify Cache Headers**

Test that origin sends correct headers:

```bash
# Test asset caching (should see immutable)
curl -I https://notes.example.com/assets/_assets/image.png

# Expected:
# Cache-Control: public, max-age=31536000, immutable
# ETag: "abc123..."

# Test HTML caching (should see 5min + must-revalidate)
curl -I https://notes.example.com/page.html

# Expected:
# Cache-Control: public, max-age=300, must-revalidate
# ETag: "def456..."
# Last-Modified: Wed, 13 Feb 2026 17:00:00 GMT

# Test manifest caching (should see 1min)
curl -I https://notes.example.com/_manifest.json

# Expected:
# Cache-Control: public, max-age=60, must-revalidate
# ETag: "ghi789..."
```

**3. Verify CDN Caching**

Check for CDN headers:

```bash
# Cloudflare adds CF-Cache-Status header
curl -I https://notes.example.com/page.html | grep -i cf-cache

# Expected first request: CF-Cache-Status: MISS
# Expected subsequent: CF-Cache-Status: HIT

# CloudFront adds X-Cache header
curl -I https://notes.example.com/page.html | grep -i x-cache

# Expected: X-Cache: Hit from cloudfront

# Fastly adds X-Cache header
curl -I https://notes.example.com/page.html | grep -i x-cache

# Expected: X-Cache: HIT
```

**4. Publishing Workflow with Cache Invalidation**

After publishing new content from Obsidian plugin:

**Option A**: Automatic purge via webhook (recommended)

Create post-publish script in plugin:

```typescript
// apps/obsidian-vps-publish/src/lib/infra/cdn-purge.ts

export async function purgeCDNCache(sessionId: string): Promise<void> {
  const cdnProvider = settings.cdnProvider; // 'cloudflare' | 'cloudfront' | 'fastly' | 'none'

  if (cdnProvider === 'cloudflare') {
    await purgeCloudflare(sessionId);
  } else if (cdnProvider === 'cloudfront') {
    await purgeCloudFront(sessionId);
  } else if (cdnProvider === 'fastly') {
    await purgeFastly(sessionId);
  }
}

async function purgeCloudflare(sessionId: string): Promise<void> {
  const zoneId = settings.cloudflareZoneId;
  const apiToken = settings.cloudflareApiToken;

  await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ purge_everything: true }),
  });
}
```

**Option B**: Manual purge after publish

```bash
# Cloudflare CLI
cloudflare purge --zone notes.example.com --all

# AWS CLI
aws cloudfront create-invalidation --distribution-id E123 --paths "/*"

# Fastly API
curl -X POST "https://api.fastly.com/service/{service_id}/purge_all" \
  -H "Fastly-Key: YOUR_API_KEY"
```

**Option C**: Wait for TTL expiration (no action)

- Manifest expires in 1 minute → navigation updates automatically
- HTML expires in 5 minutes → users see updates within 5 minutes
- Assets never change (immutable) → no purge needed

---

### Monitoring Cache Performance

#### Cloudflare Analytics

1. Dashboard → Analytics → Caching
2. Metrics:
   - **Cache Hit Ratio**: Target > 90% (higher = better CDN efficiency)
   - **Bandwidth Saved**: Amount of traffic served from edge (not origin)
   - **Requests**: Total requests vs. cached requests

**Optimization tips**:

- Hit ratio < 80% → Increase `max-age` values in cache headers
- High origin requests → Check if cache bypass rules too aggressive

#### CloudFront Metrics

1. AWS Console → CloudFront → Monitoring
2. Metrics:
   - **Cache Hit Rate**: Percentage of requests served from edge
   - **Origin Requests**: Requests forwarded to origin (lower = better)
   - **Latency**: Edge response time (should be < 100ms)

#### Custom Monitoring Script

```bash
#!/bin/bash
# check-cdn-performance.sh

URL="https://notes.example.com/page.html"

echo "Testing CDN performance..."

# First request (should be MISS or stale)
FIRST=$(curl -s -o /dev/null -w "%{http_code} | %{time_total}s | CF-Status: %{header_json}" -H "Cache-Control: no-cache" "$URL")
echo "Cold request: $FIRST"

# Second request (should be HIT)
sleep 1
SECOND=$(curl -s -o /dev/null -w "%{http_code} | %{time_total}s" "$URL")
echo "Warm request: $SECOND"

# ETag test (should return 304)
ETAG=$(curl -sI "$URL" | grep -i etag | cut -d' ' -f2)
CONDITIONAL=$(curl -s -o /dev/null -w "%{http_code}" -H "If-None-Match: $ETAG" "$URL")
echo "Conditional request (ETag): $CONDITIONAL (expected 304)"
```

---

## Troubleshooting

### Issue 1: Cache Not Working (CF-Cache-Status: BYPASS)

**Symptoms**:

- Every request shows `CF-Cache-Status: BYPASS` or `X-Cache: MISS`
- Origin server receives all requests (no bandwidth reduction)
- CDN dashboard shows 0% cache hit ratio

**Root Causes**:

1. **Cache headers missing or incorrect**

   Check origin response:

   ```bash
   curl -I https://origin-server.com/page.html
   ```

   Should see:

   ```http
   Cache-Control: public, max-age=300, must-revalidate
   ```

   If missing, check app configuration in `app.ts`.

2. **CDN configured to bypass cache**
   - Cloudflare: Check Page Rules for "Cache Level: Bypass"
   - CloudFront: Check Cache Behavior settings for "Caching Disabled"
   - Fastly: Check VCL for `return(pass)` statements

3. **Authentication headers preventing cache**

   CDN won't cache responses with:
   - `Set-Cookie` headers (except for known exceptions)
   - `Authorization` headers
   - `Cache-Control: private` or `no-store`

   Solution: Use CDN page rules to ignore these headers for public content.

4. **Query strings preventing cache**

   URLs with query strings may not cache properly:
   - `https://notes.example.com/page.html?v=123` (may bypass cache)

   Solution: Configure CDN to ignore query strings for static content.

**Resolution**:

```bash
# Verify origin sends correct headers
curl -I https://your-origin-server.com/page.html

# Test CDN caching
curl -I https://notes.example.com/page.html
sleep 2
curl -I https://notes.example.com/page.html  # Should show HIT

# Check CDN configuration
# Cloudflare: Caching → Configuration → Browser Cache TTL: "Respect Existing Headers"
# CloudFront: Catalog Behaviors → "Use Origin Cache Headers"
```

---

### Issue 2: Stale Content After Publishing

**Symptoms**:

- Published new content from Obsidian, but old version still visible on website
- Manifest shows outdated pages or assets
- Cache headers show `Age: 3600` (content served from cache)

**Root Causes**:

1. **CDN not purged after publish**
2. **Browser cache not cleared (local issue)**
3. **Manifest cached at edge with stale page list**

**Resolution**:

**Step 1**: Force CDN purge

```bash
# Cloudflare
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"purge_everything":true}'

# CloudFront
aws cloudfront create-invalidation --distribution-id E123 --paths "/*"

# Fastly
curl -X POST "https://api.fastly.com/service/{service_id}/purge_all" \
  -H "Fastly-Key: YOUR_KEY"
```

**Step 2**: Verify purge completed

```bash
# Test URL with cache-busting query param
curl -I "https://notes.example.com/_manifest.json?bust=$(date +%s)"

# Should return recent Last-Modified date
Last-Modified: Thu, 13 Feb 2026 18:00:00 GMT (< 5 min ago)
```

**Step 3**: Clear browser cache

```bash
# Hard refresh in browser
# Chrome/Firefox: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
# Safari: Cmd+Option+R

# Or test with curl (bypasses browser cache)
curl -H "Cache-Control: no-cache" https://notes.example.com/page.html
```

**Prevention**:

- Automate CDN purge in plugin post-publish workflow
- Use shorter `max-age` for manifest (currently 60s, consider 30s)
- Monitor `Age` response header (should be recent after publish)

---

### Issue 3: Assets 404 After Cache Purge

**Symptoms**:

- After purging CDN cache, some assets return 404 Not Found
- Images/PDFs that were previously loading now broken
- Console errors: `GET /assets/_assets/image.png 404`

**Root Causes**:

1. **Race condition**: Purge happened during asset synchronization
2. **Selective promotion**: Asset was deleted because not referenced in manifest
3. **CDN purge was too aggressive**: Purged assets before manifest updated

**Resolution**:

**Step 1**: Verify asset exists on origin

```bash
# Check origin server directly (bypass CDN)
curl -I https://your-vps-ip/assets/_assets/image.png

# If 404 on origin, asset truly missing (not CDN issue)
```

**Step 2**: Check manifest references

```bash
# Download manifest from origin
curl https://your-vps-ip/_manifest.json | jq '.assets[] | select(.path == "_assets/image.png")'

# If null, asset not in manifest → will be deleted during next promotion
```

**Step 3**: Re-publish content to restore missing assets

From Obsidian plugin:

1. Re-run publish workflow (will re-upload assets)
2. Verify asset appears in manifest after publish
3. Purge CDN again to clear 404 cache

**Prevention**:

- Implement **two-phase purge**:
  1. Purge manifest first (CDN fetches new version)
  2. Wait 5 seconds
  3. Purge HTML (ensures references are updated)
  4. Never purge `/assets/*` (immutable content, safe to keep cached)

- Use **cache tags** instead of full purge (Cloudflare Enterprise):
  ```typescript
  res.setHeader('Cache-Tag', `session:${sessionId}`);
  // Only purge content from specific session, not all assets
  ```

---

### Issue 4: High CDN Costs / Bandwidth Overages

**Symptoms**:

- Unexpected cloudflare/CloudFront bills
- Bandwidth usage higher than expected
- CDN reports show low cache hit ratio (< 70%)

**Root Causes**:

1. **Cache hit ratio too low** (origin serving too many requests)
2. **Large assets not cached properly** (images, PDFs bypassing cache)
3. **Frequent cache purges** (invalidations reset cache)
4. **Query string variations** (each unique URL bypasses cache)

**Resolution**:

**Step 1**: Analyze cache hit ratio

```bash
# Cloudflare Analytics → Caching → Cache Hit Ratio
# Target: > 85% for static site

# If < 70%, investigate:
# - Which URLs have low hit ratio?
# - Are cache headers correct?
# - Are page rules overriding cache settings?
```

**Step 2**: Optimize cache configuration

```yaml
# Increase max-age for stable content
# apps/node/src/infra/http/express/app.ts

# Assets: Already optimal (1 year immutable)
# HTML: Consider 10min instead of 5min (if updates less frequent)
if (filePath.endsWith('.html')) {
  res.setHeader('Cache-Control', 'public, max-age=600, must-revalidate'); // 10min
}

# Manifest: Consider 2min instead of 1min (if publish frequency < 1/min)
if (filePath.endsWith('_manifest.json')) {
  res.setHeader('Cache-Control', 'public, max-age=120, must-revalidate'); // 2min
}
```

**Step 3**: Reduce invalidations

- Use **versioned URLs** instead of purging (changes URL when content changes)
- Reduce full-site purges, use selective purge instead
- Wait for TTL expiration for non-critical updates

**Step 4**: Enable Cloudflare Argo (paid)

- Smart routing reduces bandwidth by ~30%
- Tiered caching reuses content across regions
- Cost: ~$5/month + $0.10/GB

**Step 5**: Compress assets before upload

```bash
# Optimize images before publishing
# (future enhancement: thumbnail generation C8)

# Use WebP instead of PNG/JPEG (60-80% smaller)
# Enable Brotli compression at CDN level
```

---

### Issue 5: Mixed Content Warnings (HTTP/HTTPS)

**Symptoms**:

- Browser console: `Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure resource 'http://...'`
- Some assets fail to load (blocked by browser)
- Lock icon in browser shows "Not Secure"

**Root Causes**:

1. **Origin serving HTTP instead of HTTPS**
2. **HTML content contains hardcoded `http://` URLs**
3. **CDN not configured for SSL/TLS**

**Resolution**:

**Step 1**: Verify origin uses HTTPS

```bash
# Test origin directly
curl -I https://your-vps-ip/

# Should return 200, not redirect to HTTP
```

**Step 2**: Configure CDN SSL

- Cloudflare: SSL/TLS → Full (Strict) mode
- CloudFront: Origin Protocol Policy → HTTPS Only
- Fastly: Origin → Use HTTPS

**Step 3**: Update hardcoded URLs in content

```bash
# Search for http:// references in markdown
grep -r "http://" test-vault/*.md

# Replace with relative URLs or https://
# Example: http://example.com/image.png → /assets/image.png
```

**Step 4**: Add HSTS header (optional, security enhancement)

```typescript
// apps/node/src/infra/http/express/app.ts

app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
});
```

---

## References

### Code Locations

- **Cache header configuration**: [apps/node/src/infra/http/express/app.ts](../../apps/node/src/infra/http/express/app.ts#L115-L150)
- **SEO cache directives**: [apps/node/src/infra/http/express/controllers/seo.controller.ts](../../apps/node/src/infra/http/express/controllers/seo.controller.ts#L50) (`s-maxage` for CDN)
- **Static file serving**: [apps/node/src/infra/http/express/app.ts](../../apps/node/src/infra/http/express/app.ts#L106-L148)
- **ETag generation**: Automatic via Express `express.static()` middleware

### Test Coverage

- **Cache headers validation**: [apps/node/src/\_tests/cache-headers.test.ts](../../apps/node/src/_tests/cache-headers.test.ts)
  - Verifies ETag generation
  - Tests 304 Not Modified responses
  - Validates `Cache-Control` directives for different content types
  - Confirms `must-revalidate` and `immutable` flags

- **SEO controller caching**: [apps/node/src/\_tests/seo.controller.test.ts](../../apps/node/src/_tests/seo.controller.test.ts#L130-L132)
  - Validates `s-maxage` for CDN-specific TTL
  - Tests sitemap.xml and robots.txt cache headers

### External Resources

**CDN Providers**:

- [Cloudflare Documentation](https://developers.cloudflare.com/cache/)
- [AWS CloudFront Developer Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/)
- [Fastly Documentation](https://docs.fastly.com/)

**Cache Standards**:

- [RFC 7234 - HTTP Caching](https://www.rfc-editor.org/rfc/rfc7234)
- [MDN: HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Web.dev: HTTP Cache Guide](https://web.dev/http-cache/)

**Best Practices**:

- [Cloudflare Cache Best Practices](https://developers.cloudflare.com/cache/best-practices/)
- [AWS CloudFront Best Practices](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/BestPractices.html)
- [Google Web Fundamentals: Caching](https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/http-caching)

### Related Documentation

- [Architecture overview](./architecture.md) - System design and deployment patterns
- [Asset deduplication](./asset-deduplication.md) - Immutable asset strategy enables long-term caching
- [Asset security](./asset-security.md) - CDN considerations for file upload limits
- [Docker deployment](../docker.md) - Production deployment with reverse proxy

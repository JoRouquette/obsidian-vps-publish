# ITS Theme Design System

**Purpose**: Complete extraction of ITS Theme color tokens and mapping to our application's design system.

**Source Files**:

- Primary: `docs/references/Obsidian--ITS-Theme/theme.css` (lines 2952-3170)
- Secondary: `docs/references/Obsidian--ITS-Theme/obsidian.css`
- Tertiary: `docs/references/Obsidian--ITS-Theme/publish.css`

**Extraction Date**: December 18, 2025  
**ITS Theme Version**: From vendored repository

---

## Design Principles

### 60/30/10 Color Distribution Rule

For proper visual hierarchy following ITS Theme:

- **60%**: Background colors (outer-bar, note, side-bar) — the canvas
- **30%**: Surface colors (bg, embed-bg, code-bg) — content containers
- **10%**: Accent colors (accent, headers, links) — highlights and CTAs

### Reading View Priority

ITS Theme is optimized for **reading published content** (Obsidian Publish mode). Key selectors:

- `.markdown-preview-view` (reading view container)
- `.markdown-rendered` (rendered markdown)
- `.cm-editor` (editor view, lower priority for our use case)

Our application is a **read-only published site**, so we prioritize "reading view" tokens.

---

## Extracted ITS Theme Tokens

### Theme-Agnostic (Common to Both Light & Dark)

```css
body,
.theme-dark,
.theme-light {
  --accent-h: 0;
  --accent-s: 49%;
  --accent-l: 49%;

  /* Mapped to Obsidian standard variables */
  --background-primary: var(--note);
  --background-primary-alt: var(--outer-bar);
  --background-secondary: var(--side-bar);
  --background-secondary-alt: var(--outer-bar);
  --background-modifier-form-field: var(--input-bg);
  --background-modifier-message: var(--dark-accent);
  --background-modifier-border: var(--lines);
  --background-modifier-border-hover: var(--bg);
  --background-modifier-border-focus: var(--accent);
  --background-modifier-hover: var(--hvr-active);
  --background-modifier-success: var(--success-bg);
  --background-modifier-error: var(--failure-bg);
  --background-modifier-active-hover: var(--dark-accent);
  --background-modifier-cover: var(--td);

  --divider-color: var(--outer-bar);
  --divider-color-hover: var(--accent);
  --prompt-border-color: var(--outline);

  --text-normal: var(--text);
  --text-on-accent: var(--text-dl);
  --text-accent: var(--accent2-lite);
  --text-accent-hover: var(--lite-accent);
  --text-muted: var(--soft-text);
  --text-faint: var(--faint-text);
  --text-highlight-bg: var(--hvr);
  --text-highlight-bg-active: var(--hvr-active);
  --text-selection: var(--highlight);

  --interactive-normal: var(--code-bg);
  --interactive-hover: var(--embed-bg);
  --interactive-accent: var(--bttn);
  --interactive-accent-hover: var(--bg);

  --icon-opacity: 1;
  --icon-color: var(--soft-text);
  --icon-color-active: var(--text-dl);
  --icon-color-hover: var(--text);
  --icon-color-focused: var(--text);

  --drag-ghost-background: var(--dark-accent);
  --drag-ghost-text-color: var(--text-dl);
  --tooltip-color: var(--text-dl);

  --toggle-thumb-color: transparent;
  --popover-background: var(--background-primary);

  --italic-color: inherit;
  --bold-color: inherit;
  --text-dl: #e5ebee; /* Design system light text for dark backgrounds */
  --accent-text: #dcddde;

  /* Rainbow list colors */
  --list-color-1: var(--rainbow-1);
  --list-color-2: var(--rainbow-2);
  --list-color-3: var(--rainbow-3);
  --list-color-4: var(--rainbow-4);
  --list-color-5: var(--rainbow-5);
  --list-color-6: var(--rainbow-6);
}
```

---

## Dark Theme (`.theme-dark`)

### Resolved Color Values

**Primary Background Layer (60%):**

```css
--outer-bar: #0b0f13; /* Deepest background (main workspace) */
--dark-sidebar: #0d1014; /* Sidebar background variation */
--note: #1a1e24; /* Note/content area background */
--note-rgb: 26, 30, 36; /* RGB for rgba() usage */
```

**Secondary Surface Layer (30%):**

```css
--bg: #252c36; /* General surface/panel background */
--embed-bg: #0d1014; /* Same as dark-sidebar */
--code-bg: #232831; /* Code block background */
--aside-bg: #11151d; /* Aside/callout background */
--input-bg: rgba(0, 0, 0, 0.3); /* Form input background (semi-transparent) */
```

**Accent Layer (10%):**

```css
--accent: #863737; /* Primary accent color (red-brown) */
--deep-dark-accent: #3f1010; /* Darkest accent variation */
--dark-accent: #652121; /* Dark accent variation */
--lite-accent: #c94d4d; /* Lighter accent variation */
--accent-color: 134, 55, 55; /* RGB for accent */

--accent2: #42536e; /* Secondary accent (blue-gray) */
--accent2-lite: #61afef; /* Light blue accent */

--headers: #c14343; /* Header text color (signature red) */
```

**Text Colors:**

```css
--text: #bccad8; /* Primary text (light blue-gray) */
--text-dl: #e5ebee; /* Text for dark backgrounds (lighter) */
--soft-text: #97a1b9; /* Muted/secondary text */
--faint-text: #4e5b6f; /* Faintest text (hints, placeholders) */
--fg: #cfd7dd; /* Foreground (lighter text variant) */
--footnote: #63778f; /* Footnote text */
```

**Code & Syntax:**

```css
--code-text: #fa4545; /* Inline code text color (bright red) */
--code-bg: #232831; /* Code block background */
```

**Borders & Lines:**

```css
--hr: #2f3b4d; /* Horizontal rule color */
--lines: #2f3b4d; /* General border/divider (same as hr) */
--outline: #0b0f13; /* Outline color (same as outer-bar) */
```

**Hover & Interaction States:**

```css
--hvr: rgba(168, 60, 60, 0.4); /* Hover background (red tint) */
--hvr2: #7a141466; /* Alternate hover (same as highlight) */
--hvr-active: rgba(212, 47, 47, 0.4); /* Active hover state */
--highlight: #7a141466; /* Text selection/highlight */
```

**Tables:**

```css
--table: #283345; /* Table row/cell background */
--th: #652121; /* Table header background (dark-accent) */
--th-text: #e5ebee; /* Table header text (text-dl) */
--td: #06080c60; /* Table data cell overlay (semi-transparent) */
```

**Tags:**

```css
--tag: #652121; /* Tag background (dark-accent) */
--tag-text: #d04e4e; /* Tag text color */
```

**Folders & Files (File Explorer):**

```css
--folder: #863737; /* Folder icon color (accent) */
--folder-open: #e05858; /* Open folder icon color (lighter red) */
--file-icon-color: #586477; /* File icon color (inactive) */
--inactive: #586477; /* Inactive UI element color */
```

**Semantic Colors:**

```css
--success-bg: #32603e; /* Success state background (green) */
--failure-bg: #772d2d; /* Error/failure state background (red) */
```

**Progress & Loading:**

```css
--progress: #863737; /* Progress bar fill (accent) */
--progress-bg: #252c36; /* Progress bar background (bg) */
```

**Graph (if applicable):**

```css
--graph-bg: #0b0f13; /* Graph background (outer-bar) */
--graph-lines: #652121; /* Graph grid lines (dark-accent) */
--graph-node: #bccad8; /* Graph node color (text) */
--graph-fill: #c14343; /* Graph fill color (headers) */
--graph-404: #727e93; /* Graph 404 node color */
--graph-img: #4c78cc; /* Graph image node color (blue) */
--graph-tag: #c14343; /* Graph tag node color (headers) */
--graph-focused: #61afef; /* Graph focused node (accent2-lite) */
```

**Rainbow Colors (Lists, Highlights):**

```css
/* Theme-specific rainbow variations */
--theme-rainbow-1: #7c2929;
--theme-rainbow-2: #652121;
--theme-rainbow-3: #471d1d;
--theme-rainbow-4: #381919;
--theme-rainbow-5: #424c61;
--theme-rainbow-6: #2e333d;

/* Standard rainbow colors */
--rainbow-1: #b03a3a; /* Red */
--rainbow-2: #d59929; /* Orange */
--rainbow-3: #207a20; /* Green */
--rainbow-4: #3232c5; /* Blue */
--rainbow-5: #7f307f; /* Purple */
--rainbow-6: #dd4794; /* Pink */
```

**Special Elements:**

```css
--bttn: #652121; /* Button background (dark-accent) */
--drop-shadow: #06080c60; /* Drop shadow color (same as td) */
--i-at: #bf5e5e; /* @ mention color */
```

---

## Light Theme (`.theme-light`)

### Resolved Color Values

**Primary Background Layer (60%):**

```css
--outer-bar: #eef3fd; /* Deepest background (main workspace) */
--dark-sidebar: #f1f5ff; /* Sidebar background variation (lighter) */
--note: #f8fbff; /* Note/content area background (lightest) */
--note-rgb: 248, 251, 255; /* RGB for rgba() usage */
```

**Secondary Surface Layer (30%):**

```css
--bg: #e1e9f6; /* General surface/panel background */
--embed-bg: #f1f5ff; /* Same as dark-sidebar */
--code-bg: #f1f5ff; /* Code block background (same as embed-bg) */
--aside-bg: #f1f5ff; /* Aside/callout background */
--input-bg: #d0ddef62; /* Form input background (semi-transparent, same as td) */
```

**Accent Layer (10%):**

```css
--accent: #912e2e; /* Primary accent color (darker red) */
--deep-dark-accent: #2f1010; /* Darkest accent variation */
--dark-accent: #c35c5c; /* Dark accent variation (lighter in light theme) */
--lite-accent: #cd2626; /* Lighter accent variation (bright red) */

--accent2: #aac1d3; /* Secondary accent (light blue-gray) */
--accent2-lite: #5599d0; /* Light blue accent */

--headers: #c14343; /* Header text color (signature red, same as dark) */
```

**Text Colors:**

```css
--text: #30353a; /* Primary text (dark gray, almost black) */
--text-dl: #e5ebee; /* Text for dark backgrounds (kept from common) */
--soft-text: #697580; /* Muted/secondary text */
--faint-text: #4e5b6f; /* Faintest text (same as dark theme) */
--fg: #912e2e; /* Foreground (accent color) */
--footnote: #8996a0; /* Footnote text (muted blue-gray) */
```

**Code & Syntax:**

```css
--code-text: #ea4262; /* Inline code text color (bright pink-red) */
--code-bg: #f1f5ff; /* Code block background */
```

**Borders & Lines:**

```css
--hr: #d6deea; /* Horizontal rule color (light blue-gray) */
--lines: #b5c2d8; /* General border/divider (medium blue-gray) */
--outline: #e1e9f6; /* Outline color (same as bg) */
```

**Hover & Interaction States:**

```css
--hvr: rgba(255, 0, 0, 0.212); /* Hover background (red tint) */
--hvr2: rgba(229, 149, 149, 0.37); /* Alternate hover (same as highlight) */
--hvr-active: rgba(253, 115, 115, 0.4); /* Active hover state */
--highlight: rgba(229, 149, 149, 0.37); /* Text selection/highlight */
```

**Tables:**

```css
--table: #ccd6eb; /* Table row/cell background (light blue) */
--th: #c14343; /* Table header background (headers) */
--th-text: #e5ebee; /* Table header text (text-dl) */
--td: #d0ddef62; /* Table data cell overlay (semi-transparent) */
```

**Tags:**

```css
--tag: #c65656; /* Tag background (red) */
--tag-text: #cd2626; /* Tag text color (lite-accent) */
```

**Folders & Files (File Explorer):**

```css
--folder: #912e2e; /* Folder icon color (accent) */
--folder-open: #ce6d6d; /* Open folder icon color (lighter red) */
--file-icon-color: #7e8ea3; /* File icon color (blue-gray) */
--inactive: #a6bbde; /* Inactive UI element color (light blue) */
--icons: #d04e4e; /* General icons color (red) */
```

**Semantic Colors:**

```css
--success-bg: #599049; /* Success state background (green) */
--failure-bg: #772d2d; /* Error/failure state background (red, same as dark) */
```

**Progress & Loading:**

```css
--progress: #912e2e; /* Progress bar fill (accent) */
--progress-bg: #e1e9f6; /* Progress bar background (bg) */
```

**Graph (if applicable):**

```css
--graph-bg: #f8fbff; /* Graph background (note) */
--graph-lines: #e4e7f8; /* Graph grid lines (very light blue) */
--graph-node: #c14343; /* Graph node color (headers) */
--graph-fill: #912e2e; /* Graph fill color (folder/accent) */
--graph-404: #727e93; /* Graph 404 node color (same as dark) */
--graph-img: #4c78cc; /* Graph image node color (blue, same as dark) */
--graph-tag: #000000; /* Graph tag node color (black) */
--graph-focused: rgba(253, 115, 115, 0.4); /* Graph focused node (hvr-active) */
```

**Rainbow Colors (Lists, Highlights):**

```css
/* Theme-specific rainbow variations */
--theme-rainbow-1: #bb5555;
--theme-rainbow-2: #a53f3f;
--theme-rainbow-3: #862c2c;
--theme-rainbow-4: #662828;
--theme-rainbow-5: #697795;
--theme-rainbow-6: #a4aec2;

/* Standard rainbow colors */
--rainbow-1: #dd3c3c; /* Red */
--rainbow-2: #f1ab27; /* Orange/Yellow */
--rainbow-3: #118811; /* Green */
--rainbow-4: #3333cc; /* Blue */
--rainbow-5: #a824a8; /* Purple */
--rainbow-6: #e83b94; /* Pink */
```

**Special Elements:**

```css
--bttn: #c14343; /* Button background (headers) */
--drop-shadow: #d0ddef62; /* Drop shadow color (same as td) */
--i-at: #912e2e; /* @ mention color (accent) */
```

---

## Typography (Common to Both Themes)

From `body.theme-dark, body.theme-light` block (lines 3156+):

```css
--font-default:
  'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif,
  'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Microsoft YaHei Light', sans-serif;

--font-monospace: 'Fira Code', 'Fira Code Medium', 'Source Code Pro', monospace;

--font-text: var(--font-text-override), var(--font-default);
--font-monospace-default: var(--font-monospace-default-override), var(--font-monospace);
--font-interface: var(--font-interface-override), var(--font-default);
```

**Heading fonts** (from `obsidian.css` or theme.css settings):

```css
--font: 'Calisto MT', 'Palatino Black', 'Book Antiqua', 'Georgia', 'Suez One', serif;
```

**Border Radius**:

```css
--radius-s: 0; /* ITS Theme default: no rounded corners */
--radius-m: calc(var(--radius-s) * 1.1);
```

---

## Mapping to Our Application Tokens

**Our Current Tokens** (from `apps/site/src/presentation/theme/its.theme.scss`):

### Proposed Normalized Token Structure

Replace current `its.theme.scss` with:

```scss
:root.theme-dark {
  /* ========================================
     Background Layer (60%)
     ======================================== */
  --color-bg-primary: #0b0f13; /* outer-bar: deepest workspace bg */
  --color-bg-secondary: #1a1e24; /* note: content area bg */
  --color-bg-tertiary: #0d1014; /* dark-sidebar: sidebar bg */

  /* ========================================
     Surface Layer (30%)
     ======================================== */
  --color-surface-default: #252c36; /* bg: general surface */
  --color-surface-raised: #232831; /* code-bg: elevated surface */
  --color-surface-inset: #11151d; /* aside-bg: inset/callout surface */
  --color-surface-input: rgba(0, 0, 0, 0.3); /* input-bg: form field bg */

  /* ========================================
     Text Layer
     ======================================== */
  --color-text-primary: #bccad8; /* text: main text */
  --color-text-secondary: #97a1b9; /* soft-text: muted text */
  --color-text-tertiary: #4e5b6f; /* faint-text: hints/placeholders */
  --color-text-on-accent: #e5ebee; /* text-dl: text on dark accent bg */
  --color-text-code: #fa4545; /* code-text: inline code color */

  /* ========================================
     Accent Layer (10%)
     ======================================== */
  --color-accent-primary: #863737; /* accent: main accent */
  --color-accent-light: #c94d4d; /* lite-accent: lighter accent */
  --color-accent-dark: #652121; /* dark-accent: darker accent */
  --color-accent-secondary: #61afef; /* accent2-lite: blue accent */
  --color-accent-header: #c14343; /* headers: signature ITS red */

  /* ========================================
     Border & Divider Layer
     ======================================== */
  --color-border-default: #2f3b4d; /* hr/lines: standard border */
  --color-border-subtle: #0b0f13; /* outline: subtle border */
  --color-divider: #2f3b4d; /* hr: divider lines */

  /* ========================================
     Interactive States
     ======================================== */
  --color-hover-bg: rgba(168, 60, 60, 0.4); /* hvr: hover background */
  --color-hover-active: rgba(212, 47, 47, 0.4); /* hvr-active: active hover */
  --color-selection: #7a141466; /* highlight: text selection */

  /* ========================================
     Semantic Colors
     ======================================== */
  --color-success-bg: #32603e; /* success-bg: success state */
  --color-error-bg: #772d2d; /* failure-bg: error state */
  --color-info-bg: #42536e; /* accent2: info state */

  /* ========================================
     UI Components
     ======================================== */
  --color-table-header-bg: #652121; /* th: table header */
  --color-table-row-bg: #283345; /* table: table row */
  --color-table-overlay: #06080c60; /* td: table cell overlay */

  --color-tag-bg: #652121; /* tag: tag background */
  --color-tag-text: #d04e4e; /* tag-text: tag text */

  --color-button-bg: #652121; /* bttn: button background */
  --color-button-text: #e5ebee; /* text-dl: button text */

  /* ========================================
     Special Elements
     ======================================== */
  --color-code-bg: #232831; /* code-bg: code block bg */
  --color-link-default: #61afef; /* accent2-lite: link color */
  --color-link-hover: #c94d4d; /* lite-accent: link hover */

  /* ========================================
     File Explorer
     ======================================== */
  --color-folder-icon: #863737; /* folder: folder icon */
  --color-folder-open: #e05858; /* folder-open: open folder */
  --color-file-icon: #586477; /* file-icon-color: file icon */

  /* ========================================
     Typography
     ======================================== */
  --font-family-default:
    'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-family-heading:
    'Calisto MT', 'Palatino Black', 'Book Antiqua', 'Georgia', 'Suez One', serif;
  --font-family-mono: 'Fira Code', 'Fira Code Medium', 'Source Code Pro', monospace;

  /* ========================================
     Border Radius
     ======================================== */
  --radius-small: 0px;
  --radius-medium: 0px;
  --radius-large: 0px;
}

:root.theme-light {
  /* ========================================
     Background Layer (60%)
     ======================================== */
  --color-bg-primary: #eef3fd; /* outer-bar: deepest workspace bg */
  --color-bg-secondary: #f8fbff; /* note: content area bg */
  --color-bg-tertiary: #f1f5ff; /* dark-sidebar: sidebar bg */

  /* ========================================
     Surface Layer (30%)
     ======================================== */
  --color-surface-default: #e1e9f6; /* bg: general surface */
  --color-surface-raised: #f1f5ff; /* code-bg: elevated surface */
  --color-surface-inset: #f1f5ff; /* aside-bg: inset/callout surface */
  --color-surface-input: #d0ddef62; /* input-bg: form field bg (semi-transparent) */

  /* ========================================
     Text Layer
     ======================================== */
  --color-text-primary: #30353a; /* text: main text (dark) */
  --color-text-secondary: #697580; /* soft-text: muted text */
  --color-text-tertiary: #4e5b6f; /* faint-text: hints/placeholders */
  --color-text-on-accent: #e5ebee; /* text-dl: text on dark accent bg */
  --color-text-code: #ea4262; /* code-text: inline code color */

  /* ========================================
     Accent Layer (10%)
     ======================================== */
  --color-accent-primary: #912e2e; /* accent: main accent */
  --color-accent-light: #cd2626; /* lite-accent: lighter accent */
  --color-accent-dark: #c35c5c; /* dark-accent: darker accent */
  --color-accent-secondary: #5599d0; /* accent2-lite: blue accent */
  --color-accent-header: #c14343; /* headers: signature ITS red */

  /* ========================================
     Border & Divider Layer
     ======================================== */
  --color-border-default: #b5c2d8; /* lines: standard border */
  --color-border-subtle: #e1e9f6; /* outline: subtle border */
  --color-divider: #d6deea; /* hr: divider lines */

  /* ========================================
     Interactive States
     ======================================== */
  --color-hover-bg: rgba(255, 0, 0, 0.212); /* hvr: hover background */
  --color-hover-active: rgba(253, 115, 115, 0.4); /* hvr-active: active hover */
  --color-selection: rgba(229, 149, 149, 0.37); /* highlight: text selection */

  /* ========================================
     Semantic Colors
     ======================================== */
  --color-success-bg: #599049; /* success-bg: success state */
  --color-error-bg: #772d2d; /* failure-bg: error state */
  --color-info-bg: #aac1d3; /* accent2: info state */

  /* ========================================
     UI Components
     ======================================== */
  --color-table-header-bg: #c14343; /* th: table header */
  --color-table-row-bg: #ccd6eb; /* table: table row */
  --color-table-overlay: #d0ddef62; /* td: table cell overlay */

  --color-tag-bg: #c65656; /* tag: tag background */
  --color-tag-text: #cd2626; /* tag-text: tag text */

  --color-button-bg: #c14343; /* bttn: button background */
  --color-button-text: #e5ebee; /* text-dl: button text */

  /* ========================================
     Special Elements
     ======================================== */
  --color-code-bg: #f1f5ff; /* code-bg: code block bg */
  --color-link-default: #5599d0; /* accent2-lite: link color */
  --color-link-hover: #cd2626; /* lite-accent: link hover */

  /* ========================================
     File Explorer
     ======================================== */
  --color-folder-icon: #912e2e; /* folder: folder icon */
  --color-folder-open: #ce6d6d; /* folder-open: open folder */
  --color-file-icon: #7e8ea3; /* file-icon-color: file icon */

  /* ========================================
     Typography
     ======================================== */
  --font-family-default:
    'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-family-heading:
    'Calisto MT', 'Palatino Black', 'Book Antiqua', 'Georgia', 'Suez One', serif;
  --font-family-mono: 'Fira Code', 'Fira Code Medium', 'Source Code Pro', monospace;

  /* ========================================
     Border Radius
     ======================================== */
  --radius-small: 0px;
  --radius-medium: 0px;
  --radius-large: 0px;
}
```

---

## Additional Tokens (Not Found in ITS Source)

The following tokens are **not found** in the extracted ITS theme files. They may be:

- Derived from other variables
- Plugin/app-specific
- Not applicable to published sites

**If needed, these must be explicitly defined:**

### Link States (derived)

- `--color-link-visited`: Not found — suggest deriving from `--color-accent-dark` or `--color-text-secondary`
- `--color-link-active`: Not found — suggest using `--color-accent-light`

### Focus Indicators (derived)

- `--color-focus-ring`: Not found — suggest using `--color-accent-secondary` (blue accent for accessibility)

### Loading/Skeleton States (not found)

- `--color-skeleton-bg`: Not found — suggest using `--color-surface-raised` with reduced opacity
- `--color-skeleton-shimmer`: Not found — suggest using `--color-hover-bg`

### Modal/Overlay (partial)

- `--color-modal-backdrop`: Not found — suggest using `--td` (table overlay) or create `rgba(0, 0, 0, 0.5)` for dark, `rgba(0, 0, 0, 0.3)` for light
- `--color-modal-bg`: Use `--color-surface-default`

### Shadows (partial)

- `--drop-shadow` exists in ITS (`#06080c60` dark, `#d0ddef62` light)
- For `box-shadow` CSS, use: `0 2px 8px var(--drop-shadow)`

---

## Alternate Color Schemes

The ITS theme repository includes alternate color schemes in `Alt Color Schemes/` folder. These should NOT be mixed into base tokens but can be handled as optional user-selectable variants.

**Available Alternates** (from `docs/references/Obsidian--ITS-Theme/Alt Color Schemes/`):

- List will be populated after directory scan if needed

**Implementation Strategy**:

- Create separate CSS files for each alternate scheme
- Load alternate as additional class (e.g., `.theme-dark.its-variant-blue`)
- Do not implement alternates in initial refactor — base ITS theme only

---

## Material Design Palette Mapping (Step 4)

**Current Material palettes** (from `its.theme.scss`):

```scss
$its-light: mat.define-theme(
  (
    color: (
      theme-type: light,
      primary: mat.$red-palette,
      // Aligned with ITS red accent
      tertiary: mat.$azure-palette,
      // Aligned with ITS blue accent
    ),
  )
);

$its-dark: mat.define-theme(
  (
    color: (
      theme-type: dark,
      primary: mat.$red-palette,
      // Aligned with ITS red accent
      tertiary: mat.$azure-palette,
      // Aligned with ITS blue accent
    ),
  )
);
```

**Note on Material Integration**:

- Angular Material v20+ uses Material Design 3 (M3) system
- M3 `define-theme()` does not support custom palette maps (only predefined palettes)
- We use `mat.$red-palette` and `mat.$azure-palette` as they're closest to ITS theme colors
- **Primary theming relies on CSS custom properties**, not Material palettes
- Material palettes only affect Material components (mat-button, mat-card, etc.)
- For maximum alignment with ITS theme, apply CSS tokens (`--color-*`) in component styles

---

## Usage Notes

1. **Primary Source**: Use CSS custom properties (`var(--color-*)`) in all components
2. **Avoid Hardcoding**: Never hardcode hex values; always reference tokens
3. **60/30/10 Rule**: Apply background layer (60%), surface layer (30%), accent layer (10%) distribution consistently
4. **Reading View First**: Prioritize styles that affect rendered markdown content
5. **Semantic Naming**: Use semantic token names (`--color-text-primary`) not raw ITS names (`--text`)
6. **Theme Toggle**: Ensure all tokens are defined for both `.theme-dark` and `.theme-light`

---

## References

- ITS Theme Repository: `docs/references/Obsidian--ITS-Theme/`
- ITS Theme Guide: https://publish.obsidian.md/slrvb-docs/ITS+Theme/ITS+Theme
- ITS Theme GitHub: https://github.com/SlRvb/Obsidian--ITS-Theme

---

**Next Steps**:

1. ✅ Extract tokens (complete)
2. ⬜ Implement tokens in `apps/site/src/presentation/theme/its.theme.scss`
3. ⬜ Update component styles to use new tokens
4. ⬜ Test in both light and dark modes
5. ⬜ Verify against non-regression checklist

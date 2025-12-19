# Style Refactor Non-Regression Checklist

**Purpose**: Ensure all existing features and UI states remain functional during ITS Theme visual redesign.

**How to use**: Check each item after applying theme changes. All must pass before deployment.

---

## Global Layout & Navigation

### Shell / Main Layout

- [ ] Desktop layout renders correctly (header, sidebar, content area)
- [ ] Mobile layout renders correctly (responsive breakpoints)
- [ ] Theme toggle (light/dark) works without page refresh
- [ ] Theme persists across navigation
- [ ] No layout shifts or overflow issues on theme switch
- [ ] Footer displays correctly (if present)

### Topbar / Header

- [ ] Logo displays correctly
- [ ] Navigation links visible and clickable
- [ ] Search bar (if present in topbar) accessible
- [ ] Mobile hamburger menu (if present) works
- [ ] Breadcrumbs (if present) display correctly
- [ ] All interaction states work:
  - [ ] Hover on links/buttons
  - [ ] Active/selected state
  - [ ] Focus indicators (keyboard navigation)

### Sidebar(s)

- [ ] Left sidebar (vault explorer) expands/collapses correctly
- [ ] Right sidebar (if present) expands/collapses correctly
- [ ] Sidebar toggle buttons visible
- [ ] Sidebar content scrollable when overflowing
- [ ] Hover states on sidebar items work
- [ ] Selected/active item highlighted correctly
- [ ] Mobile: sidebar behavior correct (overlay, swipe, etc.)

---

## Pages & Routes

### Home Page

- [ ] Hero section (if present) renders correctly
- [ ] Welcome content displays
- [ ] CTAs/buttons visible and styled
- [ ] All interaction states:
  - [ ] Hover on interactive elements
  - [ ] Focus states
  - [ ] Disabled states (if applicable)

### Search Page

- [ ] Search input field visible and styled
- [ ] Search button/icon visible
- [ ] Placeholder text readable
- [ ] Results list displays correctly
- [ ] Empty state ("No results") displays correctly
- [ ] Loading state (if present) visible
- [ ] Result items have proper hover/active states
- [ ] Pagination (if present) works
- [ ] All interaction states:
  - [ ] Hover on result items
  - [ ] Active/selected result
  - [ ] Focus on input and results (keyboard navigation)
  - [ ] Disabled state (if applicable)

### Viewer Page (Main Content Rendering)

- [ ] Markdown content renders correctly
- [ ] Headings (H1-H6) styled properly
- [ ] Paragraphs, lists, blockquotes display correctly
- [ ] Links styled and distinguishable
- [ ] Code blocks (inline and multi-line) render correctly
- [ ] Code syntax highlighting works (if present)
- [ ] Tables render correctly (borders, header row, cell alignment)
- [ ] Callouts/alerts render correctly (if present)
- [ ] Images display correctly
- [ ] Embedded content (if any) renders
- [ ] Wikilinks styled correctly (internal links)
- [ ] Footnotes (if present) display correctly
- [ ] Horizontal rules (`<hr>`) display correctly
- [ ] All interaction states:
  - [ ] Hover on links
  - [ ] Focus on links (keyboard navigation)
  - [ ] Image hover/click (if image viewer feature exists)

---

## Special Rendered Blocks

### Dataview Rendered Content

**Critical: No regression in Dataview output allowed**

- [ ] Dataview **lists** render correctly (bullet points, item spacing)
- [ ] Dataview **tables** render correctly (headers, rows, borders, alignment)
- [ ] Dataview **task lists** render correctly (checkboxes, strike-through on completed)
- [ ] Dataview **inline queries** display results correctly
- [ ] Dataview error messages display correctly (if query fails)
- [ ] Dataview output container styling matches markdown content area
- [ ] All interaction states:
  - [ ] Hover on table rows
  - [ ] Checkbox interaction (if editable)
  - [ ] Sortable columns (if applicable)

### Leaflet Map Blocks

**Critical: Maps must render after F5 refresh**

- [ ] Leaflet map containers render correctly after page load
- [ ] Maps render correctly after F5 refresh (no blank containers)
- [ ] Map tiles load correctly (no missing tiles)
- [ ] Map controls (zoom, pan) visible and functional
- [ ] Map markers/overlays display correctly
- [ ] Map theming (if ITS theme affects map) is correct
- [ ] Mobile: maps render correctly on small screens
- [ ] All interaction states:
  - [ ] Hover on markers/controls
  - [ ] Zoom controls work
  - [ ] Pan/drag interaction smooth

### Code Blocks

- [ ] Multi-line code blocks have correct background
- [ ] Code block border/padding correct
- [ ] Syntax highlighting works (if present)
- [ ] Line numbers (if present) display correctly
- [ ] Copy button (if present) visible and works
- [ ] Inline code (`code`) styled correctly
- [ ] Code text readable in both light/dark themes

### Callouts / Alerts

- [ ] Callout containers render correctly
- [ ] Callout icons (if present) display correctly
- [ ] Callout title styled correctly
- [ ] Callout content readable
- [ ] Different callout types (info, warning, error, success) distinguishable
- [ ] Collapsible callouts (if present) expand/collapse correctly

---

## Vault Explorer

### File/Folder Tree

- [ ] Folder structure displays correctly
- [ ] Folder icons visible
- [ ] File icons visible
- [ ] Indentation for nested folders correct
- [ ] Expand/collapse folder controls work
- [ ] VPS root pinning feature works (file-by-file root selection)
- [ ] Hover state on files/folders
- [ ] Selected file/folder highlighted
- [ ] Active file indicator visible
- [ ] All interaction states:
  - [ ] Hover on file/folder items
  - [ ] Active/selected state
  - [ ] Focus indicator (keyboard navigation)
  - [ ] Disabled state (if applicable)

### File Operations (if present)

- [ ] Context menus (if present) display correctly
- [ ] File actions (if any) visible

---

## Upload Workflow (Plugin-side, but UI feedback in app)

**Note**: If app displays upload progress/stats (e.g., notification modals)

### Upload Progress UI

- [ ] Progress modal/notification displays correctly
- [ ] 4-step model visible:
  - [ ] Step 1: Parse content
  - [ ] Step 2: Upload notes batches
  - [ ] Step 3: Upload assets batches
  - [ ] Step 4: Final stats notification
- [ ] No notification spam (only expected notifications appear)
- [ ] Progress bars (if present) animate correctly
- [ ] Success/failure messages display correctly
- [ ] Error messages readable
- [ ] All interaction states:
  - [ ] Close button on notifications works
  - [ ] Dismiss gesture (if applicable)

---

## Tags UI

### Tag Display

- [ ] Tags render correctly in content
- [ ] Inline tags (Obsidian-style `#tag`) display correctly
- [ ] Tag pills/badges styled correctly
- [ ] Tag colors (if any) display correctly
- [ ] "Tags to delete" logic works (if applicable)
- [ ] All interaction states:
  - [ ] Hover on tags (if clickable)
  - [ ] Active/selected tag (if filterable)

---

## Search & Filters

### Search Input

- [ ] Search input visible and styled
- [ ] Placeholder text readable
- [ ] Input focus state clear
- [ ] Clear button (if present) visible

### Filters (if present)

- [ ] Filter controls visible
- [ ] Dropdown/checkbox filters work
- [ ] Active filters indicated visually
- [ ] Filter reset button (if present) works

### Sort Controls (if present)

- [ ] Sort dropdown/buttons visible
- [ ] Sort order indicator clear
- [ ] Sort options accessible

---

## Forms & Inputs (General)

- [ ] Text inputs styled correctly
- [ ] Textareas styled correctly
- [ ] Buttons styled correctly (primary, secondary, outlined, text)
- [ ] Checkboxes/radio buttons visible and functional
- [ ] Dropdowns/select elements work
- [ ] Form validation messages (if present) display correctly
- [ ] All interaction states:
  - [ ] Hover on inputs/buttons
  - [ ] Focus on inputs
  - [ ] Active button state
  - [ ] Disabled inputs/buttons clearly indicated
  - [ ] Error state (invalid input)
  - [ ] Success state (valid input)

---

## Modals & Dialogs

- [ ] Modals open correctly (overlay visible)
- [ ] Modal content readable
- [ ] Modal close button visible and works
- [ ] Click outside to close works (if applicable)
- [ ] ESC key closes modal (if applicable)
- [ ] Modal scrollable if content overflows
- [ ] All interaction states:
  - [ ] Hover on buttons in modal
  - [ ] Focus trap inside modal (keyboard navigation)

---

## Loading States

- [ ] Spinners/loaders visible
- [ ] Skeleton screens (if present) display correctly
- [ ] Loading text readable

---

## Empty States

- [ ] "No results" message displays correctly
- [ ] "No content" message displays correctly
- [ ] Empty state icons/images (if present) display

---

## Error States

- [ ] Error messages display correctly
- [ ] Error colors distinguishable (not same as normal text)
- [ ] Error icons (if present) visible
- [ ] 404 page (if present) renders correctly

---

## Mobile-Specific UI

### Responsive Layout

- [ ] Mobile breakpoints work correctly
- [ ] Content readable on small screens (no overflow)
- [ ] Touch targets appropriately sized (min 44x44px)
- [ ] No horizontal scroll (unless intentional, e.g., tables)

### Mobile Navigation

- [ ] Hamburger menu (if present) works
- [ ] Bottom navigation (if present) visible and functional
- [ ] Swipe gestures (if present) work
- [ ] Mobile sidebar behavior correct (slide-in overlay)

### Mobile Forms

- [ ] Input fields not zoomed in on focus (font-size >= 16px)
- [ ] Virtual keyboard does not obscure inputs

---

## Keyboard Navigation

- [ ] Tab order logical and complete
- [ ] Focus indicators visible on all interactive elements
- [ ] Shortcuts (if any) still work
- [ ] No keyboard traps

---

## Accessibility (A11y)

- [ ] Color contrast meets WCAG AA (minimum 4.5:1 for text)
- [ ] Focus indicators visible (not just color)
- [ ] Screen reader landmarks (if present) not broken
- [ ] Images have alt text (if applicable to theme changes)

---

## Performance (No Regressions)

- [ ] No new layout shifts (CLS)
- [ ] No increase in bundle size (CSS)
- [ ] No new JavaScript errors in console
- [ ] Theme switch performant (no lag)

---

## Additional Features (Project-Specific)

### Pagination (if present)

- [ ] Pagination controls visible
- [ ] Active page indicated
- [ ] Prev/Next buttons work
- [ ] All interaction states:
  - [ ] Hover on page numbers
  - [ ] Active page state
  - [ ] Disabled state (first/last page)

### Tooltips (if present)

- [ ] Tooltips display on hover
- [ ] Tooltip text readable
- [ ] Tooltip positioning correct (not off-screen)

### Notifications/Toasts (if present)

- [ ] Notifications display in correct position
- [ ] Auto-dismiss works (if applicable)
- [ ] Manual dismiss button works
- [ ] Multiple notifications stack correctly

---

## Sign-Off

**Tester**: **\*\***\_**\*\***  
**Date**: **\*\***\_**\*\***  
**Theme Tested**: [ ] Light [ ] Dark [ ] Both  
**Device/Browser**: **\*\***\_**\*\***

**All items checked?** [ ] Yes [ ] No  
**Any regressions found?** [ ] Yes [ ] No  
**If yes, describe**:

---

## Notes

- This checklist must be completed for **both light and dark themes**.
- Test on **desktop and mobile** viewports.
- Test in **multiple browsers** (Chrome, Firefox, Safari minimum).
- Document any visual changes that are **intentional** in `docs/its-theme-migration-summary.md`.

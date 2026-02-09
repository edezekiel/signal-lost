# Accessibility Audit: Signal Lost

**File:** `/Users/edward/code/personal/signal-lost/signal-lost.html`
**Date:** 2026-02-08
**Auditor:** accessibility-auditor (automated QA)

---

## Critical Issues

### C1. No ARIA Live Region for Radio Log

**Location:** Line 383 (`#radio-log-container`)
**Impact:** Screen reader users will not hear new radio messages as they arrive. The radio log is the primary narrative channel of the game, making it completely unplayable without this.

**Recommendation:** Add `role="log"` and `aria-live="polite"` to the radio log container. For urgent messages, inject them with `aria-live="assertive"` or use a separate assertive live region.

```html
<div id="radio-log-container" role="log" aria-live="polite" aria-relevant="additions"></div>
```

### C2. No ARIA Live Region for Squad Status Updates

**Location:** Line 387 (`#squad-status`), rendered via `renderStatus()` (line 676)
**Impact:** Squad health, ammo, morale, and status changes are invisible to screen readers. The entire status panel is re-rendered via `innerHTML` with no announcement.

**Recommendation:** Add `aria-live="polite"` to `#squad-status`. Alternatively, only announce meaningful changes (e.g., casualties, status transitions) via a dedicated live region.

```html
<div id="squad-status" aria-live="polite" aria-atomic="false"></div>
```

### C3. ASCII Map Has No Text Alternative

**Location:** Line 378 (`<pre id="map"></pre>`), rendered via `renderMap()` (line 620)
**Impact:** The tactical map is pure ASCII art rendered into a `<pre>` element. Screen readers will read it as a stream of punctuation characters (`dot dot dot triangle dot dot`), which is meaningless. The map is essential for gameplay -- users must know unit positions and terrain.

**Recommendation:**
1. Add `role="img"` and a dynamic `aria-label` to `#map` that summarizes unit positions and terrain in prose.
2. Update `renderMap()` to also set the `aria-label`:

```javascript
const summary = `ALPHA at ${gridLabel(squads.ALPHA.col, squads.ALPHA.row)}, BRAVO at ${gridLabel(squads.BRAVO.col, squads.BRAVO.row)}...`;
document.getElementById('map').setAttribute('aria-label', summary);
```

### C4. Choice Overlay Buttons Not Keyboard-Focusable When Shown

**Location:** Lines 1267-1285 (`showChoice()`)
**Impact:** When a choice overlay appears, keyboard focus remains on the command input. There is no focus trap or focus movement to the choice buttons. Users relying on keyboard navigation cannot reach or activate the choices. Furthermore, the game blocks all typed commands during a choice (`state.choiceActive` check at line 771), so keyboard-only users are completely stuck.

**Recommendation:**
1. Move focus to the first choice button when the overlay appears.
2. Trap focus within the overlay until a choice is made.
3. Return focus to `#cmd` after the choice is dismissed.

```javascript
// In showChoice(), after appending buttons:
optionsEl.querySelector('button').focus();
```

---

## High Issues

### H1. Briefing Overlay Not a Dialog / No Focus Trap

**Location:** Lines 399-418 (`#briefing-overlay`)
**Impact:** The briefing overlay covers the entire screen but is a plain `<div>`. Screen readers do not announce it as a dialog. Focus is not trapped inside it -- Tab can move to elements behind the overlay. The "Begin Mission" button is not auto-focused.

**Recommendation:**
1. Add `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="briefing-title"` to `#briefing-overlay` or `#briefing`.
2. Give the `<h2>` an `id` for `aria-labelledby`.
3. Auto-focus the "Begin Mission" button on page load.
4. Trap focus within the dialog.

```html
<div id="briefing" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
  <h2 id="briefing-title">Operation Bright Light</h2>
  ...
  <button onclick="startGame()" autofocus>Begin Mission</button>
</div>
```

### H2. Game Over Overlay Not a Dialog / No Focus Management

**Location:** Lines 420-427 (`#gameover-overlay`)
**Impact:** Same issues as H1. When the game ends, the overlay appears but screen readers do not announce the result. Focus is not moved to the game-over content.

**Recommendation:** Same pattern as H1 -- add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and move focus to the heading or the "New Mission" button when shown.

### H3. Stat Pips Have No Accessible Text

**Location:** Lines 697-706 (`renderStat()`)
**Impact:** Morale, ammo, and stamina are displayed as visual pip bars (`<span class="stat-pip filled">`) with no text content. Screen readers will either skip them entirely or announce empty spans. Example output: `<span class="stat-label">MOR</span>` followed by 5 empty `<span>` elements.

**Recommendation:** Add `aria-label` to the stat container with the numeric value, and `aria-hidden="true"` to the individual pips.

```javascript
function renderStat(label, val, max) {
  let html = `<span class="stat" aria-label="${label} ${Math.round(val)} of ${max}">`;
  html += `<span class="stat-label" aria-hidden="true">${label}</span><span class="stat-bar" aria-hidden="true">`;
  // ... pips ...
  html += `</span></span>`;
  return html;
}
```

### H4. No Skip or Keyboard Shortcut to Navigate Between Panels

**Location:** Lines 375-396 (game layout)
**Impact:** The game has four panels (Map, Radio Log, Squad Status, Command Input) but no landmarks, skip links, or heading hierarchy to navigate between them. Screen reader users must Tab through everything linearly.

**Recommendation:**
1. Add `role="region"` and `aria-label` to each panel.
2. Use proper heading levels inside panels (`<h2>` for panel titles instead of styled `<div class="panel-title">`).

```html
<div class="panel" id="map-panel" role="region" aria-label="Tactical Map">
  <h2 class="panel-title">Tactical Map</h2>
  ...
</div>
```

### H5. Command Input Label Not Programmatically Associated

**Location:** Lines 392-395
**Impact:** The `<label>` element at line 393 (`<label>` COMMAND:</label>`) is present but has no `for` attribute linking it to the `#cmd` input. Screen readers may not announce the label when the input is focused.

**Recommendation:** Add `for="cmd"` to the label element.

```html
<label for="cmd">COMMAND:</label>
```

---

## Medium Issues

### M1. No `prefers-reduced-motion` Support

**Location:** Lines 66-74 (flicker animation), line 170 (fadeIn animation), line 212 (blink animation)
**Impact:** Three animations run continuously -- CRT screen flicker (line 74), message fade-in (line 170), and critical-stat blink (line 212). Users with vestibular disorders or motion sensitivities have no way to disable these. The flicker animation in particular affects the entire screen.

**Recommendation:** Add a media query to disable animations:

```css
@media (prefers-reduced-motion: reduce) {
  #crt { animation: none !important; }
  .radio-msg { animation: none !important; }
  .stat-pip.critical { animation: none !important; }
}
```

### M2. Color Contrast: `--dim` (#666) on `--panel` (#111) Fails WCAG AA

**Location:** Lines 14, 19 (CSS custom properties)
**Impact:** `--dim` (#666666) on `--panel` (#111111) yields a contrast ratio of approximately 3.6:1, which fails WCAG AA for normal text (requires 4.5:1). This color is used for timestamps, panel titles, system messages, squad extras, and stat labels -- a significant amount of game content.

**Recommendation:** Change `--dim` to at least `#888` (contrast ratio ~4.8:1 on #111) or `#999` (~5.6:1) to meet WCAG AA.

### M3. Color Contrast: `--border` (#333) Used for Placeholder Text

**Location:** Line 241 (`#cmd::placeholder{color:#333}`)
**Impact:** The placeholder text "Type command... (HELP for commands)" at color #333 on background #111 has a contrast ratio of approximately 1.8:1, far below WCAG AA minimums. While placeholders are not strictly required to meet contrast ratios, this is the primary instructional text for new players.

**Recommendation:** Use at least `#767676` for placeholder text (4.5:1 on #111).

### M4. TTS Toggle is Not a Button

**Location:** Line 372 (`<span id="tts-toggle" ... onclick="toggleTTS()">`)
**Impact:** The TTS toggle is a `<span>` with an `onclick` handler. It is not focusable via keyboard (no `tabindex`), has no `role="button"`, and no `aria-pressed` state. Keyboard users cannot toggle voice output.

**Recommendation:** Replace with a `<button>` element with `aria-pressed`:

```html
<button id="tts-toggle" onclick="toggleTTS()" aria-pressed="true"
  style="cursor:pointer;color:var(--dim);font-size:12px;letter-spacing:1px;background:none;border:none;font-family:inherit">
  VOICE: ON
</button>
```

Update `toggleTTS()` to also set `aria-pressed`.

### M5. Overlay Buttons Have No Focus Styles

**Location:** Lines 289-301 (briefing button), 323-335 (game-over button), 353-364 (choice buttons)
**Impact:** Buttons only define `:hover` styles. There are no `:focus` or `:focus-visible` styles, so keyboard users cannot see which button is focused. The input field also has `outline:none` (line 238) with no replacement focus indicator.

**Recommendation:** Add visible focus styles:

```css
button:focus-visible {
  outline: 2px solid var(--highlight);
  outline-offset: 2px;
}
#cmd:focus-visible {
  outline: 1px solid var(--glow);
}
```

### M6. `<html>` Has `lang="en"` but No Dynamic Updates for Garbled Text

**Location:** Line 2, Lines 730-738 (`addGarbled()`)
**Impact:** Minor. The `lang="en"` is correctly set. However, garbled text replaces characters with `█` block characters. Screen readers may attempt to read these as symbols. Consider adding `aria-label` on garbled messages with the original text (since the garbling is a visual effect, not a gameplay mechanic hiding information).

---

## Low Issues

### L1. Heading Hierarchy Gaps

**Location:** Lines 94, 260, 279 (h1, h2, h3 usage)
**Impact:** The `<h1>` is in the header ("Signal Lost"). The briefing uses `<h2>` and `<h3>`. However, the main game panels use `<div class="panel-title">` instead of heading elements, creating gaps in the document outline. The game-over overlay also uses `<h2>`.

**Recommendation:** Convert `.panel-title` divs to `<h2>` elements for map, radio log, and squad status panels.

### L2. `<ul>` in Briefing Has `list-style: none` and Custom Markers

**Location:** Lines 283-288
**Impact:** The objectives list uses `list-style: none` with CSS `::before` content `'` '`. Some screen readers (notably VoiceOver/Safari) may not announce these as list items when `list-style: none` is applied.

**Recommendation:** Add `role="list"` to the `<ul>` to ensure list semantics are preserved.

### L3. Map Cursor Style `crosshair` May Confuse Users

**Location:** Line 140 (`cursor: crosshair`)
**Impact:** The map uses `cursor: crosshair` but clicking on the map does nothing. This suggests interactivity that does not exist, which could confuse users (including those using assistive tech that announces cursor changes).

**Recommendation:** Remove `cursor: crosshair` from `#map` or change it to `default`.

### L4. No Page `<main>` Landmark

**Location:** Lines 367-397
**Impact:** The game layout has no `<main>` element or `role="main"`. Screen reader users cannot quickly jump to the main content area.

**Recommendation:** Wrap `#game` with a `<main>` element or add `role="main"` to `#game`.

### L5. Click-to-Focus Intercepts All Clicks

**Location:** Lines 1428-1432
**Impact:** The global click handler calls `cmd.focus()` on every click. This could interfere with assistive technology interactions by stealing focus unexpectedly. For example, clicking a choice button first triggers the button action, then the global handler steals focus back to the input -- though this is partially mitigated by event bubbling order.

**Recommendation:** Only focus the input when clicking on "dead" areas (check `event.target`):

```javascript
document.addEventListener('click', (e) => {
  if (e.target === document.body || e.target.id === 'crt' || e.target.id === 'game') {
    if (!document.getElementById('cmd').disabled) {
      document.getElementById('cmd').focus();
    }
  }
});
```

### L6. `overflow: hidden` on `body` Prevents Zoom Scrolling

**Location:** Line 28 (`overflow: hidden`)
**Impact:** Users who zoom to 200%+ cannot scroll to see off-screen content because both `html` and `body` have `overflow: hidden`. WCAG 1.4.4 requires content to be accessible at 200% zoom.

---

## Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| Critical | 4 | No live regions for game updates, ASCII map inaccessible, choice overlay keyboard trap |
| High | 5 | Dialogs lack ARIA roles/focus management, stat bars unreadable, no landmarks |
| Medium | 6 | No reduced-motion support, contrast failures, non-semantic toggle, no focus styles |
| Low | 6 | Heading gaps, missing landmarks, cursor hints, zoom issues |

**Overall Assessment:** The game is effectively unplayable for screen reader users. The most impactful fix would be adding `aria-live` regions to the radio log and squad status, plus a text summary for the ASCII map. Keyboard-only users are blocked by the choice overlay focus issue and the inaccessible TTS toggle. Visual accessibility is hampered by insufficient color contrast on dim text and missing `prefers-reduced-motion` support.

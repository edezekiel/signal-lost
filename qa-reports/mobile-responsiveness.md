# Mobile Responsiveness Audit - Signal Lost

**Auditor:** mobile-auditor
**Date:** 2026-02-08
**File:** `signal-lost.html` (1,466 lines, single-file game)
**Severity Scale:** CRITICAL / HIGH / MEDIUM / LOW

---

## Executive Summary

The game is built as a desktop-first experience with no media queries or responsive breakpoints. The two-column CSS Grid layout, fixed-size ASCII map, monospace typography, and `overflow:hidden` on `html,body` make it essentially unusable on mobile phones and heavily degraded on tablets. There are 14 issues identified across 11 audit categories.

---

## 1. Viewport Meta Tag

**Status:** Present
**Line 5:** `<meta name="viewport" content="width=device-width, initial-scale=1.0">`

**Issue (MEDIUM):** The viewport tag is present but should also include `interactive-widget=resizes-content` to handle virtual keyboard behavior on modern mobile browsers. Without it, the virtual keyboard may overlay the command input rather than resizing the viewport.

**Fix:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content">
```

---

## 2. CSS Grid Layout on Small Screens

**Severity:** CRITICAL

The main game area uses a two-column grid (line 100):
```css
#main {
  grid-template-columns: 1fr 1fr;
}
```

On screens narrower than ~600px, both columns are squeezed to ~50% of a small viewport. The tactical map and radio log become unreadably small. There are **zero media queries** in the entire stylesheet.

**Fix -- Stack columns on small screens:**
```css
@media (max-width: 768px) {
  #main {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  #right-col {
    grid-template-rows: 1fr auto;
    min-height: 200px;
  }

  #map-panel {
    max-height: 40vh;
  }
}
```

---

## 3. ASCII Map Overflow

**Severity:** CRITICAL

The map uses `white-space: pre` (line 139) with hardcoded character widths. Each map row is approximately 28 characters wide (`3 + 8*3 + margins`). At `font-size: 14px` with `letter-spacing: 2px`, each character occupies ~10.4px, making the map ~291px wide minimum. On phones < 360px wide (minus padding/borders), this overflows horizontally.

The map container has `overflow: hidden` (line 129), so overflowed content is silently clipped rather than scrollable.

**Fix:**
```css
@media (max-width: 480px) {
  #map {
    font-size: 11px;
    letter-spacing: 1px;
    line-height: 1.4;
  }

  #map-container {
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    justify-content: flex-start;
    align-items: flex-start;
  }
}
```

---

## 4. Typography and Readability

**Severity:** HIGH

- **Base font size** is `13px` (line 28). On mobile, this is borderline too small for monospace text, especially with the CRT effects reducing contrast.
- **Panel titles** are `11px` (line 119) -- below WCAG minimum recommended touch-target-adjacent text.
- **Squad status rows** are `12px` (line 200) with stat labels at `10px` (line 203) -- very hard to read on mobile.
- **Stat pips** are `8x8px` (line 206) -- too small to distinguish on mobile.

**Fix:**
```css
@media (max-width: 768px) {
  html, body {
    font-size: 14px;
  }

  .panel-title {
    font-size: 12px;
    padding: 6px 10px;
  }

  .squad-row {
    font-size: 13px;
  }

  .stat-label {
    font-size: 11px;
  }

  .stat-pip {
    width: 10px;
    height: 10px;
  }
}
```

---

## 5. Touch Targets

**Severity:** HIGH

Several interactive elements fail the 44x44px minimum touch target guideline (WCAG 2.5.8):

| Element | Current Size | Location |
|---------|-------------|----------|
| Briefing button | 8px vertical padding | Line 289-300 |
| Game over button | 8px vertical padding | Line 323-335 |
| Choice buttons | 6px vertical padding | Line 353-364 |
| TTS toggle | Inline text, no padding | Line 372 |
| Command input | 8px vertical padding | Line 238 |

**Fix:**
```css
@media (max-width: 768px) {
  #briefing button,
  #gameover button {
    padding: 14px 28px;
    font-size: 14px;
  }

  #choice-options button {
    padding: 12px 20px;
    font-size: 13px;
  }

  #cmd {
    padding: 12px 8px;
    font-size: 16px; /* Prevents iOS zoom on focus */
  }

  #input-area label {
    padding: 12px 10px;
  }

  #tts-toggle {
    padding: 8px;
  }
}
```

Note: Setting `font-size: 16px` on the input is critical -- iOS Safari auto-zooms on any input with font-size below 16px, which breaks the layout.

---

## 6. Virtual Keyboard Behavior

**Severity:** HIGH

- `html, body` have `overflow: hidden` and `height: 100%` (lines 22-29). When the virtual keyboard opens, it covers roughly 40-50% of the viewport. The input area (fixed at the bottom of the grid) gets hidden behind the keyboard.
- The `document.addEventListener('click', ...)` handler (line 1428) auto-focuses the input on any tap, which will repeatedly trigger the keyboard even when users are trying to read the radio log or map.
- There is no `inputmode` attribute on the command input, so the default keyboard appears rather than one optimized for commands.

**Fix:**
```css
@media (max-width: 768px) {
  html, body {
    height: 100%;
    height: 100dvh; /* Dynamic viewport height, accounts for keyboard */
  }

  #game {
    height: 100dvh;
  }

  #input-area {
    position: sticky;
    bottom: 0;
    z-index: 50;
  }
}
```

```html
<!-- Add inputmode for better mobile keyboard -->
<input type="text" id="cmd" inputmode="text" autocapitalize="characters"
       placeholder="Type command..." autocomplete="off" spellcheck="false" disabled>
```

```javascript
// Fix: Don't auto-focus on tap when on touch devices
document.addEventListener('click', (e) => {
  if (!document.getElementById('cmd').disabled && !('ontouchstart' in window)) {
    document.getElementById('cmd').focus();
  }
});
```

---

## 7. Overlay Dialogs on Small Screens

**Severity:** HIGH

### Briefing overlay (lines 243-301)
- `max-width: 640px` with `padding: 40px` -- on a 375px phone, content area is only 295px wide.
- No `overflow-y: auto`, so long briefing text is clipped if it exceeds viewport height.
- The briefing content is quite long (objectives, quick start guide) and will overflow on phones in landscape.

### Game over overlay (lines 303-335)
- `max-width: 500px` with `padding: 40px` -- same padding issue.

### Choice overlay (lines 337-364)
- `bottom: 60px` positions it above the input area, but on mobile with the keyboard open, this puts it off-screen.

**Fix:**
```css
@media (max-width: 768px) {
  #briefing,
  #gameover {
    padding: 20px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 32px);
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
  }

  #briefing h2 {
    font-size: 14px;
    margin-bottom: 12px;
  }

  #choice-overlay {
    bottom: auto;
    top: 50%;
    transform: translate(-50%, -50%);
    max-height: 80vh;
    overflow-y: auto;
  }
}
```

---

## 8. Orientation Handling

**Severity:** MEDIUM

### Portrait
The two-column layout becomes two very narrow columns. After applying the stacking fix from issue #2, portrait mode works but the map takes significant vertical space.

### Landscape
On phones in landscape, the viewport height is typically 320-400px. With `overflow: hidden`, the stacked layout would require scrolling but cannot scroll. The header, map panel, radio log, squad status, and input area cannot all fit in 350px of height.

**Fix:**
```css
@media (max-height: 500px) and (orientation: landscape) {
  #header h1 {
    font-size: 12px;
    letter-spacing: 2px;
  }

  #header {
    padding: 2px 8px;
  }

  #game {
    padding: 4px;
    gap: 2px;
  }

  /* Keep side-by-side in landscape but reduce heights */
  #main {
    grid-template-columns: 1fr 1fr;
  }

  .panel-title {
    padding: 2px 8px;
    font-size: 10px;
  }

  #squad-status {
    padding: 4px 8px;
  }
}
```

---

## 9. Scrolling and Panel Overflow

**Severity:** MEDIUM

- The radio log container (line 155-163) has `overflow-y: auto` and smooth scrolling, which works well.
- However, the custom scrollbar styles (`::-webkit-scrollbar`, 4px width) produce a very thin scrollbar that is nearly impossible to drag on touch screens.
- The map container has `overflow: hidden` -- on mobile where the map may overflow, users cannot pan.
- `#main` has `overflow: hidden` (line 102), preventing any scroll within the main game area.

**Fix:**
```css
@media (max-width: 768px) {
  #radio-log-container::-webkit-scrollbar {
    width: 8px;
  }

  #main {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}
```

---

## 10. CRT Effects and Mobile GPU Performance

**Severity:** MEDIUM

Three CSS effects run continuously and impact mobile GPU performance:

1. **Scanlines** (lines 40-53): A `repeating-linear-gradient` pseudo-element covering the full viewport. Renders on every frame due to the animation below.
2. **Vignette** (lines 56-63): A `radial-gradient` pseudo-element also covering the full viewport.
3. **Screen flicker** (line 74): `animation: flicker 4s infinite` on the entire `#crt` container. This triggers constant repaints of the entire page.

On lower-end mobile devices, these three overlapping effects cause:
- Increased battery drain
- Potential frame drops during radio log updates (which trigger DOM changes under the composited layers)
- The scanline effect at 2px/4px spacing may cause moire patterns on certain mobile screen densities

**Fix:**
```css
@media (max-width: 768px) {
  /* Disable scanlines on mobile for performance */
  #crt::before {
    display: none;
  }

  /* Simplify vignette */
  #crt::after {
    background: radial-gradient(ellipse at center, transparent 70%, rgba(0,0,0,0.4) 100%);
  }

  /* Reduce flicker animation */
  #crt {
    animation: none;
  }
}

/* Allow users who prefer reduced motion to disable effects everywhere */
@media (prefers-reduced-motion: reduce) {
  #crt {
    animation: none;
  }
  #crt::before {
    display: none;
  }
  .radio-msg {
    animation: none;
  }
  .stat-pip.critical {
    animation: none;
  }
}
```

---

## 11. Header Layout on Narrow Screens

**Severity:** MEDIUM

The header (lines 86-95) uses `display: flex; justify-content: space-between`. It contains the title "SIGNAL LOST" and a right-side group with operation name, clock, and TTS toggle separated by `│` characters. On screens < 400px, these wrap awkwardly or overflow.

**Fix:**
```css
@media (max-width: 480px) {
  #header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 6px 10px;
  }

  #header h1 {
    font-size: 12px;
    letter-spacing: 3px;
  }

  #header > div {
    font-size: 11px;
    width: 100%;
  }
}
```

---

## Consolidated Proposed Media Queries

Below is a complete, consolidated CSS block that could be appended to the existing `<style>` tag (before `</style>` at line 365):

```css
/* ═══ MOBILE RESPONSIVENESS ═══ */

/* Respect user motion preferences */
@media (prefers-reduced-motion: reduce) {
  #crt { animation: none; }
  #crt::before { display: none; }
  .radio-msg { animation: none; }
  .stat-pip.critical { animation: none; }
}

/* Tablet breakpoint */
@media (max-width: 768px) {
  html, body {
    font-size: 14px;
    height: 100dvh;
  }

  #game {
    height: 100dvh;
  }

  #main {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  #right-col {
    min-height: 200px;
  }

  #map-panel {
    max-height: 40vh;
  }

  .panel-title {
    font-size: 12px;
    padding: 6px 10px;
  }

  .squad-row {
    font-size: 13px;
    flex-wrap: wrap;
  }

  .stat-label { font-size: 11px; }
  .stat-pip { width: 10px; height: 10px; }

  #briefing button,
  #gameover button {
    padding: 14px 28px;
    font-size: 14px;
  }

  #choice-options button {
    padding: 12px 20px;
    font-size: 13px;
  }

  #cmd {
    padding: 12px 8px;
    font-size: 16px; /* Prevents iOS auto-zoom */
  }

  #input-area label {
    padding: 12px 10px;
  }

  #input-area {
    position: sticky;
    bottom: 0;
    z-index: 50;
  }

  #briefing,
  #gameover {
    padding: 20px;
    max-width: calc(100vw - 32px);
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
  }

  #choice-overlay {
    bottom: auto;
    top: 50%;
    transform: translate(-50%, -50%);
    max-height: 80vh;
    overflow-y: auto;
  }

  #radio-log-container::-webkit-scrollbar {
    width: 8px;
  }

  /* Reduce CRT effects for mobile GPU */
  #crt::before { display: none; }
  #crt { animation: none; }
}

/* Phone breakpoint */
@media (max-width: 480px) {
  #header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  #header h1 {
    font-size: 12px;
    letter-spacing: 3px;
  }

  #map {
    font-size: 11px;
    letter-spacing: 1px;
    line-height: 1.4;
  }

  #map-container {
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    justify-content: flex-start;
    align-items: flex-start;
  }

  #briefing h2 {
    font-size: 14px;
    margin-bottom: 12px;
  }
}

/* Landscape phones */
@media (max-height: 500px) and (orientation: landscape) {
  #header {
    padding: 2px 8px;
  }

  #header h1 {
    font-size: 12px;
    letter-spacing: 2px;
  }

  #game {
    padding: 4px;
    gap: 2px;
  }

  #main {
    grid-template-columns: 1fr 1fr;
  }

  .panel-title {
    padding: 2px 8px;
    font-size: 10px;
  }

  #squad-status {
    padding: 4px 8px;
  }
}
```

---

## JavaScript Changes Required

### 1. Disable auto-focus on touch devices (line 1428)
```javascript
document.addEventListener('click', (e) => {
  const cmd = document.getElementById('cmd');
  if (!cmd.disabled && !('ontouchstart' in window)) {
    cmd.focus();
  }
});
```

### 2. Add autocapitalize for mobile keyboards (line 394)
```html
<input type="text" id="cmd" inputmode="text" autocapitalize="characters"
       placeholder="Type command..." autocomplete="off" spellcheck="false" disabled>
```

---

## Issue Summary Table

| # | Issue | Severity | Category |
|---|-------|----------|----------|
| 1 | No media queries -- two-column layout breaks on mobile | CRITICAL | Layout |
| 2 | ASCII map clips/overflows on narrow screens | CRITICAL | Content |
| 3 | Font sizes too small for mobile (10-13px monospace) | HIGH | Typography |
| 4 | Touch targets below 44x44px minimum | HIGH | Touch |
| 5 | Virtual keyboard hides command input | HIGH | Input |
| 6 | iOS auto-zoom on input focus (font < 16px) | HIGH | Input |
| 7 | Briefing overlay not scrollable, padding too large | HIGH | Overlays |
| 8 | Auto-focus on tap interferes with touch interaction | HIGH | Input |
| 9 | CRT effects cause GPU strain on mobile | MEDIUM | Performance |
| 10 | Header wraps awkwardly on narrow screens | MEDIUM | Layout |
| 11 | Landscape orientation layout broken | MEDIUM | Orientation |
| 12 | Thin scrollbar (4px) unusable on touch screens | MEDIUM | Scrolling |
| 13 | Choice overlay positioned off-screen with keyboard | MEDIUM | Overlays |
| 14 | No `interactive-widget` viewport hint | LOW | Viewport |

**Critical:** 2 | **High:** 6 | **Medium:** 5 | **Low:** 1

---

## Testing Recommendations

1. Test with Chrome DevTools device emulation: iPhone SE (375x667), iPhone 14 (390x844), iPad (768x1024)
2. Test on a real iOS device for keyboard behavior and auto-zoom
3. Test on a real Android device for performance with CRT effects
4. Test in both portrait and landscape orientations
5. Verify the game is playable end-to-end on mobile after fixes are applied

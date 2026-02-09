# Signal Lost - Feature Development Proposals

**Date:** 2026-02-08
**Analyst:** feature-analyst
**Game Version:** Initial commit (24ffd7d)

---

## Table of Contents

1. [Gameplay Depth](#1-gameplay-depth)
2. [Narrative & Immersion](#2-narrative--immersion)
3. [Quality of Life](#3-quality-of-life)
4. [Replayability](#4-replayability)
5. [Polish & Feel](#5-polish--feel)
6. [Social & Meta](#6-social--meta)

---

## 1. Gameplay Depth

### 1.1 Fog of War

- **Description:** Tiles beyond a 2-tile radius of each squad render as `???` or darkened. Enemy positions, POIs, and terrain are only visible when within squad sight range. Recon or elevated terrain (hills) extends visibility.
- **Priority:** High
- **Complexity:** Medium
- **Impact:** High - transforms the map from an informational display into a strategic tool; creates genuine tension around unknown territory.
- **Implementation Notes:** Add a `visible(col, row)` function that checks distance from all friendly units. In `renderMap()`, replace cell content with fog character when not visible. Hills at row 0, col >= 5 could grant +1 visibility radius. Store previously-seen tiles as "stale" intel (shown dimmer).

### 1.2 Terrain Effects on Combat

- **Description:** Jungle (`~`) and hills (`^`) provide defensive bonuses. Units in jungle get +20% defense; units on hills get +20% attack and +1 visibility. Open ground offers no bonus. Units attacking into jungle suffer a penalty.
- **Priority:** Medium
- **Complexity:** Low
- **Impact:** Medium - adds positional strategy to movement decisions.
- **Implementation Notes:** In `resolveCombat()`, check terrain at squad position. Multiply `squadPower` by a terrain modifier. Add a `getTerrainAt(col, row)` helper. Display terrain bonus in SITREP output.

### 1.3 Squad Formations / Stances

- **Description:** Add SPREAD and TIGHT formation commands. SPREAD reduces casualties from artillery/air strikes but lowers combat effectiveness. TIGHT increases firepower but makes the squad vulnerable to area attacks. Current behavior becomes the default "NORMAL" stance.
- **Priority:** Medium
- **Complexity:** Low
- **Impact:** Medium - gives players more tactical granularity without overwhelming complexity.
- **Implementation Notes:** Add `formation` property to squad state (`normal`, `spread`, `tight`). Modify `resolveCombat()` and fire support casualty calculations to factor in formation. New command: `[UNIT] FORMATION [SPREAD|TIGHT|NORMAL]`.

### 1.4 Enemy AI Movement

- **Description:** Enemies currently remain static until discovered. Add patrol routes and reactive behavior: enemies move toward gunfire, reinforce other enemy positions under attack, or attempt to flank engaged squads. After VIPER is found, enemies converge on that position.
- **Priority:** High
- **Complexity:** Medium
- **Impact:** High - static enemies make the map feel lifeless once their positions are known. Dynamic AI creates genuine pressure and unpredictability.
- **Implementation Notes:** Add `patrol` array to enemy objects with waypoints. In `tick()`, move enemies along patrol routes. On combat events, set enemy `targetCol/targetRow` toward the engagement. Add a `moveEnemy(enemy)` function called each tick. Enemies that move into squad proximity trigger contact events.

### 1.5 Smoke Screen Command

- **Description:** Allow squads to deploy smoke at their position or an adjacent tile. Smoke lasts 3 ticks and blocks line-of-sight for combat (reducing accuracy for both sides) and allows DUSTOFF to land at hot LZs. Limited to 1 smoke per squad.
- **Priority:** Medium
- **Complexity:** Low
- **Impact:** Medium - creates a new tactical option for extraction and disengagement.
- **Implementation Notes:** Add `smokeGrid` array to state tracking active smoke positions and expiry times. New command: `[UNIT] SMOKE [GRID]`. In `resolveCombat()`, if smoke is between combatants, reduce effectiveness. In DUSTOFF landing check, treat smoke-covered hot LZ as cold.

### 1.6 Overwatch Command

- **Description:** Squad enters overwatch at its position. If any enemy moves into or through an adjacent tile, the squad automatically fires (like a reactive ambush). Consumes ammo. Different from AMBUSH in that it triggers on any enemy movement, not just initial contact.
- **Priority:** Low
- **Complexity:** Medium (requires enemy movement from 1.4)
- **Impact:** Medium - pairs well with enemy AI to create defensive play options.
- **Implementation Notes:** Add `overwatch` status. In enemy movement logic, check if any squad in overwatch is adjacent and trigger auto-engagement. Overwatch breaks after firing once.

### 1.7 Difficulty Levels

- **Description:** Easy/Normal/Hard selection on the briefing screen. Easy: 3 fire supports, weaker enemies, 25-min timer. Normal: current settings. Hard: 1 fire support, stronger enemies (10/8 strength), 15-min timer, a third enemy patrol, VIPER has only 2 survivors.
- **Priority:** Medium
- **Complexity:** Low
- **Impact:** High - extends the game's appeal to both casual and experienced players.
- **Implementation Notes:** Add difficulty parameter to `initSquads()` and `initMap()`. Multiply enemy strength, adjust resource counts, and change timer in `setupMissionEvents()` based on selection. Add radio buttons or buttons to the briefing overlay.

---

## 2. Narrative & Immersion

### 2.1 Dynamic Squad Dialogue

- **Description:** Expand personality-driven radio chatter beyond the current `nervous`/`calm` binary. Add idle chatter during movement (stories, complaints, observations), stress-reactive lines when morale drops, celebratory lines after winning combat, and banter between squads when they are on adjacent tiles.
- **Priority:** High
- **Complexity:** Low
- **Impact:** High - the radio log is the primary narrative vehicle; richer dialogue dramatically improves immersion at low implementation cost.
- **Implementation Notes:** Create a dialogue bank object keyed by `[personality][event_type]`. In `tick()`, occasionally (1-in-8 chance per moving squad) inject idle chatter. On combat resolution, morale change, or squad proximity, select appropriate dialogue. Add 3-4 personality types: `calm`, `nervous`, `aggressive`, `stoic`.

### 2.2 Branching Story Events

- **Description:** Add 3-4 mid-mission decision points beyond the village encounter. Examples: (a) Intercepted enemy radio transmission - decode it (costs 2 minutes) to learn enemy positions, or ignore it. (b) Wounded enemy soldier found - interrogate for intel, take prisoner (slows squad), or leave him. (c) Secondary objective: arms cache discovered - destroy it for bonus score or bypass to save time.
- **Priority:** Medium
- **Complexity:** Medium
- **Impact:** High - choices create emotional investment and make each playthrough feel unique.
- **Implementation Notes:** Extend the `showChoice()` system. Add events triggered by position or time in `setupMissionEvents()`. Each choice should have meaningful gameplay consequences (resource cost/gain, time cost, intel revelation, morale effects). Track choices in state for end-of-mission scoring.

### 2.3 VIPER Survivor Dialogue

- **Description:** When VIPER is found, add dialogue from the survivors describing what happened to them (ambush, captivity, escape). This provides narrative payoff for the rescue mission and context for the enemy presence. During extraction loading, add a wounded soldier speaking.
- **Priority:** Medium
- **Complexity:** Low
- **Impact:** Medium - gives the rescue objective emotional weight beyond a game mechanic.
- **Implementation Notes:** In the VIPER discovery event, schedule 2-3 follow-up radio messages from a new "VIPER" callsign. Add VIPER to the TTS profiles with a weak, strained voice (low volume, slow rate). Messages could reveal the secondary enemy position if not yet discovered.

### 2.4 Weather and Time-of-Day Effects

- **Description:** Introduce weather changes during the mission via radio. Rain reduces visibility and slows movement. Approaching nightfall (the time pressure) reduces visibility radius and makes garbled radio more likely. Weather announced by HQ at intervals.
- **Priority:** Low
- **Complexity:** Medium
- **Impact:** Medium - adds environmental storytelling and mechanical variety.
- **Implementation Notes:** Add `weather` state (`clear`, `rain`, `fog`). Trigger weather change events at fixed times. Modify movement speed (stamina cost), combat accuracy, and radio garble probability based on weather. Display weather in header bar.

### 2.5 Pre-Mission Intel Briefing Choices

- **Description:** Before the mission starts, let the player choose between 2-3 intel packages that affect starting information. For example: (a) SIGINT report: reveals one enemy position at start. (b) Local contact: village POI is pre-revealed. (c) Extra supplies: +1 fire support but no intel.
- **Priority:** Low
- **Complexity:** Low
- **Impact:** Medium - adds strategic depth before the first command and encourages replays with different loadouts.
- **Implementation Notes:** Add choice buttons to the briefing overlay. Store selection and apply effects in `initMap()` / `initSquads()`. Simple branching with 3 options.

---

## 3. Quality of Life

### 3.1 Command History (Arrow Keys)

- **Description:** Store the last 20 commands and allow cycling through them with up/down arrow keys, like a terminal. This is essential for a command-line interface game.
- **Priority:** High
- **Complexity:** Low
- **Impact:** High - reduces friction for the primary interaction method. Players will frequently repeat or modify commands.
- **Implementation Notes:** Add `commandHistory` array and `historyIndex` to state. In the `keydown` listener, handle ArrowUp (previous command) and ArrowDown (next command). Set input value to the history entry. Reset index on Enter.

### 3.2 Command Autocomplete (Tab)

- **Description:** Tab key autocompletes unit names, commands, and grid references. First tab completes the current token; subsequent tabs cycle through options. Show a subtle hint below the input showing available completions.
- **Priority:** High
- **Complexity:** Medium
- **Impact:** High - dramatically speeds up input, reduces typos, and serves as a discoverable help system.
- **Implementation Notes:** Parse current input to determine context (first word = unit, second = command, third = grid). Build completion list based on context. On Tab keydown, prevent default and replace current token with next completion. Show completions in a small div below the input area.

### 3.3 Clickable Map Grid

- **Description:** Clicking a tile on the map auto-fills the grid reference into the command input. If a unit command is partially typed (e.g., "ALPHA MOVE"), clicking a tile completes the command. Visual hover highlight on map tiles.
- **Priority:** Medium
- **Complexity:** Medium
- **Impact:** Medium - provides an alternative to memorizing grid coordinates; bridges mouse and keyboard interaction.
- **Implementation Notes:** Replace the `<pre>` map with a grid of `<span>` elements with `data-col` and `data-row` attributes. Add click handler that reads grid from data attributes. Add CSS hover state. Integrate with command input: if input ends with a command expecting a grid, append grid and submit; otherwise just fill grid reference.

### 3.4 Command Cheat Sheet Sidebar

- **Description:** A collapsible panel (toggled by `?` key or a button) showing all available commands with syntax, organized by category. Context-sensitive: highlights commands relevant to the current situation (e.g., MEDEVAC highlighted when VIPER is found).
- **Priority:** Medium
- **Complexity:** Low
- **Impact:** Medium - reduces the learning curve without cluttering the radio log with HELP output.
- **Implementation Notes:** Add a fixed-position panel with `display:none` by default. Toggle visibility on `?` keypress (when input is not focused) or via a header button. Populate with static HTML. Optionally add/remove a `.relevant` class to command entries based on game state.

### 3.5 Pause Functionality

- **Description:** Since the game advances on command input (not real-time), this is less critical, but add a PAUSE command or `Esc` key that explicitly pauses event processing and shows a "PAUSED" indicator. Useful if the player needs to step away or think.
- **Priority:** Low
- **Complexity:** Low
- **Impact:** Low - the turn-based nature already provides implicit pause, but explicit pause is a nice safety net.
- **Implementation Notes:** Add `paused` boolean to state. In `tick()`, skip if paused. Add "PAUSED" text to header when active. Toggle on `Esc` keypress.

### 3.6 Tutorial / First-Run Walkthrough

- **Description:** On first visit (tracked via localStorage), overlay a brief interactive tutorial: (1) "This is your tactical map," (2) "Type commands here," (3) "Move ALPHA toward VIPER's last position." Three steps with highlight boxes and next/skip buttons.
- **Priority:** Medium
- **Complexity:** Medium
- **Impact:** High - the current gentle nudge at tick 4 is good, but a structured tutorial would help players who have never seen a text-command game.
- **Implementation Notes:** Add a tutorial overlay system with step tracking. Each step highlights a UI element (map, radio log, input) with a CSS outline and descriptive text. Store `tutorialComplete` in localStorage. Skip if already completed. The existing HQ hint at tick 4 can remain as a backup.

---

## 4. Replayability

### 4.1 Procedural Map Generation

- **Description:** Randomize enemy positions, VIPER location, POI locations, and terrain layout each playthrough. Keep the 8x8 grid but vary jungle placement, hill positions, and the number/strength of enemy patrols. Ensure VIPER is always reachable and at least 4 tiles from starting positions.
- **Priority:** High
- **Complexity:** Medium
- **Impact:** High - the single fixed layout is the biggest barrier to replay. Once a player has won, they know exactly where everything is.
- **Implementation Notes:** In `initMap()`, randomly place 2-3 enemy patrols (constrained to the eastern half), randomly place VIPER (constrained to center-east), randomly scatter jungle tiles (8-12 tiles in connected clusters), and place 2-3 POIs. Add validation to ensure solvability (path exists from start to VIPER, enemies don't start adjacent to squads).

### 4.2 Mission Scoring System

- **Description:** Calculate a numerical score at mission end based on: survivors extracted (major), time elapsed (bonus for speed), casualties taken (penalty), fire support/air strike usage (penalty for using them), and choices made. Display letter grade (S/A/B/C/D/F) and breakdown on the game over screen.
- **Priority:** High
- **Complexity:** Low
- **Impact:** High - gives players a reason to replay even the same map, chasing a better score.
- **Implementation Notes:** In `endMission()`, calculate score from state variables: `viperSurvivors * 1000 + timeBonus - casualties * 200 - supportsUsed * 150`. Map to letter grade. Display in `#gameover-stats`. Store best score in localStorage.

### 4.3 Multiple Mission Scenarios

- **Description:** Add 2-3 alternative missions beyond Operation Bright Light. Examples: (a) "Broken Arrow" - defend a firebase for 15 minutes against waves. (b) "Ghost Walk" - stealth recon mission, avoid all contact, gather intel from 3 POIs. (c) "Dust Off" - escort a wounded convoy across the map under fire.
- **Priority:** Medium
- **Complexity:** High
- **Impact:** High - dramatically extends content without requiring engine changes.
- **Implementation Notes:** Refactor mission setup into a mission config object: `{ name, briefing, objectives, squads, enemies, pois, events, winCondition, loseCondition }`. Create a mission select screen before the briefing. Each mission reuses the same engine but with different configs. The existing mission becomes the first in the list.

### 4.4 Mission Log / After Action Report

- **Description:** At mission end, display a detailed timeline of key events: movements, contacts, casualties, choices made, and outcome. Allow the player to review their decision-making. Optionally copy-to-clipboard for sharing.
- **Priority:** Low
- **Complexity:** Low
- **Impact:** Medium - provides reflection and a shareable artifact.
- **Implementation Notes:** Throughout the game, push key events to a `missionLog` array: `{ time, type, description }`. On game over, render the log in the overlay or a new panel. Add a "Copy Report" button using `navigator.clipboard.writeText()`.

### 4.5 Unlockable Modifiers

- **Description:** After completing the mission, unlock gameplay modifiers for subsequent runs: "Night Ops" (reduced visibility), "Lone Wolf" (only one squad), "Heavy Weapons" (3 fire supports, 2 air strikes), "Radio Silence" (no TTS, garbled radio always). Select modifiers on the briefing screen.
- **Priority:** Low
- **Complexity:** Low
- **Impact:** Medium - cheap content extension that rewards mastery.
- **Implementation Notes:** Track completion in localStorage. Show modifier toggles on briefing screen if unlocked. Each modifier adjusts state initialization values. Simple boolean flags checked in relevant game functions.

---

## 5. Polish & Feel

### 5.1 Sound Effects (Web Audio API)

- **Description:** Add procedural sound effects using Web Audio API (no external files needed): radio static/squelch on message receive, gunfire during combat, explosion for artillery/air strike, helicopter rotor for DUSTOFF, ambient jungle sounds. Keep volume low and tasteful.
- **Priority:** High
- **Complexity:** Medium
- **Impact:** High - audio is the single biggest immersion multiplier missing from the game. The TTS system is excellent but ambient/effect audio would complete the experience.
- **Implementation Notes:** Create an `sfx` module mirroring the `tts` structure. Use `OscillatorNode` and `AudioBufferSourceNode` for procedural sounds. Radio squelch: short white noise burst with bandpass filter. Gunfire: noise burst with rapid decay. Explosion: low-frequency noise with slow decay. Add `sfx.play('gunfire')` calls in combat resolution, fire support, etc. Include a volume/mute toggle in the header.

### 5.2 Map Transition Animations

- **Description:** When squads move, animate the transition with a brief character swap (e.g., the squad marker blinks between old and new position for one render cycle). When enemies are destroyed, show a brief `X` marker. When fire support lands, flash the affected tiles.
- **Priority:** Low
- **Complexity:** Medium
- **Impact:** Medium - makes the map feel alive rather than snapping between states.
- **Implementation Notes:** In `renderMap()`, check for pending animations in an `animations` queue. Each animation specifies a grid position, character, duration, and CSS class. Use `setTimeout` to clear animations after their duration. Add CSS classes for flash effects (brief background color pulse).

### 5.3 Screen Shake on Explosions

- **Description:** Apply a CSS transform shake to the `#crt` container when fire support or air strikes land. Brief (200ms), subtle, and satisfying.
- **Priority:** Low
- **Complexity:** Low
- **Impact:** Medium - high polish-to-effort ratio; makes ordnance feel impactful.
- **Implementation Notes:** Add a `@keyframes shake` animation. Apply it to `#crt` via a `.shaking` class. Add/remove the class in fire support and air strike resolution callbacks. Use `transform: translate()` with small random values.

### 5.4 Radio Static Visual Effect

- **Description:** When garbled messages appear, briefly overlay a static/noise effect on the radio panel. Flash the panel border. This reinforces the "degraded comms" fiction.
- **Priority:** Low
- **Complexity:** Low
- **Impact:** Low - subtle polish that reinforces the radio fiction.
- **Implementation Notes:** In `addGarbled()`, add a `.static` class to `#radio-panel` that applies a brief CSS animation (border color flash, background noise pattern via CSS gradient). Remove class after 500ms.

### 5.5 Typewriter Effect for Radio Messages

- **Description:** Instead of radio messages appearing instantly, type them out character by character at a fast rate (20ms per character). This mimics radio transmission and creates a sense of real-time communication. Skip animation if messages are queuing up.
- **Priority:** Medium
- **Complexity:** Low
- **Impact:** Medium - significantly enhances the radio communication feel.
- **Implementation Notes:** In `addRadio()`, instead of setting innerHTML all at once, set the body text to empty and use `setInterval` to append characters. Track active typewriter animations and skip to completion if a new message arrives while one is still typing. Add a subtle cursor blink at the end during typing.

---

## 6. Social & Meta

### 6.1 Shareable Mission Results

- **Description:** On the game over screen, add a "Share" button that generates a text-based summary (suitable for social media or messaging) with the mission outcome, score, and a link to play. Uses the clipboard API.
- **Priority:** Medium
- **Complexity:** Low
- **Impact:** Medium - free organic distribution; text-based games have strong share appeal.
- **Implementation Notes:** Generate a formatted text block:
  ```
  SIGNAL LOST - Operation Bright Light
  Result: MISSION COMPLETE
  Survivors: 3/3 | Casualties: 2 | Score: A
  [link]
  ```
  Copy to clipboard on button click with visual confirmation.

### 6.2 Daily Challenge Mode

- **Description:** A seeded random mission that is the same for all players on a given day. Players compete for the best score on that day's map layout. Uses the date as the random seed. Show personal best for each day.
- **Priority:** Low
- **Complexity:** Medium
- **Impact:** High - creates a reason to return daily; adds competitive element without requiring a server.
- **Implementation Notes:** Use a seeded PRNG (simple LCG) with `YYYYMMDD` as the seed for procedural generation (requires feature 4.1). Store daily scores in localStorage keyed by date. Display "Daily Challenge" mode on the briefing screen alongside the standard mission.

### 6.3 Mission Replay Export

- **Description:** Record all player commands with timestamps. Allow exporting the replay as a JSON file and importing/replaying it. The replay plays back commands automatically, showing the mission unfold.
- **Priority:** Low
- **Complexity:** Medium
- **Impact:** Low - niche appeal but interesting for content creators and post-game analysis.
- **Implementation Notes:** Push `{ time: state.gameTime, command: raw }` to a `replayLog` array on each command. Export as JSON blob download. Import reads the JSON and feeds commands to `processCommand()` with appropriate delays. Add play/pause/speed controls for replay mode.

### 6.4 Achievement System

- **Description:** Track notable accomplishments across sessions: "Zero Casualties" (win with no losses), "Speed Run" (win in under 10 minutes), "Against All Odds" (win with both squads below 3 strength), "Danger Close" (call fire support within 1 tile of own squad and survive), "Silent Professional" (win without using fire support or air strike).
- **Priority:** Low
- **Complexity:** Low
- **Impact:** Medium - provides long-term goals and encourages varied playstyles.
- **Implementation Notes:** Define achievements as objects with `{ id, name, description, condition() }`. Check conditions at mission end. Store unlocked achievements in localStorage. Display on game over screen and optionally in a new "Achievements" panel accessible from the briefing screen. Show notification on unlock.

---

## Priority Summary

### Must-Have (High Priority, High Impact)

| Feature | Complexity | Section |
|---------|-----------|---------|
| Command History (Arrow Keys) | Low | QoL |
| Command Autocomplete (Tab) | Medium | QoL |
| Fog of War | Medium | Gameplay |
| Enemy AI Movement | Medium | Gameplay |
| Dynamic Squad Dialogue | Low | Narrative |
| Procedural Map Generation | Medium | Replayability |
| Mission Scoring System | Low | Replayability |
| Sound Effects (Web Audio) | Medium | Polish |

### Should-Have (Medium Priority)

| Feature | Complexity | Section |
|---------|-----------|---------|
| Terrain Effects on Combat | Low | Gameplay |
| Squad Formations | Low | Gameplay |
| Branching Story Events | Medium | Narrative |
| VIPER Survivor Dialogue | Low | Narrative |
| Difficulty Levels | Low | Gameplay |
| Clickable Map Grid | Medium | QoL |
| Tutorial / Walkthrough | Medium | QoL |
| Shareable Mission Results | Low | Social |
| Typewriter Effect | Low | Polish |

### Nice-to-Have (Low Priority)

| Feature | Complexity | Section |
|---------|-----------|---------|
| Smoke Screen Command | Low | Gameplay |
| Overwatch Command | Medium | Gameplay |
| Weather Effects | Medium | Narrative |
| Pre-Mission Intel Choices | Low | Narrative |
| Pause Functionality | Low | QoL |
| Multiple Mission Scenarios | High | Replayability |
| Mission Log / AAR | Low | Replayability |
| Unlockable Modifiers | Low | Replayability |
| Map Animations | Medium | Polish |
| Screen Shake | Low | Polish |
| Radio Static Visual | Low | Polish |
| Daily Challenge | Medium | Social |
| Replay Export | Medium | Social |
| Achievement System | Low | Social |

---

## Recommended Implementation Order

1. **Command History + Autocomplete** - Immediate QoL wins that improve every session
2. **Mission Scoring** - Low effort, high replay motivation
3. **Dynamic Squad Dialogue** - Low effort, high immersion gain
4. **Fog of War** - Transforms gameplay fundamentally
5. **Sound Effects** - Major immersion multiplier
6. **Procedural Map Generation** - Unlocks true replayability
7. **Enemy AI Movement** - Makes the world feel alive
8. **Difficulty Levels** - Broadens audience
9. **Branching Story Events** - Deepens each playthrough
10. **Shareable Results + Scoring** - Enables organic growth

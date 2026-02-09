# Signal Lost -- Bug Report

**Auditor:** bug-hunter
**Date:** 2026-02-08
**File:** `/Users/edward/code/personal/signal-lost/signal-lost.html`

---

## BUG-001: Squad strength can go negative

**Severity:** HIGH
**Location:** `signal-lost.html` lines 1101-1103 (resolveCombat), lines 826-828 (fire support friendly fire), lines 863-865 (air strike friendly fire)

**Description:** When a squad takes casualties, `squad.strength -= sCas` is applied without clamping to zero. Strength can become negative (e.g., -2), which causes downstream issues: negative strength squads still render on the map (line 660 checks `s.strength > 0` but never resets status), and `checkGameOver` only fires inside `resolveCombat` -- not after fire support / air strike friendly fire.

**Steps to Reproduce:**
1. Start the game
2. Move ALPHA to a fire support target grid
3. Fire `FIRE SUPPORT` on that grid
4. If ALPHA has low strength, casualties can reduce it below zero

**Expected:** Strength should be clamped to `Math.max(0, ...)` and squad status set to `destroyed` when reaching 0. `checkGameOver()` should also be called after friendly fire casualties.

**Actual:** Strength can go negative. Squad status remains unchanged. No game-over check after friendly fire kills a squad.

---

## BUG-002: Friendly fire / air strike does not trigger checkGameOver

**Severity:** HIGH
**Location:** `signal-lost.html` lines 822-832 (fire support callback), lines 860-868 (air strike callback)

**Description:** When friendly fire from artillery or an air strike kills both squads (reduces strength to 0 or below), `checkGameOver()` is never called. The game continues even though all units are destroyed.

**Steps to Reproduce:**
1. Move both squads adjacent to each other
2. Call `FIRE SUPPORT` and `AIR STRIKE` on their position
3. Both squads reach 0 strength

**Expected:** Game should end with "MISSION FAILED -- All units lost."

**Actual:** Game continues running with no active squads.

---

## BUG-003: DUSTOFF can be re-launched after aborting from a hot LZ

**Severity:** MEDIUM
**Location:** `signal-lost.html` lines 910-914

**Description:** When DUSTOFF aborts due to a hot LZ, status is reset to `standby`, but `state.dustoffLaunched` remains `true`. The MEDEVAC command checks `state.squads.DUSTOFF.status !== 'standby'` (line 883) but not `dustoffLaunched`. This means after an abort, the player CAN re-launch DUSTOFF (the status gate allows it). However, this is inconsistent -- `dustoffLaunched` being `true` while status is `standby` is a state contradiction.

**Steps to Reproduce:**
1. Find VIPER
2. Call MEDEVAC with enemies nearby
3. Wait for DUSTOFF to abort (hot LZ)
4. Clear enemies
5. Call MEDEVAC again

**Expected:** Consistent behavior -- either allow re-launch and reset `dustoffLaunched`, or prevent re-launch.

**Actual:** Re-launch works because status check passes, but `dustoffLaunched` remains `true` (stale flag).

**Suggested Fix:** When DUSTOFF aborts, also reset `state.dustoffLaunched = false`.

---

## BUG-004: Scheduled events fire after game ends

**Severity:** MEDIUM
**Location:** `signal-lost.html` lines 1144-1152 (scheduleEvent / processEvents)

**Description:** Events scheduled via `scheduleEvent()` have no guard against firing after `state.missionEnd` or `!state.running`. If combat or extraction events are pending when `endMission()` is called, they will still execute on subsequent ticks (if any are triggered). The `tick()` function guards its entry, but `processEvents()` is called inside `tick()` after the guard, so pending events from before game-end will fire if `tick()` was already in progress.

More critically, `checkWin()` at line 1353 uses `setTimeout` (2000ms) to show the game-over overlay. If `endMission()` is called during that 2-second window (from the 20-minute timer event), it would overwrite the win overlay with a failure message.

**Steps to Reproduce:**
1. Complete extraction near the 20-minute mark
2. `checkWin()` fires `setTimeout` for 2 seconds
3. At minute 20, `endMission()` fires and overwrites the overlay

**Expected:** Win state should be preserved. Events should not fire post-game-end.

**Actual:** `endMission()` can overwrite the win overlay, turning a success into a displayed failure.

**Suggested Fix:** Add `if (state.missionEnd) return;` guard at the top of `endMission()`. Also guard scheduled event callbacks.

---

## BUG-005: checkWin does not stop the game loop (state.running remains true)

**Severity:** MEDIUM
**Location:** `signal-lost.html` lines 1353-1363

**Description:** `checkWin()` sets `state.missionEnd = true` but never sets `state.running = false`. The game loop `tick()` checks both `state.running` and `state.missionEnd` at line 1289, so ticking stops. However, the command input remains enabled, and `processCommand` calls `advanceTime()` which calls `tick()` -- but tick returns immediately. So commands can still be entered and echoed to the radio log after winning.

Also, `tts.stop()` is never called on win, so TTS continues.

**Steps to Reproduce:**
1. Complete a successful extraction
2. `checkWin()` fires
3. Try typing commands -- they still echo to the radio log

**Expected:** Input should be disabled on win. TTS should stop.

**Actual:** Commands still process (echo to log). TTS not stopped.

**Suggested Fix:** Set `state.running = false` and disable the command input in `checkWin()`.

---

## BUG-006: RETREAT at column 0 (leftmost edge) does nothing silently

**Severity:** LOW
**Location:** `signal-lost.html` lines 990-999

**Description:** The RETREAT command decrements `squad.col` only if `squad.col > 0`. If the squad is already at column 0 (column A), the retreat has no effect, but a radio message is still sent saying "Falling back to A{row}" -- the same grid they were already at. The morale penalty (`morale - 1`) is still applied even though no actual retreat occurred.

**Steps to Reproduce:**
1. Keep ALPHA at starting position (B2, col=1)
2. Issue `ALPHA RETREAT` (now at A2, col=0)
3. Issue `ALPHA RETREAT` again

**Expected:** Either prevent retreat at the edge with a message like "Can't retreat further", or don't apply the morale penalty.

**Actual:** Morale decreases but position doesn't change. Radio message implies movement occurred.

---

## BUG-007: REGROUP with self is allowed

**Severity:** LOW
**Location:** `signal-lost.html` lines 1057-1067

**Description:** `ALPHA REGROUP ALPHA` will cause ALPHA to move to its own position (which it's already at), completing immediately on the next tick.

**Steps to Reproduce:**
1. `ALPHA REGROUP ALPHA`

**Expected:** Error message like "Cannot regroup with self."

**Actual:** Squad begins "moving" to its own grid, wastes a tick.

---

## BUG-008: Stamina uses floating-point decrements causing display issues

**Severity:** LOW
**Location:** `signal-lost.html` lines 1304, 1317, 1331

**Description:** Stamina is decremented by fractional values (0.2, 0.3, 0.5) but displayed with integer pip rendering at line 700: `i < val`. Since `val` can be e.g., 4.8, `i < 4.8` is true for i=0..4, showing 5 filled pips even though stamina has decreased. The fractional decrements accumulate but the UI rounds up visually, making stamina appear higher than it is.

More importantly, `squad.stamina` is initialized as integer `5` but becomes a float (e.g., 4.6, 3.1). The stat bar has 5 pips max but fractional values mean the display doesn't accurately reflect the actual value.

**Steps to Reproduce:**
1. Move a squad through multiple tiles
2. Observe stamina pips -- they don't visibly decrease until a full integer is consumed

**Expected:** Either use integer stamina decrements or render a continuous bar.

**Actual:** Misleading pip display due to float arithmetic.

---

## BUG-009: parseGrid accepts multi-digit row numbers like "A12" without proper bounds

**Severity:** LOW
**Location:** `signal-lost.html` lines 744-751

**Description:** `parseGrid` uses `parseInt(str.slice(1))` which would parse "A12" as row 12 (index 11). The bounds check `r >= MAP_ROWS` (8) correctly rejects this. However, `parseGrid("A10")` parses to row index 9, which is also rejected. This is correct behavior, but `parseGrid("A00")` parses to row index -1, which is caught by `r < 0`. So bounds checking works, but the function accepts strings like "A1B" -- `parseInt("1B")` returns 1, silently ignoring trailing characters.

**Steps to Reproduce:**
1. Type `ALPHA MOVE A1B`

**Expected:** Error message about invalid grid.

**Actual:** Parses as A1 and moves the squad there. Trailing characters silently ignored.

---

## BUG-010: Movement during combat is allowed

**Severity:** MEDIUM
**Location:** `signal-lost.html` lines 960-975

**Description:** The MOVE command does not check if a squad is currently `engaged` in combat. A player can issue `ALPHA MOVE H8` while ALPHA is in active combat, and the squad will start moving while combat resolution events continue to fire. The squad moves away but `resolveCombat` callbacks still reference the squad and enemy, potentially resolving combat at incorrect ranges.

**Steps to Reproduce:**
1. Get ALPHA into combat (status = 'engaged')
2. Issue `ALPHA MOVE H8`
3. Squad starts moving while combat events resolve

**Expected:** Moving during combat should be blocked or treated as a retreat/disengage.

**Actual:** Squad moves freely during combat. Combat resolution continues with the squad at a potentially distant position.

---

## BUG-011: Enemy patrol can trigger simultaneous duplicate combat encounters

**Severity:** MEDIUM
**Location:** `signal-lost.html` lines 1243-1254

**Description:** In `checkProximityEvents()`, enemy proximity checks iterate all enemies for each squad. If both ALPHA and BRAVO are adjacent to the same unrevealed enemy, the enemy is revealed on the first squad's check, so only one combat triggers (the `!e.revealed` guard prevents the second). This is correct. However, if two enemies are adjacent to the same squad in the same tick, both encounters trigger simultaneously, scheduling two `resolveCombat` calls for the same squad against different enemies.

**Steps to Reproduce:**
1. Move ALPHA to a position adjacent to both enemies (e.g., col=5, row=4)
2. Both enemies are unrevealed
3. On the next tick, both enemies are revealed and both schedule combat

**Expected:** One combat at a time, or merged into a single multi-enemy engagement.

**Actual:** Two parallel combat resolutions run independently, both reducing squad strength. The squad can effectively be destroyed twice.

---

## BUG-012: VIPER survivors can be reduced to 0 via friendly fire, then extraction "succeeds" with 0 survivors

**Severity:** MEDIUM
**Location:** `signal-lost.html` lines 834-836, 1353-1363

**Description:** Fire support near VIPER reduces `viperSurvivors` by 2 (to a minimum of 0). If survivors reach 0 and extraction is completed, `performExtraction()` loads "0 VIPER survivors" and `extractionDone` is set to `true`. However, `checkWin()` requires `viperSurvivors >= 2`, so the win doesn't trigger. When the 20-minute timer fires `endMission()`, it shows "MISSION COMPLETE" because `extractionDone` is `true` (line 1374 checks `extractionDone && viperSurvivors >= 2`). Wait -- actually that also checks `>= 2`, so it would fall through to "extraction not completed" message. So extracting 0 survivors results in the ambiguous "extraction was not completed in time" failure message.

**Steps to Reproduce:**
1. Find VIPER
2. Fire support on VIPER position twice (survivors: 3 -> 1 -> 0 -- clamped)
3. Launch MEDEVAC and complete extraction
4. DUSTOFF reports "Loading 0 VIPER survivors"

**Expected:** Radio message should indicate no survivors to extract, or extraction should be blocked when survivors = 0.

**Actual:** DUSTOFF goes through the full extraction sequence for 0 survivors. Mission fails with confusing message.

---

## BUG-013: No interval cleanup -- timer leak on page if game restarts

**Severity:** LOW
**Location:** `signal-lost.html` -- no `setInterval` is actually used

**Description:** The game uses a command-driven tick system (each command calls `advanceTime()` -> `tick()`). There is no `setInterval` timer, so there is no timer leak. This is actually fine by design.

**Status:** NOT A BUG (after review, the game is purely command-driven with no interval timer).

---

## BUG-014: Division by zero possible in resolveCombat when morale is 0

**Severity:** LOW
**Location:** `signal-lost.html` line 1077

**Description:** `squadPower = squad.strength * (squad.morale / 5) * (squad.ammo > 0 ? 1 : 0.2)`. If `squad.morale` is 0 (which can happen at line 1103: `Math.max(0, squad.morale - 1)`), then `squadPower` becomes 0. The roll at line 1079 is `Math.random() * (0 + enemyPower)`, which always results in `roll >= squadPower` (since squadPower is 0 and roll >= 0). This means a squad with 0 morale can NEVER win a combat exchange. While this is arguably realistic, it creates an unwinnable death spiral where the squad keeps taking casualties with no way to disengage (combat auto-continues via `scheduleEvent`).

**Steps to Reproduce:**
1. Get a squad into combat
2. Morale reaches 0 from repeated losses
3. Combat continues indefinitely until squad is destroyed

**Expected:** Squads with 0 morale should attempt to retreat or the player should be able to disengage.

**Actual:** Guaranteed loss spiral with no player agency.

---

## BUG-015: Command input not disabled on game over via endMission

**Severity:** LOW
**Location:** `signal-lost.html` lines 1366-1388

**Description:** `endMission()` sets `state.running = false` and shows the overlay, but never disables the command input (`#cmd`). Players can still type commands behind the overlay. While `processCommand` -> `advanceTime` -> `tick` will return early (due to `!state.running`), the command still echoes to the radio log via `addRadio('COMMAND', ...)` at line 762 (this line runs before the `advanceTime` call and has no running check).

**Steps to Reproduce:**
1. Let the game end (time runs out)
2. Click behind the overlay on the input
3. Type a command and press Enter

**Expected:** Input should be disabled.

**Actual:** Commands echo to radio log but have no game effect.

**Suggested Fix:** Add `document.getElementById('cmd').disabled = true;` in `endMission()`.

---

## BUG-016: Air strike does not check VIPER friendly fire

**Severity:** MEDIUM
**Location:** `signal-lost.html` lines 851-871

**Description:** The fire support callback (lines 833-837) checks for VIPER proximity and reduces survivors. The air strike callback does NOT have this check. An air strike on the VIPER position will kill enemies but won't reduce VIPER survivors, which is inconsistent.

**Steps to Reproduce:**
1. Find VIPER at E5
2. Call `AIR STRIKE E5`

**Expected:** VIPER survivors should be affected by the air strike (consistent with fire support behavior).

**Actual:** VIPER survivors are unaffected by air strikes, only by fire support.

---

## Summary Table

| ID | Title | Severity |
|----|-------|----------|
| BUG-001 | Squad strength can go negative | HIGH |
| BUG-002 | Friendly fire does not trigger checkGameOver | HIGH |
| BUG-003 | DUSTOFF dustoffLaunched flag inconsistent after abort | MEDIUM |
| BUG-004 | Scheduled events / checkWin race with endMission | MEDIUM |
| BUG-005 | checkWin does not stop game loop or disable input | MEDIUM |
| BUG-006 | RETREAT at map edge still penalizes morale | LOW |
| BUG-007 | REGROUP with self is allowed | LOW |
| BUG-008 | Floating-point stamina causes misleading display | LOW |
| BUG-009 | parseGrid silently ignores trailing characters | LOW |
| BUG-010 | Movement allowed during active combat | MEDIUM |
| BUG-011 | Simultaneous dual combat encounters on one squad | MEDIUM |
| BUG-012 | Extraction proceeds with 0 VIPER survivors | MEDIUM |
| BUG-014 | Zero-morale death spiral with no player agency | LOW |
| BUG-015 | Command input not disabled on game over | LOW |
| BUG-016 | Air strike missing VIPER friendly fire check | MEDIUM |

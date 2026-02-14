/**
 * Signal Lost — E2E tests using Playwright
 *
 * These tests load the full game HTML in a real browser and exercise
 * the game through its DOM interface and exposed window.__game API.
 */

import { test, expect } from '@playwright/test';

/** Send a command by typing into the input and pressing Enter */
async function sendCommand(page, text) {
  const input = page.locator('#cmd');
  await input.fill(text);
  await input.press('Enter');
}

/** Get all radio log message texts */
async function getRadioMessages(page) {
  const msgs = await page.locator('.radio-msg').allTextContents();
  return msgs.map(m => m.trim());
}

/** Get the last N radio messages */
async function getLastMessages(page, n = 1) {
  const all = await getRadioMessages(page);
  return all.slice(-n);
}

/** Advance game time by N ticks */
async function advanceTicks(page, n) {
  await page.evaluate((count) => {
    for (let i = 0; i < count; i++) {
      window.__game.tick();
    }
  }, n);
}

/** Start the game */
async function startMission(page) {
  await page.evaluate(() => window.__game.startGame());
}


// ─── BRIEFING SCREEN ──────────────────────────────────

test.describe('Briefing Screen', () => {
  test('shows the briefing overlay on load', async ({ page }) => {
    await page.goto('/signal-lost.html');
    const overlay = page.locator('#briefing-overlay');
    await expect(overlay).not.toHaveClass(/hidden/);
  });

  test('displays mission objectives', async ({ page }) => {
    await page.goto('/signal-lost.html');
    const briefing = page.locator('#briefing');
    const text = await briefing.textContent();
    expect(text).toContain('Operation Bright Light');
    expect(text).toContain('VIPER');
    expect(text).toContain('Locate missing recon patrol');
    expect(text).toContain('Extract at least 2 survivors');
    expect(text).toContain('Minimize casualties');
  });

  test('has command input disabled before game start', async ({ page }) => {
    await page.goto('/signal-lost.html');
    const input = page.locator('#cmd');
    await expect(input).toBeDisabled();
  });

  test('hides briefing and enables input when game starts', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const overlay = page.locator('#briefing-overlay');
    await expect(overlay).toHaveClass(/hidden/);
    const input = page.locator('#cmd');
    await expect(input).toBeEnabled();
  });
});


// ─── GAME INITIALIZATION ──────────────────────────────

test.describe('Game Start & UI', () => {
  test('shows clock at 06:00', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await expect(page.locator('#clock')).toHaveText('06:00');
  });

  test('renders tactical map with legend', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const map = await page.locator('#map').textContent();
    expect(map).toContain('ALPHA');
    expect(map).toContain('BRAVO');
    expect(map).toContain('ENEMY');
    expect(map).toContain('VIPER');
    expect(map).toContain('DUSTOFF');
  });

  test('renders squad status for ALPHA and BRAVO', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const status = await page.locator('#squad-status').textContent();
    expect(status).toContain('ALPHA');
    expect(status).toContain('BRAVO');
    expect(status).toContain('DUSTOFF');
  });

  test('shows initial radio messages', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const msgs = await getRadioMessages(page);
    expect(msgs.some(m => m.includes('OPERATION BRIGHT LIGHT'))).toBe(true);
    expect(msgs.some(m => m.includes('PAPA BEAR'))).toBe(true);
  });

  test('initializes squads with correct starting positions', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const state = await page.evaluate(() => window.__game.state);
    expect(state.squads.ALPHA.col).toBe(1);
    expect(state.squads.ALPHA.row).toBe(1);
    expect(state.squads.BRAVO.col).toBe(1);
    expect(state.squads.BRAVO.row).toBe(5);
    expect(state.squads.DUSTOFF.status).toBe('standby');
  });

  test('initializes game state correctly', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const state = await page.evaluate(() => window.__game.state);
    expect(state.running).toBe(true);
    expect(state.gameTime).toBe(360);
    expect(state.viperFound).toBe(false);
    expect(state.extractionDone).toBe(false);
    expect(state.fireSupportsLeft).toBe(2);
    expect(state.airStrikesLeft).toBe(1);
    expect(state.missionEnd).toBe(false);
  });
});


// ─── COMMAND SYSTEM ───────────────────────────────────

test.describe('Command System', () => {
  test('HELP command lists available commands', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'HELP');
    const msgs = await getLastMessages(page, 6);
    const helpMsg = msgs.find(m => m.includes('MOVE') && m.includes('HOLD'));
    expect(helpMsg).toBeDefined();
  });

  test('STATUS command shows squad info', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'STATUS');
    const msgs = await getLastMessages(page, 4);
    expect(msgs.some(m => m.includes('ALPHA') && m.includes('Grid'))).toBe(true);
    expect(msgs.some(m => m.includes('BRAVO') && m.includes('Grid'))).toBe(true);
    expect(msgs.some(m => m.includes('DUSTOFF'))).toBe(true);
  });

  test('invalid callsign shows error', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'ZULU MOVE A1');
    const msgs = await getLastMessages(page, 2);
    expect(msgs.some(m => m.includes('Unknown callsign'))).toBe(true);
  });

  test('invalid grid shows error', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'ALPHA MOVE Z9');
    const msgs = await getLastMessages(page, 2);
    expect(msgs.some(m => m.includes('Invalid grid'))).toBe(true);
  });

  test('MAP command refreshes the map', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'MAP');
    const msgs = await getLastMessages(page, 2);
    expect(msgs.some(m => m.includes('Map refreshed'))).toBe(true);
  });
});


// ─── SQUAD MOVEMENT ──────────────────────────────────

test.describe('Squad Movement', () => {
  test('ALPHA MOVE sets squad to moving status', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'ALPHA MOVE E5');
    const state = await page.evaluate(() => window.__game.state);
    expect(state.squads.ALPHA.status).toBe('moving');
    expect(state.squads.ALPHA.targetCol).toBe(4);
    expect(state.squads.ALPHA.targetRow).toBe(4);
    const msgs = await getLastMessages(page, 2);
    expect(msgs.some(m => m.includes('moving to E5') || m.includes('Roger'))).toBe(true);
  });

  test('squad moves one grid step per tick', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'ALPHA MOVE H1');
    const colAfterCommand = await page.evaluate(() => window.__game.state.squads.ALPHA.col);
    // Terrain: 2 ticks delay then move (first step on 3rd tick)
    await advanceTicks(page, 3);
    const newCol = await page.evaluate(() => window.__game.state.squads.ALPHA.col);
    expect(newCol).toBe(colAfterCommand + 1);
  });

  test('HOLD command stops movement', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'ALPHA MOVE E5');
    let moving = await page.evaluate(() => window.__game.state.squads.ALPHA.moving);
    expect(moving).toBe(true);
    await sendCommand(page, 'ALPHA HOLD');
    const state = await page.evaluate(() => window.__game.state.squads.ALPHA);
    expect(state.moving).toBe(false);
    expect(state.status).toBe('idle');
  });

  test('RETREAT moves squad back one column', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await page.evaluate(() => {
      const alpha = window.__game.state.squads.ALPHA;
      alpha.col = 3;
      alpha.row = 1;
      alpha.moving = false;
      alpha.status = 'idle';
    });
    await sendCommand(page, 'ALPHA RETREAT');
    const col = await page.evaluate(() => window.__game.state.squads.ALPHA.col);
    expect(col).toBe(2);
  });

  test('SITREP gives a situation report', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'ALPHA SITREP');
    const msgs = await getLastMessages(page, 2);
    expect(msgs.some(m => m.includes('Vasquez') || m.includes('Position') || m.includes('effectives'))).toBe(true);
  });

  test('AMBUSH sets squad to ambush status', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'ALPHA AMBUSH');
    const status = await page.evaluate(() => window.__game.state.squads.ALPHA.status);
    expect(status).toBe('ambush');
  });
});


// ─── FIRE SUPPORT & AIR STRIKE ────────────────────────

test.describe('Fire Support & Air Strike', () => {
  test('FIRE SUPPORT decrements count and queues event', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    let count = await page.evaluate(() => window.__game.state.fireSupportsLeft);
    expect(count).toBe(2);
    await sendCommand(page, 'FIRE SUPPORT E4');
    count = await page.evaluate(() => window.__game.state.fireSupportsLeft);
    expect(count).toBe(1);
    const msgs = await getLastMessages(page, 2);
    expect(msgs.some(m => m.includes('ARTILLERY') || m.includes('Fire mission'))).toBe(true);
  });

  test('FIRE SUPPORT fails when exhausted', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'FIRE SUPPORT E4');
    await sendCommand(page, 'FIRE SUPPORT E5');
    await sendCommand(page, 'FIRE SUPPORT E6');
    const count = await page.evaluate(() => window.__game.state.fireSupportsLeft);
    expect(count).toBe(0);
    const msgs = await getLastMessages(page, 2);
    expect(msgs.some(m => m.includes('No fire support'))).toBe(true);
  });

  test('AIR STRIKE decrements count and queues event', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    let count = await page.evaluate(() => window.__game.state.airStrikesLeft);
    expect(count).toBe(1);
    await sendCommand(page, 'AIR STRIKE F4');
    count = await page.evaluate(() => window.__game.state.airStrikesLeft);
    expect(count).toBe(0);
    const msgs = await getLastMessages(page, 2);
    expect(msgs.some(m => m.includes('FALCON') || m.includes('rolling in'))).toBe(true);
  });

  test('AIR STRIKE fails when exhausted', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'AIR STRIKE F4');
    await sendCommand(page, 'AIR STRIKE F5');
    const msgs = await getLastMessages(page, 2);
    expect(msgs.some(m => m.includes('No air strikes'))).toBe(true);
  });

  test('fire support splash resolves after delay', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'FIRE SUPPORT F4');
    await advanceTicks(page, 3);
    const msgs = await getRadioMessages(page);
    expect(msgs.some(m => m.includes('Splash') || m.includes('Rounds complete'))).toBe(true);
  });
});


// ─── DISCOVERY & PROXIMITY ────────────────────────────

test.describe('Discovery & Proximity', () => {
  test('finding VIPER sets viperFound flag', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await page.evaluate(() => {
      window.__game.state.squads.ALPHA.col = 3;
      window.__game.state.squads.ALPHA.row = 4;
    });
    await advanceTicks(page, 1);
    const viperFound = await page.evaluate(() => window.__game.state.viperFound);
    expect(viperFound).toBe(true);
  });

  test('finding VIPER generates urgent radio message', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await page.evaluate(() => {
      window.__game.state.squads.ALPHA.col = 3;
      window.__game.state.squads.ALPHA.row = 4;
    });
    await advanceTicks(page, 1);
    const msgs = await getRadioMessages(page);
    expect(msgs.some(m => m.includes('VIPER') && m.includes('survivors'))).toBe(true);
  });

  test('village discovery reveals POI', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    let village = await page.evaluate(() => window.__game.state.pois.find(p => p.label === 'village'));
    expect(village.revealed).toBe(false);
    await page.evaluate(() => {
      window.__game.state.squads.ALPHA.col = 3;
      window.__game.state.squads.ALPHA.row = 1;
    });
    await advanceTicks(page, 1);
    village = await page.evaluate(() => window.__game.state.pois.find(p => p.label === 'village'));
    expect(village.revealed).toBe(true);
  });

  test('enemy proximity reveals enemy', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    let enemy = await page.evaluate(() => window.__game.state.enemies[0]);
    expect(enemy.revealed).toBe(false);
    await page.evaluate(() => {
      window.__game.state.squads.ALPHA.col = 5;
      window.__game.state.squads.ALPHA.row = 2;
    });
    await advanceTicks(page, 1);
    enemy = await page.evaluate(() => window.__game.state.enemies[0]);
    expect(enemy.revealed).toBe(true);
  });

  test('ambush status gives advantage on enemy contact', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await page.evaluate(() => {
      window.__game.state.squads.ALPHA.col = 4;
      window.__game.state.squads.ALPHA.row = 3;
      window.__game.state.squads.ALPHA.status = 'ambush';
    });
    await advanceTicks(page, 1);
    const msgs = await getRadioMessages(page);
    expect(msgs.some(m => m.includes('drop on them') || m.includes("don't see us"))).toBe(true);
  });
});


// ─── RESUPPLY ─────────────────────────────────────────

test.describe('Resupply', () => {
  test('RESUPPLY command queues ammo replenishment', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await page.evaluate(() => {
      window.__game.state.squads.ALPHA.ammo = 1;
    });
    await sendCommand(page, 'RESUPPLY ALPHA');
    await advanceTicks(page, 4);
    const ammo = await page.evaluate(() => window.__game.state.squads.ALPHA.ammo);
    expect(ammo).toBeGreaterThan(1);
  });

  test('RESUPPLY invalid unit shows error', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'RESUPPLY DUSTOFF');
    const msgs = await getLastMessages(page, 2);
    expect(msgs.some(m => m.includes('Invalid unit'))).toBe(true);
  });
});


// ─── EXTRACTION FLOW ──────────────────────────────────

test.describe('Extraction Flow', () => {
  test('MEDEVAC requires VIPER to be found first', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const viperFound = await page.evaluate(() => window.__game.state.viperFound);
    expect(viperFound).toBe(false);
    await sendCommand(page, 'MEDEVAC');
    const msgs = await getLastMessages(page, 2);
    expect(msgs.some(m => m.includes('VIPER not yet located') || m.includes('Need a grid'))).toBe(true);
  });

  test('MEDEVAC launches DUSTOFF after VIPER is found', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await page.evaluate(() => {
      window.__game.state.viperFound = true;
    });
    await sendCommand(page, 'MEDEVAC');
    const state = await page.evaluate(() => ({
      status: window.__game.state.squads.DUSTOFF.status,
      launched: window.__game.state.dustoffLaunched,
    }));
    expect(state.status).toBe('inbound');
    expect(state.launched).toBe(true);
    const msgs = await getLastMessages(page, 2);
    expect(msgs.some(m => m.includes('DUSTOFF') && m.includes('wheels up'))).toBe(true);
  });

  test('MEDEVAC prevents double launch', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await page.evaluate(() => {
      window.__game.state.viperFound = true;
    });
    await sendCommand(page, 'MEDEVAC');
    await sendCommand(page, 'MEDEVAC');
    const msgs = await getLastMessages(page, 2);
    expect(msgs.some(m => m.includes('already deployed'))).toBe(true);
  });

  test('full extraction flow leads to mission complete', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await page.evaluate(() => {
      window.__game.state.viperFound = true;
      window.__game.state.viperSurvivors = 3;
      window.__game.state.enemies.forEach(e => { e.alive = false; });
      window.__game.processCommand('MEDEVAC');
    });
    const status = await page.evaluate(() => window.__game.state.squads.DUSTOFF.status);
    expect(status).toBe('inbound');
    await advanceTicks(page, 15);
    const extractionDone = await page.evaluate(() => window.__game.state.extractionDone);
    expect(extractionDone).toBe(true);
  });
});


// ─── GAME OVER STATES ─────────────────────────────────

test.describe('Game Over States', () => {
  test('mission fails when time runs out and VIPER not found', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await page.evaluate(() => window.__game.endMission());
    const overlay = page.locator('#gameover-overlay');
    await expect(overlay).not.toHaveClass(/hidden/);
    await expect(page.locator('#gameover-title')).toHaveText('MISSION FAILED');
    const text = await page.locator('#gameover-text').textContent();
    expect(text).toContain('never located');
  });

  test('mission fails when both squads are destroyed', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await page.evaluate(() => {
      window.__game.state.squads.ALPHA.strength = 0;
      window.__game.state.squads.BRAVO.strength = 0;
      window.__game.endMission();
    });
    await expect(page.locator('#gameover-title')).toHaveText('MISSION FAILED');
    const text = await page.locator('#gameover-text').textContent();
    expect(text).toContain('All units lost');
  });

  test('mission fails when VIPER found but not extracted in time', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await page.evaluate(() => {
      window.__game.state.viperFound = true;
      window.__game.state.extractionDone = false;
      window.__game.endMission();
    });
    await expect(page.locator('#gameover-title')).toHaveText('MISSION FAILED');
    const text = await page.locator('#gameover-text').textContent();
    expect(text).toContain('extraction was not completed');
  });

  test('mission succeeds when extraction is complete with enough survivors', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await page.evaluate(() => {
      window.__game.state.extractionDone = true;
      window.__game.state.viperSurvivors = 3;
      window.__game.endMission();
    });
    await expect(page.locator('#gameover-title')).toHaveText('MISSION COMPLETE');
    const text = await page.locator('#gameover-text').textContent();
    expect(text).toContain('3 VIPER survivors extracted');
  });

  test('endMission stops the game loop', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    let running = await page.evaluate(() => window.__game.state.running);
    expect(running).toBe(true);
    await page.evaluate(() => window.__game.endMission());
    const state = await page.evaluate(() => ({
      running: window.__game.state.running,
      missionEnd: window.__game.state.missionEnd,
    }));
    expect(state.running).toBe(false);
    expect(state.missionEnd).toBe(true);
  });
});


// ─── GAME CLOCK & TICK ────────────────────────────────

test.describe('Game Clock & Tick', () => {
  test('tick advances game time by 1 minute', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const timeBefore = await page.evaluate(() => window.__game.state.gameTime);
    await page.evaluate(() => window.__game.tick());
    const timeAfter = await page.evaluate(() => window.__game.state.gameTime);
    expect(timeAfter).toBe(timeBefore + 1);
  });

  test('clock display updates on tick', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await page.evaluate(() => window.__game.tick());
    await expect(page.locator('#clock')).toHaveText('06:01');
  });

  test('scheduled events fire at correct time', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await advanceTicks(page, 1);
    const msgs = await getRadioMessages(page);
    expect(msgs.some(m => m.includes('Vasquez') || m.includes('Alpha is ready'))).toBe(true);
  });

  test('ticking does not progress when game is not running', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await page.evaluate(() => {
      window.__game.state.running = false;
    });
    const timeBefore = await page.evaluate(() => window.__game.state.gameTime);
    await page.evaluate(() => window.__game.tick());
    const timeAfter = await page.evaluate(() => window.__game.state.gameTime);
    expect(timeAfter).toBe(timeBefore);
  });
});


// ─── TTS TOGGLE ───────────────────────────────────────

test.describe('TTS Toggle', () => {
  test('toggle changes display text', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const toggle = page.locator('#tts-toggle');
    await expect(toggle).toContainText('ON');
    await page.evaluate(() => window.__game.toggleTTS());
    await expect(toggle).toContainText('OFF');
    await page.evaluate(() => window.__game.toggleTTS());
    await expect(toggle).toContainText('ON');
  });

  test('disabling TTS sets enabled to false', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    let enabled = await page.evaluate(() => window.__game.tts.enabled);
    expect(enabled).toBe(true);
    await page.evaluate(() => window.__game.toggleTTS());
    enabled = await page.evaluate(() => window.__game.tts.enabled);
    expect(enabled).toBe(false);
  });
});


// ─── UTILITY FUNCTIONS ────────────────────────────────

test.describe('Utility Functions', () => {
  test('gridLabel converts coords to grid string', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const results = await page.evaluate(() => ({
      a1: window.__game.gridLabel(0, 0),
      e5: window.__game.gridLabel(4, 4),
      h8: window.__game.gridLabel(7, 7),
    }));
    expect(results.a1).toBe('A1');
    expect(results.e5).toBe('E5');
    expect(results.h8).toBe('H8');
  });

  test('parseGrid converts grid string to coords', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const results = await page.evaluate(() => ({
      a1: window.__game.parseGrid('A1'),
      e5: window.__game.parseGrid('E5'),
      h8: window.__game.parseGrid('H8'),
    }));
    expect(results.a1).toEqual({ col: 0, row: 0 });
    expect(results.e5).toEqual({ col: 4, row: 4 });
    expect(results.h8).toEqual({ col: 7, row: 7 });
  });

  test('parseGrid returns null for invalid input', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const results = await page.evaluate(() => ({
      z9: window.__game.parseGrid('Z9'),
      empty: window.__game.parseGrid(''),
      a0: window.__game.parseGrid('A0'),
    }));
    expect(results.z9).toBeNull();
    expect(results.empty).toBeNull();
    expect(results.a0).toBeNull();
  });

  test('dist computes Manhattan distance', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const results = await page.evaluate(() => ({
      d1: window.__game.dist({ col: 0, row: 0 }, { col: 3, row: 4 }),
      d2: window.__game.dist({ col: 2, row: 2 }, { col: 2, row: 2 }),
      d3: window.__game.dist({ col: 1, row: 1 }, { col: 4, row: 4 }),
    }));
    expect(results.d1).toBe(7);
    expect(results.d2).toBe(0);
    expect(results.d3).toBe(6);
  });

  test('formatTime converts minutes to HH:MM', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const results = await page.evaluate(() => ({
      t360: window.__game.formatTime(360),
      t375: window.__game.formatTime(375),
      t0: window.__game.formatTime(0),
    }));
    expect(results.t360).toBe('06:00');
    expect(results.t375).toBe('06:15');
    expect(results.t0).toBe('00:00');
  });
});


// ─── COMBAT SYSTEM ────────────────────────────────────

test.describe('Combat System', () => {
  test('ENGAGE with no visible enemies shows message', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    await sendCommand(page, 'ALPHA ENGAGE');
    const msgs = await getLastMessages(page, 2);
    expect(msgs.some(m => m.includes('No confirmed enemy'))).toBe(true);
  });

  test('ENGAGE with revealed enemy starts combat', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    // Place ALPHA near enemy but far from VIPER (to avoid VIPER discovery flooding the log)
    await page.evaluate(() => {
      window.__game.state.enemies[0].revealed = true;
      window.__game.state.enemies[0].col = 1;
      window.__game.state.enemies[0].row = 0;
      window.__game.state.squads.ALPHA.col = 1;
      window.__game.state.squads.ALPHA.row = 1;
    });
    await sendCommand(page, 'ALPHA ENGAGE');
    const status = await page.evaluate(() => window.__game.state.squads.ALPHA.status);
    expect(status).toBe('engaged');
    const msgs = await getLastMessages(page, 4);
    expect(msgs.some(m => m.includes('Engaging enemy'))).toBe(true);
  });

  test('combat resolution reduces strength', async ({ page }) => {
    await page.goto('/signal-lost.html');
    await startMission(page);
    const totalBefore = await page.evaluate(() => {
      const enemy = window.__game.state.enemies[0];
      enemy.revealed = true;
      window.__game.state.squads.ALPHA.col = 5;
      window.__game.state.squads.ALPHA.row = 3;
      window.__game.state.squads.ALPHA.status = 'engaged';
      window.__game.resolveCombat(window.__game.state.squads.ALPHA, enemy);
      return window.__game.state.squads.ALPHA.strength + enemy.strength;
    });
    await advanceTicks(page, 5);
    const totalAfter = await page.evaluate(() => {
      const enemy = window.__game.state.enemies[0];
      return window.__game.state.squads.ALPHA.strength + enemy.strength;
    });
    expect(totalAfter).toBeLessThan(totalBefore);
  });
});

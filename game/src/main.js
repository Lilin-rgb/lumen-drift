// Lumen Drift — main loop and screen state machine.
// Screens: title (with a live attract mode), play, levelup, pause, over, victory.
// The simulation runs on a fixed 1/60 s step; rendering is decoupled from it.
import { VIEW } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createWorld, resetWorld, step, applyLevelUp, PHASE } from './world.js';
import { rollUpgradeChoices } from './player.js';
import { render } from './render.js';
import {
  drawHUD, drawLevelUp, levelUpCardRects,
  drawTitle, drawPause, drawGameOver, drawVictory,
} from './ui.js';
import { stageShot, createAutopilot } from './shots.js';

const STEP = 1 / 60;
const BEST_KEY = 'lumen-drift-best';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const audio = createAudio();
const input = createInput(canvas);
const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') || '', 10);
const baseSeed = Number.isFinite(seedParam) ? seedParam : (Date.now() % 2147483647);

let world = createWorld(baseSeed);
let screen = 'title';
let choices = null;
let best = 0;
try { best = Number(window.localStorage.getItem(BEST_KEY)) || 0; } catch { best = 0; }

function saveBest() {
  if (world.score > best) {
    best = world.score;
    try { window.localStorage.setItem(BEST_KEY, String(best)); } catch { /* storage unavailable */ }
  }
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function startGame() {
  resetWorld(world, (Date.now() % 2147483647) | 0);
  screen = 'play';
  choices = null;
  audio.unlock();
  audio.waveStart();
  announce('Game started. Wave 1.');
}

function openLevelUp() {
  choices = rollUpgradeChoices(world.rng, world.player);
  screen = 'levelup';
  announce(`Level ${world.player.level}. Choose an upgrade.`);
}

function pickUpgrade(index) {
  if (!choices || index < 0 || index >= choices.length) return;
  applyLevelUp(world, choices[index].id, audio);
  if (world.pendingLevels > 0) {
    choices = rollUpgradeChoices(world.rng, world.player);
  } else {
    choices = null;
    screen = 'play';
  }
}

function clicked() {
  return input.consumeClick();
}

function handleScreenKeys() {
  if (input.wasPressed('KeyM')) audio.setMuted(!audio.isMuted());

  if (screen === 'title') {
    if (input.wasPressed('Enter') || input.wasPressed('Space') || clicked()) startGame();
  } else if (screen === 'play') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) screen = 'pause';
  } else if (screen === 'pause') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape') || input.wasPressed('Enter') || clicked()) {
      screen = 'play';
    }
  } else if (screen === 'levelup') {
    if (input.wasPressed('Digit1')) pickUpgrade(0);
    else if (input.wasPressed('Digit2')) pickUpgrade(1);
    else if (input.wasPressed('Digit3')) pickUpgrade(2);
    else if (clicked()) {
      const rects = levelUpCardRects();
      for (let i = 0; i < rects.length; i += 1) {
        const r = rects[i];
        if (input.mouseX >= r.x && input.mouseX <= r.x + r.w && input.mouseY >= r.y && input.mouseY <= r.y + r.h) {
          pickUpgrade(i);
          break;
        }
      }
    }
  } else if (screen === 'over' || screen === 'victory') {
    if (input.wasPressed('KeyR') || input.wasPressed('Enter') || clicked()) startGame();
  }
}

function playStep() {
  const events = step(world, input, STEP, audio);
  for (const event of events) {
    if (event === 'levelup') openLevelUp();
    else if (event === 'boss') audio.bossWarn();
    else if (event === 'wavestart') audio.waveStart();
    else if (event === 'waveclear') audio.waveClear();
  }
  if (world.phase === PHASE.VICTORY && screen === 'play') {
    screen = 'victory';
    audio.victory();
    saveBest();
    announce(`Victory. Score ${world.score}.`);
  } else if (world.phase === PHASE.OVER && screen === 'play') {
    screen = 'over';
    audio.gameOver();
    saveBest();
    announce(`Game over. Score ${world.score}.`);
  }
}

function drawFrame() {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  render(ctx, world, screen === 'play' || screen === 'pause' ? input : null);
  if (screen === 'play' || screen === 'pause' || screen === 'levelup') drawHUD(ctx, world);
  if (screen === 'title') drawTitle(ctx, world, best);
  else if (screen === 'pause') drawPause(ctx);
  else if (screen === 'levelup' && choices) drawLevelUp(ctx, world, choices);
  else if (screen === 'over') drawGameOver(ctx, world, best);
  else if (screen === 'victory') drawVictory(ctx, world, best);
}

// Read-only debug snapshot for automated smoke tests (no game logic here).
window.__lumen = () => ({
  screen,
  wave: world.wave,
  phase: world.phase,
  hp: Math.round(world.player.hp),
  level: world.player.level,
  xp: world.player.xp,
  score: world.score,
  kills: world.kills,
  enemies: world.enemies.length,
  bullets: world.bullets.length,
  time: Math.round(world.time * 10) / 10,
  pendingLevels: world.pendingLevels || 0,
  px: Math.round(world.player.x),
  py: Math.round(world.player.y),
  mote: (() => {
    let n = null;
    let d = Infinity;
    for (const m of world.motes) {
      const dd = Math.hypot(m.x - world.player.x, m.y - world.player.y);
      if (dd < d) { d = dd; n = { x: Math.round(m.x), y: Math.round(m.y) }; }
    }
    return n;
  })(),
  nearest: (() => {
    let n = null;
    let d = Infinity;
    for (const e of world.enemies) {
      const dd = Math.hypot(e.x - world.player.x, e.y - world.player.y);
      if (dd < d) { d = dd; n = { x: Math.round(e.x), y: Math.round(e.y) }; }
    }
    return n;
  })(),
});

// --- Screenshot mode: ?shot=start|play|levelup|end&seed=N ---
// Stages one deterministic scene with the real game code, draws a single frame,
// and never starts the loop or the audio.
const shotName = params.get('shot');
if (shotName) {
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  choices = staged.choices || null;
  best = staged.best || 0;
  drawFrame();
} else {
  // --- Live game ---
  const autopilot = createAutopilot(world);
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    const elapsed = Math.min(1, (now - last) / 1000);
    last = now;
    acc += elapsed;
    // Never let a long frame (slow software rendering, tab switch) swallow
    // more than a second of game time, but otherwise catch the simulation up
    // in full: the game must run in real time even at a few frames per second.
    if (acc > 1) acc = 1;
    let guard = 0;
    while (acc >= STEP && guard < 120) {
      acc -= STEP;
      guard += 1;
      handleScreenKeys();
      if (screen === 'title') {
        // Attract mode: the game plays itself behind the title, and applies
        // its own level-ups so the demo stays balanced.
        autopilot.update();
        step(world, autopilot, STEP, audio);
        while (world.pendingLevels > 0) {
          const demoChoices = rollUpgradeChoices(world.rng, world.player);
          if (demoChoices.length === 0) break;
          applyLevelUp(world, demoChoices[0].id, audio);
        }
        if (world.phase === PHASE.OVER || world.phase === PHASE.VICTORY) {
          resetWorld(world, (Date.now() % 2147483647) | 0);
        }
      } else if (screen === 'play') {
        playStep();
        if (screen !== 'play') break;
      }
      input.endStep();
    }
    drawFrame();
    requestAnimationFrame(frame);
  }

  // First user gesture unlocks audio (browsers require it).
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });
  requestAnimationFrame(frame);
}

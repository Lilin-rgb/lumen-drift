// Deterministic screenshot scenes behind ?shot=start|play|levelup|end.
// Each scene plays the real rules forward from a fresh world with a simple
// autopilot, so the frame is what a short game really looks like and the same
// seed always gives the same frame.
import { WAVE } from './config.js';
import { resetWorld, step, applyLevelUp, PHASE } from './world.js';
import { rollUpgradeChoices, applyUpgrade } from './player.js';

const STEP = 1 / 60;
const START_SECONDS = 6;
const PLAY_SECONDS = 16;
const LEVELUP_LIMIT_SECONDS = 60;

// A simple autopilot that plays like a cautious beginner: aim at the nearest
// enemy, keep some distance, drift toward the nearest light dust.
export function createAutopilot(world) {
  const input = {
    mouseX: 640,
    mouseY: 300,
    mouseDown: false,
    _mv: { x: 0, y: 0 },
    moveVector() { return this._mv; },
    wasPressed() { return false; },
    endStep() {},
    update() {
      const p = world.player;
      let nearest = null;
      let nearestD = Infinity;
      for (const e of world.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < nearestD) { nearestD = d; nearest = e; }
      }
      if (nearest) {
        input.mouseX = nearest.x;
        input.mouseY = nearest.y;
      }
      let mx = 0;
      let my = 0;
      if (nearest && nearestD < 150) {
        // Too close: back away.
        mx = (p.x - nearest.x) / nearestD;
        my = (p.y - nearest.y) / nearestD;
      } else {
        // Chase the nearest dust mote, else close in on the enemy.
        let mote = null;
        let moteD = Infinity;
        for (const m of world.motes) {
          const d = Math.hypot(m.x - p.x, m.y - p.y);
          if (d < moteD) { moteD = d; mote = m; }
        }
        let tx;
        let ty;
        if (mote && moteD < 420) { tx = mote.x; ty = mote.y; }
        else if (nearest) { tx = nearest.x; ty = nearest.y; }
        else { tx = 640; ty = 400; }
        const d = Math.hypot(tx - p.x, ty - p.y) || 1;
        if (nearest && nearestD < 260 && !mote) {
          // Hold a firing distance instead of ramming the enemy.
          mx = 0;
          my = 0;
        } else {
          mx = (tx - p.x) / d;
          my = (ty - p.y) / d;
        }
      }
      const len = Math.hypot(mx, my) || 1;
      input._mv = { x: mx / len, y: my / len };
    },
  };
  return input;
}

// The step function expects an audio object; screenshots run silent.
const SILENT_AUDIO = {
  shoot() {}, enemyHit() {}, enemyDie() {}, playerHit() {}, dash() {},
  pickup() {}, levelUp() {}, waveStart() {}, bossWarn() {}, victory() {}, gameOver() {},
};

function runFor(world, seconds, pilot, stopWhen) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    pilot.update();
    step(world, pilot, STEP, SILENT_AUDIO);
    if (world.phase === PHASE.OVER || world.phase === PHASE.VICTORY) break;
    if (stopWhen && stopWhen(world)) break;
  }
}

// Play a real game with the autopilot, applying its level-ups the way
// attract mode does (first rolled card), and stop early when `stopWhen`
// fires, on victory/defeat, or after `maxSeconds` of game time. Every
// number on the HUD after this is the true state of that run.
function runGame(world, pilot, stopWhen, maxSeconds) {
  const maxSteps = Math.floor((maxSeconds || 400) / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    pilot.update();
    step(world, pilot, STEP, SILENT_AUDIO);
    while (world.pendingLevels > 0) {
      const demoChoices = rollUpgradeChoices(world.rng, world.player);
      if (demoChoices.length === 0) break;
      applyLevelUp(world, demoChoices[0].id, SILENT_AUDIO);
    }
    if (world.phase === PHASE.OVER || world.phase === PHASE.VICTORY) break;
    if (stopWhen && stopWhen(world)) break;
  }
}

// A dense boss fight: the Maw alive, its radial bursts in flight, and
// summoned chasers on screen.
function denseBossFight(world) {
  return world.wave === WAVE.bossWave
    && world.phase === PHASE.FIGHTING
    && world.enemies.some((e) => e.kind === 'boss')
    && world.ebullets.length >= 12
    && world.enemies.length >= 3;
}

// The boss fight is still on: wave 10, fighting, Maw alive. Checked after
// the bloom, when the bullet count may have dipped below the staging bar.
function bossFightOn(world) {
  return world.wave === WAVE.bossWave
    && world.phase === PHASE.FIGHTING
    && world.enemies.some((e) => e.kind === 'boss');
}

/**
 * Set `world` to the named scene and return the screen to draw over it, the
 * level-up choices (for the levelup scene), and the best score to show.
 */
export function stageShot(name, world) {
  resetWorld(world, world.seed);
  const pilot = createAutopilot(world);

  if (name === 'play') {
    // Stage the wave-10 boss fight for real: play a full game with the
    // autopilot and stop mid-fight once the Maw's radial bursts and summoned
    // chasers fill the screen. The HUD then shows the true wave, timer and
    // score of that run.
    for (const seed of [world.seed, 2, 3, 4, 5, 6, 7, 8]) {
      resetWorld(world, seed);
      runGame(world, pilot, denseBossFight, 400);
      if (denseBossFight(world)) break;
    }
    if (denseBossFight(world)) {
      // Let the newest radial burst travel clear of the Maw's glow so the
      // ring reads on the frame instead of hiding inside the boss sprite.
      // The boss has roughly half its hull left here, so it survives this.
      runFor(world, 1.0, pilot);
    }
    if (!bossFightOn(world)) {
      // Last resort: the short early fight the old staging used.
      resetWorld(world, world.seed);
      runFor(world, PLAY_SECONDS, pilot);
      if (world.phase === PHASE.OVER) {
        resetWorld(world, world.seed);
        applyUpgrade(world.player, 'vitality');
        applyUpgrade(world.player, 'damage');
        runFor(world, 14, pilot);
      }
    }
    return { screen: 'play', best: 0 };
  }

  if (name === 'levelup') {
    // Start one mote away from levelling and stop the moment the choice
    // screen would open, so the shot shows the first level-up, not a late one.
    applyUpgrade(world.player, 'damage');
    world.player.xp = world.player.xpNext - 1;
    runFor(world, LEVELUP_LIMIT_SECONDS, pilot, (w) => (w.pendingLevels || 0) > 0);
    if (!world.pendingLevels) {
      // Fallback: the pilot never collected a mote; drop one on the player
      // so the real pickup path still fires the level-up.
      world.motes.push({ x: world.player.x, y: world.player.y, vx: 0, vy: 0, value: 1, r: 6 });
      runFor(world, 2, pilot, (w) => (w.pendingLevels || 0) > 0);
    }
    const choices = rollUpgradeChoices(world.rng, world.player);
    return { screen: 'levelup', choices, best: 0 };
  }

  if (name === 'end') {
    // Stage the victory the real way: play a full game with the autopilot
    // and its level-ups, so the victory screen shows the true clear time.
    // Seed 1 clears in about 156 s; the other seeds are fallbacks.
    // A faked timer is never substituted: if no seed clears, fail loudly.
    for (const seed of [world.seed, 2, 3, 4, 5, 6, 7, 8]) {
      resetWorld(world, seed);
      runGame(world, pilot, (w) => w.phase === PHASE.VICTORY, 400);
      if (world.phase === PHASE.VICTORY) break;
    }
    if (world.phase !== PHASE.VICTORY) {
      throw new Error('stageShot(end): no seed cleared the game');
    }
    // Let the boss-death burst bloom behind the victory screen. The timer
    // is frozen in the victory phase, so the clear time stays true.
    runFor(world, 1.5, pilot);
    return { screen: 'victory', best: world.score };
  }

  // Default: start — a few seconds of attract mode behind the title.
  runFor(world, START_SECONDS, pilot);
  return { screen: 'title', best: 0 };
}

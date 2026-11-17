// Deterministic screenshot scenes behind ?shot=start|play|levelup|end.
// Each scene plays the real rules forward from a fresh world with a simple
// autopilot, so the frame is what a short game really looks like and the same
// seed always gives the same frame.
import { WAVE } from './config.js';
import { resetWorld, step, damageEnemy, PHASE } from './world.js';
import { rollUpgradeChoices, applyUpgrade } from './player.js';

const STEP = 1 / 60;
const START_SECONDS = 6;
const PLAY_SECONDS = 16;
const LEVELUP_LIMIT_SECONDS = 60;
const BOSS_FIGHT_SECONDS = 12;

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

/**
 * Set `world` to the named scene and return the screen to draw over it, the
 * level-up choices (for the levelup scene), and the best score to show.
 */
export function stageShot(name, world) {
  resetWorld(world, world.seed);
  const pilot = createAutopilot(world);

  if (name === 'play') {
    runFor(world, PLAY_SECONDS, pilot);
    if (world.phase === PHASE.OVER) {
      // The pilot died; re-stage a shorter, safer play scene.
      resetWorld(world, world.seed);
      applyUpgrade(world.player, 'vitality');
      applyUpgrade(world.player, 'damage');
      runFor(world, 14, pilot);
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
    // Stage the victory the real way: jump to wave 10, let the Maw spawn,
    // fight it for real with a boosted loadout, then land the finishing blow
    // through the real damage path so the victory flow fires.
    applyUpgrade(world.player, 'damage');
    applyUpgrade(world.player, 'damage');
    applyUpgrade(world.player, 'damage');
    applyUpgrade(world.player, 'firerate');
    applyUpgrade(world.player, 'firerate');
    applyUpgrade(world.player, 'vitality');
    world.wave = WAVE.bossWave - 1;
    // Re-enter the wave machine at wave 10.
    world.phase = 'clear';
    world.phaseT = 99;
    runFor(world, 4, pilot);
    runFor(world, BOSS_FIGHT_SECONDS, pilot);
    const boss = world.enemies.find((e) => e.kind === 'boss');
    if (boss) {
      while (boss.hp > 0) damageEnemy(world, boss, 400, 0, -1);
    }
    runFor(world, 1.2, pilot);
    return { screen: world.phase === PHASE.VICTORY ? 'victory' : 'play', best: world.score };
  }

  // Default: start — a few seconds of attract mode behind the title.
  runFor(world, START_SECONDS, pilot);
  return { screen: 'title', best: 0 };
}

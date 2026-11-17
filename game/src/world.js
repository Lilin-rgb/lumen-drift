// The world: waves, collisions, drops, scoring, win/lose. One fixed step
// advances everything; main.js calls step() and reacts to the events it returns.
import { VIEW, ARENA, PLAYER, WAVE, COMBO, PARTICLES, xpNeeded, waveComposition } from './config.js';
import { createRandom, randPick, shuffled } from './random.js';
import { createPlayer, updatePlayer, applyUpgrade } from './player.js';
import { spawnEnemy, spawnBoss, updateEnemies } from './enemies.js';

export const PHASE = {
  BANNER: 'banner',
  SPAWNING: 'spawning',
  FIGHTING: 'fighting',
  CLEAR: 'clear',
  VICTORY: 'victory',
  OVER: 'over',
};

export function createWorld(seed) {
  const world = {
    seed,
    rng: createRandom(seed),
    time: 0,
    wave: 0,
    phase: PHASE.BANNER,
    phaseT: 0,
    spawnQueue: [],
    spawnTimer: 0,
    player: createPlayer(),
    enemies: [],
    bullets: [],
    ebullets: [],
    motes: [],
    particles: [],
    floats: [],
    orbitAngle: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    shake: 0,
    flash: 0,
    bannerText: '',
    bannerSub: '',
    stats: { shots: 0, hits: 0, damageDealt: 0, dashes: 0 },
    levelUpChoices: null,
    pendingLevels: 0,
  };
  // The player module needs the damage path (orbit blades); attach it here so
  // the world stays the single owner of combat rules.
  world.damageEnemy = (enemy, dmg, kx, ky) => damageEnemy(world, enemy, dmg, kx, ky);
  startWave(world, 1);
  return world;
}

export function resetWorld(world, seed) {
  const fresh = createWorld(seed === undefined ? world.seed : seed);
  Object.keys(fresh).forEach((key) => { world[key] = fresh[key]; });
  // Rebind the closures to this world object, not the discarded fresh one.
  world.rng = createRandom(world.seed);
  world.damageEnemy = (enemy, dmg, kx, ky) => damageEnemy(world, enemy, dmg, kx, ky);
}

function startWave(world, wave) {
  world.wave = wave;
  world.phase = PHASE.BANNER;
  world.phaseT = 0;
  if (wave === WAVE.bossWave) {
    world.bannerText = 'WAVE 10 — THE ABYSS MAW';
    world.bannerSub = 'Defeat the Maw to win';
  } else {
    world.bannerText = `WAVE ${wave}`;
    world.bannerSub = wave === 1 ? 'Survive. Collect light dust. Level up.' : '';
  }
  if (wave === WAVE.bossWave) {
    world.spawnQueue = ['boss'];
  } else {
    const { count, mix } = waveComposition(wave);
    const queue = [];
    for (let i = 0; i < count; i += 1) queue.push(randPick(world.rng, mix));
    world.spawnQueue = shuffled(world.rng, queue);
  }
  world.spawnTimer = 0;
}

export function startNextWave(world) {
  startWave(world, world.wave + 1);
}

function addParticles(world, x, y, color, count, speed, size) {
  const rng = world.rng;
  for (let i = 0; i < count; i += 1) {
    if (world.particles.length >= PARTICLES.max) return;
    const a = rng() * Math.PI * 2;
    const v = speed * (0.3 + rng() * 0.7);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.35 + rng() * 0.45, maxLife: 0.8,
      size: size * (0.6 + rng() * 0.8), color, drag: 3,
    });
  }
}

function addFloat(world, x, y, text, color, size) {
  if (world.floats.length > 60) world.floats.shift();
  world.floats.push({ x, y, vy: -46, life: 0.8, maxLife: 0.8, text, color, size: size || 14 });
}

export function damageEnemy(world, enemy, dmg, kx, ky) {
  if (enemy.hp <= 0) return;
  enemy.hp -= dmg;
  enemy.hitFlash = 0.09;
  world.stats.damageDealt += dmg;
  addFloat(world, enemy.x, enemy.y - enemy.r - 4, String(Math.round(dmg)), '#ffe9a8', 13);
  // A little knockback so hits feel physical.
  const kb = enemy.kind === 'boss' ? 0 : 26;
  enemy.x += kx * kb * 0.02;
  enemy.y += ky * kb * 0.02;
  if (enemy.hp <= 0) killEnemy(world, enemy);
}

function killEnemy(world, enemy) {
  const rng = world.rng;
  world.kills += 1;
  world.combo += 1;
  world.comboTimer = COMBO.window;
  const mult = 1 + Math.min(20, world.combo) * 0.05;
  const gained = Math.round(enemy.score * mult);
  world.score += gained;
  addFloat(world, enemy.x, enemy.y, `+${gained}`, '#7df9ff', 15);
  addParticles(world, enemy.x, enemy.y, enemy.color, enemy.kind === 'boss' ? 70 : 16, 260, 4);
  world.shake = Math.min(PARTICLES.shakeMax, world.shake + (enemy.kind === 'boss' ? 12 : 2.5));
  // Drop light dust.
  for (let i = 0; i < enemy.xp; i += 1) {
    const a = rng() * Math.PI * 2;
    world.motes.push({
      x: enemy.x, y: enemy.y,
      vx: Math.cos(a) * 60, vy: Math.sin(a) * 60,
      value: 1, r: 6,
    });
  }
  if (enemy.kind === 'splitter') {
    spawnEnemy(world, 'mini', enemy.x - 14, enemy.y);
    spawnEnemy(world, 'mini', enemy.x + 14, enemy.y);
  }
  if (enemy.kind === 'boss') {
    world.phase = PHASE.VICTORY;
    world.phaseT = 0;
    addParticles(world, enemy.x, enemy.y, '#ff2e88', 90, 420, 5);
    addParticles(world, enemy.x, enemy.y, '#ffffff', 40, 300, 3);
  }
}

function hurtPlayer(world, dmg, fromX, fromY) {
  const p = world.player;
  if (!p.alive || p.invuln > 0 || p.dashLeft > 0) return;
  p.hp -= dmg;
  p.invuln = PLAYER.contactGrace;
  world.flash = 1;
  world.shake = Math.min(PARTICLES.shakeMax, world.shake + 7);
  addParticles(world, p.x, p.y, '#ff4d6d', 14, 220, 4);
  const dx = p.x - fromX;
  const dy = p.y - fromY;
  const d = Math.hypot(dx, dy) || 1;
  p.vx += (dx / d) * 260;
  p.vy += (dy / d) * 260;
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    world.phase = PHASE.OVER;
    world.phaseT = 0;
    addParticles(world, p.x, p.y, '#7df9ff', 80, 380, 5);
    addParticles(world, p.x, p.y, '#ffffff', 40, 260, 3);
  }
}

function gainXp(world, amount) {
  const p = world.player;
  p.xp += amount;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level += 1;
    p.xpNext = xpNeeded(p.level);
    world.levelUpChoices = null; // main.js rolls fresh choices when it opens the screen
    world.pendingLevels = (world.pendingLevels || 0) + 1;
  }
}

// One fixed simulation step. Returns an array of event names for main.js.
export function step(world, input, dt, audio) {
  const events = [];
  if (world.phase === PHASE.VICTORY || world.phase === PHASE.OVER) {
    world.phaseT += dt;
    // A boss killed through the damage path leaves a corpse in the list until
    // the next combat step; drop it here so the end screen never shows it.
    world.enemies = world.enemies.filter((e) => e.hp > 0);
    updateParticles(world, dt);
    return events;
  }

  world.time += dt;
  world.phaseT += dt;
  world.flash = Math.max(0, world.flash - dt * 2.2);
  world.shake = Math.max(0, world.shake - dt * 26);
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }

  // Wave state machine.
  if (world.phase === PHASE.BANNER) {
    if (world.phaseT >= WAVE.bannerTime) {
      world.phase = PHASE.SPAWNING;
      world.phaseT = 0;
      if (world.wave === WAVE.bossWave) events.push('boss');
    }
  } else if (world.phase === PHASE.SPAWNING) {
    world.spawnTimer -= dt;
    if (world.spawnQueue.length > 0 && world.spawnTimer <= 0) {
      world.spawnTimer = WAVE.spawnInterval;
      const kind = world.spawnQueue.shift();
      if (kind === 'boss') spawnBoss(world);
      else spawnEnemy(world, kind);
    }
    if (world.spawnQueue.length === 0) {
      world.phase = PHASE.FIGHTING;
      world.phaseT = 0;
    }
  } else if (world.phase === PHASE.FIGHTING) {
    if (world.enemies.length === 0) {
      world.phase = PHASE.CLEAR;
      world.phaseT = 0;
      events.push('waveclear');
    }
  } else if (world.phase === PHASE.CLEAR) {
    if (world.phaseT >= WAVE.clearPause) {
      startNextWave(world);
      events.push('wavestart');
    }
  }

  updatePlayer(world, input, dt, audio);
  updateEnemies(world, dt);

  // Player bullets vs enemies.
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0
      || b.x < ARENA.x || b.x > ARENA.x + ARENA.width
      || b.y < ARENA.y || b.y > ARENA.y + ARENA.height;
    if (!dead) {
      for (const e of world.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d < e.r + b.r) {
          world.stats.hits += 1;
          const len = Math.hypot(b.vx, b.vy) || 1;
          damageEnemy(world, e, b.damage, b.vx / len, b.vy / len);
          audio.enemyHit();
          dead = true;
          break;
        }
      }
    }
    if (dead) {
      addParticles(world, b.x, b.y, '#9be8ff', 3, 90, 2.5);
      world.bullets.splice(i, 1);
    }
  }
  world.enemies = world.enemies.filter((e) => e.hp > 0);

  // Enemy bullets vs the player.
  const p = world.player;
  for (let i = world.ebullets.length - 1; i >= 0; i -= 1) {
    const b = world.ebullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0
      || b.x < ARENA.x || b.x > ARENA.x + ARENA.width
      || b.y < ARENA.y || b.y > ARENA.y + ARENA.height;
    if (!dead && p.alive) {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < p.radius + b.r) {
        hurtPlayer(world, b.damage, b.x - b.vx * 0.01, b.y - b.vy * 0.01);
        audio.playerHit();
        dead = true;
      }
    }
    if (dead) world.ebullets.splice(i, 1);
  }

  // Contact damage: touching an enemy hurts.
  if (p.alive) {
    for (const e of world.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < e.r + p.radius) {
        hurtPlayer(world, e.damage, e.x, e.y);
        audio.playerHit();
        if (!p.alive) break;
      }
    }
  }

  // Light dust: drift, get magnetised, get collected.
  for (let i = world.motes.length - 1; i >= 0; i -= 1) {
    const m = world.motes[i];
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    const d = Math.hypot(dx, dy) || 1;
    if (p.alive && d < p.magnet) {
      const pull = 900 * (1 - d / (p.magnet + 1)) + 260;
      m.vx += (dx / d) * pull * dt;
      m.vy += (dy / d) * pull * dt;
    } else {
      m.vx *= Math.max(0, 1 - 2.5 * dt);
      m.vy *= Math.max(0, 1 - 2.5 * dt);
    }
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (p.alive && d < p.radius + m.r + 6) {
      gainXp(world, m.value);
      audio.pickup();
      addParticles(world, m.x, m.y, '#ffe66d', 4, 120, 3);
      world.motes.splice(i, 1);
    }
  }

  if (world.pendingLevels > 0) {
    events.push('levelup');
  }

  updateParticles(world, dt);
  return events;
}

function updateParticles(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const pt = world.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) { world.particles.splice(i, 1); continue; }
    const f = Math.max(0, 1 - pt.drag * dt);
    pt.vx *= f;
    pt.vy *= f;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
  }
  for (let i = world.floats.length - 1; i >= 0; i -= 1) {
    const fl = world.floats[i];
    fl.life -= dt;
    fl.y += fl.vy * dt;
    if (fl.life <= 0) world.floats.splice(i, 1);
  }
}

// Called by main.js once the player picks a level-up card.
export function applyLevelUp(world, upgradeId, audio) {
  applyUpgrade(world.player, upgradeId);
  world.pendingLevels -= 1;
  audio.levelUp();
  addParticles(world, world.player.x, world.player.y, '#ffe66d', 30, 260, 4);
}

export { VIEW };

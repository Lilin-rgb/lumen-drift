// Enemy kinds, spawning and AI for Lumen Drift.
import { ENEMIES, SHOOTER, SPEEDER, BOSS, ARENA } from './config.js';
import { randInt, randPick } from './random.js';

function baseStats(kind, wave) {
  const s = ENEMIES[kind];
  const scale = 1 + (wave - 1) * 0.11;
  return {
    kind, x: 0, y: 0, vx: 0, vy: 0,
    r: s.radius, hp: Math.round(s.hp * scale), maxHp: Math.round(s.hp * scale),
    speed: s.speed * (1 + (wave - 1) * 0.02), damage: s.damage,
    score: s.score, xp: s.xp, color: s.color,
    t: 0, hitFlash: 0, lungeTimer: 1,
    fireTimer: 1.5, burstTimer: 2.0, summonTimer: 5.0, lungeState: 0, lungeX: 0, lungeY: 0,
    orbitHitAt: -99, wobble: 0,
  };
}

// Spawn at a random point on the arena edge, away from the player.
export function spawnEnemy(state, kind, x, y) {
  const e = baseStats(kind, state.wave);
  const rng = state.rng;
  e.lungeTimer = 1 + rng() * 1.5;
  e.wobble = rng() * Math.PI * 2;
  if (x === undefined || y === undefined) {
    const p = state.player;
    for (let tries = 0; tries < 12; tries += 1) {
      const edge = randInt(rng, 0, 4);
      if (edge === 0) { e.x = ARENA.x + rng() * ARENA.width; e.y = ARENA.y + e.r + 4; }
      else if (edge === 1) { e.x = ARENA.x + rng() * ARENA.width; e.y = ARENA.y + ARENA.height - e.r - 4; }
      else if (edge === 2) { e.x = ARENA.x + e.r + 4; e.y = ARENA.y + rng() * ARENA.height; }
      else { e.x = ARENA.x + ARENA.width - e.r - 4; e.y = ARENA.y + rng() * ARENA.height; }
      if (Math.hypot(e.x - p.x, e.y - p.y) > 260) break;
    }
  } else {
    e.x = x;
    e.y = y;
  }
  state.enemies.push(e);
  return e;
}

export function spawnBoss(state) {
  const e = baseStats('boss', state.wave);
  e.x = ARENA.x + ARENA.width / 2;
  e.y = ARENA.y + 120;
  state.enemies.push(e);
  return e;
}

function seek(e, tx, ty, speed, dt) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.vx = (dx / d) * speed;
  e.vy = (dy / d) * speed;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

export function updateEnemies(state, dt) {
  const p = state.player;
  const rng = state.rng;
  for (const e of state.enemies) {
    e.t += dt;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (e.kind === 'chaser' || e.kind === 'mini') {
      // A little wobble so chasers do not stack into a single line.
      const wob = Math.sin(e.t * 2.2 + e.wobble) * 0.35;
      const ax = nx - ny * wob;
      const ay = ny + nx * wob;
      const len = Math.hypot(ax, ay) || 1;
      e.x += (ax / len) * e.speed * dt;
      e.y += (ay / len) * e.speed * dt;
    } else if (e.kind === 'speeder') {
      e.lungeTimer -= dt;
      if (e.lungeState > 0) {
        e.lungeState -= dt;
        e.x += e.lungeX * SPEEDER.lungeSpeed * dt;
        e.y += e.lungeY * SPEEDER.lungeSpeed * dt;
      } else if (e.lungeTimer <= 0 && dist < 420) {
        e.lungeState = SPEEDER.lungeTime;
        e.lungeX = nx;
        e.lungeY = ny;
        e.lungeTimer = SPEEDER.lungeInterval * (0.8 + rng() * 0.4);
      } else {
        seek(e, p.x, p.y, e.speed, dt);
      }
    } else if (e.kind === 'splitter') {
      seek(e, p.x, p.y, e.speed, dt);
    } else if (e.kind === 'shooter') {
      if (dist > SHOOTER.range) {
        seek(e, p.x, p.y, e.speed, dt);
      } else if (dist < SHOOTER.range * 0.65) {
        e.x -= nx * e.speed * 0.7 * dt;
        e.y -= ny * e.speed * 0.7 * dt;
      } else {
        // Strafe sideways while holding range.
        e.x += -ny * e.speed * 0.5 * dt;
        e.y += nx * e.speed * 0.5 * dt;
      }
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && p.alive) {
        e.fireTimer = SHOOTER.fireInterval * (0.85 + rng() * 0.3);
        state.ebullets.push({
          x: e.x, y: e.y,
          vx: nx * SHOOTER.shotSpeed, vy: ny * SHOOTER.shotSpeed,
          r: SHOOTER.shotRadius, damage: SHOOTER.damage, life: 4,
        });
      }
    } else if (e.kind === 'boss') {
      const enraged = e.hp < e.maxHp * BOSS.enrageHp;
      const speed = e.speed * (enraged ? 1.5 : 1);
      if (dist > 240) seek(e, p.x, p.y, speed, dt);
      else {
        e.x += -ny * speed * 0.6 * dt;
        e.y += nx * speed * 0.6 * dt;
      }
      e.burstTimer -= dt;
      if (e.burstTimer <= 0 && p.alive) {
        e.burstTimer = BOSS.burstInterval * (enraged ? 0.6 : 1);
        const count = BOSS.burstCount + (enraged ? 6 : 0);
        const offset = rng() * Math.PI * 2;
        for (let i = 0; i < count; i += 1) {
          const a = offset + (i * Math.PI * 2) / count;
          state.ebullets.push({
            x: e.x, y: e.y,
            vx: Math.cos(a) * BOSS.burstSpeed, vy: Math.sin(a) * BOSS.burstSpeed,
            r: 7, damage: 12, life: 5,
          });
        }
        state.shake = Math.min(12, state.shake + 5);
      }
      e.summonTimer -= dt;
      if (e.summonTimer <= 0) {
        e.summonTimer = BOSS.summonInterval;
        if (state.enemies.length < 26) {
          spawnEnemy(state, 'chaser', e.x + 60, e.y);
          spawnEnemy(state, 'chaser', e.x - 60, e.y);
        }
      }
    }

    e.x = Math.min(ARENA.x + ARENA.width - e.r, Math.max(ARENA.x + e.r, e.x));
    e.y = Math.min(ARENA.y + ARENA.height - e.r, Math.max(ARENA.y + e.r, e.y));
  }

  // Gentle separation so enemies do not pile onto one pixel.
  const list = state.enemies;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.r + b.r;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }
  }
}

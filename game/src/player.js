// The player: movement, dash, auto-fire, orbiting blades, and the upgrade system.
import { PLAYER, ORBIT, BULLET, ARENA, xpNeeded, UPGRADES } from './config.js';
import { shuffled } from './random.js';

export function createPlayer() {
  return {
    x: 640, y: 420, vx: 0, vy: 0, angle: -Math.PI / 2, radius: PLAYER.radius,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
    speed: PLAYER.speed, fireRate: PLAYER.fireRate, damage: PLAYER.damage,
    projectiles: 1, orbitBlades: 0, magnet: PLAYER.pickupRadius,
    dashCooldown: PLAYER.dashCooldown, dashCd: 0, dashLeft: 0, dashDirX: 0, dashDirY: 1,
    invuln: 0, fireTimer: 0, level: 1, xp: 0, xpNext: xpNeeded(1),
    upgrades: {}, alive: true,
  };
}

// Roll three distinct level-up choices the player has not maxed out yet.
export function rollUpgradeChoices(rng, player) {
  const available = UPGRADES.filter((u) => (player.upgrades[u.id] || 0) < u.max);
  return shuffled(rng, available).slice(0, Math.min(3, available.length));
}

export function applyUpgrade(player, id) {
  player.upgrades[id] = (player.upgrades[id] || 0) + 1;
  switch (id) {
    case 'damage': player.damage *= 1.25; break;
    case 'firerate': player.fireRate *= 1.2; break;
    case 'speed': player.speed *= 1.12; break;
    case 'vitality':
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
      break;
    case 'dash': player.dashCooldown *= 0.75; break;
    case 'multishot': player.projectiles += 1; break;
    case 'orbit': player.orbitBlades += 1; break;
    case 'magnet': player.magnet *= 1.7; break;
    default: break;
  }
}

function spawnBullet(state, x, y, angle, damage) {
  state.bullets.push({
    x, y,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    r: PLAYER.bulletRadius, damage, life: PLAYER.bulletLife,
  });
}

export function updatePlayer(state, input, dt, audio) {
  const p = state.player;
  if (!p.alive) return;
  const rng = state.rng;

  p.invuln = Math.max(0, p.invuln - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.fireTimer -= dt;

  // Aim follows the mouse (or the autopilot's synthetic aim in shot mode).
  p.angle = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);

  const move = input.moveVector();

  // Dash: Space or either Shift. A short burst with brief invulnerability.
  if ((input.wasPressed('Space') || input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight')) && p.dashCd <= 0) {
    let dx = move.x;
    let dy = move.y;
    if (dx === 0 && dy === 0) { dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
    p.dashDirX = dx;
    p.dashDirY = dy;
    p.dashLeft = PLAYER.dashTime;
    p.dashCd = p.dashCooldown;
    p.invuln = Math.max(p.invuln, PLAYER.dashInvuln);
    audio.dash();
    for (let i = 0; i < 10; i += 1) {
      state.particles.push({
        x: p.x - dx * i * 3, y: p.y - dy * i * 3,
        vx: -dx * 120 + (rng() - 0.5) * 120, vy: -dy * 120 + (rng() - 0.5) * 120,
        life: 0.3, maxLife: 0.3, size: 3 + rng() * 3, color: '#7df9ff', drag: 4,
      });
    }
  }

  if (p.dashLeft > 0) {
    p.dashLeft -= dt;
    p.vx = p.dashDirX * PLAYER.dashSpeed;
    p.vy = p.dashDirY * PLAYER.dashSpeed;
  } else {
    p.vx += move.x * PLAYER.accel * dt;
    p.vy += move.y * PLAYER.accel * dt;
    // Friction when no input; clamp speed otherwise.
    const speed = Math.hypot(p.vx, p.vy);
    const max = p.speed;
    if (move.x === 0 && move.y === 0) {
      const f = Math.max(0, 1 - PLAYER.friction * dt);
      p.vx *= f;
      p.vy *= f;
    } else if (speed > max) {
      p.vx = (p.vx / speed) * max;
      p.vy = (p.vy / speed) * max;
    }
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = Math.min(ARENA.x + ARENA.width - p.radius, Math.max(ARENA.x + p.radius, p.x));
  p.y = Math.min(ARENA.y + ARENA.height - p.radius, Math.max(ARENA.y + p.radius, p.y));

  // Auto-fire toward the aim point.
  if (p.fireTimer <= 0) {
    p.fireTimer = 1 / p.fireRate;
    const n = p.projectiles;
    const base = p.angle;
    for (let i = 0; i < n; i += 1) {
      const offset = (i - (n - 1) / 2) * BULLET.spread;
      const gx = p.x + Math.cos(base) * (p.radius + 6);
      const gy = p.y + Math.sin(base) * (p.radius + 6);
      spawnBullet(state, gx, gy, base + offset, p.damage);
    }
    // Muzzle flash: a couple of short-lived sparks at the gun tip.
    for (let i = 0; i < 2; i += 1) {
      state.particles.push({
        x: p.x + Math.cos(base) * (p.radius + 10),
        y: p.y + Math.sin(base) * (p.radius + 10),
        vx: Math.cos(base + (rng() - 0.5) * 0.9) * 260,
        vy: Math.sin(base + (rng() - 0.5) * 0.9) * 260,
        life: 0.12, maxLife: 0.12, size: 3.5, color: '#bff6ff', drag: 2,
      });
    }
    audio.shoot();
    state.stats.shots += n;
  }

  // Orbiting light blades sweep around the player and shred what they touch.
  if (p.orbitBlades > 0) {
    state.orbitAngle += ORBIT.speed * dt;
    for (let b = 0; b < p.orbitBlades; b += 1) {
      const a = state.orbitAngle + (b * Math.PI * 2) / p.orbitBlades;
      const bx = p.x + Math.cos(a) * ORBIT.radius;
      const by = p.y + Math.sin(a) * ORBIT.radius;
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - bx, e.y - by);
        if (d < ORBIT.bladeRadius + e.r && state.time - (e.orbitHitAt || -99) > ORBIT.hitCooldown) {
          e.orbitHitAt = state.time;
          state.damageEnemy(e, ORBIT.damage, Math.cos(a), Math.sin(a));
        }
      }
    }
  }
}

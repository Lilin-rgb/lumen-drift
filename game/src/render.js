// All drawing for Lumen Drift: the arena, the player, enemies, bullets, particles
// and floating damage numbers. Everything is Canvas code — no images, no fonts
// loaded from anywhere. Glow comes from shadowBlur and additive blending.
import { VIEW, ARENA, ORBIT } from './config.js';
import { createRandom } from './random.js';
import { PHASE } from './world.js';

const TAU = Math.PI * 2;

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx) {
  ctx.shadowBlur = 0;
}

function drawGrid(ctx, world) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  g.addColorStop(0, '#070a1a');
  g.addColorStop(0.55, '#05060f');
  g.addColorStop(1, '#0a0618');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // Drifting star dust, fixed positions from a fixed seed.
  const rng = createRandom(1337);
  ctx.save();
  for (let i = 0; i < 70; i += 1) {
    const x = rng() * VIEW.width;
    const y = rng() * VIEW.height;
    const r = 0.6 + rng() * 1.6;
    const tw = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(world.time * 0.7 + i));
    ctx.globalAlpha = tw;
    ctx.fillStyle = rng() > 0.85 ? '#9be8ff' : '#c9d4ff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // Faint grid.
  ctx.save();
  ctx.strokeStyle = 'rgba(90, 140, 255, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ARENA.x; x <= ARENA.x + ARENA.width; x += 64) {
    ctx.moveTo(x, ARENA.y);
    ctx.lineTo(x, ARENA.y + ARENA.height);
  }
  for (let y = ARENA.y; y <= ARENA.y + ARENA.height; y += 64) {
    ctx.moveTo(ARENA.x, y);
    ctx.lineTo(ARENA.x + ARENA.width, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawArena(ctx, world) {
  ctx.save();
  glow(ctx, '#2de2ff', 18);
  ctx.strokeStyle = 'rgba(45, 226, 255, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height);
  noGlow(ctx);
  ctx.strokeStyle = 'rgba(45, 226, 255, 0.16)';
  ctx.lineWidth = 7;
  ctx.strokeRect(ARENA.x - 4, ARENA.y - 4, ARENA.width + 8, ARENA.height + 8);
  ctx.restore();
}

function drawMotes(ctx, world) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const m of world.motes) {
    const pulse = 0.7 + 0.3 * Math.sin(world.time * 6 + m.x);
    glow(ctx, '#ffe66d', 10);
    ctx.fillStyle = `rgba(255, 230, 109, ${pulse})`;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y - 6);
    ctx.lineTo(m.x + 4.5, m.y);
    ctx.lineTo(m.x, m.y + 6);
    ctx.lineTo(m.x - 4.5, m.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawBullets(ctx, world) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of world.bullets) {
    glow(ctx, '#7df9ff', 12);
    ctx.strokeStyle = '#bff6ff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const b of world.ebullets) {
    glow(ctx, '#ff2e88', 12);
    ctx.fillStyle = '#ff5c9d';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd7e8';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemy(ctx, world, e) {
  const p = world.player;
  const ang = Math.atan2(p.y - e.y, p.x - e.x);
  ctx.save();
  ctx.translate(e.x, e.y);
  glow(ctx, e.color, 14);
  ctx.fillStyle = e.color;
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 2;

  if (e.kind === 'chaser') {
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(e.r + 6, 0);
    ctx.lineTo(-e.r * 0.8, e.r * 0.75);
    ctx.lineTo(-e.r * 0.4, 0);
    ctx.lineTo(-e.r * 0.8, -e.r * 0.75);
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'speeder') {
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(e.r + 8, 0);
    ctx.lineTo(0, e.r * 0.55);
    ctx.lineTo(-e.r - 4, 0);
    ctx.lineTo(0, -e.r * 0.55);
    ctx.closePath();
    ctx.fill();
    // Speed lines.
    ctx.strokeStyle = 'rgba(255, 176, 32, 0.5)';
    ctx.beginPath();
    ctx.moveTo(-e.r - 6, -4);
    ctx.lineTo(-e.r - 18, -4);
    ctx.moveTo(-e.r - 6, 4);
    ctx.lineTo(-e.r - 18, 4);
    ctx.stroke();
  } else if (e.kind === 'splitter') {
    ctx.rotate(world.time * 0.8);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i * TAU) / 6;
      const px = Math.cos(a) * e.r;
      const py = Math.sin(a) * e.r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = '#efe0ff';
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.35, 0, TAU);
    ctx.fill();
  } else if (e.kind === 'mini') {
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, TAU);
    ctx.fill();
  } else if (e.kind === 'shooter') {
    ctx.rotate(ang);
    ctx.fillRect(-e.r * 0.8, -e.r * 0.8, e.r * 1.6, e.r * 1.6);
    noGlow(ctx);
    ctx.fillStyle = '#dff8ff';
    ctx.fillRect(0, -2.5, e.r + 8, 5);
  } else if (e.kind === 'boss') {
    ctx.rotate(world.time * 0.35);
    ctx.beginPath();
    const spikes = 12;
    for (let i = 0; i < spikes * 2; i += 1) {
      const a = (i * Math.PI) / spikes;
      const rad = i % 2 === 0 ? e.r + 14 : e.r - 6;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = '#2a0616';
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.62, 0, TAU);
    ctx.fill();
    // The maw: a pulsing dark eye.
    const pulse = 0.8 + 0.2 * Math.sin(world.time * 3);
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.34 * pulse, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0b0208';
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.18 * pulse, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // Hit flash: a white shell for a split second.
  if (e.hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.7, e.hitFlash / 0.09);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Small hp bar when damaged.
  if (e.hp < e.maxHp && e.kind !== 'boss') {
    const w = e.r * 2;
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w, 4);
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w * frac, 4);
    ctx.restore();
  }
}

function drawPlayer(ctx, world, input) {
  const p = world.player;
  if (!p.alive) return;
  ctx.save();
  // Blink while invulnerable after a hit.
  if (p.invuln > 0 && p.dashLeft <= 0) {
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(world.time * 40);
  }
  ctx.translate(p.x, p.y);

  // Orbit blades.
  if (p.orbitBlades > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < p.orbitBlades; b += 1) {
      const a = world.orbitAngle + (b * TAU) / p.orbitBlades;
      const bx = Math.cos(a) * ORBIT.radius;
      const by = Math.sin(a) * ORBIT.radius;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + Math.PI / 2);
      glow(ctx, '#ffe66d', 12);
      ctx.fillStyle = '#ffe66d';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(7, 8);
      ctx.lineTo(0, 3);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Dash trail.
  if (p.dashLeft > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#7df9ff';
    ctx.beginPath();
    ctx.arc(-p.dashDirX * 26, -p.dashDirY * 26, p.radius * 0.9, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // The ship: a dart pointing at the aim.
  ctx.rotate(p.angle);
  glow(ctx, '#2de2ff', 18);
  ctx.fillStyle = '#dffaff';
  ctx.beginPath();
  ctx.moveTo(p.radius + 8, 0);
  ctx.lineTo(-p.radius * 0.7, p.radius * 0.72);
  ctx.lineTo(-p.radius * 0.35, 0);
  ctx.lineTo(-p.radius * 0.7, -p.radius * 0.72);
  ctx.closePath();
  ctx.fill();
  noGlow(ctx);
  ctx.fillStyle = '#0e7490';
  ctx.beginPath();
  ctx.arc(-2, 0, 5, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Aim reticle at the mouse.
  if (input) {
    ctx.save();
    ctx.strokeStyle = 'rgba(125, 249, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(input.mouseX, input.mouseY, 10, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(input.mouseX - 15, input.mouseY);
    ctx.lineTo(input.mouseX - 6, input.mouseY);
    ctx.moveTo(input.mouseX + 6, input.mouseY);
    ctx.lineTo(input.mouseX + 15, input.mouseY);
    ctx.moveTo(input.mouseX, input.mouseY - 15);
    ctx.lineTo(input.mouseX, input.mouseY - 6);
    ctx.moveTo(input.mouseX, input.mouseY + 6);
    ctx.lineTo(input.mouseX, input.mouseY + 15);
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles(ctx, world) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const pt of world.particles) {
    const frac = pt.life / pt.maxLife;
    ctx.globalAlpha = Math.max(0, frac);
    glow(ctx, pt.color, 8);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * frac + 0.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawFloats(ctx, world) {
  ctx.save();
  ctx.textAlign = 'center';
  for (const fl of world.floats) {
    const frac = fl.life / fl.maxLife;
    ctx.globalAlpha = Math.min(1, frac * 1.5);
    ctx.font = `bold ${fl.size}px monospace, sans-serif`;
    ctx.fillStyle = fl.color;
    ctx.fillText(fl.text, fl.x, fl.y);
  }
  ctx.restore();
}

export function render(ctx, world, input) {
  ctx.save();
  // Screen shake: a decaying offset driven by world time (deterministic).
  if (world.shake > 0.2) {
    const s = world.shake;
    ctx.translate(Math.sin(world.time * 91) * s * 0.5, Math.cos(world.time * 113) * s * 0.5);
  }
  drawGrid(ctx, world);
  drawArena(ctx, world);
  drawMotes(ctx, world);
  drawBullets(ctx, world);
  for (const e of world.enemies) drawEnemy(ctx, world, e);
  drawPlayer(ctx, world, input);
  drawParticles(ctx, world);
  drawFloats(ctx, world);
  ctx.restore();

  // Red flash when the player is hurt.
  if (world.flash > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 30, 70, ${world.flash * 0.22})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.restore();
  }
}

export { PHASE };

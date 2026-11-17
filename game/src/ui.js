// HUD, menus and overlays for Lumen Drift. All text is drawn on the canvas so the
// game needs no DOM UI and no external fonts.
import { VIEW, ARENA, WAVE } from './config.js';
import { PHASE } from './world.js';

const TAU = Math.PI * 2;

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function bar(ctx, x, y, w, h, frac, fill, back, glowColor) {
  ctx.save();
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  if (frac > 0) {
    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8;
    }
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

export function drawHUD(ctx, world) {
  const p = world.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Top-left: hull (health) and experience.
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px monospace, sans-serif';
  ctx.fillStyle = '#9be8ff';
  ctx.fillText('HULL', 28, 30);
  bar(ctx, 28, 38, 240, 16, p.hp / p.maxHp, '#2de2ff', 'rgba(20, 40, 60, 0.8)', '#2de2ff');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px monospace, sans-serif';
  ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 276, 51);
  ctx.fillStyle = '#ffe66d';
  ctx.font = 'bold 13px monospace, sans-serif';
  ctx.fillText(`LV ${p.level}`, 28, 76);
  bar(ctx, 76, 64, 192, 10, p.xp / p.xpNext, '#ffe66d', 'rgba(60, 50, 10, 0.8)', '#ffe66d');
  ctx.fillStyle = '#cfc39a';
  ctx.font = '11px monospace, sans-serif';
  ctx.fillText(`${p.xp} / ${p.xpNext} XP`, 276, 73);

  // Top-centre: wave and timer.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px monospace, sans-serif';
  const waveLabel = world.wave === WAVE.bossWave ? 'WAVE 10 — BOSS' : `WAVE ${world.wave}`;
  ctx.fillText(waveLabel, VIEW.width / 2, 34);
  ctx.fillStyle = '#9be8ff';
  ctx.font = 'bold 15px monospace, sans-serif';
  ctx.fillText(fmtTime(world.time), VIEW.width / 2, 56);

  // Boss health bar.
  const boss = world.enemies.find((e) => e.kind === 'boss');
  if (boss) {
    ctx.fillStyle = '#ff2e88';
    ctx.font = 'bold 13px monospace, sans-serif';
    ctx.fillText('THE ABYSS MAW', VIEW.width / 2, 82);
    bar(ctx, VIEW.width / 2 - 220, 90, 440, 12, boss.hp / boss.maxHp, '#ff2e88', 'rgba(60, 10, 30, 0.85)', '#ff2e88');
  }

  // Top-right: score, kills, combo.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px monospace, sans-serif';
  ctx.fillText(`${world.score}`, VIEW.width - 28, 34);
  ctx.fillStyle = '#9be8ff';
  ctx.font = 'bold 13px monospace, sans-serif';
  ctx.fillText(`KILLS ${world.kills}`, VIEW.width - 28, 56);
  if (world.combo > 1) {
    ctx.fillStyle = '#ffb020';
    ctx.font = 'bold 16px monospace, sans-serif';
    ctx.fillText(`COMBO x${world.combo}`, VIEW.width - 28, 80);
  }

  // Bottom-left: dash cooldown.
  const ready = p.dashCd <= 0;
  ctx.textAlign = 'left';
  ctx.fillStyle = ready ? '#7df9ff' : '#7d8aa5';
  ctx.font = 'bold 13px monospace, sans-serif';
  ctx.fillText(ready ? 'DASH READY  [SPACE]' : 'DASH …', 28, VIEW.height - 52);
  bar(ctx, 28, VIEW.height - 44, 150, 8,
    ready ? 1 : 1 - p.dashCd / p.dashCooldown,
    '#7df9ff', 'rgba(20, 40, 60, 0.8)', ready ? '#7df9ff' : null);

  // Bottom-right: controls reminder.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(160, 190, 220, 0.75)';
  ctx.font = '12px monospace, sans-serif';
  ctx.fillText('WASD MOVE · MOUSE AIM · SPACE DASH · P PAUSE · M MUTE', VIEW.width - 28, VIEW.height - 28);

  // Wave banner.
  if (world.phase === PHASE.BANNER) {
    const alpha = Math.min(1, world.phaseT * 3);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#2de2ff';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px monospace, sans-serif';
    ctx.fillText(world.bannerText, VIEW.width / 2, VIEW.height / 2 - 10);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#9be8ff';
    ctx.font = 'bold 18px monospace, sans-serif';
    ctx.fillText(world.bannerSub, VIEW.width / 2, VIEW.height / 2 + 28);
    ctx.restore();
  } else if (world.phase === PHASE.CLEAR) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, world.phaseT * 2);
    ctx.fillStyle = '#7df9ff';
    ctx.font = 'bold 30px monospace, sans-serif';
    ctx.fillText('WAVE CLEARED', VIEW.width / 2, VIEW.height / 2 - 10);
    ctx.restore();
  }
  ctx.restore();
}

// The three upgrade cards, laid out deterministically so main.js can hit-test clicks.
export function levelUpCardRects() {
  const w = 300;
  const h = 190;
  const gap = 28;
  const total = w * 3 + gap * 2;
  const x0 = (VIEW.width - total) / 2;
  const y0 = 300;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y: y0, w, h }));
}

export function drawLevelUp(ctx, world, choices) {
  const p = world.player;
  ctx.save();
  ctx.fillStyle = 'rgba(3, 5, 16, 0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ffe66d';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ffe66d';
  ctx.font = 'bold 44px monospace, sans-serif';
  ctx.fillText(`LEVEL ${p.level} — CHOOSE AN UPGRADE`, VIEW.width / 2, 190);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#9be8ff';
  ctx.font = '16px monospace, sans-serif';
  ctx.fillText('Click a card, or press 1 / 2 / 3', VIEW.width / 2, 228);

  const rects = levelUpCardRects();
  choices.forEach((choice, i) => {
    const r = rects[i];
    const level = p.upgrades[choice.id] || 0;
    ctx.save();
    ctx.fillStyle = 'rgba(14, 24, 48, 0.95)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#2de2ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#2de2ff';
    ctx.shadowBlur = 12;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace, sans-serif';
    ctx.fillText(choice.name, r.x + r.w / 2, r.y + 52);
    ctx.fillStyle = '#9be8ff';
    ctx.font = '15px monospace, sans-serif';
    ctx.fillText(choice.desc, r.x + r.w / 2, r.y + 92);
    // Level pips: filled for taken levels, hollow up to the cap.
    for (let k = 0; k < choice.max; k += 1) {
      ctx.fillStyle = k < level ? '#ffe66d' : 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(r.x + r.w / 2 - (choice.max - 1) * 11 + k * 22, r.y + 132, 6, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#7d8aa5';
    ctx.font = 'bold 15px monospace, sans-serif';
    ctx.fillText(`[${i + 1}]`, r.x + r.w / 2, r.y + 168);
    ctx.restore();
  });
  ctx.restore();
}

function overlayTitle(ctx, big, sub, accent) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 28;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px monospace, sans-serif';
  ctx.fillText(big, VIEW.width / 2, VIEW.height / 2 - 40);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#9be8ff';
  ctx.font = '20px monospace, sans-serif';
  ctx.fillText(sub, VIEW.width / 2, VIEW.height / 2 + 6);
  ctx.restore();
}

export function drawTitle(ctx, world, best) {
  ctx.save();
  ctx.fillStyle = 'rgba(3, 5, 16, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#2de2ff';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px monospace, sans-serif';
  ctx.fillText('LUMEN DRIFT', VIEW.width / 2, 250);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#7df9ff';
  ctx.font = 'bold 22px monospace, sans-serif';
  ctx.fillText('NEON ARENA SURVIVAL', VIEW.width / 2, 296);
  ctx.fillStyle = '#c9d4ff';
  ctx.font = '17px monospace, sans-serif';
  ctx.fillText('WASD move · mouse aim · auto-fire · SPACE dash · P pause · M mute', VIEW.width / 2, 380);
  ctx.fillText('Collect light dust, level up, and defeat the Abyss Maw on wave 10.', VIEW.width / 2, 412);
  const pulse = 0.6 + 0.4 * Math.sin(world.time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffe66d';
  ctx.font = 'bold 24px monospace, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO START', VIEW.width / 2, 500);
  ctx.globalAlpha = 1;
  if (best > 0) {
    ctx.fillStyle = '#9be8ff';
    ctx.font = 'bold 16px monospace, sans-serif';
    ctx.fillText(`BEST SCORE  ${best}`, VIEW.width / 2, 548);
  }
  ctx.restore();
}

export function drawPause(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(3, 5, 16, 0.66)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  overlayTitle(ctx, 'PAUSED', 'Press P or click to resume', '#2de2ff');
  ctx.restore();
}

export function drawStats(ctx, world, best) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9d4ff';
  ctx.font = '20px monospace, sans-serif';
  const lines = [
    `SCORE  ${world.score}`,
    `WAVE REACHED  ${world.wave}   ·   KILLS  ${world.kills}`,
    `TIME  ${fmtTime(world.time)}   ·   LEVEL  ${world.player.level}`,
    `BEST  ${Math.max(best, world.score)}`,
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, VIEW.height / 2 + 56 + i * 34));
  ctx.restore();
}

export function drawGameOver(ctx, world, best) {
  ctx.save();
  ctx.fillStyle = 'rgba(10, 2, 8, 0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  overlayTitle(ctx, 'SIGNAL LOST', 'The drift claims another pilot.', '#ff2e88');
  drawStats(ctx, world, best);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe66d';
  ctx.font = 'bold 22px monospace, sans-serif';
  ctx.fillText('PRESS R TO DRIFT AGAIN', VIEW.width / 2, VIEW.height / 2 + 210);
  ctx.restore();
}

export function drawVictory(ctx, world, best) {
  ctx.save();
  ctx.fillStyle = 'rgba(2, 10, 8, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  overlayTitle(ctx, 'THE MAW IS SILENT', 'Wave 10 cleared. The arena is yours.', '#ffe66d');
  drawStats(ctx, world, best);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe66d';
  ctx.font = 'bold 22px monospace, sans-serif';
  ctx.fillText('PRESS R TO PLAY AGAIN', VIEW.width / 2, VIEW.height / 2 + 210);
  ctx.restore();
}

export { ARENA };

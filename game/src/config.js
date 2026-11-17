// Lumen Drift — every tuning number lives here, so balance changes touch one file.
// All distances are pixels, all times seconds, all speeds pixels per second.
export const VIEW = { width: 1280, height: 800 };

// The arena is the whole canvas with a glowing wall margin the player cannot cross.
// The top 80 px and bottom 64 px stay clear for the HUD.
export const ARENA = { x: 36, y: 80, width: 1208, height: 656 };

export const PLAYER = {
  radius: 14,
  maxHp: 120,
  speed: 265,
  accel: 2600,
  friction: 6.5,
  fireRate: 3.6, // shots per second
  damage: 12,
  bulletSpeed: 640,
  bulletRadius: 5,
  bulletLife: 0.9,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 2.6,
  dashInvuln: 0.34,
  pickupRadius: 78,
  contactGrace: 0.6, // seconds of invulnerability after taking a hit
};

export const BULLET = { spread: 0.09 }; // radians between multishot projectiles

export const ORBIT = {
  radius: 62,
  speed: 3.4, // radians per second
  bladeRadius: 11,
  damage: 14,
  hitCooldown: 0.45, // seconds before the same blade can hurt the same enemy again
};

// Enemy roster. hp and speed scale a little with the wave; see enemies.js.
export const ENEMIES = {
  chaser:   { hp: 24,  speed: 92,  radius: 16, damage: 8,  xp: 1, score: 50,  color: '#ff4d6d' },
  speeder:  { hp: 15,  speed: 196, radius: 12, damage: 8,  xp: 1, score: 80,  color: '#ffb020' },
  splitter: { hp: 36,  speed: 72,  radius: 21, damage: 12, xp: 2, score: 120, color: '#b26bff' },
  mini:     { hp: 10,  speed: 128, radius: 9,  damage: 6,  xp: 1, score: 30,  color: '#d08cff' },
  shooter:  { hp: 19,  speed: 84,  radius: 14, damage: 8,  xp: 2, score: 110, color: '#3fd2ff' },
  boss:     { hp: 980, speed: 56,  radius: 48, damage: 22, xp: 0, score: 5000, color: '#ff2e88' },
};

export const SHOOTER = { range: 330, fireInterval: 2.3, shotSpeed: 250, shotRadius: 6, damage: 9 };
export const SPEEDER = { lungeInterval: 2.6, lungeSpeed: 430, lungeTime: 0.42 };
export const BOSS = {
  burstInterval: 3.1, // seconds between radial bullet bursts
  burstCount: 14,
  burstSpeed: 210,
  summonInterval: 7.5, // seconds between spawning two chasers
  enrageHp: 0.35, // below this fraction of hp the boss speeds up and bursts faster
};

// Waves: count grows, the mix shifts toward the nastier kinds.
export function waveComposition(wave) {
  const count = 4 + wave * 3;
  const mix = [];
  const push = (kind, weight) => { for (let i = 0; i < weight; i += 1) mix.push(kind); };
  push('chaser', 5);
  if (wave >= 2) push('speeder', 2 + Math.min(3, wave - 1));
  if (wave >= 3) push('splitter', 1 + Math.min(3, Math.floor(wave / 2)));
  if (wave >= 4) push('shooter', 1 + Math.min(3, Math.floor((wave - 1) / 2)));
  return { count, mix };
}

export const WAVE = {
  spawnInterval: 0.45, // seconds between spawns while a wave is trickling in
  bannerTime: 1.6, // seconds the "WAVE N" banner shows before spawning starts
  clearPause: 1.4, // seconds of calm after a wave is cleared
  bossWave: 10,
};

// Experience: dust motes dropped by enemies; level n needs this much to reach n+1.
export function xpNeeded(level) {
  return 8 + level * 6;
}

export const COMBO = { window: 3.0, scorePerKill: 1 };

export const PARTICLES = { max: 420, shakeMax: 14 };

// The eight level-up choices. Each entry: id, name, short line, and how it stacks.
export const UPGRADES = [
  { id: 'damage',   name: 'Overcharge Rounds',  desc: '+25% bullet damage',        max: 5 },
  { id: 'firerate', name: 'Rapid Cycler',       desc: '+20% fire rate',            max: 5 },
  { id: 'speed',    name: 'Ion Thrusters',      desc: '+12% move speed',           max: 5 },
  { id: 'vitality', name: 'Hull Plating',       desc: '+25 max hull, restore 25', max: 5 },
  { id: 'dash',     name: 'Blink Capacitor',    desc: '-25% dash cooldown',        max: 4 },
  { id: 'multishot',name: 'Split Barrel',       desc: '+1 projectile per shot',    max: 3 },
  { id: 'orbit',    name: 'Orbit Blades',       desc: '+1 orbiting light blade',   max: 3 },
  { id: 'magnet',   name: 'Dust Magnet',        desc: '+70% pickup radius',        max: 4 },
];

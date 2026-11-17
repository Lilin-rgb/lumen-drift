// All sound in Lumen Drift is synthesised with WebAudio: oscillators and filtered
// noise, no audio files. The audio context is created lazily on the first user
// gesture (or the first explicit unlock call), so the title screen stays silent
// until the player interacts, and screenshot mode never creates one.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  // A minor-key bass loop: A1, A1, C2, G1, one note per beat at 112 BPM.
  const BASS_LINE = [55.0, 55.0, 65.41, 49.0, 55.0, 55.0, 82.41, 73.42];
  const BEAT = 60 / 112;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    startMusic();
  }

  function startMusic() {
    if (!ctx || musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const freq = BASS_LINE[musicStep % BASS_LINE.length];
      musicStep += 1;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, t);
      filter.frequency.exponentialRampToValueAtTime(140, t + BEAT * 0.9);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + BEAT * 0.95);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(musicGain);
      osc.start(t);
      osc.stop(t + BEAT);
      // A soft hat tick on the off-beat keeps the pulse moving.
      if (musicStep % 2 === 0) tick(t + BEAT / 2, 0.05);
    }, BEAT * 1000);
  }

  function tick(when, volume) {
    const dur = 0.03;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(when);
  }

  function tone({ type = 'sine', from = 440, to = null, dur = 0.12, vol = 0.2, when = 0 }) {
    if (!ensure() || ctx.state !== 'running') return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.25, vol = 0.3, filterFreq = 1200, when = 0 }) {
    if (!ensure() || ctx.state !== 'running') return;
    const t = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  return {
    unlock,
    isMuted() { return muted; },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    shoot() { tone({ type: 'square', from: 880, to: 320, dur: 0.07, vol: 0.07 }); },
    enemyHit() { tone({ type: 'triangle', from: 220, to: 140, dur: 0.05, vol: 0.1 }); },
    enemyDie() {
      noise({ dur: 0.28, vol: 0.28, filterFreq: 900 });
      tone({ type: 'sawtooth', from: 180, to: 40, dur: 0.25, vol: 0.16 });
    },
    playerHit() {
      noise({ dur: 0.2, vol: 0.3, filterFreq: 700 });
      tone({ type: 'sawtooth', from: 140, to: 60, dur: 0.3, vol: 0.22 });
    },
    dash() { noise({ dur: 0.16, vol: 0.16, filterFreq: 2600 }); },
    pickup() { tone({ type: 'sine', from: 660, to: 990, dur: 0.09, vol: 0.1 }); },
    levelUp() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ type: 'sine', from: f, dur: 0.16, vol: 0.14, when: i * 0.07 }));
    },
    waveStart() {
      tone({ type: 'square', from: 330, to: 330, dur: 0.1, vol: 0.1 });
      tone({ type: 'square', from: 440, to: 440, dur: 0.12, vol: 0.1, when: 0.1 });
    },
    waveClear() {
      tone({ type: 'sine', from: 659.25, dur: 0.14, vol: 0.12 });
      tone({ type: 'sine', from: 987.77, dur: 0.2, vol: 0.12, when: 0.09 });
    },
    bossWarn() {
      [110, 110, 87.31].forEach((f, i) => tone({ type: 'sawtooth', from: f, to: f * 0.94, dur: 0.4, vol: 0.2, when: i * 0.28 }));
    },
    victory() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.3, vol: 0.15, when: i * 0.11 }));
    },
    gameOver() {
      [392, 311.13, 233.08, 174.61].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.35, vol: 0.16, when: i * 0.16 }));
    },
  };
}

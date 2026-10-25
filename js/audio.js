// 効果音（WebAudioで作る。音声ファイルなし）
let ctx = null, master = null, eng = null, muted = false;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.45; master.connect(ctx.destination);
  } catch (e) { ctx = null; }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.45;
  return muted;
}

export function beep(freq, dur = 0.15, type = 'square', vol = 0.18, slideTo = null) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

export function noise(dur = 0.3, vol = 0.25, freq = 1200) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master); src.start(t);
}

export const sfx = {
  menu: () => beep(660, 0.06, 'square', 0.06),
  select: () => { beep(660, 0.07, 'square', 0.08); setTimeout(() => beep(990, 0.09, 'square', 0.08), 60); },
  error: () => beep(220, 0.2, 'square', 0.1, 160),
  buy: () => { beep(1200, 0.06, 'square', 0.08); setTimeout(() => beep(1600, 0.12, 'square', 0.08), 70); },
  coin: () => { beep(1318, 0.06, 'square', 0.06); setTimeout(() => beep(1760, 0.14, 'square', 0.06), 60); },
  order: () => beep(880, 0.08, 'triangle', 0.08),
  ready: () => { beep(1046, 0.1, 'sine', 0.12); setTimeout(() => beep(1318, 0.18, 'sine', 0.12), 90); },
  pick: () => beep(600, 0.08, 'triangle', 0.1, 900),
  serve: () => { beep(784, 0.08, 'triangle', 0.12); setTimeout(() => beep(1046, 0.12, 'triangle', 0.12), 70); },
  cook: () => noise(0.35, 0.12, 2500),
  clean: () => noise(0.2, 0.1, 4000),
  angry: () => beep(300, 0.25, 'sawtooth', 0.06, 180),
  bell: () => [1046, 1318, 1568].forEach((f, i) => setTimeout(() => beep(f, 0.4, 'sine', 0.12), i * 120)),
  train: () => { beep(660, 0.5, 'sine', 0.08); setTimeout(() => beep(554, 0.6, 'sine', 0.08), 450); },
  fanfare: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.22, 'square', 0.1), i * 130)),
};

// ---------- BGM（コースごとのチップチューン） ----------
const SONGS = {
  prep: {
    bpm: 96, wave: 'triangle', leadVol: 0.08, kit: 'soft',
    roots: ['F2', 'D2', 'G2', 'C3'],
    melody: [
      'A4 - C5 - F5 - - - E5 - C5 - A4 - - -',
      'D5 - F5 - A5 - - - G5 - F5 - D5 - - -',
      'B4 - D5 - G5 - - - F5 - D5 - B4 - - -',
      'C5 - E5 - G5 - Bb5 - A5 - - - . . . .',
    ],
  },
  open: {
    bpm: 138, wave: 'square', leadVol: 0.045, kit: 'pop',
    roots: ['C3', 'A2', 'F2', 'G2'],
    melody: [
      'G5 . E5 . C5 - E5 - G5 - C6 - B5 - G5 -',
      'A5 . C6 . A5 - E5 - C5 - E5 - A5 - - -',
      'F5 . A5 . C6 - A5 - F5 - A5 - G5 - F5 -',
      'D5 - G5 - B5 - D6 - C6 - - - . . . .',
    ],
  },
  night: {
    bpm: 104, wave: 'sawtooth', leadVol: 0.03, kit: 'four',
    roots: ['A2', 'F2', 'C3', 'E2'],
    melody: [
      'E5 - - - A5 - C6 - B5 - A5 - E5 - - -',
      'F5 - - - A5 - C6 - E6 - D6 - C6 - - -',
      'G5 - - - C6 - E6 - D6 - C6 - G5 - - -',
      'G#5 - B5 - E6 - - - D6 - B5 - G#5 - - -',
    ],
  },
};
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freq(name) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  const n = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * Math.pow(2, (n - 69) / 12);
}
function compile(song) {
  const lead = [], bass = [];
  song.melody.forEach((bar, b) => {
    const tok = bar.trim().split(/\s+/);
    tok.forEach((t, i) => {
      if (t === '-' || t === '.') return;
      let len = 1;
      while (tok[i + len] === '-') len++;
      lead.push({ step: b * 16 + i, f: freq(t), len });
    });
    const r = freq(song.roots[b]);
    [0, 2, 4, 6, 8, 10, 12, 14].forEach((s, j) => bass.push({ step: b * 16 + s, f: r * [1, 1, 1.5, 1, 2, 1, 1.5, 1][j], len: 1.6 }));
  });
  return { ...song, lead, bass, len: song.melody.length * 16 };
}

let bgm = null, bgmGain = null;
export function bgmStart(id) {
  if (!ctx) return;
  bgmStop();
  const song = SONGS[id];
  if (!song) return;
  if (!bgmGain) { bgmGain = ctx.createGain(); bgmGain.gain.value = 0.7; bgmGain.connect(master); }
  const s = compile(song);
  bgm = { s, step: 0, next: ctx.currentTime + 0.1, stepDur: 60 / s.bpm / 4, rate: 1 };
  bgm.timer = setInterval(bgmTick, 25);
}
export function bgmRate(r) { if (bgm) bgm.rate = r; }
export function bgmStop() {
  if (!bgm) return;
  clearInterval(bgm.timer);
  bgm = null;
}
function bgmTick() {
  if (!bgm) return;
  const b = bgm;
  if (b.next < ctx.currentTime - 0.5) b.next = ctx.currentTime + 0.05;
  while (b.next < ctx.currentTime + 0.15) {
    playStep(b.s, b.step, b.next, b.stepDur / b.rate);
    b.next += b.stepDur / b.rate;
    b.step = (b.step + 1) % b.s.len;
  }
}
function tone(type, f, t, dur, vol, cutoff) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (cutoff) {
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff;
    o.connect(fl); fl.connect(g);
  } else o.connect(g);
  g.connect(bgmGain); o.start(t); o.stop(t + dur + 0.05);
}
function drum(kind, t) {
  if (kind === 'kick') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(bgmGain); o.start(t); o.stop(t + 0.2);
    return;
  }
  const dur = kind === 'hat' ? 0.04 : 0.12;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = kind === 'hat' ? 'highpass' : 'bandpass';
  f.frequency.value = kind === 'hat' ? 7000 : kind === 'tom' ? 400 : 1800;
  const g = ctx.createGain(); g.gain.value = kind === 'hat' ? 0.05 : 0.12;
  src.connect(f); f.connect(g); g.connect(bgmGain); src.start(t);
}
const KITS = {
  soft: { kick: [0, 10], hat: [4, 12], tom: [] },
  pop: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] },
  tabla: { kick: [0, 6, 8], snare: [12], tom: [3, 4, 10, 14], hat: [2, 7, 11] },
  four: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14, 15] },
  calypso: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [2, 3, 6, 10, 11, 14], tom: [7, 15] },
};
function playStep(s, step, t, sd) {
  for (const n of s.lead) if (n.step === step) tone(s.wave, n.f, t, n.len * sd * 0.95, s.leadVol, s.wave === 'sawtooth' ? 2200 : 0);
  for (const n of s.bass) if (n.step === step) tone('triangle', n.f, t, sd * n.len, 0.12);
  const kit = KITS[s.kit], i = step % 16;
  for (const k of Object.keys(kit)) if (kit[k].includes(i)) drum(k, t);
}

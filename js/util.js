// こまかい道具
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function pickWeighted(rnd, obj) {
  let sum = 0; for (const k in obj) sum += obj[k];
  let r = rnd() * sum;
  for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
  return Object.keys(obj)[0];
}
export function yen(n) {
  const s = Math.round(n).toLocaleString('ja-JP');
  return (n < 0 ? '-' : '') + '¥' + s.replace('-', '');
}
export function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
export function stars(r) {
  const full = Math.floor(r + 0.25), half = r - full >= 0.25 && r - full < 0.75;
  return '★'.repeat(Math.min(5, full)) + (half && full < 5 ? '☆' : '') + '・'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)));
}
export function hourText(h) {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
  return `${hh}:${String(mm).padStart(2, '0')}`;
}
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

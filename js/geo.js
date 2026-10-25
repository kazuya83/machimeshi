// 町とお店の位置関係（シミュレーションと見た目の両方で使う）
import { LOTS, LEVELS, KITCHEN_DEPTH, FURN } from './data.js';

export const STREET_HALF = 4; // 車道の半分の幅
export const WALK_Z = 5.5; // 歩道の真ん中
export const FRONT_Z = 7; // お店の正面
export const STREET_LEN = 78;

// ---------- 歩道のネットワーク ----------
const XS = [-78, -66, -50, -41, -32, -23, -14, -5.5, 5.5, 14, 23, 32, 41, 50, 66, 78];
const CROSS_ZS = [-70, -45, -25, -5.5, 5.5, 25, 45, 70];
export const NODES = [];
const nodeIndex = new Map();
function node(x, z) {
  const k = x + ',' + z;
  if (nodeIndex.has(k)) return nodeIndex.get(k);
  const id = NODES.length; NODES.push({ id, x, z, nb: [] }); nodeIndex.set(k, id); return id;
}
function link(a, b) { NODES[a].nb.push(b); NODES[b].nb.push(a); }
for (const side of [-1, 1]) {
  let prev = -1;
  for (const x of XS) { const n = node(x, side * WALK_Z); if (prev >= 0) link(prev, n); prev = n; }
}
for (const sx of [-1, 1]) {
  let prev = -1;
  for (const z of CROSS_ZS) { const n = node(sx * WALK_Z, z); if (prev >= 0) link(prev, n); prev = n; }
}
// 横断歩道
for (const x of [-66, -5.5, 5.5, 66]) link(node(x, -WALK_Z), node(x, WALK_Z));
export function nearestNode(x, z) {
  let best = 0, bd = 1e9;
  for (const n of NODES) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n.id; } }
  return best;
}
export function findPath(a, b) {
  if (a === b) return [a];
  const prev = new Map([[a, -1]]); const q = [a];
  while (q.length) {
    const c = q.shift();
    if (c === b) break;
    for (const n of NODES[c].nb) if (!prev.has(n)) { prev.set(n, c); q.push(n); }
  }
  if (!prev.has(b)) return [a];
  const out = []; for (let c = b; c !== -1; c = prev.get(c)) out.push(c);
  return out.reverse();
}
export const ENTRANCES = [
  { name: 'station', x: -78, z: -WALK_Z, w: 3 }, { name: 'station', x: -78, z: WALK_Z, w: 3 },
  { name: 'east', x: 78, z: -WALK_Z, w: 1 }, { name: 'east', x: 78, z: WALK_Z, w: 1 },
  { name: 'north', x: -WALK_Z, z: -70, w: 1 }, { name: 'north', x: WALK_Z, z: -70, w: 1 },
  { name: 'south', x: -WALK_Z, z: 70, w: 1 }, { name: 'south', x: WALK_Z, z: 70, w: 1 },
].map((e) => ({ ...e, node: node(e.x, e.z) }));
export const LOT_NODE = LOTS.map((l) => node(l.x, l.side * WALK_Z));

// ---------- お店の中の座標 ----------
// u: 通りから見て左右（右が+）、v: 正面からの奥行き
export function frame(shop) {
  const lot = LOTS[shop.lot];
  const L = LEVELS[shop.level];
  const s = lot.side; // -1 北側（正面は +z を向く）
  const fz = s * FRONT_Z;
  const toW = (u, v) => ({ x: lot.x + (s < 0 ? u : -u), z: fz + s * v });
  const W = L.W, D = L.D;
  const cols = Math.floor(W - 1), rows = Math.max(2, Math.floor(D - KITCHEN_DEPTH - 1.2));
  const passV = D - KITCHEN_DEPTH;
  const stoves = [];
  for (let i = 0; i < L.stoves; i++) {
    const u = -W / 2 + 1.1 + i * 1.5;
    stoves.push({ u, v: D - 0.65, ...toW(u, D - 0.65), stand: toW(u, D - 1.45) });
  }
  const nSlots = Math.max(2, Math.min(8, Math.floor((W - 3) / 0.8)));
  const slots = [];
  for (let i = 0; i < nSlots; i++) {
    const u = -W / 2 + 0.9 + i * 0.8;
    slots.push({ u, v: passV, ...toW(u, passV), front: toW(u, passV - 0.75), back: toW(u, passV + 0.7) });
  }
  const gapU = W / 2 - 0.75; // 厨房への入り口
  return {
    lot, L, side: s, W, D, cols, rows, passV, stoves, slots, toW,
    rot: s < 0 ? 0 : Math.PI, // お店の向き（正面が向いている方向）
    door: toW(0, 0.2), doorOut: toW(0, -1.2), walk: { x: lot.x, z: s * WALK_Z },
    gate: toW(gapU, passV), kitchenIdle: toW(gapU - 0.3, D - 1.6), hallIdle: toW(gapU - 1.2, passV - 1.0),
    // 座っている人が向く角度：正面(+v)が奥向き
    faceIn: s < 0 ? Math.PI : 0,
  };
}

// 行列の並び位置（歩道に3列）
export function queueSpot(f, i) {
  const row = Math.floor(i / 10), k = i % 10;
  const z = f.side * (4.5 + row * 0.85);
  const dir = f.lot.x < 0 ? 1 : -1; // 交差点の方へ伸ばさない
  return { x: f.lot.x + dir * (1.6 + k * 0.72), z };
}

// 家具の占めるマスと席の位置
export function furnSize(it) { const F = FURN[it.id]; return it.r ? { w: F.d, d: F.w } : { w: F.w, d: F.d }; }
export function cellsOf(f, it) {
  const { w, d } = furnSize(it);
  const i0 = Math.round(it.u + f.cols / 2 - w / 2), j0 = Math.round(it.v - 0.5 - d / 2);
  return { i0, j0, w, d };
}
export function snapItem(f, it, i0, j0) {
  const { w, d } = furnSize(it);
  return { ...it, u: -f.cols / 2 + i0 + w / 2, v: 0.5 + j0 + d / 2 };
}
export function layoutOk(f, layout) {
  const used = new Set();
  for (const it of layout) {
    const c = cellsOf(f, it);
    if (c.i0 < 0 || c.j0 < 0 || c.i0 + c.w > f.cols || c.j0 + c.d > f.rows) return false;
    for (let i = c.i0; i < c.i0 + c.w; i++) for (let j = c.j0; j < c.j0 + c.d; j++) {
      const k = i + ',' + j;
      if (used.has(k)) return false;
      used.add(k);
      // 入り口の前はあけておく
      const cu = -f.cols / 2 + i + 0.5;
      if (j === 0 && Math.abs(cu) < 0.9) return false;
    }
  }
  return true;
}
// 席（ローカル座標 → 世界座標）
const SEAT_DEF = {
  table2: [[0, -0.62, 0], [0, 0.62, Math.PI]],
  table4: [[-0.5, -0.95, 0], [0.5, -0.95, 0], [-0.5, 0.95, Math.PI], [0.5, 0.95, Math.PI]],
  booth: [[-0.5, -0.95, 0], [0.5, -0.95, 0], [-0.5, 0.95, Math.PI], [0.5, 0.95, Math.PI]],
  counter: [[-1, -0.45, 0], [0, -0.45, 0], [1, -0.45, 0]],
};
const PLATE_DEF = {
  table2: [[0, -0.22], [0, 0.22]],
  table4: [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]],
  booth: [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]],
  counter: [[-1, 0.2], [0, 0.2], [1, 0.2]],
};
export function seatsOf(f, layout) {
  const out = [];
  layout.forEach((it, idx) => {
    const sd = SEAT_DEF[it.id];
    if (!sd) return;
    sd.forEach(([a, b, face], k) => {
      // 家具のローカル（a: 横, b: 奥行き）→ お店のローカル
      const [pa, pb] = PLATE_DEF[it.id][k];
      const ru = it.r ? b : a, rv = it.r ? -a : b;
      const pu = it.r ? pb : pa, pv = it.r ? -pa : pb;
      const w = f.toW(it.u + ru, it.v + rv);
      const p = f.toW(it.u + pu, it.v + pv);
      // 座った人の向き：家具の中心を向く
      const c = f.toW(it.u, it.v);
      const rot = Math.atan2(c.x - w.x, c.z - w.z);
      out.push({ x: w.x, z: w.z, rot, px: p.x, pz: p.z, table: idx, face });
    });
  });
  return out;
}
export function seatCount(layout) {
  let n = 0; for (const it of layout) n += FURN[it.id]?.seats || 0; return n;
}
// 家具のローカル（a: 横, b: 奥行き）→ お店のローカル(u, v)
export function itemPoint(it, a, b) {
  return it.r ? { u: it.u + b, v: it.v - a } : { u: it.u + a, v: it.v + b };
}

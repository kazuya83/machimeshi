// 人の見た目（たくさんの人をまとめて描く）
import * as THREE from 'three';
import { rng } from './util.js';

const MAX = 260;
const SKIN = [0xf1c9a5, 0xe8b48f, 0xd59a6f, 0xf6d7bd, 0xc58a5c, 0x9a6440];
const HAIR = [0x1b1612, 0x2b1d14, 0x4a3020, 0x6b4a2e, 0x8a8a8a, 0xb07a40, 0x161616];
const OUTFIT = {
  worker: { top: [0x2b3442, 0x3b3f46, 0x1d2430, 0x4a4f57], bottom: [0x23272e, 0x2b2f36], hat: 0 },
  student: { top: [0xf4f4f0, 0xe8ecf2, 0x2d3a5c], bottom: [0x24304d, 0x2b2b38, 0x5a4a3a], hat: 0 },
  gourmet: { top: [0x7a2533, 0xd8c7a8, 0x3b2a4a, 0x111111], bottom: [0x2a2a2a, 0x6b5a48], hat: 0.1 },
  family: { top: [0xe56b5d, 0x5aa9e6, 0xf2c14e, 0x7bc67b, 0xffffff], bottom: [0x3b5b8a, 0x8a7a66, 0x2e4a6a], hat: 0 },
  relax: { top: [0xc7d8c2, 0xe9d5c3, 0xb8c9e0, 0xf2e2b0], bottom: [0x8a8070, 0xd8d0c0, 0x5a6a7a], hat: 0.15 },
  tourist: { top: [0xff6b6b, 0x4ecdc4, 0xffd93d, 0x6c5ce7, 0xff9f43], bottom: [0xe8dcc0, 0x4a6a8a, 0x2d3436], hat: 0.75 },
};

const _m = new THREE.Matrix4(), _base = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

function part(geo, mat) {
  const m = new THREE.InstancedMesh(geo, mat, MAX);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
  m.count = 0;
  for (let i = 0; i < MAX; i++) m.setColorAt(i, _c.set(0xffffff));
  return m;
}

export class Crowd {
  constructor(scene) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 });
    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
    const leg = cap(0.075, 0.68); leg.translate(0, -0.42, 0);
    const arm = cap(0.055, 0.5); arm.translate(0, -0.28, 0);
    const torso = cap(0.17, 0.36); torso.scale(1.3, 1, 0.78);
    const head = new THREE.SphereGeometry(0.115, 18, 14); head.scale(0.92, 1.05, 1);
    const hair = new THREE.SphereGeometry(0.125, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55); hair.scale(0.95, 1.05, 1.05); hair.translate(0, 0.0, -0.012);
    const hat = new THREE.CylinderGeometry(0.1, 0.11, 0.24, 14); hat.translate(0, 0.12, 0);
    const apron = new THREE.BoxGeometry(0.36, 0.55, 0.02); apron.translate(0, -0.05, 0.14);
    this.parts = {
      legL: part(leg, mat), legR: part(leg, mat), armL: part(arm, mat), armR: part(arm, mat),
      torso: part(torso, mat), head: part(head, mat), hair: part(hair, mat), hat: part(hat, mat), apron: part(apron, mat),
    };
    for (const p of Object.values(this.parts)) scene.add(p);
    this.info = new Map(); // id -> 見た目と歩きの状態
  }

  look(p) {
    let L = this.info.get(p.id);
    if (L) return L;
    const r = rng(p.look || p.id * 7919);
    const pick = (a) => a[Math.floor(r() * a.length)];
    const kind = p.kind;
    let top, bottom, hat = null, hatShape = 0, scale = 0.92 + r() * 0.14, apron = null;
    if (kind === 'cust') {
      const O = OUTFIT[p.type] || OUTFIT.family;
      top = pick(O.top); bottom = pick(O.bottom);
      if (r() < O.hat) { hat = pick([0xf2e6c8, 0xffffff, 0x2b2b2b, 0xd9534f, 0x3b7dd8]); hatShape = 1; }
      if (p.type === 'family' && r() < 0.35) scale = 0.62 + r() * 0.1;
      if (p.type === 'student') scale = 0.88 + r() * 0.1;
    } else if (kind === 'staff') {
      top = p.staff?.role === 'hall' ? 0xffffff : 0xf4f4f4; bottom = 0x222222;
      apron = p.staff?.role === 'hall' ? 0x2b2b2b : 0x5a3a28;
      if (p.staff?.role !== 'hall') { hat = 0xffffff; hatShape = 2; }
    } else {
      top = 0xffffff; bottom = 0x2b2b2b; hat = 0xffffff; hatShape = 3; apron = p.color ?? 0xff5a5a; scale = 1;
    }
    L = { skin: pick(SKIN), hair: pick(HAIR), top, bottom, hat, hatShape, scale, apron, phase: r() * 6, px: p.x, pz: p.z, x: p.x, z: p.z, rot: p.rot, swing: 0 };
    this.info.set(p.id, L);
    return L;
  }

  forget(id) { this.info.delete(id); }

  // list: { id, x, z, rot, pose, kind, type, look } の配列
  update(list, dt, t) {
    const P = this.parts;
    let i = 0;
    for (const p of list) {
      if (i >= MAX) break;
      const L = this.look(p);
      // 動いた距離で足を動かす
      const moved = Math.hypot(p.x - L.px, p.z - L.pz);
      L.px = p.x; L.pz = p.z;
      const walking = p.pose === 0 || p.pose === 4 || (p.pose == null && moved > 0.001);
      L.phase += moved * 4.2 / L.scale;
      L.swing += ((walking && moved > 0.0005 ? 1 : 0) - L.swing) * Math.min(1, dt * 10);
      const sw = Math.sin(L.phase) * 0.55 * L.swing;
      const sit = p.pose === 2, cook = p.pose === 3, carry = p.pose === 4 || p.carry;
      const s = L.scale;
      const y = sit ? -0.43 * s : Math.abs(Math.cos(L.phase)) * 0.03 * L.swing;
      _base.compose(_v.set(p.x, y, p.z), _q.setFromAxisAngle(_s.set(0, 1, 0), p.rot), _s.set(s, s, s));

      const set = (mesh, ox, oy, oz, rx, color, sx = 1, sy = 1, sz = 1) => {
        _m.compose(_v.set(ox, oy, oz), _q.setFromEuler(_e.set(rx, 0, 0)), _s.set(sx, sy, sz));
        _m.premultiply(_base);
        mesh.setMatrixAt(i, _m);
        if (color != null) mesh.setColorAt(i, _c.set(color));
      };
      const legA = sit ? -1.45 : sw;
      set(P.legL, -0.095, 0.9, 0, legA, L.bottom);
      set(P.legR, 0.095, 0.9, 0, sit ? -1.45 : -sw, L.bottom);
      const bob = cook ? Math.sin(t * 9 + L.phase) * 0.15 : 0;
      const armA = carry ? -1.35 : cook ? -1.0 + bob : sit ? -0.5 : -sw * 0.8;
      const armB = carry ? -1.35 : cook ? -1.0 - bob : sit ? -0.5 : sw * 0.8;
      set(P.armL, -0.25, 1.46, 0, armA, L.top);
      set(P.armR, 0.25, 1.46, 0, armB, L.top);
      set(P.torso, 0, 1.2, 0, sit ? -0.05 : 0.03, L.top);
      set(P.head, 0, 1.69, 0.01, 0, L.skin);
      set(P.hair, 0, 1.7, -0.005, -0.15, L.hair);
      if (L.hat != null) {
        if (L.hatShape === 1) set(P.hat, 0, 1.77, 0, -0.1, L.hat, 1.6, 0.35, 1.6);
        else if (L.hatShape === 2) set(P.hat, 0, 1.78, 0, 0, L.hat, 1.05, 0.7, 1.05);
        else set(P.hat, 0, 1.78, 0, 0, L.hat, 1.2, 1.15, 1.2);
      } else P.hat.setMatrixAt(i, HIDE);
      if (L.apron != null) set(P.apron, 0, 1.12, 0, 0, L.apron); else P.apron.setMatrixAt(i, HIDE);
      i++;
    }
    for (const m of Object.values(P)) {
      m.count = i;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}

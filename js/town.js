// 町の見た目（道路・歩道・駅・まわりのビル・木・街灯・車・電車）
import * as THREE from 'three';
import { TEX, textSprite } from './graphics.js';
import { LOTS } from './data.js';
import { rng } from './util.js';

const LOT_W = 14, LOT_D = 16;

export class Town {
  constructor(scene) {
    this.scene = scene;
    this.g = new THREE.Group(); scene.add(this.g);
    this.night = [];
    this.lampMats = [];
    this.cars = [];
    this.emptyLots = new Map();
    this.build();
  }

  mesh(geo, mat, x, y, z, opts = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = opts.cast ?? true; m.receiveShadow = opts.receive ?? true;
    if (opts.ry) m.rotation.y = opts.ry;
    (opts.parent || this.g).add(m);
    return m;
  }

  build() {
    const r = rng(42);
    // 地面
    const groundTex = TEX.sidewalk().clone(); groundTex.repeat.set(120, 120); groundTex.needsUpdate = true;
    const ground = this.mesh(new THREE.PlaneGeometry(480, 480), new THREE.MeshStandardMaterial({ color: 0x9d978c, map: groundTex, roughness: 0.95 }), 0, -0.02, 0, { cast: false });
    ground.rotation.x = -Math.PI / 2;

    // 道路
    const asph = (len, rep) => { const t = TEX.asphalt().clone(); t.repeat.set(rep, 2); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, color: 0x8a8a8a }); };
    const road1 = this.mesh(new THREE.PlaneGeometry(208, 8), asph(208, 52), 16, 0.005, 0, { cast: false }); road1.rotation.x = -Math.PI / 2;
    const road2 = this.mesh(new THREE.PlaneGeometry(240, 8), asph(240, 60), 0, 0.006, 0, { cast: false }); road2.rotation.x = -Math.PI / 2; road2.rotation.z = Math.PI / 2;
    // 白線
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.6 });
    const line = (x, z, w, d, m = white) => { const l = this.mesh(new THREE.PlaneGeometry(w, d), m, x, 0.012, z, { cast: false }); l.rotation.x = -Math.PI / 2; };
    for (let x = -86; x < 118; x += 6) if (Math.abs(x) > 9) line(x + 1.5, 0, 3, 0.15, yellow);
    for (let z = -118; z < 118; z += 6) if (Math.abs(z) > 9) line(0, z + 1.5, 0.15, 3, yellow);
    for (const sx of [-1, 1]) { line(16, sx * 3.75, 208, 0.12); line(sx * 3.75, 0, 0.12, 240); }
    // 横断歩道
    const zebra = (cx, cz, alongX) => {
      for (let k = -3; k <= 3; k++) {
        if (alongX) line(cx, cz + k * 1.05, 2.6, 0.5); else line(cx + k * 1.05, cz, 0.5, 2.6);
      }
    };
    zebra(-66, 0, true); zebra(66, 0, true); zebra(-5.5, 0, true); zebra(5.5, 0, true);
    zebra(0, -5.5, false); zebra(0, 5.5, false);
    // 停止線をかくすため交差点の中は黒く
    const box = this.mesh(new THREE.PlaneGeometry(8, 8), asph(8, 2), 0, 0.009, 0, { cast: false }); box.rotation.x = -Math.PI / 2;

    // 歩道（少し高い）
    const swTex = TEX.sidewalk();
    const swMat = (w, d) => { const t = swTex.clone(); t.repeat.set(w / 2, d / 2); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); };
    const curb = new THREE.MeshStandardMaterial({ color: 0xc9c4ba, roughness: 0.8 });
    const walk = (x0, x1, z0, z1) => {
      const w = x1 - x0, d = z1 - z0;
      this.mesh(new THREE.BoxGeometry(w, 0.14, d), swMat(w, d), (x0 + x1) / 2, 0.07, (z0 + z1) / 2, { cast: false });
    };
    for (const s of [-1, 1]) {
      walk(-88, -4, s < 0 ? -7 : 4, s < 0 ? -4 : 7);
      walk(4, 120, s < 0 ? -7 : 4, s < 0 ? -4 : 7);
      walk(s < 0 ? -7 : 4, s < 0 ? -4 : 7, -120, -7);
      walk(s < 0 ? -7 : 4, s < 0 ? -4 : 7, 7, 120);
    }
    // 縁石
    for (const s of [-1, 1]) {
      this.mesh(new THREE.BoxGeometry(84, 0.18, 0.18), curb, -46, 0.09, s * 4.05, { cast: false });
      this.mesh(new THREE.BoxGeometry(116, 0.18, 0.18), curb, 62, 0.09, s * 4.05, { cast: false });
      this.mesh(new THREE.BoxGeometry(0.18, 0.18, 113), curb, s * 4.05, 0.09, -63.5, { cast: false });
      this.mesh(new THREE.BoxGeometry(0.18, 0.18, 113), curb, s * 4.05, 0.09, 63.5, { cast: false });
    }

    // 区画の地面
    const pav = new THREE.MeshStandardMaterial({ color: 0xa8a297, roughness: 0.95, map: swTex });
    for (const L of LOTS) {
      const zc = L.side * (7 + LOT_D / 2);
      this.mesh(new THREE.BoxGeometry(LOT_W + 3.6, 0.1, LOT_D), pav, L.x, 0.05, zc, { cast: false });
      this.emptyLots.set(L.id, this.makeEmptyLot(L));
    }

    // まわりのビル
    this.buildings = [];
    const addBld = (x, z, w, d, h, seed) => {
      const t = TEX.windows(seed % 9).clone(); t.repeat.set(Math.max(1, w / 12), Math.max(1, h / 24)); t.needsUpdate = true;
      const tn = TEX.windowsNight(seed % 9).clone(); tn.repeat.copy(t.repeat); tn.needsUpdate = true;
      const mat = new THREE.MeshStandardMaterial({ map: t, emissiveMap: tn, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85, metalness: 0.05 });
      const top = new THREE.MeshStandardMaterial({ color: 0x77736e, roughness: 0.95 });
      const m = this.mesh(new THREE.BoxGeometry(w, h, d), [mat, mat, top, top, mat, mat], x, h / 2, z);
      this.night.push(mat);
      this.buildings.push(m);
      // 屋上の設備
      if (r() < 0.6) this.mesh(new THREE.BoxGeometry(w * 0.3, 1.6, d * 0.3), top, x + (r() - 0.5) * w * 0.4, h + 0.8, z + (r() - 0.5) * d * 0.4);
    };
    let seed = 1;
    for (const s of [-1, 1]) {
      // 区画の裏手
      for (let x = -112; x <= 112; x += 16) {
        if (Math.abs(x) < 10) continue;
        addBld(x + (r() - 0.5) * 2, s * (36 + r() * 6), 14 + r() * 3, 14 + r() * 6, 14 + r() * 26, seed++);
      }
      // 通りの両端（区画の外）
      for (const x of [-96, -80, 80, 96, 112]) {
        if (x === -96 || x === -80) continue; // 駅前広場
        addBld(x, s * 16, 14, 16, 10 + r() * 16, seed++);
      }
      // 交差する通りぞい
      for (let z = 30; z <= 112; z += 16) {
        addBld(s * (15 + r() * 2), z, 14, 14, 12 + r() * 30, seed++);
        addBld(s * (15 + r() * 2), -z, 14, 14, 12 + r() * 30, seed++);
      }
    }
    // 区画どうしのすき間（細い路地の塀）
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.95 });
    for (const L of LOTS) for (const dx of [-1, 1]) {
      const x = L.x + dx * (LOT_W / 2 + 1.8);
      if (Math.abs(x) < 7.5) continue;
      this.mesh(new THREE.BoxGeometry(0.25, 1.4, LOT_D - 2), wallMat, x, 0.7, L.side * (7 + LOT_D / 2 + 1));
    }

    this.buildStation();
    this.buildPark();
    this.buildTrees(r);
    this.buildLamps();
    this.buildCars(r);
  }

  makeEmptyLot(L) {
    const g = new THREE.Group();
    const zc = L.side * (7 + LOT_D / 2);
    const grass = TEX.grass().clone(); grass.repeat.set(4, 4); grass.needsUpdate = true;
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(LOT_W - 1, LOT_D - 2), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
    gm.rotation.x = -Math.PI / 2; gm.position.set(L.x, 0.11, zc); gm.receiveShadow = true; g.add(gm);
    const pole = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.6, roughness: 0.4 });
    const front = L.side * 8;
    for (let k = -3; k <= 3; k++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), pole);
      p.position.set(L.x + k * 2.1, 0.6, front); p.castShadow = true; g.add(p);
    }
    const rope = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: 0xf2c14e }));
    rope.position.set(L.x, 1.0, front); g.add(rope);
    const sign = textSprite(`売地 ${L.id + 1}  ¥${L.price.toLocaleString()}`, { size: 44, bg: 'rgba(255,255,255,0.92)', color: '#333', h: 0.8 });
    sign.position.set(L.x, 1.9, front); g.add(sign);
    this.g.add(g);
    return g;
  }
  setLotUsed(lotId, used) { const g = this.emptyLots.get(lotId); if (g) g.visible = !used; }

  buildStation() {
    const g = new THREE.Group(); this.g.add(g);
    const wall = new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.8, map: TEX.plaster('#e9e2d4') });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.55 });
    const roof = new THREE.MeshStandardMaterial({ color: 0x55606b, roughness: 0.6, metalness: 0.3 });
    // 駅舎
    this.mesh(new THREE.BoxGeometry(14, 9, 30), wall, -96, 4.5, 0, { parent: g });
    this.mesh(new THREE.BoxGeometry(0.3, 6, 18), glass, -88.9, 3.6, 0, { parent: g });
    this.mesh(new THREE.BoxGeometry(18, 0.6, 34), roof, -96, 9.3, 0, { parent: g });
    const name = textSprite('まちめし駅', { size: 64, color: '#ffffff', bg: 'rgba(30,60,110,0.95)', h: 1.6 });
    name.position.set(-88.6, 7.4, 0); g.add(name);
    // 駅前広場
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(14, 30), new THREE.MeshStandardMaterial({ color: 0xc8c0b2, map: TEX.tile('#cfc7b8'), roughness: 0.9 }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(-82, 0.15, 0); plaza.receiveShadow = true; g.add(plaza);
    // 線路
    const rail = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.35 });
    const ballast = new THREE.MeshStandardMaterial({ color: 0x5b5650, roughness: 1 });
    this.mesh(new THREE.BoxGeometry(6, 0.3, 300), ballast, -108, 0.15, 0, { parent: g, cast: false });
    for (const dx of [-0.75, 0.75]) this.mesh(new THREE.BoxGeometry(0.1, 0.15, 300), rail, -108 + dx, 0.38, 0, { parent: g, cast: false });
    // ホーム
    this.mesh(new THREE.BoxGeometry(4, 1.1, 60), new THREE.MeshStandardMaterial({ color: 0xbdb6aa, roughness: 0.9 }), -103.5, 0.55, 0, { parent: g });
    this.mesh(new THREE.BoxGeometry(4.5, 0.2, 50), roof, -103.5, 4.2, 0, { parent: g });
    // 電車
    const train = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.35, metalness: 0.2 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0x2e9e5b, roughness: 0.4 });
    const win = new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.1, metalness: 0.5, emissive: 0xffe7b0, emissiveIntensity: 0 });
    for (let c = 0; c < 4; c++) {
      const z = c * 20.5;
      const b = new THREE.Mesh(new THREE.BoxGeometry(3, 3.2, 20), body); b.position.set(0, 2.2, z); b.castShadow = true; train.add(b);
      const s = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.3, 20.02), stripe); s.position.set(0, 1.3, z); train.add(s);
      const w = new THREE.Mesh(new THREE.BoxGeometry(3.06, 1.0, 17), win); w.position.set(0, 2.6, z); train.add(w);
    }
    train.position.set(-108, 0, -400);
    g.add(train);
    this.train = { g: train, state: 'away', t: 0, win };
    this.night.push(win);
  }
  arriveTrain() {
    const T = this.train;
    if (T.state === 'away') { T.state = 'in'; T.t = 0; }
  }
  updateTrain(dt) {
    const T = this.train;
    T.t += dt;
    if (T.state === 'in') {
      const k = Math.min(1, T.t / 7);
      T.g.position.z = -220 + (1 - (1 - k) ** 3) * 190;
      if (k >= 1) { T.state = 'stop'; T.t = 0; }
    } else if (T.state === 'stop') {
      if (T.t > 9) { T.state = 'out'; T.t = 0; }
    } else if (T.state === 'out') {
      T.g.position.z = -30 + (T.t / 7) ** 2 * 260;
      if (T.t > 8) { T.state = 'away'; T.g.position.z = -400; }
    }
  }

  buildPark() {
    const g = new THREE.Group(); this.g.add(g);
    const grass = TEX.grass().clone(); grass.repeat.set(8, 8); grass.needsUpdate = true;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(26, 34), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
    p.rotation.x = -Math.PI / 2; p.position.set(93, 0.03, 0); p.receiveShadow = true; g.add(p);
    const stone = new THREE.MeshStandardMaterial({ color: 0xbab3a6, roughness: 0.8 });
    const water = new THREE.MeshStandardMaterial({ color: 0x5aa0c8, roughness: 0.05, metalness: 0.3 });
    this.mesh(new THREE.CylinderGeometry(4, 4.3, 0.7, 32), stone, 93, 0.35, 0, { parent: g });
    this.mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.1, 32), water, 93, 0.66, 0, { parent: g, cast: false });
    this.mesh(new THREE.CylinderGeometry(0.4, 0.6, 1.8, 16), stone, 93, 1.2, 0, { parent: g });
    this.mesh(new THREE.CylinderGeometry(1.4, 0.4, 0.3, 16), stone, 93, 2.2, 0, { parent: g });
  }

  buildTrees(r) {
    const spots = [];
    for (const L of LOTS) for (const dx of [-1, 1]) {
      const x = L.x + dx * 9;
      if (Math.abs(x) > 6.5) spots.push([x, L.side * 6.3]);
    }
    for (let z = 12; z < 110; z += 10) for (const s of [-1, 1]) { spots.push([s * 6.3, z]); spots.push([s * 6.3, -z]); }
    for (let k = 0; k < 14; k++) spots.push([84 + r() * 18, (r() - 0.5) * 30]);
    const n = spots.length;
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 1 }), n);
    const leafGeo = new THREE.IcosahedronGeometry(1.4, 1);
    const leaf = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), n * 3);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    spots.forEach(([x, z], i) => {
      const s = 0.85 + r() * 0.4;
      m.makeScale(s, s, s).setPosition(x, 1.3 * s, z); trunk.setMatrixAt(i, m);
      for (let k = 0; k < 3; k++) {
        const ss = s * (0.8 + r() * 0.4);
        m.makeScale(ss, ss * 0.9, ss).setPosition(x + (r() - 0.5) * 0.9, (2.8 + k * 0.7) * s, z + (r() - 0.5) * 0.9);
        leaf.setMatrixAt(i * 3 + k, m);
        leaf.setColorAt(i * 3 + k, c.setHSL(0.25 + r() * 0.07, 0.45, 0.25 + r() * 0.1));
      }
    });
    trunk.castShadow = leaf.castShadow = true; leaf.receiveShadow = true;
    this.g.add(trunk, leaf);
  }

  buildLamps() {
    const spots = [];
    for (let x = -86; x <= 114; x += 14) if (Math.abs(x) > 8) for (const s of [-1, 1]) spots.push([x, s * 4.45, s]);
    for (let z = 14; z <= 112; z += 14) for (const s of [-1, 1]) { spots.push([s * 4.45, z, 0]); spots.push([s * 4.45, -z, 0]); }
    const n = spots.length;
    const poleM = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.6, roughness: 0.4 });
    const bulbM = new THREE.MeshStandardMaterial({ color: 0xfff4d8, emissive: 0xffd890, emissiveIntensity: 0 });
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 5, 8), poleM, n);
    const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), bulbM, n);
    const m = new THREE.Matrix4();
    spots.forEach(([x, z], i) => {
      m.makeTranslation(x, 2.5, z); pole.setMatrixAt(i, m);
      m.makeTranslation(x, 5, z); head.setMatrixAt(i, m);
    });
    pole.castShadow = true;
    this.g.add(pole, head);
    this.lampMats.push(bulbM);
    // 道を照らす光（少しだけ）
    this.streetLights = [];
    for (const x of [-50, -14, 14, 50]) {
      const l = new THREE.PointLight(0xffd8a0, 0, 26, 1.6); l.position.set(x, 4.8, 0); this.g.add(l); this.streetLights.push(l);
    }
  }

  buildCars(r) {
    const colors = [0xc0392b, 0xf2f2f2, 0x2c3e50, 0x7f8c8d, 0x2980b9, 0xf1c40f, 0x111111];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const paint = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], metalness: 0.5, roughness: 0.3 });
      const glass = new THREE.MeshStandardMaterial({ color: 0x1b2430, metalness: 0.6, roughness: 0.1 });
      const tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
      const light = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 0 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4.2), paint); b.position.y = 0.65; b.castShadow = true; g.add(b);
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.3), glass); c.position.set(0, 1.25, -0.2); c.castShadow = true; g.add(c);
      for (const [x, z] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 14), tire); w.rotation.z = Math.PI / 2; w.position.set(x, 0.34, z); g.add(w);
      }
      for (const x of [-0.6, 0.6]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.05), light); h.position.set(x, 0.75, 2.11); g.add(h); }
      this.lampMats.push(light);
      const lane = i % 2 ? 1 : -1; // 左側通行
      const onCross = i >= 5;
      this.cars.push({ g, lane, onCross, pos: r() * 240 - 120, speed: 7 + r() * 4 });
      this.g.add(g);
    }
  }
  updateCars(dt) {
    for (const c of this.cars) {
      c.pos += c.speed * dt * c.lane;
      const lo = c.onCross ? -125 : -84;
      if (c.pos > 125) c.pos = lo; if (c.pos < lo) c.pos = 125;
      if (c.onCross) { c.g.position.set(-c.lane * 1.9, 0, c.pos); c.g.rotation.y = c.lane > 0 ? 0 : Math.PI; }
      else { c.g.position.set(c.pos, 0, c.lane * 1.9); c.g.rotation.y = c.lane > 0 ? Math.PI / 2 : -Math.PI / 2; }
    }
  }

  update(dt, night) {
    this.updateCars(dt);
    this.updateTrain(dt);
    const lit = THREE.MathUtils.smoothstep(night, 0.3, 0.8);
    for (const m of this.night) m.emissiveIntensity = lit * 1.1;
    for (const m of this.lampMats) m.emissiveIntensity = lit * 3;
    for (const l of this.streetLights) l.intensity = lit * 40;
  }
}

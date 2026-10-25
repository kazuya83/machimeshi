// お店の見た目（建物・内装・厨房・家具・料理）
import * as THREE from 'three';
import { GENRE, FURN, FLOORS, WALLS, KITCHEN_DEPTH, PLAYER_COLORS } from './data.js';
import { frame, furnSize, seatsOf } from './geo.js';
import { TEX, textSprite } from './graphics.js';
import { recipeOf } from './sim.js';

const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });
const MAT = {
  wood: M({ color: 0x8a5a36, map: TEX.wood('#8a5a36') }),
  lightWood: M({ color: 0xc89a68, map: TEX.wood('#c89a68') }),
  darkWood: M({ color: 0x4a3020, map: TEX.wood('#4a3020') }),
  steel: M({ color: 0xc9ccd0, metalness: 0.85, roughness: 0.28 }),
  darkSteel: M({ color: 0x3b3f45, metalness: 0.7, roughness: 0.4 }),
  black: M({ color: 0x1a1a1a, roughness: 0.4 }),
  piano: M({ color: 0x0b0b0b, roughness: 0.12, metalness: 0.2 }),
  white: M({ color: 0xf4f4f2, roughness: 0.5 }),
  fabric: M({ color: 0x7a2533, roughness: 0.95 }),
  fabric2: M({ color: 0x2f4f6f, roughness: 0.95 }),
  leaf: M({ color: 0x3f7a3a, roughness: 0.8, flatShading: true }),
  pot: M({ color: 0xb8673e, roughness: 0.9 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xdbeef7, roughness: 0.04, metalness: 0, transmission: 0, transparent: true, opacity: 0.18, depthWrite: false }),
  water: M({ color: 0x3a8fc8, roughness: 0.05, transparent: true, opacity: 0.55 }),
  frame: M({ color: 0x2b2b2b, metalness: 0.6, roughness: 0.35 }),
  kitchenFloor: M({ color: 0x9a9a96, map: TEX.tile('#a8a8a4'), roughness: 0.6 }),
  roof: M({ color: 0x6f6a66, map: TEX.roof(), roughness: 0.9 }),
  lampShade: M({ color: 0xfff1d0, emissive: 0xffd890, emissiveIntensity: 0.4 }),
  fire: M({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 2.5 }),
  burnerOff: M({ color: 0x222222, metalness: 0.5, roughness: 0.5 }),
  ceramic: M({ color: 0xfafafa, roughness: 0.3 }),
  dirty: M({ color: 0xe8e2d6, roughness: 0.6 }),
  progBg: new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.7, depthTest: false }),
  progFg: new THREE.MeshBasicMaterial({ color: 0x5ce07a, depthTest: false }),
};

function box(w, h, d, mat, x, y, z, parent, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
}
function cyl(rt, rb, h, mat, x, y, z, parent, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function tex(mat, rep) { const t = mat.map.clone(); t.repeat.set(rep[0], rep[1]); t.needsUpdate = true; return t; }

// ---------- 家具 ----------
function chair(g, a, b, face, mat) {
  const c = new THREE.Group(); c.position.set(a, 0, -b); c.rotation.y = face; g.add(c);
  box(0.42, 0.05, 0.42, mat, 0, 0.45, 0, c);
  for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(0.04, 0.45, 0.04, mat, x, 0.225, z, c);
  box(0.42, 0.45, 0.04, mat, 0, 0.7, -0.2, c);
}
function table(g, w, d, mat, top) {
  box(w, 0.05, d, top || mat, 0, 0.74, 0, g);
  for (const [x, z] of [[-w / 2 + 0.06, -d / 2 + 0.06], [w / 2 - 0.06, -d / 2 + 0.06], [-w / 2 + 0.06, d / 2 - 0.06], [w / 2 - 0.06, d / 2 - 0.06]]) box(0.05, 0.72, 0.05, mat, x, 0.36, z, g);
}
export function buildFurniture(id) {
  const g = new THREE.Group();
  switch (id) {
    case 'table2':
      table(g, 0.8, 0.75, MAT.darkWood, MAT.lightWood);
      chair(g, 0, -0.62, 0, MAT.darkWood); chair(g, 0, 0.62, Math.PI, MAT.darkWood);
      break;
    case 'table4':
      table(g, 1.5, 0.95, MAT.darkWood, MAT.lightWood);
      for (const a of [-0.5, 0.5]) { chair(g, a, -0.95, 0, MAT.darkWood); chair(g, a, 0.95, Math.PI, MAT.darkWood); }
      break;
    case 'counter': {
      box(2.9, 1.0, 0.5, MAT.darkWood, 0, 0.5, -0.3, g);
      box(3.0, 0.06, 0.62, MAT.lightWood, 0, 1.02, -0.3, g);
      for (const a of [-1, 0, 1]) { cyl(0.2, 0.2, 0.06, MAT.fabric, a, 0.68, 0.45, g); cyl(0.04, 0.04, 0.66, MAT.steel, a, 0.33, 0.45, g, 8); cyl(0.2, 0.22, 0.03, MAT.steel, a, 0.02, 0.45, g); }
      break;
    }
    case 'booth': {
      table(g, 1.5, 0.85, MAT.darkWood, MAT.lightWood);
      for (const s of [-1, 1]) {
        const z = s * 0.98;
        box(1.7, 0.45, 0.55, MAT.fabric, 0, 0.23, z, g);
        box(1.7, 0.75, 0.15, MAT.fabric, 0, 0.75, z + s * 0.25, g);
        box(1.75, 0.1, 0.62, MAT.darkWood, 0, 0.02, z, g);
      }
      break;
    }
    case 'plant': {
      cyl(0.22, 0.16, 0.4, MAT.pot, 0, 0.2, 0, g);
      for (let k = 0; k < 6; k++) {
        const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), MAT.leaf);
        l.position.set(Math.cos(k) * 0.15, 0.6 + k * 0.12, Math.sin(k * 2) * 0.15); l.scale.set(1, 1.4, 1); l.castShadow = true; g.add(l);
      }
      break;
    }
    case 'lamp': {
      cyl(0.18, 0.2, 0.04, MAT.black, 0, 0.02, 0, g); cyl(0.025, 0.025, 1.5, MAT.black, 0, 0.77, 0, g, 8);
      const s = cyl(0.14, 0.24, 0.32, MAT.lampShade, 0, 1.6, 0, g); s.userData.glow = true;
      break;
    }
    case 'shelf': {
      box(1.8, 1.8, 0.4, MAT.wood, 0, 0.9, -0.25, g);
      for (let k = 0; k < 4; k++) for (let j = 0; j < 5; j++) {
        const c = new THREE.Color().setHSL(Math.random(), 0.5, 0.45);
        cyl(0.05, 0.05, 0.25, M({ color: c, roughness: 0.2 }), -0.7 + j * 0.35, 0.3 + k * 0.42, -0.2, g, 8);
      }
      break;
    }
    case 'aquarium': {
      box(1.8, 0.8, 0.6, MAT.darkWood, 0, 0.4, -0.15, g);
      box(1.7, 0.75, 0.5, MAT.water, 0, 1.2, -0.15, g, false);
      box(1.74, 0.79, 0.54, MAT.glass, 0, 1.2, -0.15, g, false);
      for (let k = 0; k < 5; k++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M({ color: [0xff7a1a, 0xffd23f, 0x4fc3ff][k % 3], emissive: 0x331100 }));
        f.scale.set(1.8, 1, 0.6); f.position.set(-0.6 + k * 0.3, 1.0 + (k % 3) * 0.15, -0.15); f.userData.fish = k; g.add(f);
      }
      break;
    }
    case 'piano': {
      const b = box(1.5, 0.35, 1.6, MAT.piano, 0, 0.85, -0.1, g);
      box(1.4, 0.05, 0.25, MAT.white, 0, 0.9, 0.8, g);
      for (const [x, z] of [[-0.6, 0.6], [0.6, 0.6], [0, -0.8]]) box(0.1, 0.7, 0.1, MAT.piano, x, 0.35, z, g);
      const lid = box(1.45, 0.03, 1.55, MAT.piano, -0.3, 1.3, -0.1, g); lid.rotation.z = 0.5;
      box(0.8, 0.45, 0.35, MAT.piano, 0, 0.23, 1.25, g);
      b.castShadow = true;
      break;
    }
  }
  return g;
}

// ---------- 料理 ----------
const dishCache = new Map();
export function buildDish(R, eaten = false) {
  const key = (R?.id || 'x') + (eaten ? '_e' : '');
  if (!dishCache.has(key)) {
    const g = new THREE.Group();
    const [c1, c2] = R?.col || [0xdddddd, 0xffffff];
    const food = M({ color: c1, roughness: 0.55 }), top = M({ color: c2, roughness: 0.5 });
    switch (R?.base) {
      case 'bowl':
        cyl(0.13, 0.08, 0.1, eaten ? MAT.dirty : M({ color: 0x8a1c14, roughness: 0.3 }), 0, 0.05, 0, g);
        if (!eaten) { cyl(0.12, 0.12, 0.01, food, 0, 0.095, 0, g); cyl(0.05, 0.05, 0.012, top, 0.03, 0.1, 0.02, g); }
        break;
      case 'cup':
        cyl(0.11, 0.11, 0.01, MAT.ceramic, 0, 0.005, 0, g);
        cyl(0.05, 0.045, 0.1, eaten ? MAT.ceramic : MAT.ceramic, 0, 0.06, 0, g);
        if (!eaten) cyl(0.046, 0.046, 0.005, food, 0, 0.108, 0, g);
        break;
      case 'sushi':
        box(0.3, 0.04, 0.14, MAT.lightWood, 0, 0.02, 0, g);
        if (!eaten) for (const x of [-0.08, 0.08]) { box(0.1, 0.04, 0.05, MAT.ceramic, x, 0.06, 0, g); box(0.11, 0.015, 0.055, food, x, 0.088, 0, g); }
        break;
      case 'bun':
        cyl(0.15, 0.15, 0.01, MAT.ceramic, 0, 0.005, 0, g);
        if (!eaten) {
          const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), food); b1.position.y = 0.075; g.add(b1);
          cyl(0.075, 0.075, 0.025, top, 0, 0.05, 0, g); cyl(0.075, 0.07, 0.03, food, 0, 0.025, 0, g);
        }
        break;
      case 'grill':
        cyl(0.14, 0.14, 0.02, MAT.ceramic, 0, 0.01, 0, g);
        if (!eaten) for (let k = 0; k < 3; k++) { const m = box(0.09, 0.012, 0.05, food, -0.06 + k * 0.06, 0.03, (k % 2) * 0.03, g); m.rotation.y = k * 0.4; }
        break;
      case 'cake':
        cyl(0.13, 0.13, 0.01, MAT.ceramic, 0, 0.005, 0, g);
        if (!eaten) { cyl(0.06, 0.06, 0.07, food, 0, 0.045, 0, g); const s = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), top); s.position.y = 0.09; g.add(s); }
        break;
      default:
        cyl(0.15, 0.13, 0.02, MAT.ceramic, 0, 0.01, 0, g);
        if (!eaten) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), food); m.scale.y = 0.5; m.position.y = 0.02; g.add(m); cyl(0.05, 0.05, 0.02, top, 0.04, 0.04, 0.02, g); }
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    dishCache.set(key, g);
  }
  return dishCache.get(key).clone();
}

// ---------- 看板 ----------
function signTexture(shop) {
  const G = GENRE[shop.genre];
  const c = document.createElement('canvas'); c.width = 1024; c.height = 192;
  const x = c.getContext('2d');
  x.fillStyle = G.sign; x.fillRect(0, 0, 1024, 192);
  x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 8; x.strokeRect(10, 10, 1004, 172);
  x.font = '110px sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'left';
  x.fillText(G.icon, 30, 100);
  x.fillStyle = '#fff8e8'; x.font = 'bold 96px "M PLUS Rounded 1c", "Hiragino Mincho ProN", serif';
  const name = shop.name;
  let fs = 96; while (fs > 40) { x.font = `bold ${fs}px "M PLUS Rounded 1c", sans-serif`; if (x.measureText(name).width < 820) break; fs -= 6; }
  x.textAlign = 'center'; x.fillText(name, 580, 100);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ---------- お店 ----------
export class ShopView {
  constructor(scene, shop) {
    this.scene = scene;
    this.g = new THREE.Group();
    scene.add(this.g);
    this.dyn = new THREE.Group(); this.g.add(this.dyn);
    this.dishes = new Map();
    this.build(shop);
  }
  dispose() { this.scene.remove(this.g); }

  build(shop) {
    this.shop = shop;
    const key = JSON.stringify([shop.lot, shop.level, shop.layout, shop.floor, shop.wall, shop.name, shop.genre, shop.perm, shop.color]);
    if (key === this.key) return;
    this.key = key;
    if (this.body) this.g.remove(this.body);
    const f = this.f = frame(shop);
    this.seats = seatsOf(f, shop.layout);
    const b = this.body = new THREE.Group();
    b.position.set(f.lot.x, 0.1, f.side * 7);
    b.rotation.y = f.rot;
    this.g.add(b);
    this.roofs = []; this.glows = []; this.fires = []; this.fish = [];
    this.interact = [];
    const { W, D } = f, H = 3.4, G = GENRE[shop.genre];
    const stall = shop.level === 1;

    // 床
    const FL = FLOORS.find((x) => x.id === shop.floor) || FLOORS[0];
    let floorMat;
    if (FL.id === 'wood') floorMat = M({ map: tex({ map: TEX.wood('#9a6b43') }, [W / 3, D / 3]), roughness: 0.6 });
    else if (FL.id === 'tile') floorMat = M({ map: tex({ map: TEX.tile('#e6e2da') }, [W / 3, D / 3]), roughness: 0.35 });
    else if (FL.id === 'dark') floorMat = M({ map: tex({ map: TEX.wood('#4a3326') }, [W / 3, D / 3]), roughness: 0.5 });
    else if (FL.id === 'check') floorMat = M({ map: tex({ map: TEX.tile('#222222', true) }, [W / 2, D / 2]), roughness: 0.35 });
    else floorMat = M({ map: tex({ map: TEX.marble() }, [W / 4, D / 4]), roughness: 0.15, metalness: 0.05 });
    const dining = box(W, 0.06, f.passV, floorMat, 0, 0.03, -f.passV / 2, b, false);
    dining.userData.floor = true;
    this.floorMesh = dining;
    box(W, 0.06, KITCHEN_DEPTH, MAT.kitchenFloor, 0, 0.03, -(f.passV + KITCHEN_DEPTH / 2), b, false);

    // 壁
    const WL = WALLS.find((x) => x.id === shop.wall) || WALLS[0];
    let wallMat;
    if (WL.id === 'brick') wallMat = M({ map: tex({ map: TEX.brick('#a0523a') }, [D / 4, H / 4]), roughness: 0.9 });
    else if (WL.id === 'wood') wallMat = M({ map: tex({ map: TEX.wood('#8a5a36') }, [D / 3, H / 3]), roughness: 0.7 });
    else wallMat = M({ map: tex({ map: TEX.plaster('#' + new THREE.Color(WL.color).getHexString()) }, [2, 2]), roughness: 0.9 });
    const outer = M({ color: G.wall, map: TEX.plaster('#' + new THREE.Color(G.wall).getHexString()), roughness: 0.9 });

    if (stall) {
      // 屋台：厨房の上に屋根、まわりはオープン
      for (const sx of [-1, 1]) for (const v of [f.passV - 0.2, D - 0.1]) cyl(0.06, 0.06, 2.6, MAT.wood, sx * (W / 2 - 0.1), 1.3, -v, b, 8);
      const canopy = box(W + 0.6, 0.12, KITCHEN_DEPTH + 1.2, M({ color: G.awning, roughness: 0.8 }), 0, 2.65, -(f.passV + KITCHEN_DEPTH / 2) + 0.3, b);
      canopy.rotation.x = -0.12;
      this.roofs.push(canopy);
      // のれん
      const noren = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.2, 0.7), M({ color: G.awning, side: THREE.DoubleSide, roughness: 0.95 }));
      noren.position.set(-0.4, 2.15, -f.passV + 0.25); b.add(noren);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.75, W * 0.75 * 0.1875), M({ map: signTexture(shop), emissiveMap: signTexture(shop), emissive: 0xffffff, emissiveIntensity: 0.1 }));
      sign.position.set(0, 3.05, -f.passV + 0.4); b.add(sign); this.glows.push({ m: sign.material, k: 0.9 });
      // 木の床（屋台の客席）
      box(W, 0.02, f.passV, MAT.lightWood, 0, 0.07, -f.passV / 2, b, false).visible = false;
      // 提灯
      for (const sx of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), M({ color: 0xff3b2f, emissive: 0xff5a20, emissiveIntensity: 0.2 }));
        l.scale.y = 1.3; l.position.set(sx * (W / 2 - 0.4), 2.2, -f.passV + 0.5); b.add(l); this.glows.push({ m: l.material, k: 2 });
      }
    } else {
      box(W, H, 0.2, wallMat, 0, H / 2, -D, b);
      for (const sx of [-1, 1]) box(0.2, H, D, wallMat, sx * W / 2, H / 2, -D / 2, b);
      // 外側の壁（横と後ろ）
      box(W + 0.4, H + 0.6, 0.1, outer, 0, (H + 0.6) / 2, -D - 0.15, b);
      for (const sx of [-1, 1]) box(0.1, H + 0.6, D, outer, sx * (W / 2 + 0.15), (H + 0.6) / 2, -D / 2, b);
      // 正面：ガラス張り（中が見える）
      for (const sx of [-1, 1]) {
        const w = W / 2 - 0.95;
        const gl = box(w, H - 0.6, 0.05, MAT.glass, sx * (0.95 + w / 2), (H - 0.6) / 2, 0, b, false);
        gl.renderOrder = 2;
        box(0.08, H - 0.6, 0.12, MAT.frame, sx * 0.95, (H - 0.6) / 2, 0, b);
        box(0.08, H - 0.6, 0.12, MAT.frame, sx * W / 2, (H - 0.6) / 2, 0, b);
        box(w, 0.4, 0.14, outer, sx * (0.95 + w / 2), 0.2, 0, b);
      }
      // 正面の上（看板）
      const band = box(W + 0.4, 0.9, 0.3, outer, 0, H - 0.15, 0.05, b);
      band.userData.facade = true;
      const st = signTexture(shop);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, W * 0.8 * 0.1875), M({ map: st, emissiveMap: st, emissive: 0xffffff, emissiveIntensity: 0.1, roughness: 0.4 }));
      sign.position.set(0, H - 0.1, 0.22); b.add(sign); this.glows.push({ m: sign.material, k: 0.9 });
      // ひさし
      const aw = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.06, 1.3), M({ color: G.awning, roughness: 0.85 }));
      aw.position.set(0, H - 0.75, 0.75); aw.rotation.x = 0.28; aw.castShadow = true; b.add(aw);
      // 屋根
      const roof = box(W + 0.6, 0.3, D + 0.4, MAT.roof, 0, H + 0.6, -D / 2, b);
      this.roofs.push(roof);
      // 2階建て・高級店
      if (shop.level >= 4) {
        const up = new THREE.Group(); b.add(up); this.roofs.push(up);
        box(W + 0.4, 3.2, D * 0.85, outer, 0, H + 2.35, -D * 0.5, up);
        for (let k = 0; k < Math.floor(W / 2.2); k++) {
          const w = box(1.3, 1.6, 0.05, M({ color: 0x223040, roughness: 0.1, metalness: 0.4, emissive: 0xffd890, emissiveIntensity: 0 }), -W / 2 + 1.4 + k * 2.2, H + 2.4, -D * 0.075 + 0.05, up);
          this.glows.push({ m: w.material, k: 0.8 });
        }
        box(W + 0.8, 0.3, D * 0.85 + 0.4, MAT.roof, 0, H + 4.1, -D * 0.5, up);
      }
      if (shop.level >= 5) {
        const gold = M({ color: 0xd4af37, metalness: 0.9, roughness: 0.25 });
        for (const sx of [-1, 1]) cyl(0.18, 0.2, H, M({ color: 0xf4efe6, roughness: 0.4 }), sx * (W / 2 + 0.2), H / 2, 0.35, b);
        box(W + 0.5, 0.08, 0.34, gold, 0, H - 0.62, 0.08, b);
        // 赤いじゅうたん
        box(1.6, 0.02, 3, M({ color: 0x9e1b2f, roughness: 0.95 }), 0, 0.01, 1.6, b, false);
      }
      // 天井の照明
      for (let k = 0; k < Math.max(2, Math.floor(W / 3)); k++) {
        const u = -W / 2 + (k + 0.5) * W / Math.max(2, Math.floor(W / 3));
        const l = cyl(0.25, 0.3, 0.12, MAT.lampShade, u, H - 0.3, -f.passV / 2, b);
        cyl(0.01, 0.01, 0.3, MAT.black, u, H - 0.1, -f.passV / 2, b, 4);
        l.castShadow = false;
      }
      this.light = new THREE.PointLight(0xffe2b0, 0, W * 1.6, 1.5);
      this.light.position.set(0, H - 0.5, -f.passV / 2); b.add(this.light);
    }

    // 厨房
    box(W - 0.4, 0.9, 0.7, MAT.steel, 0, 0.45, -(D - 0.55), b);
    f.stoves.forEach((s, i) => {
      const st = new THREE.Group(); st.position.set(s.u, 0.9, -s.v); b.add(st);
      box(0.9, 0.06, 0.6, MAT.darkSteel, 0, 0.03, 0, st);
      const fires = [];
      for (const x of [-0.2, 0.2]) {
        const burner = cyl(0.12, 0.12, 0.02, MAT.burnerOff, x, 0.07, 0, st);
        const fire = cyl(0.11, 0.06, 0.06, MAT.fire, x, 0.1, 0, st); fire.visible = false; fires.push(fire);
      }
      const pot = cyl(0.16, 0.14, 0.2, MAT.steel, -0.2, 0.2, 0, st);
      this.fires.push({ fires, pot });
      if (!stall) { const hood = box(1.0, 0.4, 0.7, MAT.steel, 0, 1.4, -0.05, st); hood.castShadow = false; }
      const hit = box(0.9, 1.2, 0.9, new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 0.3, st, false);
      hit.userData.act = { k: 'stove', i };
      this.interact.push(hit);
    });
    // 冷蔵庫とシンク
    box(0.8, 1.9, 0.7, MAT.steel, W / 2 - 0.6, 0.95, -(D - 0.55), b);
    // 受け取り口（カウンター）
    const passLen = W - 1.7;
    box(passLen, 1.0, 0.5, stall ? MAT.wood : MAT.darkWood, -W / 2 + passLen / 2, 0.5, -f.passV, b);
    box(passLen + 0.1, 0.05, 0.62, MAT.lightWood, -W / 2 + passLen / 2, 1.02, -f.passV, b);
    f.slots.forEach((s, i) => {
      const hit = box(0.7, 1.2, 1.6, new THREE.MeshBasicMaterial({ visible: false }), s.u, 0.6, -s.v, b, false);
      hit.userData.act = { k: 'slot', i };
      this.interact.push(hit);
    });

    // 家具
    this.furn = [];
    shop.layout.forEach((it, idx) => {
      const m = buildFurniture(it.id);
      m.position.set(it.u, 0.06, -it.v);
      m.rotation.y = it.r ? -Math.PI / 2 : 0;
      m.traverse((o) => { if (o.userData.glow) this.glows.push({ m: o.material, k: 1.2 }); if (o.userData.fish != null) this.fish.push(o); });
      m.userData.item = idx;
      b.add(m); this.furn.push(m);
    });

    // 看板（宣伝）
    if (shop.perm.signboard) {
      const sb = new THREE.Group(); sb.position.set(W / 2 - 1, 0, 1.6); b.add(sb);
      cyl(0.06, 0.06, 2.6, MAT.darkSteel, 0, 1.3, 0, sb, 8);
      const st = signTexture(shop);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 2.4), [M({ map: st }), M({ map: st }), MAT.black, MAT.black, MAT.black, MAT.black]);
      p.position.y = 2.4; p.castShadow = true; sb.add(p);
      const icon = textSprite(G.icon, { size: 80, h: 0.9 }); icon.position.set(0, 3.2, 0); sb.add(icon);
    }
    if (shop.perm.neon) {
      const neon = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 8, 40), M({ color: 0xff4fa3, emissive: 0xff2f8f, emissiveIntensity: 0.3 }));
      neon.position.set(stall ? 0 : -W / 2 + 1.2, stall ? 3.6 : H + 0.9, stall ? -f.passV + 0.4 : 0.25); b.add(neon);
      this.glows.push({ m: neon.material, k: 4 });
      const t2 = textSprite('OPEN', { size: 60, color: '#ffe0f0', stroke: '#ff2f8f', h: 0.5 }); t2.position.copy(neon.position); b.add(t2);
    }
    // オーナーの色の旗
    if (!shop.cpu) {
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), M({ color: PLAYER_COLORS[shop.color % 4], side: THREE.DoubleSide }));
      flag.position.set(-W / 2 + 0.3, stall ? 3.1 : H + 0.4, 0.4); b.add(flag);
    }

    // 編集用のマス目
    this.grid = new THREE.Group(); this.grid.visible = false; b.add(this.grid);
    const gm = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    const pts = [];
    for (let i = 0; i <= f.cols; i++) { const u = -f.cols / 2 + i; pts.push(new THREE.Vector3(u, 0.08, -0.5), new THREE.Vector3(u, 0.08, -(0.5 + f.rows))); }
    for (let j = 0; j <= f.rows; j++) { const v = 0.5 + j; pts.push(new THREE.Vector3(-f.cols / 2, 0.08, -v), new THREE.Vector3(f.cols / 2, 0.08, -v)); }
    this.grid.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), gm));
    this.b = b;
    this.dishes.clear(); this.dyn.clear();
    this.body.updateMatrixWorld(true);
  }

  // 編集中の家具（半透明）
  setGhost(it, ok) {
    if (this.ghost) { this.b.remove(this.ghost); this.ghost = null; }
    if (!it) return;
    const g = buildFurniture(it.id);
    g.traverse((o) => { if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ color: ok ? 0x5ce07a : 0xff5a5a, transparent: true, opacity: 0.5, depthWrite: false }); o.castShadow = false; } });
    g.position.set(it.u, 0.08, -it.v); g.rotation.y = it.r ? -Math.PI / 2 : 0;
    this.b.add(g); this.ghost = g;
  }
  highlightItem(idx) {
    this.furn?.forEach((m, i) => m.traverse((o) => { if (o.isMesh && o.material.emissive) { if (i === idx) { o.userData.oe ??= o.material.emissive.getHex(); } } }));
    if (this.sel) { this.b.remove(this.sel); this.sel = null; }
    if (idx == null || !this.shop.layout[idx]) return;
    const it = this.shop.layout[idx];
    const { w, d } = furnSize(it);
    const sel = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.35, depthWrite: false }));
    sel.rotation.x = -Math.PI / 2; sel.position.set(it.u, 0.09, -it.v);
    this.b.add(sel); this.sel = sel;
  }

  // 毎フレーム：料理・火・照明
  update(dyn, people, t, night, showRoof) {
    for (const r of this.roofs) r.visible = showRoof;
    const lit = THREE.MathUtils.smoothstep(night, 0.2, 0.7);
    for (const gl of this.glows) gl.m.emissiveIntensity = 0.08 + lit * gl.k;
    if (this.light) this.light.intensity = 1.5 + lit * 12;
    for (const fz of this.fish) fz.position.x = Math.sin(t * 0.6 + fz.userData.fish * 1.7) * 0.65;
    if (!dyn) { this.fires.forEach((s) => s.fires.forEach((x) => (x.visible = false))); this.clearDishes(); return; }
    const f = this.f;
    const busy = new Set();
    for (const o of dyn.orders) if (o.state === 'cook' && o.stove != null) busy.add(o.stove);
    this.fires.forEach((s, i) => {
      const on = busy.has(i);
      s.fires.forEach((x) => { x.visible = on; x.scale.y = 0.8 + Math.sin(t * 20 + i) * 0.3; });
      s.pot.position.y = 0.2 + (on ? Math.abs(Math.sin(t * 12 + i)) * 0.02 : 0);
    });
    // 料理の位置
    const want = new Map();
    const R = (rid) => recipeOf(this.shop, rid);
    for (const o of dyn.orders) {
      if (o.state === 'ready' && o.slot != null) { const s = f.slots[o.slot]; if (s) want.set('o' + o.id, { rid: o.rid, x: s.x, y: 1.15, z: s.z }); }
      else if (o.state === 'served' && o.seat != null) {
        const seat = this.seats?.[o.seat];
        if (seat) want.set('o' + o.id, { rid: o.rid, x: seat.px, y: 0.88, z: seat.pz });
      } else if (o.state === 'cook' && o.stove != null) {
        // 作っているあいだの進み具合
        want.set('p' + o.id, { prog: o.prog, x: f.stoves[o.stove].x, y: 2.3, z: f.stoves[o.stove].z });
      }
    }
    if (this.seats) dyn.dirty.forEach((d, i) => { if ((d & 1) && this.seats[i]) want.set('d' + i, { rid: null, dirty: true, x: this.seats[i].px, y: 0.88, z: this.seats[i].pz }); });
    // 運んでいる料理
    for (const p of people) {
      if (p.carry == null || p.shop !== this.shop.owner) continue;
      want.set('c' + p.id, { rid: p.carry, x: p.x + Math.sin(p.rot) * 0.42, y: 1.12, z: p.z + Math.cos(p.rot) * 0.42 });
    }
    for (const [k, m] of this.dishes) if (!want.has(k)) { this.dyn.remove(m); this.dishes.delete(k); }
    for (const [k, w] of want) {
      let m = this.dishes.get(k);
      if (!m) {
        if (w.prog != null) {
          m = new THREE.Group();
          const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.14), MAT.progBg); bg.renderOrder = 20; m.add(bg);
          const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.1), MAT.progFg); fg.renderOrder = 21; fg.position.z = 0.001; m.add(fg);
          m.userData.fg = fg;
        } else m = buildDish(w.dirty ? null : R(w.rid), !!w.dirty);
        this.dyn.add(m); this.dishes.set(k, m);
      }
      m.position.set(w.x, w.y + 0.1, w.z);
      if (w.prog != null) {
        const fg = m.userData.fg; const p = Math.min(1, w.prog);
        fg.scale.x = Math.max(0.01, p); fg.position.x = -0.43 * (1 - p);
        m.quaternion.copy(this.camQuat || m.quaternion);
      }
    }
  }
  clearDishes() { for (const m of this.dishes.values()) this.dyn.remove(m); this.dishes.clear(); }
}

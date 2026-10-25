// 光・空・影・光のにじみと、時間による明るさの変化、画質の切り替え
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// 画質：2 きれい / 1 ふつう / 0 軽い
export const GFX = { q: 2 };
try {
  const s = localStorage.getItem('mm-gfx');
  GFX.q = s != null ? +s : (/Mobi|Android|iPhone|iPad/.test(navigator.userAgent) ? 1 : 2);
} catch (e) { /* 既定 */ }
export const GFX_NAMES = ['軽い', 'ふつう', 'きれい'];

export function createGraphics(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.3, 900);

  const pm = new THREE.PMREMGenerator(renderer);
  const envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  scene.environment = envTex;

  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x5a5040, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.4;
  const sc = sun.shadow.camera; sc.near = 5; sc.far = 400;
  scene.add(sun, sun.target);

  const sky = new Sky();
  sky.scale.setScalar(1500);
  const u = sky.material.uniforms;
  u.turbidity.value = 3; u.rayleigh.value = 1.2; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8;
  scene.add(sky);
  scene.fog = new THREE.Fog(0xcfd8e6, 120, 420);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.25, 0.4, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const sunDir = new THREE.Vector3();
  const G = {
    renderer, scene, camera, sun, hemi, sky, bloom, composer, night: 0,
    // 時刻（6〜22時）で空と光を変える
    setHour(h) {
      // 太陽の高さ：6時 0度 → 12時 60度 → 19時 0度
      const elev = h < 12.5 ? (h - 6) / 6.5 * 62 : 62 - (h - 12.5) / 6.5 * 64;
      const az = 90 + (h - 6) / 13 * 180;
      sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - Math.max(elev, 4)), THREE.MathUtils.degToRad(az));
      u.sunPosition.value.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(az));
      const day = THREE.MathUtils.smoothstep(elev, -6, 14); // 1 昼 0 夜
      const dusk = Math.max(0, 1 - Math.abs(elev - 4) / 12) * (h > 14 ? 1 : 0.4);
      G.night = 1 - day;
      sun.intensity = 0.15 + 2.5 * day;
      sun.color.setRGB(1, 0.95 - dusk * 0.35, 0.86 - dusk * 0.5);
      hemi.intensity = 0.25 + 0.75 * day;
      hemi.color.setRGB(0.55 + 0.35 * day, 0.6 + 0.32 * day, 0.85 + 0.1 * day);
      renderer.toneMappingExposure = GFX.q >= 1 ? 0.55 + 0.1 * (1 - day) : 1.0;
      scene.environment = day > 0.2 ? envTex : envTex;
      scene.environmentIntensity = 0.25 + 0.75 * day;
      const fogC = new THREE.Color().setRGB(0.81 * day + 0.06, 0.85 * day + 0.07, 0.9 * day + 0.14);
      if (dusk > 0) fogC.lerp(new THREE.Color(0xf0a070), dusk * 0.35);
      scene.fog.color.copy(fogC);
      bloom.strength = 0.18 + 0.55 * (1 - day);
      bloom.threshold = 0.85 - 0.25 * (1 - day);
      if (GFX.q === 0 || elev < -2) scene.background = fogC.clone();
      else scene.background = null;
      sky.visible = GFX.q > 0 && elev >= -2;
    },
    // 影はカメラの見ているところだけ細かく
    follow(x, z, size) {
      const s = Math.max(30, size);
      sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.updateProjectionMatrix();
      sun.target.position.set(x, 0, z);
      sun.position.set(x + sunDir.x * 200, sunDir.y * 200, z + sunDir.z * 200);
    },
    applyQuality() {
      renderer.shadowMap.enabled = GFX.q >= 1;
      sun.castShadow = GFX.q >= 1;
      sun.shadow.mapSize.set(GFX.q === 2 ? 4096 : 2048, GFX.q === 2 ? 4096 : 2048);
      sun.shadow.map?.dispose(); sun.shadow.map = null;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, GFX.q === 2 ? 1.75 : GFX.q === 1 ? 1.25 : 1));
      renderer.setSize(innerWidth, innerHeight);
      composer.setSize(innerWidth, innerHeight);
      scene.traverse((o) => { if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true; });
    },
    cycleQuality() {
      GFX.q = (GFX.q + 2) % 3;
      try { localStorage.setItem('mm-gfx', GFX.q); } catch (e) { /* 続行 */ }
      G.applyQuality();
      return GFX_NAMES[GFX.q];
    },
    render() {
      if (GFX.q === 2) composer.render();
      else renderer.render(scene, camera);
    },
    resize() {
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    },
  };
  G.applyQuality();
  G.setHour(10);
  addEventListener('resize', () => G.resize());
  return G;
}

// ---------- 布や床の模様（画像ファイルなしで作る） ----------
const texCache = new Map();
export function canvasTex(key, w, h, draw, rep = [1, 1]) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  texCache.set(key, t);
  return t;
}
function noise(x, w, h, base, amt, n = 4000, size = 2) {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = Math.random() * amt - amt / 2;
    x.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    x.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}
export const TEX = {
  asphalt: () => canvasTex('asphalt', 256, 256, (x, w, h) => noise(x, w, h, '#4a4c50', 0.18, 9000, 2)),
  sidewalk: () => canvasTex('sidewalk', 256, 256, (x, w, h) => {
    noise(x, w, h, '#b9b3a8', 0.12, 5000, 2);
    x.strokeStyle = 'rgba(70,60,50,0.35)'; x.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); }
  }),
  brick: (col = '#9c4f38') => canvasTex('brick' + col, 256, 256, (x, w, h) => {
    x.fillStyle = '#d6cfc4'; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 16; r++) for (let c = -1; c < 5; c++) {
      const off = r % 2 ? 32 : 0;
      const shade = 0.85 + Math.random() * 0.3;
      const base = new THREE.Color(col).multiplyScalar(shade);
      x.fillStyle = '#' + base.getHexString();
      x.fillRect(c * 64 + off + 2, r * 16 + 2, 60, 12);
    }
  }),
  wood: (col = '#9a6b43') => canvasTex('wood' + col, 256, 256, (x, w, h) => {
    for (let i = 0; i < 8; i++) {
      const base = new THREE.Color(col).multiplyScalar(0.85 + Math.random() * 0.3);
      x.fillStyle = '#' + base.getHexString(); x.fillRect(0, i * 32, w, 32);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, i * 32, w, 1.5);
      for (let k = 0; k < 30; k++) { x.fillStyle = `rgba(60,30,10,${Math.random() * 0.12})`; x.fillRect(Math.random() * w, i * 32 + Math.random() * 32, 30 + Math.random() * 60, 1); }
      x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(Math.random() * w, i * 32, 1.5, 32);
    }
  }),
  tile: (col = '#e6e2da', dark = false) => canvasTex('tile' + col + dark, 256, 256, (x, w, h) => {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      x.fillStyle = dark && (r + c) % 2 ? '#f2f0ea' : col;
      x.fillRect(c * 64, r * 64, 64, 64);
    }
    x.strokeStyle = 'rgba(0,0,0,0.15)'; x.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); }
  }),
  marble: () => canvasTex('marble', 256, 256, (x, w, h) => {
    noise(x, w, h, '#efede8', 0.05, 3000, 3);
    x.strokeStyle = 'rgba(120,120,130,0.25)';
    for (let i = 0; i < 12; i++) { x.lineWidth = Math.random() * 2; x.beginPath(); x.moveTo(Math.random() * w, 0); x.bezierCurveTo(Math.random() * w, h / 3, Math.random() * w, h * 2 / 3, Math.random() * w, h); x.stroke(); }
  }),
  plaster: (col = '#f1e6d2') => canvasTex('plaster' + col, 128, 128, (x, w, h) => noise(x, w, h, col, 0.06, 2500, 2)),
  grass: () => canvasTex('grass', 256, 256, (x, w, h) => noise(x, w, h, '#5d7f3a', 0.22, 12000, 2)),
  roof: () => canvasTex('roof', 128, 128, (x, w, h) => {
    noise(x, w, h, '#6f6a66', 0.12, 3000, 2);
  }),
  windows: (seed) => canvasTex('win' + seed, 256, 512, (x, w, h) => {
    const r = mulberry(seed);
    const base = ['#c9c1b5', '#a9a49c', '#d8cdbb', '#8f8a84', '#b8aa98', '#e0d9cc'][Math.floor(r() * 6)];
    noise(x, w, h, base, 0.08, 2500, 2);
    for (let fl = 0; fl < 8; fl++) for (let c = 0; c < 4; c++) {
      const lit = r() < 0.35;
      x.fillStyle = lit ? '#2a3240' : '#1d2430';
      x.fillRect(c * 64 + 12, fl * 64 + 14, 40, 38);
      x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(c * 64 + 12, fl * 64 + 14, 40, 6);
    }
  }),
  windowsNight: (seed) => canvasTex('winN' + seed, 256, 512, (x, w, h) => {
    const r = mulberry(seed);
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    for (let fl = 0; fl < 8; fl++) for (let c = 0; c < 4; c++) {
      if (r() < 0.45) { x.fillStyle = ['#ffd890', '#fff0c8', '#ffe2a8'][Math.floor(r() * 3)]; x.fillRect(c * 64 + 12, fl * 64 + 14, 40, 38); }
    }
  }),
};
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// 文字や絵を描いたスプライト
export function textSprite(text, opt = {}) {
  const fs = opt.size || 48;
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  x.font = `bold ${fs}px "M PLUS Rounded 1c", sans-serif`;
  const w = Math.ceil(x.measureText(text).width) + fs;
  c.width = w; c.height = fs * 1.6;
  x.font = `bold ${fs}px "M PLUS Rounded 1c", sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (opt.bg) { x.fillStyle = opt.bg; x.beginPath(); x.roundRect(2, 2, w - 4, c.height - 4, fs * 0.5); x.fill(); }
  if (opt.stroke) { x.lineWidth = fs * 0.16; x.strokeStyle = opt.stroke; x.strokeText(text, w / 2, c.height / 2); }
  x.fillStyle = opt.color || '#fff';
  x.fillText(text, w / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: opt.depthTest ?? true, transparent: true }));
  const h = opt.h || 0.6;
  s.scale.set(h * w / c.height, h, 1);
  return s;
}

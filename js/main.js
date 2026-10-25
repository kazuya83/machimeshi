// みんなでまちめし 本体：画面の流れ・ロビー・通信・操作・カメラ
import * as THREE from 'three';
import { GENRE, LEVELS, LOTS, PREP_TIME, OPEN_TIME, MAX_PLAYERS, PLAYER_COLORS, FURN, buzzName, OPEN_HOUR, START_CAPITAL } from './data.js';
import { createGraphics, GFX_NAMES, GFX, textSprite } from './graphics.js';
import { Town } from './town.js';
import { ShopView } from './shopview.js';
import { Crowd } from './people.js';
import { World, newTown, newShop, makeCpuShop, freeLots, awayEarnings, contextOf, POSE, recipeOf, playerOf, walletOf, shopsOf, openBranch, closeBranch, bankrupt } from './sim.js';
import { frame, layoutOk, snapItem, seatsOf, furnSize } from './geo.js';
import { Net, makeCode } from './net.js';
import { Store } from './save.js';
import * as A from './audio.js';
import { Prep, renderResult, renderRanking, Rank, renderSetup, Setup } from './ui.js';
import { yen, stars, hourText, clamp, esc } from './util.js';

const $ = (id) => document.getElementById(id);
const LS = Store.local;
const PARAMS = new URLSearchParams(location.search);
const RESULT_WAIT = 25; // 結果を見てから次の日が始まるまで（秒）
const SPEED = Math.max(1, Math.min(20, +PARAMS.get('speed') || 1)); // 動作確認用の早送り

// ---------- 描画の準備 ----------
const GX = createGraphics($('view'));
const { scene, camera } = GX;
const town3d = new Town(scene);
const crowd = new Crowd(scene);
const views = new Map(); // owner -> ShopView
const raycaster = new THREE.Raycaster();

// ---------- ゲームの状態 ----------
const G = {
  name: LS.get('mm-name', ''), me: null, isHost: false, net: null, code: '', online: false,
  town: null, world: null,
  players: new Map(), // pid -> { pid, name, ready, online }
  phase: 'title', phaseT: 0,
  dyn: null, // いまの町の動き（人・注文）
  ppl: new Map(), // 子：人の位置（なめらかに動かす）
  avatarsInfo: {}, // owner -> { carry, cook }
  summary: null,
  shopVer: {},
  me3d: { x: -70, z: 5.5, rot: Math.PI / 2, moving: false, path: [], pendingAct: null },
  cam: { yaw: 0, dist: 16, tDist: 16, mode: 'follow', cine: false, cineT: 0, tx: 0, tz: 0 },
  keys: new Set(),
  reqId: 1, pending: new Map(),
  today: {},
  lastSave: '',
  hp: 100, hurtT: 0, stunT: 0, // 体力（車にひかれると減る）
  cur: null, // いま自分が立っているお店（2店目・3店目もある）
  auto: LS.get('mm-auto', '0') === '1', autoT: 0, autoPause: 0,
};
// 自分のお店の一覧と、いま働いているお店
function myShops() { return G.town ? shopsOf(G.town.shops, G.me).filter((s) => !s.closing) : []; }
function curKey() {
  const sh = G.town?.shops; if (!sh) return G.me;
  if (G.cur && sh[G.cur] && !sh[G.cur].cpu && playerOf(sh[G.cur]) === G.me) return G.cur;
  return sh[G.me] ? G.me : (myShops()[0]?.owner ?? G.me);
}
function myWallet() { const s = G.town?.shops[curKey()]; return s ? walletOf(G.town.shops, s) : null; }

// ---------- 画面 ----------
function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
}
function hideScreens() { document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active')); }
let toastTimer = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function overlay(html) { $('overlay-text').innerHTML = html; $('overlay').classList.remove('hidden'); }
function setHUD(on) { $('hud').classList.toggle('hidden', !on); }

// ---------- 起動 ----------
(async function boot() {
  $('in-name').value = G.name;
  await Store.init();
  G.me = Store.uid;
  updateLogin();
  $('loading').classList.add('hide');
  show('title');
  G.phase = 'title';
  if (PARAMS.get('room')) { $('in-code').value = PARAMS.get('room').toUpperCase(); if (G.name) show('join'); }
  requestAnimationFrame(loop);
})();

function updateLogin() {
  const s = $('login-state');
  if (Store.mode !== 'cloud') { s.textContent = 'いまはこのブラウザの中に保存します'; $('btn-google').classList.add('hidden'); return; }
  $('btn-google').classList.toggle('hidden', Store.google);
  s.textContent = Store.google ? `Googleでログイン中（${Store.displayName}）：どの端末からでも続きができます` : 'クラウドに保存します。Googleでログインすると、ほかの端末からも続きができます';
}

function checkName() {
  const v = $('in-name').value.trim().slice(0, 8);
  if (!v) { $('title-err').textContent = 'なまえを入れてね'; return false; }
  G.name = v; LS.set('mm-name', v); $('title-err').textContent = '';
  return true;
}

// ---------- ボタン ----------
document.addEventListener('click', async (e) => {
  A.initAudio();
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  A.sfx.menu();
  switch (act) {
    case 'new': if (checkName()) { show('new'); $('in-town').value = ''; } break;
    case 'towns': if (checkName()) showTowns(); break;
    case 'gojoin': if (checkName()) show('join'); break;
    case 'howto': show('howto'); break;
    case 'back': show('title'); break;
    case 'google':
      try { await Store.loginGoogle(); G.me = Store.uid; updateLogin(); toast('ログインしました'); }
      catch (er) { $('title-err').textContent = 'ログインできませんでした：' + (er.code || er.message); }
      break;
    case 'create': createTown(); break;
    case 'dojoin': doJoin(); break;
    case 'copy': copyInvite(); break;
    case 'leave': leaveRoom(); break;
    case 'start': if (G.isHost) hostStartDay(); else G.net?.toHost({ k: 'start' }); break;
    case 'open-shop': openMyShop(); break;
    case 'ranking': case 'rank': showRanking(); break;
    case 'close': $('modal').classList.add('hidden'); G.restartOpen = false; break;
    case 'ok': $('overlay').classList.add('hidden'); break;
    case 'next': if (G.isHost) hostNextDay(); else G.net?.toHost({ k: 'next' }); break;
    case 'endday': hostBackToLobby(); break;
    case 'zoom': toggleTownView(); break;
    case 'nextshop': nextShop(); break;
    case 'cine': G.cam.cine = !G.cam.cine; toast(G.cam.cine ? '宣伝カメラ（もう一度押すと戻る）' : 'ふつうのカメラ'); break;
    case 'gfx': toast('画質：' + GX.cycleQuality()); break;
    case 'mute': b.textContent = A.toggleMute() ? '🔇' : '🔊'; break;
    case 'menu': showRanking(true); break;
    case 'load': hostOpenTown(b.dataset.id); break;
    case 'del':
      if (confirm('この町を消しますか？（もとに戻せません）')) { await Store.deleteTown(b.dataset.id); showTowns(); }
      break;
  }
});
document.addEventListener('click', (e) => {
  const inName = () => (document.querySelector('#modal:not(.hidden) #in-shop') || $('in-shop'))?.value || '';
  const g = e.target.closest('[data-genre]'); if (g) { Setup.genre = g.dataset.genre; Setup.name = inName(); renderLobby(); if (G.restartOpen) showRestart(); }
  const l = e.target.closest('[data-lot]'); if (l) { Setup.lot = +l.dataset.lot; Setup.name = inName(); renderLobby(); if (G.restartOpen) showRestart(); }
  const rs = e.target.closest('[data-rs]'); if (rs) { Rank.scope = rs.dataset.rs; showRanking(); }
  const rt = e.target.closest('[data-rt]'); if (rt) { Rank.tab = rt.dataset.rt; showRanking(); }
});
$('prep').addEventListener('click', (e) => Prep.click(e));
$('prep-toggle').addEventListener('click', () => { $('prep').classList.remove('hidden'); $('prep-toggle').classList.add('hidden'); });
$('btn-ready').addEventListener('click', () => {
  const p = G.players.get(G.me); const r = !(p && p.ready);
  if (G.isHost) { setReady(G.me, r); } else G.net.toHost({ k: 'ready', ready: r });
  if (r) { $('prep').classList.add('hidden'); $('prep-toggle').classList.remove('hidden'); }
});

// ---------- 町の一覧 ----------
async function showTowns() {
  show('towns');
  const box = $('town-list');
  box.innerHTML = '<p class="note">読みこみ中…</p>';
  const list = await Store.listTowns();
  if (!list.length) { box.innerHTML = '<p class="note">まだ町がありません。「新しい町をつくる」から始めよう！</p>'; return; }
  box.innerHTML = list.map((t) => {
    const mine = t.shops.find((s) => s.owner === G.me);
    return `<div class="town-card"><div class="tc-main"><b>${esc(t.name)}</b> <span class="note">${t.day}日目 ・にぎわい ${Math.round(t.buzz)}「${buzzName(t.buzz)}」</span>
      <div class="shops">${t.shops.map((s) => `${GENRE[s.genre].icon}${esc(s.name)}${s.cpu ? '' : `（${esc(s.ownerName)}）`} ★${s.rating.toFixed(1)}`).join(' ／ ')}</div>
      ${mine ? `<div class="note">自分のお店：${esc(mine.name)} ・所持金 ${yen(mine.money)} ・のべ ${mine.totalCust}人</div>` : ''}</div>
      <button class="btn primary" data-act="load" data-id="${t.id}">この町を開く</button><button class="btn" data-act="del" data-id="${t.id}">消す</button></div>`;
  }).join('');
}

// ---------- 町をつくる・開く（親） ----------
async function createTown() {
  const name = $('in-town').value.trim() || 'まちめし町';
  const t = newTown(name);
  t.host = G.me;
  await startHosting(t);
}
async function hostOpenTown(id) {
  const t = await Store.loadTown(id);
  if (!t) { toast('町を読みこめませんでした'); return; }
  // 留守のあいだの売上
  const now = Date.now();
  for (const s of Object.values(t.shops)) {
    s.lastSeen = t.lastPlayed;
    const e = awayEarnings(t, s, now);
    if (e) { walletOf(t.shops, s).money += e.earn; s.stats.totalCust += e.cust; s.stats.totalSales += e.earn; s.away = e; }
  }
  t.lastPlayed = now;
  await startHosting(t);
}

async function startHosting(t) {
  G.isHost = true; G.town = t; G.world = new World(t);
  G.players = new Map([[G.me, { pid: G.me, name: G.name, ready: false, online: true }]]);
  G.code = t.code || makeCode();
  t.code = G.code;
  G.phase = 'lobby';
  syncViews(true);
  placeMeOutside();
  show('lobby'); renderLobby();
  $('lobby-err').textContent = 'オンラインの部屋を準備中…';
  G.net = new Net();
  G.net.on('join', () => {});
  G.net.on('data', hostOnData);
  G.net.on('leave', hostOnLeave);
  try {
    await G.net.host(G.code);
    G.online = true; $('lobby-err').textContent = '';
  } catch (e) {
    // だれかがもうこの町を開いていたら、そこに入る
    if (e?.type === 'unavailable-id') {
      G.net.close(); G.net = null;
      $('lobby-err').textContent = 'だれかがこの町を開いています。その部屋に入ります…';
      if (await joinCode(t.code)) { $('lobby-err').textContent = ''; return; }
      G.isHost = true; G.world = new World(t);
    }
    // つながらなければ別のコードで
    try { G.net.close(); G.net = new Net(); G.net.on('data', hostOnData); G.net.on('leave', hostOnLeave); G.code = makeCode(); await G.net.host(G.code); G.online = true; $('lobby-err').textContent = ''; }
    catch (e2) { G.online = false; G.net = null; $('lobby-err').textContent = 'オンラインにつながりませんでした。ひとりで遊べます。'; }
  }
  renderLobby();
  save();
}

// ---------- 部屋に入る（子） ----------
async function doJoin() {
  const code = $('in-code').value.trim().toUpperCase();
  if (code.length !== 4) { $('join-err').textContent = '4文字のコードを入れてね'; return; }
  $('join-err').textContent = 'つないでいます…';
  if (await joinCode(code)) $('join-err').textContent = '';
  else $('join-err').textContent = '入れませんでした。コードを確かめてね';
}
async function joinCode(code) {
  G.isHost = false; G.world = null;
  G.net = new Net();
  G.net.on('data', clientOnData);
  G.net.on('hostLost', onHostLost);
  try {
    await G.net.join(code);
    G.code = code; G.online = true;
    G.net.toHost({ k: 'hello', pid: G.me, name: G.name });
    return true;
  } catch (e) {
    G.net.close(); G.net = null;
    return false;
  }
}
// 部屋を開いていた人が抜けても、残った人が町を引きついで続ける
async function onHostLost() {
  if (G.phase === 'title' || !G.town || G.takingOver) return;
  G.takingOver = true;
  G.net?.close(); G.net = null;
  toast('部屋を開いていた人が抜けました。この町をそのまま続けます…');
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 1700));
  G.ppl.clear(); G.dyn = null; G.remoteAv = {};
  const t = G.town; t.code = t.code || G.code;
  const wasPlaying = ['prep', 'open', 'result'].includes(G.phase);
  try { await startHosting(t); } finally { G.takingOver = false; }
  // 自分が引きついだら、その日の準備からすぐ再開する
  if (G.isHost && wasPlaying) hostStartDay();
}
function lostConnection(msg) {
  if (G.phase === 'title') return;
  leaveRoom(false);
  overlay(esc(msg));
}
function leaveRoom(saveFirst = true) {
  if (G.isHost && saveFirst) save();
  G.net?.close(); G.net = null;
  G.phase = 'title'; G.town = null; G.world = null; G.dyn = null; G.ppl.clear();
  for (const v of views.values()) v.dispose(); views.clear();
  setHUD(false); $('prep').classList.add('hidden'); $('prep-toggle').classList.add('hidden');
  A.bgmStop();
  show('title');
}
function inviteUrl() { return `${location.origin}${location.pathname}?room=${G.code}`; }
function copyInvite() {
  const url = inviteUrl();
  const ok = () => { $('lobby-err').textContent = '招待URLをコピーしました！ともだちに送ってね'; };
  if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, () => { $('lobby-err').textContent = url; });
  else $('lobby-err').textContent = url;
}

// ---------- ロビー ----------
function renderLobby() {
  if (!G.town) return;
  const t = G.town;
  $('lobby-title').textContent = `🏙️ ${t.name}`;
  $('lobby-code-box').classList.toggle('hidden', !G.online);
  $('lobby-code').textContent = G.code;
  $('lobby-town').textContent = `${t.day}日目 ・町のにぎわい ${Math.round(t.buzz)}「${buzzName(t.buzz)}」 ${G.online ? '・招待URLを送ると、ともだちが入れます' : ''}`;
  document.querySelectorAll('#screen-lobby .host-only, #screen-result .host-only').forEach((e) => e.classList.toggle('hidden', !G.isHost));
  document.querySelectorAll('#screen-lobby .guest-only, #screen-result .guest-only').forEach((e) => e.classList.toggle('hidden', G.isHost));
  const mine = t.shops[G.me];
  const active = document.activeElement?.id === 'in-shop';
  if (!active) $('my-shop-box').innerHTML = renderSetup(t, G.me);
  const list = [];
  const shops = Object.values(t.shops);
  for (const s of shops) {
    const p = G.players.get(playerOf(s));
    const col = s.cpu ? '#8a99a8' : '#' + PLAYER_COLORS[s.color % 4].toString(16).padStart(6, '0');
    list.push(`<li><span class="dot" style="background:${col}"></span><span class="pn">${GENRE[s.genre].icon} ${esc(s.name)}<br><small>${s.cpu ? 'コンピューター' : esc(s.ownerName)} ・${LEVELS[s.level].name} ・★${s.rating.toFixed(2)}</small></span>
      <span class="tag ${s.cpu ? 'cpu' : p?.online ? 'on' : ''}">${s.cpu ? 'CPU' : p?.online ? (p.ready ? '準備OK' : 'いる') : 'おまかせ営業'}</span></li>`);
  }
  for (const p of G.players.values()) if (!t.shops[p.pid]) list.push(`<li><span class="dot" style="background:#ccc"></span><span class="pn">${esc(p.name)}<br><small>お店を準備中…</small></span><span class="tag on">いる</span></li>`);
  $('player-list').innerHTML = list.join('');
  $('pcount').textContent = `（${shops.length}店）`;
  const btn = $('btn-start');
  if (btn) { btn.disabled = !mine; btn.textContent = mine ? `${t.day}日目の営業をはじめる！` : 'まず自分のお店を出してね'; }
}

function openMyShop() {
  const t = G.town; if (!t) return;
  const inp = document.querySelector('#modal:not(.hidden) #in-shop') || $('in-shop');
  const name = (inp?.value.trim() || GENRE[Setup.genre].name).slice(0, 12);
  if (Setup.lot == null) { $('lobby-err').textContent = '空いている場所がありません'; return; }
  const req = { name, genre: Setup.genre, lot: Setup.lot };
  if (G.isHost) hostSetupShop(G.me, G.name, req);
  else G.net.toHost({ k: 'setup', ...req });
  Setup.name = '';
}
function hostSetupShop(pid, pname, req) {
  const t = G.town;
  if (t.shops[pid]) return;
  const humans = Object.values(t.shops).filter((s) => !s.cpu);
  if (new Set(humans.map(playerOf)).size >= MAX_PLAYERS) { sendTo(pid, { k: 'err', msg: 'この町はもういっぱいです（4人まで）' }); return; }
  // 場所は早い者勝ち
  const lot = req.lot;
  if (!freeLots(t).includes(lot)) { sendTo(pid, { k: 'err', msg: 'その場所はひと足先に埋まってしまいました。ほかの場所を選んでね' }); broadcastTown(); return; }
  // コンピューターのお店がいたら1つ町を出てもらう
  const cpus = Object.values(t.shops).filter((s) => s.cpu);
  if (Object.keys(t.shops).length >= 4 && cpus.length) {
    const out = cpus.sort((a, b) => a.rating - b.rating)[0];
    delete t.shops[out.owner]; G.world.rebuild(out.owner);
  }
  const used = new Set(humans.map((s) => s.color));
  let color = 0; while (used.has(color)) color++;
  const shop = newShop({ owner: pid, ownerName: pname, name: req.name, genre: req.genre, lot, color });
  G.world.addShop(shop);
  bumpShop(pid);
  broadcastTown();
  save();
}

// ---------- 通信（親） ----------
function sendTo(pid, msg) {
  if (!G.net) return;
  if (pid === G.me) { clientOnData(msg); return; }
  const p = G.players.get(pid); if (p?.conn) G.net.send(p.conn, msg);
}
function broadcast(msg) { if (G.net) G.net.broadcast(msg); }
function playersList() { return [...G.players.values()].map((p) => ({ pid: p.pid, name: p.name, ready: p.ready, online: p.online })); }
function broadcastTown() {
  renderLobby();
  broadcast({ k: 'town', town: G.town, players: playersList(), phase: G.phase, phaseT: G.phaseT, code: G.code });
}
function broadcastShop(owner) {
  bumpShop(owner);
  broadcast({ k: 'shop', owner, shop: G.town.shops[owner] });
}
function hostOnData(d, conn) {
  const pid = [...G.players.values()].find((p) => p.conn === conn)?.pid;
  switch (d.k) {
    case 'hello': {
      const online = [...G.players.values()].filter((p) => p.online).length;
      if (online >= MAX_PLAYERS && !G.players.get(d.pid)?.online) { G.net.send(conn, { k: 'full' }); G.net.kick(conn); return; }
      const p = G.players.get(d.pid) || { pid: d.pid };
      Object.assign(p, { name: String(d.name || 'ゲスト').slice(0, 8), conn, online: true, ready: false });
      G.players.set(d.pid, p);
      const s = G.town.shops[d.pid];
      if (s) s.ownerName = p.name;
      broadcastTown();
      G.net.send(conn, { k: 'welcome', pid: d.pid });
      if (G.phase === 'result' && G.summary) G.net.send(conn, { k: 'result', summary: G.summary, town: G.town });
      toast(`${p.name} さんが町に来ました`);
      break;
    }
    case 'start': if (pid && G.town.shops[pid]) hostStartDay(); break;
    case 'hp': if (pid && G.town.shops[pid]) G.town.shops[pid].hp = clamp(+d.hp || 0, 0, 100); break;
    case 'bankrupt': if (pid) hostBankrupt(pid); break;
    case 'next': if (pid) hostNextDay(); break;
    case 'setup': if (pid) hostSetupShop(pid, G.players.get(pid).name, d); break;
    case 'ready': if (pid) setReady(pid, !!d.ready); break;
    case 'cmd': {
      if (!pid || G.phase !== 'prep') { G.net.send(conn, { k: 'cmdres', id: d.id, ok: false, msg: 'いまは変えられません' }); return; }
      const sid = sidOf(pid, d.sid);
      const r = G.world.cmd(sid, d.c);
      G.net.send(conn, { k: 'cmdres', id: d.id, ...r });
      if (r.ok) hostAfterCmd(pid, sid, d.c);
      break;
    }
    case 'branch': case 'closeShop': {
      if (!pid || G.phase !== 'prep') { G.net.send(conn, { k: 'cmdres', id: d.id, ok: false, msg: '準備の時間にできます' }); return; }
      const r = d.k === 'branch' ? openBranch(G.world, pid, d) : closeBranch(G.world, pid, d.sid);
      G.net.send(conn, { k: 'cmdres', id: d.id, ...r });
      if (r.ok) { broadcastTown(); save(); }
      break;
    }
    case 'pos': if (pid && G.world) hostAvatar(pid, sidOf(pid, d.sid), d.x, d.z, d.rot, d.m, !!d.sg); break;
    case 'act': if (pid && G.world) { const sid = sidOf(pid, d.sid); if (d.x != null) hostAvatar(pid, sid, d.x, d.z, d.rot, false); G.world.act(sid); } break;
  }
}
// 子が送ってきたお店が本当にその人のものか確かめる
function sidOf(pid, sid) {
  const s = sid && G.town.shops[sid];
  return s && !s.cpu && playerOf(s) === pid ? sid : pid;
}
// 自分のキャラは1つだけ：別のお店に移ったら前のお店からは消す
function hostAvatar(pid, sid, x, z, rot, m, sign) {
  for (const s of shopsOf(G.town.shops, pid)) if (s.owner !== sid) G.world.avatars.delete(s.owner);
  G.world.setAvatar(sid, x, z, rot, m, sign);
}
function hostAfterCmd(pid, sid, c) {
  broadcastShop(sid);
  if (sid !== pid) broadcastShop(pid); // お財布は1店目にある
  if (c.op === 'moveLot') broadcastTown();
}
function hostOnLeave(conn) {
  const p = [...G.players.values()].find((x) => x.conn === conn);
  if (!p) return;
  p.online = false; p.conn = null; p.ready = false;
  if (G.town) for (const s of shopsOf(G.town.shops, p.pid)) G.world?.avatars.delete(s.owner);
  toast(`${p.name} さんが町を出ました（お店は店員さんがおまかせ営業します）`);
  broadcastTown();
}
function setReady(pid, r) {
  const p = G.players.get(pid); if (!p) return;
  p.ready = r;
  broadcast({ k: 'ready', players: playersList() });
  updateReadyBtn();
}

// ---------- 通信（子） ----------
function clientOnData(d) {
  switch (d.k) {
    case 'welcome': G.me = d.pid; break;
    case 'full': lostConnection('この町はもういっぱいです'); break;
    case 'err': $('lobby-err').textContent = d.msg; break;
    case 'town': {
      if (G.isHost) return;
      G.town = d.town; G.code = d.code;
      G.players = new Map(d.players.map((p) => [p.pid, p]));
      for (const o of Object.keys(G.town.shops)) bumpShop(o);
      syncViews(true);
      if (G.phase === 'title') { G.phase = 'lobby'; placeMeOutside(); }
      if (d.phase !== G.phase && d.phase !== 'lobby') enterPhase(d.phase, d.phaseT);
      else if (d.phase === 'lobby' && G.phase !== 'lobby') enterPhase('lobby');
      if (G.phase === 'lobby') { show('lobby'); renderLobby(); }
      break;
    }
    case 'shop': if (!G.isHost) { G.town.shops[d.owner] = d.shop; bumpShop(d.owner); if (playerOf(d.shop) === G.me) refreshPrep(); } break;
    case 'ready': if (!G.isHost) { G.players = new Map(d.players.map((p) => [p.pid, p])); updateReadyBtn(); if (G.phase === 'lobby') renderLobby(); } break;
    case 'phase': if (!G.isHost) { if (d.town) { G.town = d.town; for (const o of Object.keys(G.town.shops)) bumpShop(o); syncViews(true); } enterPhase(d.phase, d.phaseT); } break;
    case 'snap': if (!G.isHost) applySnap(d); break;
    case 'tick': if (!G.isHost) G.phaseT = d.t; break;
    case 'result': if (!G.isHost) { G.town = d.town; for (const o of Object.keys(G.town.shops)) bumpShop(o); showResult(d.summary); } break;
    case 'cmdres': { const f = G.pending.get(d.id); if (f) { G.pending.delete(d.id); f(d); } break; }
  }
}

// 準備のコマンドを送る（親ならその場で）
function sendCmd(c) {
  if (G.isHost) {
    const r = G.world.cmd(curKey(), c);
    if (r.ok) { hostAfterCmd(G.me, curKey(), c); afterCmd(c, r); } else cmdFail(r);
    return Promise.resolve(r);
  }
  return request({ k: 'cmd', c, sid: curKey() }).then((r) => { if (r.ok) afterCmd(c, r); else cmdFail(r); return r; });
}
// 親に頼んで、答えを待つ
function request(msg) {
  return new Promise((res) => {
    const id = G.reqId++;
    G.pending.set(id, res);
    G.net.toHost({ ...msg, id });
  });
}
// 2店目・3店目を出す／たたむ
async function doBranch(req) {
  const name = GENRE[req.genre].name;
  let r;
  if (G.isHost) { r = openBranch(G.world, G.me, { ...req, name }); if (r.ok) { broadcastTown(); save(); } }
  else r = await request({ k: 'branch', ...req, name });
  if (!r.ok) { cmdFail(r); return; }
  A.sfx.buy();
  toast(`🎉 ${req.lot + 1}番の空き地に新しいお店を出しました！`);
  setTimeout(() => switchShop(r.sid), 50);
}
async function doCloseShop(sid) {
  let r;
  if (G.isHost) { r = closeBranch(G.world, G.me, sid); if (r.ok) { broadcastTown(); save(); } }
  else r = await request({ k: 'closeShop', sid });
  if (!r.ok) { cmdFail(r); return; }
  toast('お店をたたみました');
  if (G.cur === sid) G.cur = null;
  placeMeInShop(); refreshPrep();
}
function switchShop(sid) {
  const old = views.get(curKey()); if (old) { old.grid.visible = false; old.setGhost(null); old.highlightItem(null); }
  G.cur = sid;
  Prep.edit = { place: null, rot: 0, sel: null };
  placeMeInShop(G.phase === 'open');
  refreshPrep(); updateGhost();
  const s = G.town.shops[curKey()];
  if (s) toast(`${GENRE[s.genre].icon} ${s.name} に来ました`);
}
function nextShop() {
  const list = myShops(); if (list.length < 2) return;
  const i = list.findIndex((s) => s.owner === curKey());
  switchShop(list[(i + 1) % list.length].owner);
}
function afterCmd(c, r) {
  if (['place', 'floor', 'wall', 'levelUp', 'hire', 'ad', 'dev'].includes(c.op)) A.sfx.buy(); else A.sfx.select();
  if (c.op === 'levelUp') toast(`🎉 「${LEVELS[G.town.shops[curKey()].level].name}」になりました！`);
  if (c.op === 'moveLot') { toast('引っ越しました！'); placeMeInShop(); }
  if (c.op === 'place' || c.op === 'moveItem') { if (Prep.edit.move != null) { Prep.edit.place = null; Prep.edit.move = null; } }
  refreshPrep();
}
function cmdFail(r) { A.sfx.error(); if (r.msg) toast(r.msg); }

// ---------- 1日の流れ ----------
function hostStartDay() {
  const t = G.town;
  if (G.phase !== 'lobby' || !Object.values(t.shops).some((s) => !s.cpu)) return;
  // 4店にそろうまでコンピューターのお店を入れる
  let idx = 1;
  while (Object.keys(t.shops).length < 4) {
    while (t.shops['cpu' + idx]) idx++;
    const free = freeLots(t);
    const genres = Object.values(t.shops).map((s) => s.genre);
    const g = Object.keys(GENRE).find((x) => !genres.includes(x) && Math.random() < 0.5) || Object.keys(GENRE).find((x) => !genres.includes(x));
    const lot = free[Math.floor(Math.random() * Math.min(free.length, 6))];
    const s = makeCpuShop(t, idx, lot, g);
    G.world.addShop(s);
  }
  for (const s of Object.values(t.shops)) s.away = null;
  hostPhase('prep');
}
function hostNextDay() { if (G.phase === 'result') hostPhase('prep'); }
function hostBackToLobby() {
  save();
  G.phase = 'lobby';
  for (const p of G.players.values()) p.ready = false;
  broadcastTown();
  enterPhase('lobby');
}
function hostPhase(ph) {
  const w = G.world;
  if (ph === 'prep') { w.startPrep(); G.phaseT = PREP_TIME; }
  if (ph === 'open') { w.startOpen(); G.phaseT = OPEN_TIME; }
  for (const p of G.players.values()) p.ready = false;
  for (const o of Object.keys(G.town.shops)) bumpShop(o);
  broadcast({ k: 'phase', phase: ph, phaseT: G.phaseT, town: G.town, players: playersList() });
  enterPhase(ph, G.phaseT);
}
function hostEndDay() {
  const sum = G.world.endDay();
  G.summary = sum;
  for (const s of Object.values(G.town.shops)) if (G.players.get(s.owner)?.online) s.lastSeen = Date.now();
  broadcast({ k: 'result', summary: sum, town: G.town });
  showResult(sum);
  save();
}
async function save() {
  if (!G.isHost || !G.town) return;
  G.town.lastPlayed = Date.now();
  const where = await Store.saveTown(G.town);
  G.lastSave = where === 'cloud' ? '☁️ クラウドに保存しました' : '💾 このブラウザに保存しました';
  const el = $('save-state'); if (el) el.textContent = G.lastSave;
}

function enterPhase(ph, t) {
  G.phase = ph; G.phaseT = t ?? 0;
  Prep.edit = { place: null, rot: 0, sel: null };
  for (const pv of views.values()) { pv.grid.visible = false; pv.setGhost(null); pv.highlightItem(null); }
  if (ph === 'lobby') {
    setHUD(false); $('prep').classList.add('hidden'); $('prep-toggle').classList.add('hidden');
    show('lobby'); renderLobby(); A.bgmStop();
    return;
  }
  hideScreens(); setHUD(true);
  if (ph === 'prep') {
    G.hp = G.town.shops[G.me]?.hp ?? 100;
    $('prep').classList.remove('hidden'); $('prep-toggle').classList.add('hidden');
    Prep.tab = 'menu'; refreshPrep(); updateReadyBtn();
    placeMeInShop();
    A.bgmStart('prep');
    toast(`${G.town.day}日目 準備の時間です`);
  } else if (ph === 'open') {
    $('prep').classList.add('hidden'); $('prep-toggle').classList.add('hidden');
    G.ppl.clear();
    placeMeInShop(true);
    A.sfx.bell(); A.bgmStart('open');
    toast('🔔 開店！ お客さんがやってきます');
  } else if (ph === 'result') {
    $('prep').classList.add('hidden'); $('prep-toggle').classList.add('hidden');
  }
}
function showResult(sum) {
  G.summary = sum;
  G.resultAt = performance.now() + RESULT_WAIT * 1000 / SPEED;
  enterPhase('result');
  setHUD(false);
  $('result-title').textContent = `${sum.day}日目の結果`;
  $('result-body').innerHTML = renderResult(sum, G.me);
  $('save-state').textContent = G.isHost ? G.lastSave : '';
  renderLobby();
  show('result');
  A.bgmStart('night'); A.sfx.fanfare();
}
function refreshPrep() {
  if (G.phase !== 'prep' || !G.town) return;
  Prep.render({ shop: G.town.shops[curKey()], money: myWallet()?.money, mine: myShops(), freeLots: freeLots(G.town), send: sendCmd, toast, onEdit: () => updateGhost(),
    switchShop, closeShop: doCloseShop, openBranch: doBranch });
  updateReadyBtn();
}
function updateReadyBtn() {
  const p = G.players.get(G.me);
  const b = $('btn-ready');
  b.classList.toggle('done', !!p?.ready);
  b.textContent = p?.ready ? '準備OK ✓' : '準備OK！';
}

// ---------- ランキング ----------
function showRanking(withMenu) {
  if (!G.town) return;
  let h = renderRanking(G.town, G.dyn?.shops, G.me);
  if (withMenu === true) {
    h = `<div class="btn-row"><button class="btn" data-act="howto2">あそびかた</button><button class="btn" data-act="leave">町を出る${G.isHost ? '（保存して終わる）' : ''}</button></div>` + h;
  }
  $('modal-body').innerHTML = h;
  $('modal').classList.remove('hidden');
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-act="howto2"]')) { $('modal').classList.add('hidden'); overlay($('screen-howto').querySelector('.panel').innerHTML.replace(/<button[^>]*data-act="back"[^>]*>.*?<\/button>/, '')); }
  if (e.target.closest('#modal [data-act="leave"]')) $('modal').classList.add('hidden');
});

// ---------- お店の見た目を合わせる ----------
function bumpShop(owner) { G.shopVer[owner] = (G.shopVer[owner] || 0) + 1; }
function syncViews(force) {
  if (!G.town) return;
  const shops = G.town.shops;
  for (const [o, v] of views) if (!shops[o]) { v.dispose(); views.delete(o); }
  for (const [o, s] of Object.entries(shops)) {
    let v = views.get(o);
    if (!v) { v = new ShopView(scene, s); v.ver = G.shopVer[o]; views.set(o, v); }
    else if (force || v.ver !== G.shopVer[o]) { v.build(s); v.ver = G.shopVer[o]; }
  }
  const used = new Set(Object.values(shops).map((s) => s.lot));
  for (const L of LOTS) town3d.setLotUsed(L.id, used.has(L.id));
}

// ---------- 自分のキャラの位置 ----------
function placeMeOutside() { Object.assign(G.me3d, { x: -72, z: 5.5, rot: Math.PI / 2, path: [], pendingAct: null }); }
function placeMeInShop(kitchen) {
  G.me3d.sign = false;
  const s = G.town?.shops[curKey()]; if (!s) return;
  const f = frame(s);
  const p = kitchen ? f.kitchenIdle : f.hallIdle;
  Object.assign(G.me3d, { x: p.x, z: p.z, rot: f.rot + Math.PI, path: [], pendingAct: null });
  G.cam.yaw = f.side < 0 ? 0 : Math.PI;
  G.cam.tDist = 15;
}

// 歩ける場所かどうか（壁・カウンターはぬけられない）
function regionAt(x, z) {
  if (!G.town) return { k: 'street' };
  for (const s of Object.values(G.town.shops)) {
    const L = LOTS[s.lot]; const lv = LEVELS[s.level];
    const u = (x - L.x) * (L.side < 0 ? 1 : -1);
    const v = (z - L.side * 7) * L.side;
    if (Math.abs(u) < lv.W / 2 + 1.5 && v > 0 && v < lv.D + 1) {
      // 入り口（屋台は前が全部あいている）は壁の線を通りぬけられる
      const door = s.level === 1 || Math.abs(u) < 0.85;
      const inside = Math.abs(u) < lv.W / 2 - 0.3 && v > (door ? -0.01 : 0.15) && v < lv.D - 1.05;
      return inside ? { k: 'shop', s, u, v, f: frame(s) } : { k: 'block' };
    }
  }
  const lot = LOTS.find((L) => Math.abs(x - L.x) < 9 && z * L.side > 7);
  if (lot) return { k: 'block' };
  if (Math.abs(z) <= 7 && Math.abs(x) <= 118) return { k: 'street' };
  if (Math.abs(x) <= 7 && Math.abs(z) <= 118) return { k: 'street' };
  return { k: 'block' };
}
function canMove(x0, z0, x1, z1) {
  const a = regionAt(x0, z0), b = regionAt(x1, z1);
  if (b.k === 'block') return false;
  if (a.k === 'street' && b.k === 'street') return true;
  const stall = (r) => r.s.level === 1;
  if (a.k === 'street' && b.k === 'shop') return stall(b) || Math.abs(b.u) < 0.85;
  if (a.k === 'shop' && b.k === 'street') return stall(a) || Math.abs(a.u) < 0.85;
  if (a.k === 'shop' && b.k === 'shop') {
    if (a.s !== b.s) return false;
    const pv = a.f.passV;
    if ((a.v < pv) !== (b.v < pv)) return b.u > a.f.W / 2 - 1.45 && a.u > a.f.W / 2 - 1.45;
    if (Math.abs(b.v - pv) < 0.35 && b.u < a.f.W / 2 - 1.45) return false;
    return true;
  }
  return a.k === 'block';
}
// クリックした場所までの道すじ
function planPath(from, to) {
  const a = regionAt(from.x, from.z), b = regionAt(to.x, to.z);
  const pts = [];
  const inK = (r) => r.k === 'shop' && r.v > r.f.passV;
  if (a.k === 'shop' && (b.k !== 'shop' || b.s !== a.s)) {
    if (inK(a)) pts.push(a.f.gate);
    if (a.s.level > 1) pts.push(a.f.door);
    pts.push(a.f.doorOut);
  }
  if (b.k === 'shop' && (a.k !== 'shop' || a.s !== b.s)) {
    pts.push(b.f.doorOut);
    if (b.s.level > 1) pts.push(b.f.door);
    if (inK(b)) pts.push(b.f.gate);
  }
  if (a.k === 'shop' && b.k === 'shop' && a.s === b.s && inK(a) !== inK(b)) {
    const g = a.f.gate, s = a.f.side;
    const gIn = a.f.toW(a.f.W / 2 - 0.75, a.f.passV + 0.6), gOut = a.f.toW(a.f.W / 2 - 0.75, a.f.passV - 0.6);
    if (inK(a)) pts.push(gIn, gOut); else pts.push(gOut, gIn);
    void g; void s;
  }
  pts.push({ x: to.x, z: to.z });
  return pts.map((p) => ({ x: p.x, z: p.z }));
}

// ---------- 入力 ----------
const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
addEventListener('keydown', (e) => {
  A.initAudio();
  if (typing()) { if (e.code === 'Enter' && document.activeElement.id === 'in-code') doJoin(); return; }
  G.keys.add(e.code);
  if (!G.town || G.phase === 'title' || G.phase === 'lobby') return;
  if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') { e.preventDefault(); doAct(); }
  if (e.code === 'KeyT') toggleTownView();
  if (e.code === 'KeyP' && G.phase === 'open') setAuto(!G.auto);
  if (e.code === 'KeyB') toggleSign();
  if (e.code === 'Tab') { e.preventDefault(); nextShop(); }
  if (e.code === 'KeyQ') G.cam.cine = !G.cam.cine;
  if (e.code === 'KeyG') toast('画質：' + GX.cycleQuality());
  if (e.code === 'KeyM') toast(A.toggleMute() ? '音オフ' : '音オン');
  if (e.code === 'KeyR' && Prep.edit.place) { Prep.edit.rot = Prep.edit.rot ? 0 : 1; updateGhost(); }
  if (e.code === 'Escape') { Prep.edit = { place: null, rot: 0, sel: null }; updateGhost(); refreshPrep(); }
});
addEventListener('keyup', (e) => G.keys.delete(e.code));
addEventListener('blur', () => G.keys.clear());

function toggleTownView() { G.cam.tDist = G.cam.tDist > 40 ? 15 : 95; }

const canvas = $('view');
const pointers = new Map();
let pinchD = 0, downAt = null;
canvas.addEventListener('pointerdown', (e) => {
  A.initAudio();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [p, q] = [...pointers.values()]; pinchD = Math.hypot(p.x - q.x, p.y - q.y); downAt = null; }
  else downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [p, q] = [...pointers.values()]; const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (pinchD) G.cam.tDist = clamp(G.cam.tDist * pinchD / d, 7, 140);
    pinchD = d;
  }
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (Prep.edit.place) updateGhost();
});
canvas.addEventListener('pointerup', (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchD = 0;
  if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 10) onTap(e.clientX, e.clientY);
  downAt = null;
});
canvas.addEventListener('wheel', (e) => { e.preventDefault(); G.cam.tDist = clamp(G.cam.tDist * (e.deltaY > 0 ? 1.12 : 0.89), 7, 140); }, { passive: false });
const mouse = { x: 0, y: 0 };
$('act-btn').addEventListener('click', () => doAct());

function ndc(x, y) { return new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); }
function groundAt(x, y, h = 0.1) {
  raycaster.setFromCamera(ndc(x, y), camera);
  const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), p) ? p : null;
}

function onTap(x, y) {
  if (!G.town || G.phase === 'title' || G.phase === 'lobby' || G.phase === 'result') return;
  const my = G.town.shops[curKey()];
  // 内装の編集
  if (G.phase === 'prep' && Prep.tab === 'decor' && my) { decorTap(x, y); return; }
  const v = views.get(curKey());
  raycaster.setFromCamera(ndc(x, y), camera);
  if (v && G.phase === 'open') {
    const hits = raycaster.intersectObjects(v.interact, false);
    if (hits.length) {
      const a = hits[0].object.userData.act, f = v.f;
      let tgt;
      if (a.k === 'stove') tgt = f.stoves[a.i].stand;
      else { const s = f.slots[a.i]; const r = regionAt(G.me3d.x, G.me3d.z); tgt = r.k === 'shop' && r.v > f.passV ? s.back : s.front; }
      walkTo(tgt, true, true);
      return;
    }
  }
  const p = groundAt(x, y);
  if (!p) return;
  // 席の近くをタップしたら、運ぶ・片づける
  if (v && G.phase === 'open') {
    let best = -1, bd = 1.2;
    v.seats.forEach((s, i) => { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { const s = v.seats[best]; const dx = s.x - s.px, dz = s.z - s.pz, dl = Math.hypot(dx, dz) || 1; walkTo({ x: s.x - dz / dl * 0.6, z: s.z + dx / dl * 0.6 }, true, true); return; }
  }
  walkTo(p, false, true);
}
function walkTo(p, act, manual) {
  if (manual) G.autoPause = performance.now() + 2500;
  G.me3d.path = planPath(G.me3d, p);
  G.me3d.pendingAct = act;
}

function decorTap(x, y) {
  const s = G.town.shops[curKey()], v = views.get(curKey());
  const p = groundAt(x, y);
  if (!p || !v) return;
  const f = v.f;
  const u = (p.x - f.lot.x) * (f.side < 0 ? 1 : -1), vv = (p.z - f.side * 7) * f.side;
  const E = Prep.edit;
  if (E.place) {
    const it = ghostItem(u, vv);
    if (E.move != null) sendCmd({ op: 'moveItem', idx: E.move, u: it.u, v: it.v, r: it.r });
    else sendCmd({ op: 'place', id: it.id, u: it.u, v: it.v, r: it.r });
    return;
  }
  // 置いてある家具をえらぶ
  let sel = null;
  s.layout.forEach((it, i) => { const { w, d } = furnSize(it); if (Math.abs(u - it.u) < w / 2 && Math.abs(vv - it.v) < d / 2) sel = i; });
  E.sel = sel;
  v.highlightItem(sel);
  refreshPrep();
}
function ghostItem(u, vv) {
  const v = views.get(curKey()), f = v.f, E = Prep.edit;
  const base = { id: E.place, u: 0, v: 0, r: E.rot };
  const { w, d } = furnSize(base);
  const i0 = Math.round(u + f.cols / 2 - w / 2), j0 = Math.round(vv - 0.5 - d / 2);
  return snapItem(f, base, i0, j0);
}
function updateGhost() {
  const v = views.get(curKey()); if (!v) return;
  const s = G.town.shops[curKey()];
  const editing = G.phase === 'prep' && Prep.tab === 'decor';
  v.grid.visible = editing;
  if (!editing || !Prep.edit.place) { v.setGhost(null); if (!editing) v.highlightItem(null); return; }
  const p = groundAt(mouse.x, mouse.y);
  if (!p) return;
  const u = (p.x - v.f.lot.x) * (v.f.side < 0 ? 1 : -1), vv = (p.z - v.f.side * 7) * v.f.side;
  const it = ghostItem(u, vv);
  const rest = Prep.edit.move != null ? s.layout.filter((_, i) => i !== Prep.edit.move) : s.layout;
  const ok = layoutOk(v.f, [...rest, it]) && (Prep.edit.move != null || s.money >= FURN[it.id].cost);
  v.setGhost(it, ok);
}

// その場で「使う」
function myContext() {
  if (G.phase !== 'open' || !G.town?.shops[curKey()]) return null;
  if (G.isHost) return G.world.contextAt(curKey());
  const v = views.get(curKey()); const dyn = G.dyn?.shops?.[curKey()];
  if (!v || !dyn) return null;
  const av = { x: G.me3d.x, z: G.me3d.z, ...(G.avatarsInfo[curKey()] || {}) };
  const seats = v.seats.map((s, i) => ({ ...s, dirty: dyn.dirty[i] & 1, occ: dyn.dirty[i] & 2 }));
  return contextOf(av, v.f, dyn.orders, seats);
}
function doAct() {
  if (G.phase !== 'open') return;
  const c = myContext();
  if (!c || c.k === 'carrying' || c.k === 'cooking' || c.k === 'nocook') {
    if (c?.k === 'carrying') toast('お客さんの席まで運んでね（光っている席）');
    return;
  }
  if (G.isHost) G.world.act(curKey());
  else G.net?.toHost({ k: 'act', sid: curKey(), x: G.me3d.x, z: G.me3d.z, rot: G.me3d.rot });
  const snd = { cook: A.sfx.cook, pick: A.sfx.pick, serve: A.sfx.serve, clean: A.sfx.clean }[c.k];
  snd?.();
}
const ACT_LABEL = { cook: '🍳 作る', pick: '🍽️ 取る', serve: '🛎️ 出す', clean: '🧽 片づけ', carrying: '席へ運ぶ', cooking: '作っています…', nocook: '注文まち' };

// ---------- 子：送られてきた町の動き ----------
const KIND = ['cust', 'staff', 'player'];
const TYPES = ['student', 'worker', 'gourmet', 'family', 'relax', 'tourist'];
function packSnap() {
  const v = G.world.view();
  const p = v.people.map((x) => [x.id, Math.round(x.x * 20) / 20, Math.round(x.z * 20) / 20, Math.round(x.rot * 100) / 100, x.pose,
    x.carry || 0, x.emote || 0, KIND.indexOf(x.kind), TYPES.indexOf(x.type), x.look || 0, x.shop || 0, x.staff?.role || 0]);
  const av = {};
  for (const [o, a] of G.world.avatars) av[o] = [Math.round(a.x * 20) / 20, Math.round(a.z * 20) / 20, Math.round(a.rot * 100) / 100, a.carry, a.cook, a.moving ? 1 : 0, a.sign ? 1 : 0];
  return { k: 'snap', h: v.hour, t: G.phaseT, p, s: v.shops, av, fx: G.world.events.slice(0, 30) };
}
function applySnap(d) {
  G.phaseT = d.t;
  const seen = new Set();
  for (const a of d.p) {
    const [id, x, z, rot, pose, carry, emote, kind, type, look, shop, role] = a;
    seen.add(id);
    let p = G.ppl.get(id);
    if (!p) { p = { id, x, z, rot, kind: KIND[kind], type: TYPES[type], look, shop: shop || null, staff: role ? { role } : null }; G.ppl.set(id, p); }
    p.tx = x; p.tz = z; p.trot = rot; p.pose = pose; p.carry = carry || null; p.emote = emote || null;
    if (Math.hypot(p.x - x, p.z - z) > 6) { p.x = x; p.z = z; }
  }
  for (const id of [...G.ppl.keys()]) if (!seen.has(id)) { G.ppl.delete(id); crowd.forget(id); }
  G.avatarsInfo = {};
  G.remoteAv = {};
  for (const [o, a] of Object.entries(d.av || {})) {
    G.avatarsInfo[o] = { carry: a[3], cook: a[4], sign: a[6] };
    if (o !== curKey()) G.remoteAv[o] = a;
  }
  G.dyn = { hour: d.h, shops: d.s, people: [...G.ppl.values()] };
  handleFx(d.fx || []);
}

// ---------- 効果（コイン・音） ----------
const pops = [];
const emojiTex = new Map();
function emojiSprite(e) {
  if (!emojiTex.has(e)) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,0.92)'; x.beginPath(); x.arc(64, 58, 52, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(54, 104); x.lineTo(64, 124); x.lineTo(74, 104); x.fill();
    x.font = '64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 64, 62);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; emojiTex.set(e, t);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex.get(e), transparent: true, depthTest: false }));
  s.scale.set(0.75, 0.75, 1); s.renderOrder = 30;
  return s;
}
function handleFx(list) {
  for (const ev of list) {
    const mine = ev.shop === curKey();
    if (ev.k === 'coin') {
      if (mine) A.sfx.coin();
      const near = Math.hypot(ev.x - camTarget.x, ev.z - camTarget.z) < 45;
      if (mine || near) {
        const s = textSprite(`+${yen(ev.amount)}`, { size: 56, color: '#ffe08a', stroke: '#6b3a00', h: 0.55, depthTest: false });
        s.position.set(ev.x, 2.3, ev.z); s.renderOrder = 31; scene.add(s); pops.push({ s, t: 0 });
      }
    } else if (ev.k === 'ready' && mine && !ev.me) A.sfx.ready();
    else if (ev.k === 'angry' && mine) A.sfx.angry();
    else if (ev.k === 'order' && mine) A.sfx.order();
    else if (ev.k === 'train') { town3d.arriveTrain(); if (Math.hypot(camTarget.x + 90, camTarget.z) < 70) A.sfx.train(); }
  }
}
function updatePops(dt) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.t += dt;
    p.s.position.y += dt * 0.9; p.s.material.opacity = Math.max(0, 1 - p.t / 1.6);
    if (p.t > 1.6) { scene.remove(p.s); p.s.material.map.dispose(); p.s.material.dispose(); pops.splice(i, 1); }
  }
}
const emoteSprites = new Map();
const nameTags = new Map();
function updateEmotes(list) {
  const seen = new Set();
  for (const p of list) {
    if (!p.emote) continue;
    seen.add(p.id);
    let s = emoteSprites.get(p.id);
    if (!s || s.userData.e !== p.emote) { if (s) scene.remove(s); s = emojiSprite(p.emote); s.userData.e = p.emote; scene.add(s); emoteSprites.set(p.id, s); }
    s.position.set(p.x, p.pose === POSE.sit ? 1.95 : 2.45, p.z);
  }
  for (const [id, s] of emoteSprites) if (!seen.has(id)) { scene.remove(s); emoteSprites.delete(id); }
}
function nameTag(owner, name, color, x, z) {
  let s = nameTags.get(owner);
  if (!s || s.userData.n !== name) {
    if (s) scene.remove(s);
    s = textSprite(name, { size: 40, color: '#fff', bg: '#' + new THREE.Color(color).multiplyScalar(0.75).getHexString() + 'dd', h: 0.42, depthTest: false });
    s.userData.n = name; s.renderOrder = 29; scene.add(s); nameTags.set(owner, s);
  }
  s.position.set(x, 2.45, z); s.visible = true;
  s.userData.seen = true;
}

// 看板（持って歩くとお客さんがついて来る）
const signBoards = new Map();
function signBoard(key, shop, x, z, rot, show) {
  if (!show || !shop) return;
  let g = signBoards.get(key);
  const label = `${GENRE[shop.genre].icon} ${shop.name}`;
  if (!g || g.userData.label !== label) {
    if (g) scene.remove(g);
    g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.3, 6), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 }));
    pole.position.y = 1.15; pole.castShadow = true; g.add(pole);
    const c = document.createElement('canvas'); c.width = 256; c.height = 160;
    const x2 = c.getContext('2d');
    x2.fillStyle = '#fff7e6'; x2.fillRect(0, 0, 256, 160);
    x2.strokeStyle = '#' + PLAYER_COLORS[shop.color % 4].toString(16).padStart(6, '0'); x2.lineWidth = 16; x2.strokeRect(8, 8, 240, 144);
    x2.fillStyle = '#3a2a1a'; x2.textAlign = 'center'; x2.textBaseline = 'middle';
    x2.font = 'bold 52px sans-serif'; x2.fillText(GENRE[shop.genre].icon, 128, 52);
    x2.font = 'bold 30px "M PLUS Rounded 1c", sans-serif'; x2.fillText(shop.name.slice(0, 7), 128, 112);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.6, 0.04), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    board.position.y = 2.25; board.castShadow = true; g.add(board);
    g.userData.label = label;
    scene.add(g); signBoards.set(key, g);
  }
  // 右手で持っているように少し横にずらす
  g.position.set(x + Math.cos(rot) * 0.38, 0, z - Math.sin(rot) * 0.38);
  g.rotation.y = rot;
  g.visible = true; g.userData.seen = true;
}

// ---------- カメラ ----------
const camTarget = new THREE.Vector3(-60, 0, 0);
function updateCamera(dt) {
  const c = G.cam, me = G.me3d;
  c.dist += (c.tDist - c.dist) * Math.min(1, dt * 5);
  if (c.cine) {
    c.cineT += dt * 0.06;
    const r = 70;
    camera.position.set(Math.cos(c.cineT) * r, 38 + Math.sin(c.cineT * 2) * 8, Math.sin(c.cineT) * r * 0.6);
    camTarget.set(Math.cos(c.cineT + 0.6) * 25, 0, 0);
    camera.lookAt(camTarget);
    return;
  }
  let tx = me.x, tz = me.z, yaw = c.yaw;
  const r = regionAt(me.x, me.z);
  if (r.k === 'shop') yaw = r.f.side < 0 ? 0 : Math.PI;
  const editing = G.phase === 'prep' && Prep.tab === 'decor' && !$('prep').classList.contains('hidden');
  let dist = c.dist, pitch = THREE.MathUtils.lerp(0.95, 1.2, clamp((dist - 10) / 80, 0, 1));
  const my = G.town?.shops[curKey()];
  if (editing && my) {
    const f = frame(my); const ctr = f.toW(0, f.D / 2);
    tx = ctr.x; tz = ctr.z; yaw = f.side < 0 ? 0 : Math.PI; dist = Math.max(f.W, f.D) * 1.55; pitch = 1.15;
    // パネルに隠れないように少しずらす
    const sideShift = innerWidth > 700 ? 0.18 * dist : 0;
    tx += Math.cos(yaw) * sideShift;
  }
  if (G.phase === 'lobby' || G.phase === 'title') {
    c.cineT += dt * 0.04;
    tx = Math.cos(c.cineT) * 30; tz = 0; yaw = c.cineT * 0.5; dist = 75; pitch = 0.7;
  }
  let dy = yaw - c.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
  c.yaw += dy * Math.min(1, dt * 3);
  camTarget.x += (tx - camTarget.x) * Math.min(1, dt * 6);
  camTarget.z += (tz - camTarget.z) * Math.min(1, dt * 6);
  camTarget.y = 0.8;
  camera.position.set(camTarget.x + Math.sin(c.yaw) * Math.cos(pitch) * dist, camTarget.y + Math.sin(pitch) * dist, camTarget.z + Math.cos(c.yaw) * Math.cos(pitch) * dist);
  camera.lookAt(camTarget);
}

// ---------- 自分のキャラを動かす ----------
let posSendT = 0, lastActTry = 0;
function updateMe(dt) {
  const me = G.me3d;
  if (!G.town || G.phase === 'title' || G.phase === 'lobby' || G.phase === 'result') return;
  let mx = 0, mz = 0;
  const K = G.keys;
  if (!typing()) {
    if (K.has('KeyW') || K.has('ArrowUp')) mz -= 1;
    if (K.has('KeyS') || K.has('ArrowDown')) mz += 1;
    if (K.has('KeyA') || K.has('ArrowLeft')) mx -= 1;
    if (K.has('KeyD') || K.has('ArrowRight')) mx += 1;
  }
  // 車にひかれた直後は動けない／体力が少ないと遅い
  G.hurtT = Math.max(0, (G.hurtT || 0) - dt);
  if (G.stunT > 0) { G.stunT -= dt; mx = 0; mz = 0; me.path = []; me.pendingAct = null; }
  const speed = G.hp < 30 ? 2.2 : 3.6;
  let vx = 0, vz = 0;
  if (mx || mz) {
    me.path = []; me.pendingAct = null;
    const yaw = G.cam.yaw, l = Math.hypot(mx, mz);
    // カメラから見た向き
    vx = (mx * Math.cos(yaw) + mz * Math.sin(yaw)) / l * speed;
    vz = (-mx * Math.sin(yaw) + mz * Math.cos(yaw)) / l * speed;
  } else if (me.path.length) {
    const t = me.path[0]; const dx = t.x - me.x, dz = t.z - me.z, d = Math.hypot(dx, dz);
    if (d < 0.15) { me.path.shift(); }
    else { vx = dx / d * speed; vz = dz / d * speed; if (d < speed * dt) { vx = dx / dt; vz = dz / dt; } }
  }
  me.moving = !!(vx || vz);
  if (me.moving) {
    let nx = me.x + vx * dt, nz = me.z + vz * dt;
    // お客さんはすり抜けずに押す（押されたお客さんの動きは親が計算する）
    [nx, nz] = bumpCustomers(me, nx, nz);
    const pathMode = !mx && !mz && me.path.length;
    if (pathMode || canMove(me.x, me.z, nx, nz)) { me.x = nx; me.z = nz; }
    else if (canMove(me.x, me.z, nx, me.z)) me.x = nx;
    else if (canMove(me.x, me.z, me.x, nz)) me.z = nz;
    else {
      // お店の前の壁にぶつかったら、入り口のほうへすべらせる
      const r0 = regionAt(me.x, me.z);
      if (r0.k === 'shop' && r0.v < 1.6) {
        const d0 = r0.f.door, dx = d0.x - me.x;
        const sx = me.x + Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
        if (canMove(me.x, me.z, sx, me.z)) me.x = sx;
      }
    }
    const tr = Math.atan2(vx, vz);
    let d = tr - me.rot; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    me.rot += d * Math.min(1, dt * 12);
  }
  checkCars();
  // 自分の別のお店に入ったら、そのお店で働く
  const here = regionAt(me.x, me.z);
  if (here.k === 'shop' && !here.s.cpu && playerOf(here.s) === G.me && here.s.owner !== curKey()) {
    const info = G.isHost ? G.world?.avatars.get(curKey()) : G.avatarsInfo[curKey()];
    if (info?.carry == null && info?.cook == null) { G.cur = here.s.owner; refreshPrep(); }
  }
  if (mx || mz) G.autoPause = performance.now() + 2500;
  if (G.auto && G.phase === 'open') { G.autoT -= dt; if (G.autoT <= 0) { G.autoT = 0.35; autoPilot(); } }
  // タップで決めた行動：着いたら実行
  if (me.pendingAct && !me.path.length) {
    me.pendingAct = false;
    const c = myContext();
    if (c && !['carrying', 'cooking', 'nocook'].includes(c.k)) doAct();
  }
  // 運んでいるときはお客さんの席に自動で出す
  if (G.phase === 'open' && performance.now() - lastActTry > 300) {
    const c = myContext();
    if (c?.k === 'serve') { lastActTry = performance.now(); doAct(); }
  }
  if (G.isHost) { if (G.world) hostAvatar(G.me, curKey(), me.x, me.z, me.rot, me.moving, !!me.sign); }
  else {
    posSendT -= dt;
    if (posSendT <= 0 && G.net) { posSendT = 0.1; G.net.toHost({ k: 'pos', sid: curKey(), sg: me.sign ? 1 : 0, x: Math.round(me.x * 100) / 100, z: Math.round(me.z * 100) / 100, rot: Math.round(me.rot * 100) / 100, m: me.moving ? 1 : 0 }); }
  }
}

// ---------- お客さんを押す・車にひかれる ----------
const BODY = 0.55;
function bumpCustomers(me, nx, nz) {
  if (G.phase !== 'open') return [nx, nz];
  const list = G.isHost ? (G.dyn?.people || []) : [...G.ppl.values()];
  for (const p of list) {
    if (p.kind !== 'cust' || p.pose === POSE.sit) continue;
    const dx = nx - p.x, dz = nz - p.z, d = Math.hypot(dx, dz);
    if (d >= BODY || d < 1e-4) continue;
    if (!G.isHost) {
      // 子は見た目だけ先に押しておく（すぐに親の位置で上書きされる）
      const k = (BODY - d) * 0.8;
      p.x -= dx / d * k; p.z -= dz / d * k; p.tx = p.x; p.tz = p.z;
    }
    const d2 = Math.hypot(nx - p.x, nz - p.z) || 1e-4;
    if (d2 < BODY * 0.8) { nx = p.x + (nx - p.x) / d2 * BODY * 0.8; nz = p.z + (nz - p.z) / d2 * BODY * 0.8; }
  }
  return [nx, nz];
}
function checkCars() {
  if (!['prep', 'open'].includes(G.phase) || G.hurtT > 0 || !myShops().length) return;
  const me = G.me3d;
  for (const c of town3d.cars) {
    const p = c.g.position;
    const along = c.onCross ? me.z - p.z : me.x - p.x, side = c.onCross ? me.x - p.x : me.z - p.z;
    if (Math.abs(along) > 2.4 || Math.abs(side) > 1.2) continue;
    // はねとばされて歩道のほうへ
    const dir = Math.sign(side) || 1, push = 2.6;
    if (c.onCross) me.x = p.x + dir * push; else me.z = p.z + dir * push;
    me.path = []; me.pendingAct = null;
    G.hp = Math.max(0, G.hp - 30); G.hurtT = 1.5; G.stunT = 0.8;
    A.sfx.angry();
    document.body.classList.remove('hit'); void document.body.offsetWidth; document.body.classList.add('hit');
    sendHp();
    if (G.hp <= 0) goBankrupt();
    else toast(`🚗 車にひかれた！ 体力 −30（のこり ${G.hp}）`);
    return;
  }
}

// 体力は1店目に記録する（日をまたいでも残る）
function sendHp() {
  const hp = Math.round(G.hp);
  if (G.isHost) { const s = G.town.shops[G.me]; if (s) s.hp = hp; }
  else G.net?.toHost({ k: 'hp', hp });
}
function goBankrupt() {
  G.me3d.sign = false; G.auto = false; G.stunT = 2;
  if (G.isHost) hostBankrupt(G.me); else G.net?.toHost({ k: 'bankrupt' });
  overlay(`<h2>💀 たおれてしまった…</h2><p>体力がなくなり、お店はすべて閉店です。</p><p>${G.phase === 'open' ? '今日の営業が終わったら' : 'このあとすぐ'}、資本金 ${yen(START_CAPITAL)} から新しいお店を出し直せます。</p><p class="note">車には気をつけよう！</p>`);
  A.sfx.angry();
}
function hostBankrupt(pid) {
  bankrupt(G.world, pid);
  syncViews(true);
  broadcastTown(); save();
}
// お店がない人（閉店した人・あとから来た人）は、ここで出し直す
function showRestart() {
  $('modal-body').innerHTML = `<h2>🏪 新しいお店を出そう</h2>${renderSetup(G.town, G.me)}`;
  $('modal').classList.remove('hidden');
  G.restartOpen = true;
}

// ---------- オートプレイ：自分のキャラが自分で作る・運ぶ・片づける ----------
function besideSeat(s, k = 0.6) {
  const dx = s.x - s.px, dz = s.z - s.pz, dl = Math.hypot(dx, dz) || 1;
  return { x: s.x - dz / dl * k, z: s.z + dx / dl * k };
}
function autoPilot() {
  const me = G.me3d, K = curKey();
  if (me.path.length || me.pendingAct || performance.now() < G.autoPause) return;
  const v = views.get(K), dyn = G.dyn?.shops?.[K], s = G.town.shops[K];
  if (!v || !dyn || !s) return;
  const info = (G.isHost ? G.world.avatars.get(K) : G.avatarsInfo[K]) || {};
  if (info.cook != null) return; // 料理中はコンロの前にいる
  const f = v.f, r = regionAt(me.x, me.z);
  const inK = r.k === 'shop' && r.s.owner === K && r.v > f.passV;
  const dist = (p) => Math.hypot(p.x - me.x, p.z - me.z);
  // 運んでいる料理はお客さんの席へ（近づくと自動で出す）
  if (info.carry != null) {
    const o = dyn.orders.find((x) => x.id === info.carry);
    const seat = o && v.seats[o.seat];
    if (seat) walkTo(besideSeat(seat), false);
    return;
  }
  // できた料理を取りに行く
  const ready = dyn.orders.filter((o) => o.state === 'ready' && o.slot != null && !o.by && f.slots[o.slot]);
  if (ready.length) {
    const sl = f.slots[ready[0].slot];
    walkTo(inK ? sl.back : sl.front, true);
    return;
  }
  // 注文があれば空いているコンロで作る
  const wait = dyn.orders.find((o) => o.state === 'wait' && !o.by);
  if (wait) {
    const busy = new Set(dyn.orders.filter((o) => o.stove != null).map((o) => o.stove));
    const free = f.stoves.map((st, i) => i).filter((i) => !busy.has(i)).sort((a, b) => dist(f.stoves[a].stand) - dist(f.stoves[b].stand));
    if (free.length) { walkTo(f.stoves[free[0]].stand, true); return; }
  }
  // よごれた席を片づける
  const dirty = v.seats.map((st, i) => i).filter((i) => (dyn.dirty[i] & 1) && !(dyn.dirty[i] & 2));
  if (dirty.length) {
    dirty.sort((a, b) => dist(v.seats[a]) - dist(v.seats[b]));
    walkTo(besideSeat(v.seats[dirty[0]]), true);
    return;
  }
  // ひまなときは厨房で待つ
  if (dist(f.kitchenIdle) > 1.2) walkTo(f.kitchenIdle, false);
}
function toggleSign() {
  if (G.phase !== 'open') return;
  G.me3d.sign = !G.me3d.sign;
  if (G.me3d.sign) { G.auto && setAuto(false); toast('🪧 看板を持ちました。町を歩くと、お客さんがついて来ます。お店の前まで連れて行こう！'); }
  else toast('看板をおろしました');
}
$('sign-btn').addEventListener('click', toggleSign);
function setAuto(on) {
  if (on) G.me3d.sign = false;
  G.auto = on; LS.set('mm-auto', on ? '1' : '0');
  G.autoPause = 0;
  toast(on ? '🤖 オートプレイ：自分のキャラが料理・配膳・片づけをします' : 'オートプレイを止めました');
}
$('auto-btn').addEventListener('click', () => setAuto(!G.auto));

// ---------- 画面の表示 ----------
let hudT = 0;
function updateHUD(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = 0.2;
  const t = G.town; if (!t) return;
  const s = t.shops[curKey()];
  $('hud-day').textContent = `${t.day}日目`;
  $('hud-phase').textContent = G.phase === 'prep' ? '🛠️ 準備' : G.phase === 'open' ? '🔔 営業中' : '🌙 閉店';
  const hour = G.phase === 'open' ? (G.dyn?.hour ?? OPEN_HOUR) : G.phase === 'prep' ? 9 + (1 - G.phaseT / PREP_TIME) * 2 : 21;
  $('hud-clock').textContent = '🕒 ' + hourText(hour);
  const T = Math.max(0, Math.ceil(G.phaseT));
  $('hud-timer').textContent = `のこり ${Math.floor(T / 60)}:${String(T % 60).padStart(2, '0')}`;
  if (s) {
    $('hud-money').textContent = yen(myWallet().money);
    $('hud-rating').textContent = `${stars(s.rating)} ${s.rating.toFixed(2)}`;
  }
  // お店がなければ出し直しの画面
  const noShop = ['prep', 'open'].includes(G.phase) && !Object.values(t.shops).some((x) => !x.cpu && playerOf(x) === G.me);
  if (noShop && !G.restartOpen && $('overlay').classList.contains('hidden')) showRestart();
  if (!noShop && G.restartOpen) { G.restartOpen = false; $('modal').classList.add('hidden'); G.hp = 100; sendHp(); placeMeInShop(); refreshPrep(); }
  const hpEl = $('hud-hp');
  hpEl.textContent = `❤️ ${Math.ceil(G.hp)}`;
  hpEl.classList.toggle('low', G.hp < 30);
  $('hud-buzz-bar').style.width = `${Math.round(t.buzz)}%`;
  $('hud-buzz-name').textContent = buzzName(t.buzz);
  const dyn = G.dyn?.shops?.[curKey()];
  const box = $('today-box');
  if (G.phase === 'open' && dyn) {
    const waiting = dyn.orders.filter((o) => o.state === 'wait' || o.state === 'cook').length;
    const ready = dyn.orders.filter((o) => o.state === 'ready').length;
    const dirty = dyn.dirty.filter((d) => d & 1).length;
    box.innerHTML = `今日の売上 <b>${yen(dyn.sales)}</b><br>来店 <b>${dyn.cust}</b>人 ・行列 <b>${dyn.q}</b>人<br>作る注文 <b>${waiting}</b> ・できた料理 <b>${ready}</b> ・よごれた席 <b>${dirty}</b>`;
    box.classList.remove('hidden');
  } else if (G.phase === 'prep') {
    const ready = [...G.players.values()].filter((p) => p.online && t.shops[p.pid]);
    box.innerHTML = `準備OK：${ready.filter((p) => p.ready).length} / ${ready.length}人<br><span style="opacity:.8">みんながOKを押すとすぐ開店</span>`;
    box.classList.remove('hidden');
  } else box.classList.add('hidden');
  const ab = $('auto-btn');
  ab.classList.toggle('hidden', G.phase !== 'open');
  ab.classList.toggle('on', G.auto);
  ab.textContent = G.auto ? '🤖 オート ON' : '🤖 オート OFF';
  const sb = $('sign-btn');
  sb.classList.toggle('hidden', G.phase !== 'open');
  sb.classList.toggle('on', !!G.me3d.sign);
  const fol = G.dyn?.people ? G.dyn.people.filter((p) => p.state === 'follow' && p.follow === curKey()).length : 0;
  sb.textContent = G.me3d.sign ? `🪧 看板中${G.isHost && fol ? `（${fol}人）` : ''}` : '🪧 看板を持つ';
  $('btn-nextshop').classList.toggle('hidden', myShops().length < 2);
  // 行動ボタン
  const c = myContext();
  const btn = $('act-btn');
  if (G.phase === 'open' && c) { btn.classList.remove('hidden'); btn.textContent = ACT_LABEL[c.k] || ''; btn.classList.toggle('dim', ['carrying', 'cooking', 'nocook'].includes(c.k)); }
  else btn.classList.toggle('hidden', !(G.phase === 'open' && 'ontouchstart' in window));
  if (G.phase === 'open' && !c) btn.textContent = '…';
  let hint = '';
  if (G.phase === 'open') {
    const r = regionAt(G.me3d.x, G.me3d.z);
    if (G.me3d.sign) hint = '🪧 お客さんを連れて、自分のお店の前まで歩こう（B でおろす）';
    else if (G.auto) hint = '🤖 オートプレイ中（P で切りかえ）';
    else if (r.k !== 'shop' || r.s.owner !== curKey()) hint = 'T で町全体 ／ 自分のお店にもどって手伝おう';
    else if (dyn && dyn.orders.some((o) => o.state === 'wait')) hint = 'コンロの前で Space（またはタップ）で料理を作ろう';
    else if (dyn && dyn.orders.some((o) => o.state === 'ready')) hint = '受け取り口の料理を取って、お客さんの席へ';
  } else if (G.phase === 'prep') hint = Prep.tab === 'decor' ? '床をクリックして家具を置こう（R で回す）' : '';
  $('hint').textContent = hint;
}

// ---------- 毎フレーム ----------
let last = performance.now(), tickSend = 0, snapSend = 0, elapsed = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  const dt = rdt * SPEED;
  elapsed += dt;
  // 親：時間を進める
  if (G.isHost && G.world) {
    if (G.phase === 'prep') {
      G.phaseT -= dt;
      const humans = [...G.players.values()].filter((p) => p.online && G.town.shops[p.pid]);
      if (G.phaseT <= 0 || (humans.length && humans.every((p) => p.ready))) hostPhase('open');
    } else if (G.phase === 'open') {
      G.phaseT -= dt;
      const r = G.world.update(dt);
      handleFx(G.world.events.filter((e) => e.k !== 'train' || true));
      snapSend -= dt;
      if (snapSend <= 0) {
        snapSend = 0.1;
        if (G.net) broadcast(packSnap());
        G.world.events = [];
      }
      G.dyn = G.world.view();
      if (r === 'end') hostEndDay();
    }
    tickSend -= dt;
    if (tickSend <= 0 && G.net && G.phase === 'prep') { tickSend = 1; broadcast({ k: 'tick', t: G.phaseT }); }
  } else if (G.phase === 'prep' || G.phase === 'open') G.phaseT = Math.max(0, G.phaseT - dt);
  if (G.isHost && G.world && G.phase !== 'open') G.world.events = [];
  // 結果画面：だれかが町にいるあいだは、少し待つと次の日が自動で始まる
  if (G.phase === 'result' && G.resultAt) {
    const left = (G.resultAt - now) / 1000;
    const nb = $('btn-next'); if (nb) nb.textContent = `次の日へ（あと${Math.max(0, Math.ceil(left))}秒）`;
    if (G.isHost && left <= 0) { G.resultAt = 0; hostNextDay(); }
  }

  syncViews(false);
  updateMe(dt);

  // 人を動かす（子はなめらかに）
  let list = [];
  if (G.phase === 'open' && G.dyn) {
    if (G.isHost) list = G.dyn.people;
    else {
      for (const p of G.ppl.values()) {
        const k = Math.min(1, dt * 10);
        p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k;
        let d = p.trot - p.rot; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        p.rot += d * k;
      }
      list = [...G.ppl.values()];
    }
  }
  // プレイヤー（自分と、ほかの人）
  const avatars = [];
  for (const t of nameTags.values()) t.userData.seen = false;
  if (G.town && G.phase !== 'title' && G.phase !== 'lobby') {
    const meS = G.town.shops[curKey()];
    const myInfo = G.isHost ? G.world?.avatars.get(curKey()) : G.avatarsInfo[curKey()];
    const carryRid = myInfo?.carry != null ? orderRid(curKey(), myInfo.carry) : null;
    avatars.push({ id: 900000, kind: 'player', look: 1, color: PLAYER_COLORS[(meS?.color ?? 0) % 4], x: G.me3d.x, z: G.me3d.z, rot: G.me3d.rot,
      pose: myInfo?.cook != null && !G.me3d.moving ? POSE.cook : carryRid ? POSE.carry : G.me3d.moving ? POSE.walk : POSE.stand, carry: carryRid, shop: curKey() });
    signBoard('@me', meS, G.me3d.x, G.me3d.z, G.me3d.rot, G.phase === 'open' && G.me3d.sign && myInfo?.carry == null && myInfo?.cook == null);
    nameTag('@me', G.name, PLAYER_COLORS[(meS?.color ?? 0) % 4], G.me3d.x, G.me3d.z);
    const others = G.isHost ? [...(G.world?.avatars || [])].filter(([o]) => o !== curKey()).map(([o, a]) => [o, [a.x, a.z, a.rot, a.carry, a.cook, a.moving, a.sign]]) : Object.entries(G.remoteAv || {});
    others.forEach(([o, a], i) => {
      const s = G.town.shops[o]; const col = PLAYER_COLORS[(s?.color ?? i + 1) % 4];
      const rid = a[3] != null ? orderRid(o, a[3]) : null;
      let rp = G.remoteP?.[o];
      if (!rp) { rp = { x: a[0], z: a[1], rot: a[2] }; (G.remoteP ||= {})[o] = rp; }
      const k = Math.min(1, dt * 10); rp.x += (a[0] - rp.x) * k; rp.z += (a[1] - rp.z) * k; rp.rot = a[2];
      avatars.push({ id: 900001 + i, kind: 'player', look: 2 + i, color: col, x: rp.x, z: rp.z, rot: rp.rot, pose: a[4] != null && !a[5] ? POSE.cook : rid ? POSE.carry : a[5] ? POSE.walk : POSE.stand, carry: rid, shop: o });
      signBoard(o, s, rp.x, rp.z, rp.rot, !!a[6]);
      const p = s && G.players.get(playerOf(s));
      nameTag(o, p?.name || s?.ownerName || '', col, rp.x, rp.z);
    });
  }
  for (const t of nameTags.values()) if (!t.userData.seen) t.visible = false;
  for (const g of signBoards.values()) { if (!g.userData.seen) g.visible = false; g.userData.seen = false; }
  const all = list.concat(avatars);
  crowd.update(all, dt, elapsed);
  updateEmotes(list);

  // 時刻と光
  let hour = 17.5;
  if (G.phase === 'prep') hour = 9 + (1 - G.phaseT / PREP_TIME) * 2;
  else if (G.phase === 'open') hour = G.dyn?.hour ?? 11;
  else if (G.phase === 'result') hour = 21.3;
  GX.setHour(Math.min(hour, 22));
  town3d.update(dt, GX.night);
  updateCamera(dt);
  const showRoof = G.cam.dist > 45 || G.cam.cine || G.phase === 'lobby' || G.phase === 'title';
  for (const [o, v] of views) {
    v.camQuat = camera.quaternion;
    v.update(G.phase === 'open' ? G.dyn?.shops?.[o] : null, all, elapsed, GX.night, showRoof);
  }
  updatePops(dt);
  updateHUD(dt);
  GX.follow(camTarget.x, camTarget.z, G.cam.dist * 1.1);
  GX.render();
}
function orderRid(owner, oid) {
  const o = G.dyn?.shops?.[owner]?.orders.find((x) => x.id === oid);
  return o ? o.rid : null;
}

// デバッグ・テスト用
window.__mm = { G, Store, views, camera, regionAt, canMove };
void recipeOf; void seatsOf; void GFX; void GFX_NAMES;

// 町の動き（お客さん・店員・注文・売上・評判）。部屋を作った人のブラウザだけが計算する
import {
  GENRE, GENRES, RECIPE, RECIPES, CUSTOMERS, customerMix, crowdCurve, FURN, FURNITURE, FLOORS, WALLS, LEVELS, LOTS,
  ADS, AD, TROPHIES, makeStaffCandidate, makeCustomRecipe, CUSTOM_DEV_COST, moveCost, START_CAPITAL, BRANCH_FEE, MAX_SHOPS, OPEN_TIME, OPEN_HOUR, CLOSE_HOUR,
  CPU_NAMES, KITCHEN_DEPTH,
} from './data.js';
import { frame, seatsOf, queueSpot, layoutOk, snapItem, cellsOf, NODES, findPath, nearestNode, ENTRANCES, LOT_NODE } from './geo.js';
import { rng, clamp, pickWeighted, uid } from './util.js';

const TYPES = Object.keys(CUSTOMERS);
const SIGN_R = 5.5, SIGN_MAX = 6; // 看板に気づく距離・ついて来る人数
export const POSE = { walk: 0, stand: 1, sit: 2, cook: 3, carry: 4, wave: 5 };
const PLAYER_COOK = 2.0; // 自分で作ると速い
const MAX_PEOPLE = 170;

// ---------- 新しい町・お店 ----------
export function newTown(name, seed) {
  return {
    v: 1, id: uid(), code: Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''),
    name: name || 'まちめし町', created: Date.now(), lastPlayed: Date.now(),
    day: 1, buzz: 5, seed: seed || Math.floor(Math.random() * 1e9), shops: {}, history: [],
  };
}

export function starterLayout(shop) {
  const f = frame(shop);
  const items = [];
  const tryPut = (id, i, j, r = 0) => {
    const it = snapItem(f, { id, u: 0, v: 0, r }, i, j);
    if (layoutOk(f, [...items, it])) { items.push(it); return true; }
    return false;
  };
  tryPut('table2', 0, 0); tryPut('table2', f.cols - 2, 0);
  return items;
}

export function newShop({ owner, player, ownerName, cpu, name, genre, lot, color, branch }) {
  const g = GENRE[genre] || GENRES[0];
  const rec = RECIPES.filter((r) => r.genre === g.id).slice(0, 3);
  const shop = {
    owner, player: player || owner, ownerName: ownerName || '', cpu: !!cpu, name: name || g.name, genre: g.id, lot, level: 1, color: color || 0,
    // 資本金から土地代を払った残りが所持金（2店目からは1つのお財布を使う）
    money: cpu ? 80000 : branch ? 0 : START_CAPITAL - LOTS[lot].price, rating: 3.0, reviews: 0,
    menu: rec.map((r) => ({ rid: r.id, price: r.price })), customs: [],
    layout: [], floor: 'wood', wall: 'cream', perm: {},
    staff: [], cands: [], ads: {},
    stats: { totalCust: 0, totalSales: 0, bestDayCust: 0, bestDaySales: 0, bestQueue: 0, days: 0, perfectDay: false },
    trophies: [], lastSeen: Date.now(), away: null,
  };
  shop.layout = starterLayout(shop);
  const r = rng(Date.now() + lot);
  shop.staff.push({ ...makeStaffCandidate(r, 'all'), skill: 2, speed: 3, charm: 2, wage: 3500 });
  shop.cands = [makeStaffCandidate(r, 'cook'), makeStaffCandidate(r, 'hall'), makeStaffCandidate(r)];
  return shop;
}

// お金はプレイヤーごとに1つ（1店目にまとめてある）
export const playerOf = (shop) => shop.player || shop.owner;
export function walletOf(shops, shop) { return shops[playerOf(shop)] || shop; }
export function shopsOf(shops, pid) { return Object.values(shops).filter((s) => !s.cpu && playerOf(s) === pid); }

export function recipeOf(shop, rid) { return RECIPE[rid] || (shop.customs || []).find((c) => c.id === rid) || null; }
export function freeLots(town) {
  const used = new Set(Object.values(town.shops).map((s) => s.lot));
  return LOTS.filter((l) => !used.has(l.id)).map((l) => l.id);
}

// ---------- 町の計算 ----------
export class World {
  constructor(town) {
    this.town = town;
    this.rnd = rng(town.seed + town.day * 7919);
    this.people = new Map();
    this.nextId = 1;
    this.phase = 'prep';
    this.t = 0;
    this.rt = new Map();
    this.avatars = new Map(); // owner -> { x, z, rot, carry, cook, moving }
    this.events = [];
    this.added = []; this.removed = [];
    this.trainT = 20;
    for (const o of Object.keys(town.shops)) this.rebuild(o);
  }

  get shops() { return this.town.shops; }
  get hour() { return OPEN_HOUR + (this.phase === 'open' ? this.t / OPEN_TIME : 0) * (CLOSE_HOUR - OPEN_HOUR); }
  fx(ev) { this.events.push(ev); }

  // お店の形が変わったら席などを作り直す
  rebuild(owner) {
    const shop = this.shops[owner];
    if (!shop) { this.rt.delete(owner); return; }
    const f = frame(shop);
    const old = this.rt.get(owner);
    const seats = seatsOf(f, shop.layout).map((s) => ({ ...s, occ: null, dirty: false, cleaner: null }));
    let comfort = 0, look = 0;
    for (const it of shop.layout) { comfort += FURN[it.id].comfort; look += FURN[it.id].look; }
    const nSeats = Math.max(1, seats.length);
    look += (FLOORS.find((x) => x.id === shop.floor)?.cost || 0) / 10000 + (shop.perm.signboard ? 1.5 : 0) + shop.level * 0.6;
    const rt = {
      f, seats,
      comfort: clamp(comfort / nSeats * 1.6, 0, 3),
      look: clamp(look / 6, 0, 3),
      orders: old?.orders || [], queue: old?.queue || [],
      stoves: new Array(f.stoves.length).fill(null),
      slots: new Array(f.slots.length).fill(null),
      today: old?.today || this.blankToday(),
      staffP: old?.staffP || [],
    };
    this.rt.set(owner, rt);
  }
  blankToday() { return { sales: 0, cust: 0, angry: 0, cost: 0, revSum: 0, revN: 0, bestQueue: 0, dishes: {} }; }

  addShop(shop) { this.shops[shop.owner] = shop; this.rebuild(shop.owner); }

  // ---------- 準備 ----------
  startPrep() {
    this.phase = 'prep'; this.t = 0;
    for (const id of [...this.people.keys()]) this.removePerson(id);
    const r = rng(this.town.seed + this.town.day * 104729);
    for (const [o, shop] of Object.entries(this.shops)) {
      shop.ads = {};
      shop.cands = [makeStaffCandidate(r, 'cook'), makeStaffCandidate(r, 'hall'), makeStaffCandidate(r)];
      const rt = this.rt.get(o); if (rt) { rt.orders = []; rt.queue = []; rt.staffP = []; rt.today = this.blankToday(); }
      this.rebuild(o);
      if (shop.cpu) cpuPrep(this, shop, r);
    }
  }

  // ---------- 営業スタート ----------
  startOpen() {
    this.phase = 'open'; this.t = 0; this.trainT = 12;
    this.rnd = rng(this.town.seed + this.town.day * 7919);
    for (const o of Object.keys(this.shops)) {
      this.rebuild(o);
      const rt = this.rt.get(o);
      rt.orders = []; rt.queue = []; rt.today = this.blankToday(); rt.staffP = [];
      const shop = this.shops[o];
      const list = [...shop.staff];
      // コンピューターのお店は店長も働く
      if (shop.cpu) list.push({ id: 'boss', name: '店長', role: 'all', skill: 3, speed: 3, charm: 3, look: shop.lot * 77 });
      list.forEach((s, i) => {
        const pos = rt.f.kitchenIdle;
        const p = this.addPerson({ kind: 'staff', shop: o, staff: s, x: pos.x + (i % 3) * 0.5, z: pos.z, look: s.look, state: 'idle', speed: 1.5 + s.speed * 0.12 });
        rt.staffP.push(p.id);
      });
    }
  }

  // ---------- 1日の終わり ----------
  endDay() {
    const results = [];
    // 食べている人はお会計してから帰る
    for (const p of this.people.values()) if (p.kind === 'cust' && p.state === 'eat') this.pay(p);
    let dayCust = 0, ratingSum = 0, n = 0;
    for (const [o, shop] of Object.entries(this.shops)) {
      const rt = this.rt.get(o);
      const td = rt.today;
      const wages = shop.staff.reduce((a, s) => a + s.wage, 0);
      const rent = LOTS[shop.lot].rent * (0.2 + shop.level * 0.15);
      walletOf(this.shops, shop).money -= wages + rent;
      const profit = td.sales - td.cost - wages - rent - (td.adCost || 0);
      const st = shop.stats;
      st.totalCust += td.cust; st.totalSales += td.sales; st.days++;
      st.bestDayCust = Math.max(st.bestDayCust, td.cust);
      st.bestDaySales = Math.max(st.bestDaySales, td.sales);
      st.bestQueue = Math.max(st.bestQueue, td.bestQueue);
      if (td.cust >= 30 && td.angry === 0) st.perfectDay = true;
      const newT = [];
      for (const T of TROPHIES) if (!shop.trophies.includes(T.id) && T.check(shop)) { shop.trophies.push(T.id); newT.push(T.id); }
      let best = null, bn = 0; for (const [rid, c] of Object.entries(td.dishes)) if (c > bn) { bn = c; best = rid; }
      results.push({
        owner: o, name: shop.name, ownerName: shop.ownerName, cpu: shop.cpu, genre: shop.genre, color: shop.color,
        sales: td.sales, cust: td.cust, angry: td.angry, cost: td.cost, wages, rent, adCost: td.adCost || 0, profit,
        rating: shop.rating, review: td.revN ? td.revSum / td.revN : 0, money: walletOf(this.shops, shop).money, player: playerOf(shop), newTrophies: newT,
        bestDish: best ? recipeOf(shop, best)?.name : null, bestDishN: bn,
      });
      dayCust += td.cust; ratingSum += shop.rating; n++;
      shop.lastSeen = shop.cpu ? shop.lastSeen : shop.lastSeen;
    }
    // 町のにぎわい：みんなが頑張るほど上がる
    const score = dayCust * 0.22 + Object.values(this.shops).reduce((a, s) => a + Math.max(0, s.rating - 2.6) * 6, 0);
    const target = clamp(score, 0, 100);
    const before = this.town.buzz;
    this.town.buzz = clamp(before + (target - before) * 0.3, 0, 100);
    this.town.history.push({ day: this.town.day, cust: dayCust, buzz: Math.round(this.town.buzz) });
    if (this.town.history.length > 60) this.town.history.shift();
    const summary = { day: this.town.day, results, buzzBefore: before, buzz: this.town.buzz, dayCust };
    this.town.day++;
    this.town.lastPlayed = Date.now();
    for (const id of [...this.people.keys()]) this.removePerson(id);
    this.phase = 'result';
    return summary;
  }

  // ---------- 人 ----------
  addPerson(o) {
    const p = { id: this.nextId++, x: 0, z: 0, rot: 0, pose: POSE.walk, path: [], carry: null, emote: null, emoteT: 0, timer: 0, speed: 1.3, ...o };
    this.people.set(p.id, p);
    this.added.push(p.id);
    return p;
  }
  removePerson(id) {
    if (this.people.delete(id)) this.removed.push(id);
  }
  emote(p, e, dur = 2.5) { p.emote = e; p.emoteT = dur; }

  route(p, fromNode, toNode, jitter = 0.55) {
    const ids = findPath(fromNode, toNode);
    const j = (this.rnd() * 2 - 1) * jitter;
    p.path = ids.map((id) => {
      const n = NODES[id];
      // 歩道の上で少し左右にずらす
      const onMain = Math.abs(Math.abs(n.z) - 5.5) < 0.01 && Math.abs(n.x) > 6;
      return onMain ? { x: n.x, z: n.z + j, node: id } : { x: n.x + j, z: n.z, node: id };
    });
  }

  spawnCustomer(entrance, forceType) {
    if (this.people.size >= MAX_PEOPLE) return null;
    const r = this.rnd;
    const type = forceType || pickWeighted(r, customerMix(this.hour));
    const exits = ENTRANCES.filter((e) => e.node !== entrance.node);
    const exit = exits[Math.floor(r() * exits.length)];
    const p = this.addPerson({
      kind: 'cust', type, look: Math.floor(r() * 1e9), x: entrance.x, z: entrance.z,
      speed: (type === 'worker' ? 1.55 : type === 'relax' ? 1.05 : 1.3) * (0.9 + r() * 0.2),
      hungry: r() < (type === 'tourist' ? 0.85 : 0.65), exit: exit.node, checked: new Set(), state: 'pass',
    });
    // 評判を聞いて来る人（行き先を決めてから歩く）
    const visitP = (type === 'tourist' ? 0.55 : 0.18) + this.flyerBoost();
    if (p.hungry && r() < visitP) {
      const target = this.chooseByReputation(p);
      if (target) { p.state = 'go'; p.target = target; this.route(p, entrance.node, LOT_NODE[this.shops[target].lot]); return p; }
    }
    this.route(p, entrance.node, exit.node);
    return p;
  }
  flyerBoost() { return Object.values(this.shops).some((s) => s.ads.flyer) ? 0.08 : 0; }

  // お店の魅力（お客さんの種類ごと）
  appeal(shop, type, passing) {
    const T = CUSTOMERS[type];
    const rt = this.rt.get(shop.owner);
    if (!rt || !shop.menu.length || !rt.seats.length) return -9;
    const sale = shop.ads.sale && this.hour >= 17 && this.hour < 19;
    let best = -9;
    for (const m of shop.menu) {
      const R = recipeOf(shop, m.rid); if (!R) continue;
      const price = m.price * (sale ? 0.8 : 1);
      const s = R.taste * T.tasteW * 0.35 - (price / T.budget) * T.priceW * 0.9 + (price > T.budget * 1.4 ? -1.2 : 0);
      if (s > best) best = s;
    }
    let a = (T.like[shop.genre] - 1) * 1.2 + best + rt.look * T.lookW * 0.25 + (shop.rating - 3) * T.ratingW * 0.55;
    a += (shop.level - 1) * 0.08;
    const q = rt.queue.length;
    if (q > 0 && q <= 5) a += 0.2; else if (q > 5) a -= (q - 5) * 0.06;
    if (passing) {
      if (shop.ads.tasting) a += 0.45;
      if (shop.perm.signboard) a += 0.25;
      if (shop.perm.neon && this.hour >= 18) a += 0.4;
      if (sale) a += 0.55;
    }
    return a;
  }
  chooseByReputation(p) {
    const T = CUSTOMERS[p.type];
    const list = [];
    for (const shop of Object.values(this.shops)) {
      const a = this.appeal(shop, p.type, false);
      if (a < -5) continue;
      list.push([shop.owner, Math.exp(a * 1.3 + (shop.rating - 3) * T.ratingW * 1.2) * (shop.ads.flyer ? 1.7 : 1)]);
    }
    if (!list.length) return null;
    let sum = list.reduce((s, x) => s + x[1], 0), r = this.rnd() * sum;
    for (const [o, w] of list) { r -= w; if (r <= 0) return o; }
    return list[0][0];
  }

  // お店に着いた
  arriveShop(p, owner) {
    const shop = this.shops[owner], rt = this.rt.get(owner);
    if (!shop || !rt || this.hour >= CLOSE_HOUR - 0.15) return this.resume(p);
    p.shop = owner;
    const seat = this.freeSeat(rt);
    if (seat >= 0 && rt.queue.length === 0) return this.sitDown(p, rt, seat);
    if (rt.queue.length < 30) {
      rt.queue.push(p.id);
      rt.today.bestQueue = Math.max(rt.today.bestQueue, rt.queue.length);
      p.state = 'queue'; p.queueT = 0;
      const s = queueSpot(rt.f, rt.queue.length - 1);
      p.path = [{ x: s.x, z: s.z }];
      return;
    }
    p.shop = null; this.resume(p);
  }
  freeSeat(rt) {
    // 空いている席の中から、先に座っている人が少ないテーブルを選ぶ
    let best = -1, bs = 1e9;
    rt.seats.forEach((s, i) => {
      if (s.occ || s.dirty) return;
      const busy = rt.seats.filter((x) => x.table === s.table && x.occ).length;
      const score = busy * 10 + i * 0.01;
      if (score < bs) { bs = score; best = i; }
    });
    return best;
  }
  sitDown(p, rt, seat) {
    const s = rt.seats[seat];
    s.occ = p.id; p.seat = seat; p.state = 'toSeat';
    p.path = [{ x: rt.f.doorOut.x, z: rt.f.doorOut.z }, { x: rt.f.door.x, z: rt.f.door.z }, { x: s.x, z: s.z }];
  }
  resume(p) {
    p.state = 'pass';
    this.route(p, nearestNode(p.x, p.z), p.exit);
  }
  leave(p, angry) {
    const rt = p.shop ? this.rt.get(p.shop) : null;
    if (rt) {
      if (p.seat != null && rt.seats[p.seat]?.occ === p.id) rt.seats[p.seat].occ = null;
      const qi = rt.queue.indexOf(p.id);
      if (qi >= 0) { rt.queue.splice(qi, 1); this.reflowQueue(rt); }
      rt.orders = rt.orders.filter((o) => {
        if (o.cust !== p.id) return true;
        this.releaseOrder(rt, o);
        return false;
      });
      if (angry) {
        rt.today.angry++;
        const shop = this.shops[p.shop];
        shop.rating = clamp(shop.rating - 0.035, 1, 5);
        this.emote(p, '💢', 3);
        this.fx({ k: 'angry', shop: p.shop, x: p.x, z: p.z });
      }
    }
    const inside = p.seat != null && rt;
    p.seat = null; p.state = 'leave';
    const path = [];
    if (inside) path.push({ x: rt.f.door.x, z: rt.f.door.z }, { x: rt.f.doorOut.x, z: rt.f.doorOut.z });
    const from = nearestNode(rt ? rt.f.walk.x : p.x, rt ? rt.f.walk.z : p.z);
    this.route(p, from, p.exit);
    p.path = [...path, ...p.path];
    p.shop = null;
  }
  releaseOrder(rt, o) {
    if (o.stove != null && rt.stoves[o.stove] === o.id) rt.stoves[o.stove] = null;
    if (o.slot != null && rt.slots[o.slot] === o.id) rt.slots[o.slot] = null;
    for (const sid of rt.staffP) { const s = this.people.get(sid); if (s && s.task?.order === o.id) { s.task = null; s.carry = null; s.state = 'idle'; } }
    for (const av of this.avatars.values()) { if (av.carry === o.id) av.carry = null; if (av.cook === o.id) av.cook = null; }
  }
  reflowQueue(rt) {
    rt.queue.forEach((id, i) => {
      const q = this.people.get(id); if (!q) return;
      const s = queueSpot(rt.f, i);
      q.path = [{ x: s.x, z: s.z }];
    });
  }

  // 注文を決める
  order(p) {
    const shop = this.shops[p.shop], rt = this.rt.get(p.shop), T = CUSTOMERS[p.type];
    const sale = shop.ads.sale && this.hour >= 17 && this.hour < 19;
    let best = null, bs = -1e9;
    for (const m of shop.menu) {
      const R = recipeOf(shop, m.rid); if (!R) continue;
      const price = Math.round(m.price * (sale ? 0.8 : 1));
      const s = R.taste * T.tasteW - (price / T.budget) * T.priceW * 2.2 + this.rnd() * 1.2;
      if (s > bs) { bs = s; best = { R, price }; }
    }
    if (!best) return this.leave(p, false);
    const o = { id: this.nextId++, cust: p.id, rid: best.R.id, price: best.price, state: 'wait', prog: 0, stove: null, slot: null, by: null, q: 0, seat: p.seat, t0: this.t };
    rt.orders.push(o);
    walletOf(this.shops, shop).money -= best.R.cost;
    rt.today.cost += best.R.cost;
    p.state = 'waitFood'; p.waitT = 0; p.order = o.id;
    this.fx({ k: 'order', shop: p.shop, rid: o.rid, x: p.x, z: p.z });
  }

  serve(p, o, rt) {
    o.state = 'served';
    p.state = 'eat'; p.timer = CUSTOMERS[p.type].eat * (0.85 + this.rnd() * 0.3); p.pose = POSE.sit;
    p.dish = o.rid;
    p.waited = this.t - o.t0;
    this.emote(p, '✨', 1.2);
  }

  // お会計と口コミ
  pay(p) {
    const shop = this.shops[p.shop], rt = this.rt.get(p.shop), T = CUSTOMERS[p.type];
    const o = rt.orders.find((x) => x.cust === p.id);
    if (!o) return;
    const R = recipeOf(shop, o.rid);
    const fit = R && (R.genre === shop.genre || (R.genres || []).includes(shop.genre)) ? 0.25 : -0.2;
    const taste = clamp((o.q || R.taste) + fit, 1, 5);
    const priceScore = clamp(3 + (R.price - o.price) / R.price * 4 - Math.max(0, o.price - T.budget) / T.budget * 3, 1, 5);
    const waitScore = clamp(5 - 4 * ((p.waited || 0) / T.patience), 1, 5);
    const comfortScore = clamp(2.6 + rt.comfort * 0.75, 1, 5);
    const w = T.tasteW + T.priceW + T.speedW + T.lookW;
    const review = clamp((taste * T.tasteW + priceScore * T.priceW + waitScore * T.speedW + comfortScore * T.lookW) / w + (this.rnd() - 0.5) * 0.4, 1, 5);
    const k = Math.max(0.02, 1 / (shop.reviews + 8));
    shop.rating = clamp(shop.rating + (review - shop.rating) * k, 1, 5);
    shop.reviews++;
    walletOf(this.shops, shop).money += o.price;
    rt.today.sales += o.price; rt.today.cust++; rt.today.revSum += review; rt.today.revN++;
    rt.today.dishes[o.rid] = (rt.today.dishes[o.rid] || 0) + 1;
    rt.orders = rt.orders.filter((x) => x !== o);
    if (p.seat != null && rt.seats[p.seat]) rt.seats[p.seat].dirty = true;
    this.emote(p, review >= 4.2 ? '❤️' : review >= 3.2 ? '♪' : '💧', 2.5);
    this.fx({ k: 'coin', shop: p.shop, amount: o.price, x: p.x, z: p.z, review });
    p.dish = null;
  }

  // ---------- 1コマ進める ----------
  update(dt) {
    if (this.phase !== 'open') return;
    this.t += dt;
    const hour = this.hour;
    // 人が来る
    if (hour < CLOSE_HOUR - 0.3) {
      const nShops = Math.max(1, Object.keys(this.shops).length);
      const rate = 0.7 * crowdCurve(hour) * (1 + this.town.buzz / 40) * (0.6 + nShops * 0.1);
      if (this.rnd() < rate * dt) {
        const e = pickWeighted(this.rnd, Object.fromEntries(ENTRANCES.map((x, i) => [i, x.w])));
        this.spawnCustomer(ENTRANCES[+e]);
      }
      // 電車が着くと観光客がまとめて来る
      this.trainT -= dt;
      if (this.trainT <= 0) {
        this.trainT = 38 + this.rnd() * 14;
        const n = Math.round(1 + this.town.buzz / 9 + this.rnd() * 2);
        this.fx({ k: 'train', n });
        for (let i = 0; i < n; i++) {
          const e = ENTRANCES[this.rnd() < 0.5 ? 0 : 1];
          const tourist = this.rnd() < 0.25 + this.town.buzz / 130;
          setTimeoutish(this, i * 0.6, () => this.spawnCustomer(e, tourist ? 'tourist' : null));
        }
      }
    }
    this.runLater(dt);
    this.signboards(dt);
    for (const p of [...this.people.values()]) this.step(p, dt);
    for (const [o, rt] of this.rt) this.stepShop(o, rt, dt);
    if (this.t >= OPEN_TIME) return 'end';
    return null;
  }
  // 看板を持って歩くプレイヤーに、近くのお客さんがついて行く
  signboards(dt) {
    for (const [sid, av] of this.avatars) {
      if (!av.sign || !this.shops[sid]) continue;
      let n = 0;
      for (const p of this.people.values()) if (p.state === 'follow' && p.follow === sid) n++;
      if (n >= SIGN_MAX) continue;
      for (const p of this.people.values()) {
        if (p.kind !== 'cust' || p.noSign || (p.state !== 'pass' && p.state !== 'go') || p.target === sid) continue;
        if (Math.hypot(p.x - av.x, p.z - av.z) > SIGN_R) continue;
        // おなかがすいている人ほどついて来る。行き先が決まっている人は少しだけ
        const chance = (p.state === 'go' ? 0.12 : p.hungry ? 0.6 : 0.22) * dt;
        if (this.rnd() < chance) {
          p.state = 'follow'; p.follow = sid; p.followT = 0; p.followN = n; p.path = []; p.target = null;
          this.emote(p, '👀', 1.5);
          if (++n >= SIGN_MAX) break;
        } else if (this.rnd() < dt * 0.5) p.noSign = p.noSign || this.rnd() < 0.15; // 興味がない人もいる
      }
    }
  }
  stepFollow(p, dt) {
    const av = this.avatars.get(p.follow), shop = this.shops[p.follow];
    p.followT += dt;
    if (!av || !av.sign || !shop || p.followT > 100) { p.noSign = true; p.follow = null; return this.resume(p); }
    // お店の前まで来たら入る
    const n = NODES[LOT_NODE[shop.lot]];
    if (Math.hypot(p.x - n.x, p.z - n.z) < 3.2) { p.noSign = true; p.follow = null; return this.arriveShop(p, shop.owner); }
    const d = Math.hypot(av.x - p.x, av.z - p.z), keep = 1.3 + (p.followN || 0) * 0.55;
    if (d > keep) {
      const sp = Math.min(d - keep, p.speed * 1.35 * dt);
      p.x += (av.x - p.x) / d * sp; p.z += (av.z - p.z) / d * sp;
      p.rot = Math.atan2(av.x - p.x, av.z - p.z); p.pose = POSE.walk;
    } else p.pose = POSE.stand;
  }
  runLater(dt) {
    if (!this.later) return;
    for (const l of this.later) l.t -= dt;
    const due = this.later.filter((l) => l.t <= 0);
    this.later = this.later.filter((l) => l.t > 0);
    for (const l of due) l.fn();
  }

  walk(p, dt) {
    if (!p.path.length) return true;
    const tgt = p.path[0];
    const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
    const sp = p.speed * dt;
    if (d <= sp) {
      p.x = tgt.x; p.z = tgt.z; p.path.shift();
      if (tgt.node != null) this.onNode(p, tgt.node);
      return !p.path.length;
    }
    p.x += dx / d * sp; p.z += dz / d * sp;
    p.rot = Math.atan2(dx, dz);
    return false;
  }

  onNode(p, nodeId) {
    if (p.kind !== 'cust') return;
    if (p.state === 'pass' && p.hungry && !p.checked.has(nodeId)) {
      p.checked.add(nodeId);
      const lotId = LOT_NODE.indexOf(nodeId);
      if (lotId < 0) return;
      const shop = Object.values(this.shops).find((s) => s.lot === lotId);
      if (!shop) return;
      const a = this.appeal(shop, p.type, true);
      const pr = 1 / (1 + Math.exp(-(a * 2.0 - 0.9))) * 0.7;
      if (this.rnd() < pr) { p.path = []; this.arriveShop(p, shop.owner); }
    } else if (p.state === 'go' && p.target && LOT_NODE[this.shops[p.target]?.lot] === nodeId) {
      p.path = []; this.arriveShop(p, p.target);
    }
  }

  step(p, dt) {
    if (p.emoteT > 0) { p.emoteT -= dt; if (p.emoteT <= 0) p.emote = null; }
    if (p.kind === 'staff') return this.stepStaff(p, dt);
    if (p.kind !== 'cust') return;
    const T = CUSTOMERS[p.type];
    switch (p.state) {
      case 'follow': this.stepFollow(p, dt); break;
      case 'pass': case 'go': case 'leave':
        p.pose = POSE.walk;
        if (this.walk(p, dt)) {
          if (p.state === 'go' && p.target) this.arriveShop(p, p.target);
          else if (p.state === 'pass' || p.state === 'leave') this.removePerson(p.id);
        }
        break;
      case 'queue': {
        p.queueT += dt;
        p.pose = this.walk(p, dt) ? POSE.stand : POSE.walk;
        const rt = this.rt.get(p.shop);
        if (p.pose === POSE.stand && rt) p.rot = Math.atan2(rt.f.walk.x - p.x, rt.f.walk.z - p.z);
        if (rt && rt.queue[0] === p.id) {
          const seat = this.freeSeat(rt);
          if (seat >= 0) { rt.queue.shift(); this.reflowQueue(rt); this.sitDown(p, rt, seat); break; }
        }
        if (p.queueT > T.patience * 1.6) this.leave(p, true);
        else if (p.queueT > T.patience * 1.1 && !p.emote) this.emote(p, '💤', 2);
        break;
      }
      case 'toSeat': {
        p.pose = POSE.walk;
        if (this.walk(p, dt)) {
          const rt = this.rt.get(p.shop); const s = rt.seats[p.seat];
          p.rot = s.rot; p.pose = POSE.sit; p.state = 'think'; p.timer = 1.5 + this.rnd() * 2;
        }
        break;
      }
      case 'think':
        p.timer -= dt; if (p.timer <= 0) this.order(p);
        break;
      case 'waitFood':
        p.waitT += dt;
        if (p.waitT > T.patience) this.leave(p, true);
        else if (p.waitT > T.patience * 0.65 && !p.emote && this.rnd() < dt * 0.5) this.emote(p, '💦', 1.8);
        break;
      case 'eat':
        p.timer -= dt;
        if (p.timer <= 0) { this.pay(p); this.leave(p, false); }
        break;
    }
  }

  // ---------- 店員 ----------
  stepStaff(p, dt) {
    const rt = this.rt.get(p.shop); if (!rt) return;
    const st = p.staff;
    const t = p.task;
    if (!t) {
      p.task = this.findTask(p, rt);
      if (!p.task) {
        const idle = st.role === 'hall' ? rt.f.hallIdle : rt.f.kitchenIdle;
        if (Math.hypot(p.x - idle.x, p.z - idle.z) > 0.3) { p.path = [{ x: idle.x, z: idle.z }]; p.pose = this.walk(p, dt) ? POSE.stand : POSE.walk; }
        else { p.pose = POSE.stand; p.rot = rt.f.side < 0 ? Math.PI : 0; p.rot += Math.PI; }
      }
      return;
    }
    const arrived = this.walk(p, dt);
    p.pose = arrived ? POSE.stand : (p.carry ? POSE.carry : POSE.walk);
    if (p.carry && !arrived) p.pose = POSE.carry;
    if (!arrived) return;
    const o = t.order != null ? rt.orders.find((x) => x.id === t.order) : null;
    switch (t.k) {
      case 'cook': {
        if (!o) { p.task = null; break; }
        p.pose = POSE.cook; p.rot = rt.f.side < 0 ? Math.PI : 0;
        const R = recipeOf(this.shops[p.shop], o.rid);
        const mult = (0.55 + st.speed * 0.1 + st.skill * 0.05) * (st.role === 'all' ? 0.85 : 1);
        o.prog += dt * mult / R.time;
        if (o.prog >= 1) {
          const slot = rt.slots.indexOf(null);
          if (slot < 0) break; // 置き場がいっぱい
          rt.stoves[o.stove] = null; o.stove = null;
          o.state = 'ready'; o.slot = slot; rt.slots[slot] = o.id; o.by = null;
          o.q = R.taste + (st.skill - 3) * 0.15;
          p.task = null;
          this.fx({ k: 'ready', shop: p.shop });
        }
        break;
      }
      case 'pick': {
        if (!o || o.state !== 'ready') { p.task = null; break; }
        rt.slots[o.slot] = null; o.slot = null; o.state = 'carry';
        p.carry = o.rid;
        const seat = rt.seats[o.seat];
        p.task = { k: 'serve', order: o.id };
        p.path = [{ x: seat.px + (seat.x - seat.px) * 0.2 + 0.5, z: seat.pz + 0.01 }];
        p.path = [this.besideSeat(rt, seat)];
        break;
      }
      case 'serve': {
        const cust = o ? this.people.get(o.cust) : null;
        p.carry = null; p.task = null;
        if (o && cust && cust.state === 'waitFood') this.serve(cust, o, rt);
        break;
      }
      case 'clean': {
        p.pose = POSE.cook;
        t.time = (t.time || 0) + dt;
        if (t.time > 1.6 - st.speed * 0.15) {
          const s = rt.seats[t.seat]; if (s) { s.dirty = false; s.cleaner = null; }
          p.task = null;
        }
        break;
      }
    }
  }
  besideSeat(rt, seat) {
    // 席のとなり（テーブルの横）に立つ
    const dx = seat.x - seat.px, dz = seat.z - seat.pz, d = Math.hypot(dx, dz) || 1;
    return { x: seat.x + (-dz / d) * 0.55, z: seat.z + (dx / d) * 0.55 };
  }
  findTask(p, rt) {
    const role = p.staff.role;
    const canHall = role !== 'cook', canCook = role !== 'hall';
    if (canHall) {
      const o = rt.orders.find((x) => x.state === 'ready' && !x.by);
      if (o) { o.by = p.id; const s = rt.f.slots[o.slot]; p.path = this.kitchenPath(p, rt, s.front, false); return { k: 'pick', order: o.id }; }
    }
    if (canCook) {
      const o = rt.orders.find((x) => x.state === 'wait' && !x.by);
      const stove = rt.stoves.indexOf(null);
      if (o && stove >= 0) {
        o.state = 'cook'; o.by = p.id; o.stove = stove; rt.stoves[stove] = o.id;
        const s = rt.f.stoves[stove].stand;
        p.path = this.kitchenPath(p, rt, s, true);
        return { k: 'cook', order: o.id };
      }
    }
    if (canHall) {
      const si = rt.seats.findIndex((s) => s.dirty && !s.cleaner && !s.occ);
      if (si >= 0) { rt.seats[si].cleaner = p.id; p.path = [this.besideSeat(rt, rt.seats[si])]; return { k: 'clean', seat: si }; }
    }
    return null;
  }
  // 厨房の出入りは入り口を通る
  kitchenPath(p, rt, dest, toKitchen) {
    const inKitchen = this.inKitchen(rt, p.x, p.z);
    if (inKitchen === toKitchen) return [dest];
    return [{ x: rt.f.gate.x, z: rt.f.gate.z }, dest];
  }
  inKitchen(rt, x, z) {
    const f = rt.f;
    const v = (z - f.side * 7) * f.side;
    return v > f.passV;
  }

  stepShop(owner, rt, dt) {
    // お客さんが入ってこない屋台でも行列は進む
    const av = this.avatars.get(owner);
    if (av && av.cook != null) {
      const o = rt.orders.find((x) => x.id === av.cook);
      const stand = o && o.stove != null ? rt.f.stoves[o.stove].stand : null;
      if (!o || !stand) { av.cook = null; }
      else if (Math.hypot(av.x - stand.x, av.z - stand.z) > 1.4) {
        // 離れたら途中のまま置いておく
        rt.stoves[o.stove] = null; o.stove = null; o.state = 'wait'; o.by = null; av.cook = null;
      } else {
        const R = recipeOf(this.shops[owner], o.rid);
        o.prog += dt * PLAYER_COOK / R.time;
        if (o.prog >= 1) {
          const slot = rt.slots.indexOf(null);
          if (slot >= 0) {
            rt.stoves[o.stove] = null; o.stove = null; o.state = 'ready'; o.slot = slot; rt.slots[slot] = o.id; o.by = null;
            o.q = R.taste + 0.25; av.cook = null;
            this.fx({ k: 'ready', shop: owner, me: true });
          }
        }
      }
    }
  }

  // ---------- プレイヤーの行動 ----------
  setAvatar(owner, x, z, rot, moving, sign) {
    let av = this.avatars.get(owner);
    if (!av) { av = { x, z, rot, carry: null, cook: null }; this.avatars.set(owner, av); }
    av.x = x; av.z = z; av.rot = rot; av.moving = moving;
    if (sign !== undefined) av.sign = !!sign;
    if (av.carry != null || av.cook != null) av.sign = false;
    return av;
  }
  // その場でできること（近くのもの）を探す
  contextAt(owner) {
    const av = this.avatars.get(owner), rt = this.rt.get(owner);
    if (!av || !rt || this.phase !== 'open') return null;
    return contextOf(av, rt.f, rt.orders, rt.seats);
  }
  act(owner) {
    const c = this.contextAt(owner);
    if (!c) return null;
    const av = this.avatars.get(owner), rt = this.rt.get(owner);
    const o = c.order != null ? rt.orders.find((x) => x.id === c.order) : null;
    switch (c.k) {
      case 'serve': {
        const cust = o && this.people.get(o.cust);
        av.carry = null;
        if (o && cust && cust.state === 'waitFood') { this.serve(cust, o, rt); this.fx({ k: 'served', shop: owner, me: true }); }
        return c;
      }
      case 'pick': {
        if (!o || o.state !== 'ready') return null;
        // 店員が取りに来ていたら任せずに自分が持つ
        for (const sid of rt.staffP) { const s = this.people.get(sid); if (s && s.task?.order === o.id) { s.task = null; s.path = []; } }
        rt.slots[o.slot] = null; o.slot = null; o.state = 'carry'; o.by = 'me';
        av.carry = o.id;
        this.fx({ k: 'pick', shop: owner, me: true });
        return c;
      }
      case 'cook': {
        if (!o) return null;
        if (c.help) {
          for (const sid of rt.staffP) { const s = this.people.get(sid); if (s && s.task?.order === o.id) { s.task = null; s.path = []; } }
        } else {
          o.stove = c.stove; rt.stoves[c.stove] = o.id;
        }
        o.state = 'cook'; o.by = 'me'; av.cook = o.id;
        this.fx({ k: 'cook', shop: owner, me: true });
        return c;
      }
      case 'clean': {
        const s = rt.seats[c.seat];
        if (s.cleaner) { const st = this.people.get(s.cleaner); if (st) { st.task = null; } }
        s.dirty = false; s.cleaner = null;
        this.fx({ k: 'clean', shop: owner, me: true });
        return c;
      }
    }
    return null;
  }

  // ---------- 準備のコマンド ----------
  cmd(owner, c) {
    const shop = this.shops[owner];
    if (!shop) return { ok: false, msg: 'お店がありません' };
    const res = applyCmd(this, shop, c);
    if (res.ok) this.rebuild(owner);
    return res;
  }

  // ---------- 送る・描く用のデータ ----------
  view() {
    const people = [];
    for (const p of this.people.values()) people.push(p);
    const shops = {};
    for (const [o, rt] of this.rt) {
      shops[o] = {
        q: rt.queue.length, sales: rt.today.sales, cust: rt.today.cust,
        orders: rt.orders.map((x) => ({ id: x.id, rid: x.rid, state: x.state, slot: x.slot, seat: x.seat, prog: Math.round(x.prog * 100) / 100, stove: x.stove, by: x.by ? 1 : 0 })),
        dirty: rt.seats.map((s) => (s.dirty ? 1 : 0) + (s.occ ? 2 : 0)),
      };
    }
    return { phase: this.phase, t: this.t, hour: this.hour, people, shops };
  }
}

// プレイヤーが近くでできること（親でも子でも同じ計算）
// av: { x, z, carry, cook }  orders: { id, state, slot, seat, stove }  seats: { x, z, px, pz, dirty, occ }
export function contextOf(av, f, orders, seats) {
  const near = (pt, r) => Math.hypot(av.x - pt.x, av.z - pt.z) < r;
  if (av.carry != null) {
    const o = orders.find((x) => x.id === av.carry);
    if (!o) return null;
    const seat = seats[o.seat];
    if (seat && near(seat, 1.7)) return { k: 'serve', order: o.id };
    return { k: 'carrying', order: o.id, seat: o.seat };
  }
  let best = null, bd = 1.4;
  for (const o of orders) {
    if (o.state !== 'ready' || o.slot == null) continue;
    const s = f.slots[o.slot]; if (!s) continue;
    const d = Math.min(Math.hypot(av.x - s.front.x, av.z - s.front.z), Math.hypot(av.x - s.back.x, av.z - s.back.z));
    if (d < bd) { bd = d; best = { k: 'pick', order: o.id }; }
  }
  if (best) return best;
  for (let i = 0; i < f.stoves.length; i++) {
    if (!near(f.stoves[i].stand, 1.3)) continue;
    if (av.cook != null) return { k: 'cooking' };
    const cur = orders.find((x) => x.stove === i && x.state === 'cook');
    if (cur) return { k: 'cook', stove: i, order: cur.id, help: true };
    const o = orders.find((x) => x.state === 'wait' && !x.by);
    if (o) return { k: 'cook', stove: i, order: o.id };
    return { k: 'nocook' };
  }
  for (let i = 0; i < seats.length; i++) {
    const s = seats[i];
    if (s.dirty && !s.occ && near(s, 1.6)) return { k: 'clean', seat: i };
  }
  return null;
}

// 少しあとで実行（電車から順番に降りてくる）
function setTimeoutish(w, t, fn) { (w.later ||= []).push({ t, fn }); }

// ---------- 準備のコマンド ----------
export function applyCmd(world, shop, c) {
  const L = LEVELS[shop.level];
  const f = frame(shop);
  const W = world ? walletOf(world.shops, shop) : shop;
  const pay = (n) => { if (W.money < n) return false; W.money -= n; return true; };
  switch (c.op) {
    case 'rename': shop.name = String(c.name || '').slice(0, 12) || shop.name; return { ok: true };
    case 'price': {
      const m = shop.menu.find((x) => x.rid === c.rid); if (!m) return { ok: false };
      m.price = clamp(Math.round(c.price / 10) * 10, 50, 30000); return { ok: true };
    }
    case 'addMenu': {
      if (shop.menu.length >= L.menu) return { ok: false, msg: `今のお店では${L.menu}品までです` };
      if (shop.menu.some((x) => x.rid === c.rid)) return { ok: false };
      const R = recipeOf(shop, c.rid); if (!R) return { ok: false };
      shop.menu.push({ rid: R.id, price: R.price }); return { ok: true };
    }
    case 'removeMenu': shop.menu = shop.menu.filter((x) => x.rid !== c.rid); return { ok: true };
    case 'dev': {
      const R = makeCustomRecipe(c.base, c.main, c.flavor, c.name);
      if (!R) return { ok: false };
      if (shop.customs.some((x) => x.id === R.id)) return { ok: false, msg: 'その組み合わせはもう作りました' };
      if (!pay(CUSTOM_DEV_COST)) return { ok: false, msg: 'お金が足りません' };
      shop.customs.push(R);
      if (shop.menu.length < L.menu) shop.menu.push({ rid: R.id, price: R.price });
      return { ok: true, recipe: R };
    }
    case 'place': {
      const F = FURN[c.id]; if (!F) return { ok: false };
      const it = { id: c.id, u: c.u, v: c.v, r: c.r ? 1 : 0 };
      if (!layoutOk(f, [...shop.layout, it])) return { ok: false, msg: 'そこには置けません' };
      if (!pay(F.cost)) return { ok: false, msg: 'お金が足りません' };
      shop.layout.push(it); return { ok: true };
    }
    case 'moveItem': {
      const old = shop.layout[c.idx]; if (!old) return { ok: false };
      const it = { ...old, u: c.u, v: c.v, r: c.r ? 1 : 0 };
      const rest = shop.layout.filter((_, i) => i !== c.idx);
      if (!layoutOk(f, [...rest, it])) return { ok: false, msg: 'そこには置けません' };
      shop.layout[c.idx] = it; return { ok: true };
    }
    case 'sell': {
      const it = shop.layout[c.idx]; if (!it) return { ok: false };
      shop.layout.splice(c.idx, 1); W.money += Math.round(FURN[it.id].cost / 2); return { ok: true };
    }
    case 'floor': {
      const F = FLOORS.find((x) => x.id === c.id); if (!F || shop.floor === F.id) return { ok: false };
      if (!pay(F.cost)) return { ok: false, msg: 'お金が足りません' };
      shop.floor = F.id; return { ok: true };
    }
    case 'wall': {
      const Wl = WALLS.find((x) => x.id === c.id); if (!Wl) return { ok: false };
      if (!pay(2000)) return { ok: false, msg: 'お金が足りません' };
      shop.wall = Wl.id; return { ok: true };
    }
    case 'hire': {
      if (shop.staff.length >= L.staff) return { ok: false, msg: `今のお店では${L.staff}人までです` };
      const s = shop.cands.find((x) => x.id === c.id); if (!s) return { ok: false };
      shop.cands = shop.cands.filter((x) => x !== s); shop.staff.push(s); return { ok: true };
    }
    case 'fire': shop.staff = shop.staff.filter((x) => x.id !== c.id); return { ok: true };
    case 'ad': {
      const A = AD[c.id]; if (!A) return { ok: false };
      if (A.once ? shop.perm[A.id] : shop.ads[A.id]) return { ok: false, msg: 'もう使っています' };
      if (!pay(A.cost)) return { ok: false, msg: 'お金が足りません' };
      if (A.once) shop.perm[A.id] = true; else shop.ads[A.id] = true;
      const rt = world?.rt.get(shop.owner); if (rt && !A.once) rt.today.adCost = (rt.today.adCost || 0) + A.cost;
      return { ok: true };
    }
    case 'levelUp': {
      const N = LEVELS[shop.level + 1];
      if (!N) return { ok: false, msg: 'もう最高のお店です' };
      if (shop.rating < N.needRating) return { ok: false, msg: `評判が星${N.needRating}以上必要です` };
      if (shop.stats.totalCust < N.needCust) return { ok: false, msg: `のべ${N.needCust}人の来店が必要です` };
      if (!pay(N.cost)) return { ok: false, msg: 'お金が足りません' };
      shop.level++;
      // 家具はそのまま広いお店へ（はみ出したものは売る）
      const nf = frame(shop); const keep = [];
      for (const it of shop.layout) {
        const c2 = cellsOf(nf, it); const sn = snapItem(nf, it, c2.i0, c2.j0);
        if (layoutOk(nf, [...keep, sn])) keep.push(sn); else W.money += Math.round(FURN[it.id].cost / 2);
      }
      shop.layout = keep;
      return { ok: true };
    }
    case 'moveLot': {
      const free = world ? freeLots(world.town) : [];
      if (!free.includes(c.lot)) return { ok: false, msg: 'その場所は空いていません' };
      if (!pay(moveCost(shop.lot, c.lot))) return { ok: false, msg: 'お金が足りません' };
      shop.lot = c.lot; return { ok: true };
    }
  }
  return { ok: false };
}

// ---------- 2店目・3店目 ----------
// 町の空き地を早い者勝ちで買う。お金は1店目のお財布から
export function openBranch(world, pid, req) {
  const shops = world.shops, main = shops[pid];
  if (!main) return { ok: false, msg: 'まず1店目を出してください' };
  const mine = shopsOf(shops, pid);
  if (mine.length >= MAX_SHOPS) return { ok: false, msg: `お店は${MAX_SHOPS}店までです` };
  if (!freeLots(world.town).includes(req.lot)) return { ok: false, msg: 'その場所はもう埋まっています' };
  const cost = LOTS[req.lot].price + BRANCH_FEE;
  if (main.money < cost) return { ok: false, msg: 'お金が足りません' };
  let n = 2; while (shops[`${pid}~${n}`]) n++;
  const shop = newShop({ owner: `${pid}~${n}`, player: pid, ownerName: main.ownerName, name: req.name, genre: req.genre, lot: req.lot, color: main.color, branch: true });
  main.money -= cost;
  world.addShop(shop);
  return { ok: true, sid: shop.owner };
}
// 2店目以降をたたむ（土地は7割で売れる）
export function closeBranch(world, pid, sid) {
  const shop = world.shops[sid];
  if (!shop || sid === pid || playerOf(shop) !== pid) return { ok: false, msg: '1店目はたためません' };
  world.shops[pid].money += Math.round(LOTS[shop.lot].price * 0.7);
  delete world.shops[sid];
  world.rebuild(sid);
  return { ok: true };
}

// ---------- コンピューターのお店の作戦 ----------
export function makeCpuShop(town, idx, lot, genre) {
  const r = rng(town.seed + idx * 31337);
  const g = genre || GENRES[Math.floor(r() * GENRES.length)].id;
  const names = CPU_NAMES[g];
  const shop = newShop({ owner: 'cpu' + idx, ownerName: 'CPU', cpu: true, name: names[Math.floor(r() * names.length)], genre: g, lot, color: idx });
  shop.personality = { price: 0.92 + r() * 0.2, decor: r() };
  return shop;
}
export function cpuPrep(world, shop, r) {
  const L = LEVELS[shop.level];
  const P = shop.personality || { price: 1, decor: 0.5 };
  // メニュー：ジャンルのおいしい料理から
  const rec = RECIPES.filter((x) => x.genre === shop.genre).sort((a, b) => b.taste - a.taste);
  for (const R of rec) if (shop.menu.length < L.menu && !shop.menu.some((m) => m.rid === R.id)) shop.menu.push({ rid: R.id, price: R.price });
  for (const m of shop.menu) { const R = recipeOf(shop, m.rid); if (R) m.price = Math.round(R.price * P.price / 10) * 10; }
  // お店を大きくする
  const N = LEVELS[shop.level + 1];
  if (N && shop.money > N.cost + 60000 && shop.rating >= N.needRating && shop.stats.totalCust >= N.needCust) applyCmd(world, shop, { op: 'levelUp' });
  const L2 = LEVELS[shop.level];
  // 店員をやとう
  while (shop.staff.length < L2.staff - (shop.level >= 3 ? 0 : 0) && shop.cands.length && shop.money > 60000) {
    const c = shop.cands.sort((a, b) => (b.skill + b.speed) - (a.skill + a.speed))[0];
    applyCmd(world, shop, { op: 'hire', id: c.id });
  }
  // 席を増やす
  const f = frame(shop);
  const order = P.decor > 0.6 ? ['booth', 'table4', 'plant', 'table2'] : ['table4', 'table2', 'counter', 'plant'];
  for (let tries = 0; tries < 40 && shop.money > 40000; tries++) {
    const id = order[tries % order.length];
    const F = FURN[id];
    const i0 = Math.floor(r() * f.cols), j0 = Math.floor(r() * f.rows);
    const it = snapItem(f, { id, u: 0, v: 0, r: r() < 0.3 ? 1 : 0 }, i0, j0);
    if (layoutOk(f, [...shop.layout, it]) && shop.money > F.cost + 30000) { shop.money -= F.cost; shop.layout.push(it); }
  }
  if (shop.money > 50000 && r() < 0.3) applyCmd(world, shop, { op: 'ad', id: r() < 0.5 ? 'flyer' : 'tasting' });
  if (!shop.perm.signboard && shop.money > 120000) applyCmd(world, shop, { op: 'ad', id: 'signboard' });
}

// ---------- 留守のあいだの売上 ----------
export function awayEarnings(town, shop, now = Date.now()) {
  if (shop.cpu) return null;
  const hours = (now - (shop.lastSeen || now)) / 3.6e6;
  if (hours < 0.5 || !shop.staff.length || !shop.menu.length) return null;
  const days = Math.min(3, hours / 6);
  const power = shop.staff.reduce((a, s) => a + s.skill + s.speed * 0.8 + s.charm * 0.4, 0);
  const cust = Math.round(days * power * 2.2 * (shop.rating / 3) * (1 + town.buzz / 120));
  const avg = shop.menu.reduce((a, m) => a + m.price, 0) / shop.menu.length;
  const earn = Math.round(cust * avg * 0.55 / 10) * 10;
  return { hours: Math.round(hours * 10) / 10, days: Math.round(days * 10) / 10, cust, earn };
}

export { TYPES };

// 準備のパネル・結果・ランキングの画面
import {
  GENRE, RECIPES, FURNITURE, FURN, FLOORS, WALLS, LEVELS, LOTS, ADS, ROLES, TROPHIES, PLAYER_COLORS,
  CUSTOM_BASES, CUSTOM_MAINS, CUSTOM_FLAVORS, CUSTOM_DEV_COST, RECRUIT_COST, moveCost, START_CAPITAL, BRANCH_FEE, MAX_SHOPS, buzzName, makeCustomRecipe,
} from './data.js';
import { recipeOf, playerOf } from './sim.js';
import { seatCount } from './geo.js';
import { yen, stars, esc } from './util.js';

const $ = (id) => document.getElementById(id);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export const Prep = {
  tab: 'menu',
  dev: { base: 'men', main: 'buta', flavor: 'shoyu', name: '' },
  // 内装の編集：place = 置く家具 / sel = 選んだ家具の番号
  edit: { place: null, rot: 0, sel: null },
  ctx: null,

  render(ctx) {
    this.ctx = ctx;
    const s = ctx.shop;
    if (!s) return;
    this.money = ctx.money ?? s.money;
    document.querySelectorAll('#prep-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    $('prep-money').textContent = `所持金 ${yen(this.money)}`;
    const body = $('prep-body');
    const scroll = body.scrollTop;
    body.innerHTML = this[this.tab](s, ctx);
    body.scrollTop = scroll;
  },

  menu(s) {
    const L = LEVELS[s.level];
    let h = `<div class="sec">いまのメニュー（${s.menu.length}/${L.menu}品）</div>`;
    for (const m of s.menu) {
      const R = recipeOf(s, m.rid); if (!R) continue;
      const fit = R.genre === s.genre || (R.genres || []).includes(s.genre);
      h += `<div class="item"><span class="ic">${GENRE[R.genre]?.icon || '🍽️'}</span><span class="nm">${esc(R.name)}<small>おいしさ ${stars(R.taste)}${fit ? '' : '（ジャンル外）'} ・材料費 ${yen(R.cost)} ・ふつう ${yen(R.price)}</small></span>
        <span class="price"><button data-c='{"op":"price","rid":"${R.id}","d":-50}'>−</button><b>${yen(m.price)}</b><button data-c='{"op":"price","rid":"${R.id}","d":50}'>＋</button></span>
        <button class="btn" data-c='{"op":"removeMenu","rid":"${R.id}"}'>外す</button></div>`;
    }
    h += `<p class="note">安いと学生や家族連れが、おいしい高級料理はグルメや観光客が来ます。材料費より安くすると赤字です。</p>`;
    const avail = [...s.customs, ...RECIPES.filter((r) => r.genre === s.genre), ...RECIPES.filter((r) => r.genre !== s.genre)].filter((r) => !s.menu.some((m) => m.rid === r.id));
    h += `<div class="sec">メニューに加える</div>`;
    for (const R of avail) {
      const fit = R.genre === s.genre || (R.genres || []).includes(s.genre);
      h += `<div class="item"><span class="ic">${R.custom ? '⭐' : GENRE[R.genre].icon}</span><span class="nm">${esc(R.name)}<small>おいしさ ${stars(R.taste)}${fit ? '' : '（ジャンル外は少し味が落ちます）'} ・${yen(R.price)}</small></span>
        <button class="btn" data-c='{"op":"addMenu","rid":"${R.id}"}' ${s.menu.length >= L.menu ? 'disabled' : ''}>加える</button></div>`;
    }
    const d = this.dev;
    const preview = makeCustomRecipe(d.base, d.main, d.flavor, d.name);
    const chip = (list, key) => `<div class="chips">${list.map((x) => `<span class="chip ${d[key] === x.id ? 'on' : ''}" data-dev="${key}:${x.id}">${x.name}</span>`).join('')}</div>`;
    h += `<div class="sec">オリジナル料理を開発（${yen(CUSTOM_DEV_COST)}）</div>
      <p class="note">材料の組み合わせで味が決まります。作ってみるまで味はわかりません！</p>
      <div>土台</div>${chip(CUSTOM_BASES, 'base')}<div>メイン</div>${chip(CUSTOM_MAINS, 'main')}<div>味つけ</div>${chip(CUSTOM_FLAVORS, 'flavor')}
      <label class="field"><span>料理の名前</span><input id="dev-name" maxlength="14" placeholder="${esc(preview.name)}" value="${esc(d.name)}"></label>
      <button class="btn primary" data-dev-go="1">開発する</button>`;
    return h;
  },

  decor(s) {
    const e = this.edit;
    let h = `<p class="tip">家具をえらんで、お店の床（白いマス）をクリック／タップして置きます。R キーか「回す」で向きを変えます。置いた家具をクリックすると、動かしたり売ったりできます。</p>`;
    h += `<div class="sec">席：${seatCount(s.layout)}席 <button class="btn" data-tab="grow">🏗️ 席を増やす・お店を広げる</button></div>`;
    if (e.sel != null && s.layout[e.sel]) {
      const it = s.layout[e.sel];
      h += `<div class="item on"><span class="nm">えらんだ家具：${FURN[it.id].name}</span>
        <button class="btn" data-ed="rotsel">回す</button><button class="btn" data-ed="movesel">動かす</button><button class="btn" data-ed="sell">売る（${yen(FURN[it.id].cost / 2)}）</button><button class="btn" data-ed="unsel">✕</button></div>`;
    }
    if (e.place) h += `<div class="item on"><span class="nm">${e.move != null ? '動かす先をクリック' : `「${FURN[e.place].name}」を置く場所をクリック`}</span><button class="btn" data-ed="rot">回す</button><button class="btn" data-ed="cancel">やめる</button></div>`;
    h += `<div class="sec">家具を買う</div>`;
    for (const F of FURNITURE) {
      h += `<div class="item ${e.place === F.id && e.move == null ? 'on' : ''}"><span class="nm">${F.name}<small>${F.seats ? `${F.seats}席 ・` : ''}居心地 +${F.comfort} ・見た目 +${F.look} ・${F.w}×${F.d}マス</small></span>
        <button class="btn" data-ed="pick:${F.id}" ${this.money < F.cost ? 'disabled' : ''}>${yen(F.cost)}</button></div>`;
    }
    h += `<div class="sec">床</div><div class="chips">${FLOORS.map((f) => `<span class="chip ${s.floor === f.id ? 'on' : ''}" data-c='{"op":"floor","id":"${f.id}"}'><span class="swatch" style="background:${hex(f.color)}"></span>${f.name}${f.cost ? ` ${yen(f.cost)}` : ''}</span>`).join('')}</div>`;
    h += `<div class="sec">壁（${yen(2000)}）</div><div class="chips">${WALLS.map((w) => `<span class="chip ${s.wall === w.id ? 'on' : ''}" data-c='{"op":"wall","id":"${w.id}"}'><span class="swatch" style="background:${hex(w.color)}"></span>${w.name}</span>`).join('')}</div>`;
    return h;
  },

  staff(s) {
    const L = LEVELS[s.level];
    const bar = (v) => `<span class="bar"><i style="width:${v * 20}%"></i></span>`;
    const card = (st, btn) => `<div class="item"><span class="ic">${st.role === 'cook' ? '🧑‍🍳' : st.role === 'hall' ? '🤵' : '🙂'}</span>
      <span class="nm">${esc(st.name)}（${ROLES[st.role].name}）<small>腕前 ${bar(st.skill)} 速さ ${bar(st.speed)} 愛想 ${bar(st.charm)}<br>1日の給料 ${yen(st.wage)}</small></span>${btn}</div>`;
    const room = L.staff - s.staff.length;
    let h = `<div class="sec">はたらいている人（${s.staff.length}/${L.staff}人）</div>`;
    h += room > 0 ? `<p class="tip">🧑‍🍳 あと${room}人やとえます。下の「はたらきたい人」から選んでね。営業中も右上の 🧑‍🍳 からやとえます。</p>`
      : `<p class="tip">いまのお店（${L.name}）ではこれ以上やとえません。${LEVELS[s.level + 1] ? `「${LEVELS[s.level + 1].name}」に広げると${LEVELS[s.level + 1].staff}人までやとえます。` : ''}<button class="btn" data-tab="grow">お店を広げる</button></p>`;
    for (const st of s.staff) h += card(st, `<button class="btn" data-c='{"op":"fire","id":"${st.id}"}'>やめてもらう</button>`);
    if (!s.staff.length) h += `<p class="note">店員がいないと、自分がいないときにお店が回りません。</p>`;
    h += `<div class="sec">はたらきたい人（毎日かわります）</div>`;
    for (const st of s.cands || []) h += card(st, `<button class="btn primary" data-c='{"op":"hire","id":"${st.id}"}' ${room <= 0 ? 'disabled' : ''}>やとう</button>`);
    if (!(s.cands || []).length) h += `<p class="note">今日はもう応募がありません。</p>`;
    h += `<div class="item"><span class="nm">求人を出す<small>はたらきたい人を4人、新しく集めます</small></span><button class="btn" data-c='{"op":"recruit"}' ${this.money < RECRUIT_COST ? 'disabled' : ''}>${yen(RECRUIT_COST)}</button></div>`;
    h += `<p class="note">料理人は料理だけ、ホール係は運ぶのと片づけだけ、アルバイトはどちらも少しずつやります。給料は毎日の終わりに払います。</p>`;
    return h;
  },

  ads(s) {
    let h = `<div class="sec">宣伝・イベント</div>`;
    for (const A of ADS) {
      const on = A.once ? s.perm[A.id] : s.ads[A.id];
      h += `<div class="item ${on ? 'on' : ''}"><span class="nm">${A.name}${A.once ? '（ずっと）' : '（今日だけ）'}<small>${A.desc}</small></span>
        <button class="btn" data-c='{"op":"ad","id":"${A.id}"}' ${on || this.money < A.cost ? 'disabled' : ''}>${on ? '使用中' : A.cost ? yen(A.cost) : '無料'}</button></div>`;
    }
    return h;
  },

  // 拡大：席を増やす・お店を広げる
  grow(s) {
    const L = LEVELS[s.level], N = LEVELS[s.level + 1];
    const seats = seatCount(s.layout);
    let h = `<div class="sec">🪑 席を増やす（いま ${seats}席）</div>
      <p class="note">ボタンを押すと、空いているところに自動で置きます。場所を自分で決めたいときは「内装」タブから。</p>`;
    for (const F of FURNITURE.filter((x) => x.seats)) {
      h += `<div class="item"><span class="nm">${F.name}<small>+${F.seats}席 ・居心地 +${F.comfort}</small></span><button class="btn primary" data-c='{"op":"autoPlace","id":"${F.id}"}' ${this.money < F.cost ? 'disabled' : ''}>${yen(F.cost)}</button></div>`;
    }
    h += `<div class="sec">🏗️ お店を広げる（いま：${L.name}）</div>
      <p class="note">いま：広さ ${L.W}×${L.D}m ・コンロ ${L.stoves}台 ・店員 ${L.staff}人 ・メニュー ${L.menu}品</p>`;
    if (!N) return h + `<p class="tip">🎉 最高のお店です！</p>`;
    const prog = (v, max) => `<span class="bar"><i style="width:${Math.min(100, v / max * 100)}%"></i></span>`;
    const okR = s.rating >= N.needRating, okC = s.stats.totalCust >= N.needCust, okM = this.money >= N.cost;
    h += `<div class="item grow"><span class="nm"><b>「${N.name}」に広げる</b>
      <small>広さ ${N.W}×${N.D}m ・コンロ ${N.stoves}台 ・店員 ${N.staff}人 ・メニュー ${N.menu}品</small>
      <small>${okR ? '✅' : '⬜'} 評判 ★${N.needRating}以上 ${prog(s.rating - 1, N.needRating - 1)} ${s.rating.toFixed(2)}</small>
      <small>${okC ? '✅' : '⬜'} のべ来店 ${N.needCust}人 ${prog(s.stats.totalCust, N.needCust)} ${s.stats.totalCust}人${okC ? '' : `（あと${N.needCust - s.stats.totalCust}人）`}</small>
      <small>${okM ? '✅' : '⬜'} 工事費 ${yen(N.cost)} ${prog(this.money, N.cost)}</small></span>
      <button class="btn primary" data-c='{"op":"levelUp"}' ${okR && okC && okM ? '' : 'disabled'}>広げる</button></div>`;
    if (!okC || !okR) h += `<p class="note">お客さんをたくさん呼んで、おいしい料理をはやく出すと条件がそろいます。看板を持って呼びこむのもおすすめ！</p>`;
    return h;
  },

  shop(s, ctx) {
    const L = LEVELS[s.level];
    let h = this.myShops(s, ctx);
    h += `<label class="field"><span>お店の名前</span><input id="shop-name" maxlength="12" value="${esc(s.name)}"></label><button class="btn" data-rename="1">名前を変える</button>`;
    h += `<p class="note">お店の大きさ：${L.name}。広げるのは「🏗️ 拡大」タブから。</p>`;
    const free = ctx.freeLots || [];
    const lotInfo = (id) => `人通り ${'●'.repeat(Math.round(LOTS[id].traffic * 3))} ・土地代 ${yen(LOTS[id].price)} ・家賃 ${yen(LOTS[id].rent)}`;
    h += `<div class="sec">引っ越し</div><p class="note">いまの場所：空き地${s.lot + 1}（${lotInfo(s.lot)}）。駅に近いほど人通りが多く、土地代も家賃も高くなります。今の土地は7割で売れます。</p>`;
    for (const id of free) {
      const cost = moveCost(s.lot, id);
      h += `<div class="item"><span class="nm">空き地${id + 1}（${LOTS[id].side < 0 ? '北' : '南'}側）<small>${lotInfo(id)}</small></span><button class="btn" data-c='{"op":"moveLot","lot":${id}}' ${this.money < cost ? 'disabled' : ''}>${yen(cost)}</button></div>`;
    }
    const st = s.stats;
    h += `<div class="sec">お店の記録</div><p class="note">営業 ${st.days}日 ・のべ ${st.totalCust}人 ・売上合計 ${yen(st.totalSales)}<br>1日の最高：${st.bestDayCust}人 / ${yen(st.bestDaySales)} ・最長の行列 ${st.bestQueue}人</p>`;
    h += `<div class="trophies">${TROPHIES.map((T) => `<span class="trophy ${s.trophies.includes(T.id) ? '' : 'off'}">${T.icon} ${T.name}</span>`).join('')}</div>`;
    return h;
  },

  // 自分のお店の一覧と、新しいお店を出す
  myShops(s, ctx) {
    const mine = ctx.mine || [s];
    let h = `<div class="sec">自分のお店（${mine.length}/${MAX_SHOPS}店）</div>`;
    for (const m of mine) {
      const cur = m.owner === s.owner;
      h += `<div class="item ${cur ? 'cur' : ''}"><span class="ic">${GENRE[m.genre].icon}</span><span class="nm">${esc(m.name)}<small>空き地${m.lot + 1} ・${LEVELS[m.level].name} ・★${m.rating.toFixed(2)} ・店員${m.staff.length}人${cur ? ' ・いま編集中' : ''}</small></span>
        ${cur ? '' : `<button class="btn" data-sw="${esc(m.owner)}">このお店へ</button>`}
        ${m.owner !== playerOf(m) ? `<button class="btn" data-close="${esc(m.owner)}">たたむ</button>` : ''}</div>`;
    }
    if (mine.length < MAX_SHOPS) {
      const free = ctx.freeLots || [];
      const B = this.branch;
      h += `<div class="sec">新しいお店を出す（土地代＋準備費 ${yen(BRANCH_FEE)}）</div>
        <p class="note">空き地は早い者勝ちです。自分がいないお店は店員さんが営業するので、店員をやとっておきましょう。お金は全部のお店で共通です。</p>
        <div class="chips">${Object.values(GENRE).map((g) => `<span class="chip ${B.genre === g.id ? 'on' : ''}" data-bg="${g.id}">${g.icon}${g.name}</span>`).join('')}</div>`;
      for (const id of free) {
        const cost = LOTS[id].price + BRANCH_FEE;
        h += `<div class="item"><span class="nm">空き地${id + 1}（${LOTS[id].side < 0 ? '北' : '南'}側）<small>人通り ${'●'.repeat(Math.round(LOTS[id].traffic * 3))} ・家賃 ${yen(LOTS[id].rent)}</small></span><button class="btn primary" data-branch="${id}" ${this.money < cost ? 'disabled' : ''}>${yen(cost)}</button></div>`;
      }
      if (!free.length) h += `<p class="note">空き地がありません</p>`;
    }
    return h;
  },
  branch: { genre: 'cafe' },

  // クリックの処理（main から渡された send で命令を送る）
  async click(e) {
    const t = e.target.closest('[data-c],[data-dev],[data-dev-go],[data-ed],[data-rename],[data-tab],[data-sw],[data-close],[data-bg],[data-branch]');
    if (!t || !this.ctx) return;
    const ctx = this.ctx, s = ctx.shop;
    if (t.dataset.tab) { this.tab = t.dataset.tab; this.edit = { place: null, rot: 0, sel: null }; ctx.onEdit?.(); this.render(ctx); return; }
    if (t.dataset.c) {
      const c = JSON.parse(t.dataset.c);
      if (c.op === 'price') { const m = s.menu.find((x) => x.rid === c.rid); c.price = Math.max(50, m.price + c.d); delete c.d; }
      await ctx.send(c);
      return;
    }
    if (t.dataset.dev) { const [k, v] = t.dataset.dev.split(':'); this.dev[k] = v; this.dev.name = $('dev-name')?.value || ''; this.render(ctx); return; }
    if (t.dataset.devGo) {
      const d = this.dev; d.name = $('dev-name')?.value.trim() || '';
      const r = await ctx.send({ op: 'dev', base: d.base, main: d.main, flavor: d.flavor, name: d.name });
      if (r?.ok && r.recipe) ctx.toast(`「${r.recipe.name}」ができた！ おいしさ ${stars(r.recipe.taste)}`);
      d.name = '';
      return;
    }
    if (t.dataset.sw) { ctx.switchShop?.(t.dataset.sw); return; }
    if (t.dataset.close) { if (confirm('このお店をたたみますか？（土地は7割で売れます）')) ctx.closeShop?.(t.dataset.close); return; }
    if (t.dataset.bg) { this.branch.genre = t.dataset.bg; this.render(ctx); return; }
    if (t.dataset.branch) { ctx.openBranch?.({ lot: +t.dataset.branch, genre: this.branch.genre }); return; }
    if (t.dataset.rename) { await ctx.send({ op: 'rename', name: $('shop-name').value.trim() }); return; }
    if (t.dataset.ed) {
      const [k, v] = t.dataset.ed.split(':');
      const E = this.edit;
      if (k === 'pick') { E.place = v; E.rot = 0; E.sel = null; E.move = null; }
      else if (k === 'rot') E.rot = E.rot ? 0 : 1;
      else if (k === 'cancel') { E.place = null; E.move = null; }
      else if (k === 'unsel') E.sel = null;
      else if (k === 'sell') { await ctx.send({ op: 'sell', idx: E.sel }); E.sel = null; }
      else if (k === 'rotsel') { const it = s.layout[E.sel]; await ctx.send({ op: 'moveItem', idx: E.sel, u: it.u, v: it.v, r: it.r ? 0 : 1 }); }
      else if (k === 'movesel') { const it = s.layout[E.sel]; E.place = it.id; E.rot = it.r; E.move = E.sel; E.sel = null; }
      ctx.onEdit?.();
      this.render(ctx);
    }
  },
};

// ---------- 結果 ----------
export function renderResult(sum, me) {
  const rows = [...sum.results].sort((a, b) => b.sales - a.sales);
  const own = (r) => (r.player || r.owner) === me;
  const mineList = sum.results.filter(own);
  // 何店か持っていたら合計を出す
  const mine = mineList.length ? mineList.reduce((a, r) => ({
    ...a, sales: a.sales + r.sales, cust: a.cust + r.cust, angry: a.angry + r.angry, cost: a.cost + r.cost, wages: a.wages + r.wages, rent: a.rent + r.rent,
    adCost: a.adCost + r.adCost, profit: a.profit + r.profit, revN: a.revN + (r.review ? r.cust : 0), revS: a.revS + r.review * r.cust,
    newTrophies: [...a.newTrophies, ...r.newTrophies], bestDish: a.bestDishN >= r.bestDishN ? a.bestDish : r.bestDish, bestDishN: Math.max(a.bestDishN, r.bestDishN), money: r.money,
  }), { sales: 0, cust: 0, angry: 0, cost: 0, wages: 0, rent: 0, adCost: 0, profit: 0, revN: 0, revS: 0, newTrophies: [], bestDish: null, bestDishN: 0 }) : null;
  if (mine) mine.review = mine.revN ? mine.revS / mine.revN : 0;
  let h = '';
  if (mine) {
    h += `<div class="cols"><div><div class="note">今日の売上${mineList.length > 1 ? `（${mineList.length}店の合計）` : ''}</div><div class="big-num">${yen(mine.sales)}</div>
      <div class="note">来店 ${mine.cust}人 ・怒って帰った人 ${mine.angry}人 ・今日の口コミ ${mine.review ? stars(mine.review) : '-'}</div></div>
      <div class="note">材料費 ${yen(-mine.cost)} ・給料 ${yen(-mine.wages)} ・家賃 ${yen(-mine.rent)}${mine.adCost ? ` ・宣伝 ${yen(-mine.adCost)}` : ''}<br>
      <b>今日のもうけ ${yen(mine.profit)}</b> ・所持金 ${yen(mine.money)}<br>${mine.bestDish ? `いちばん売れた料理：${esc(mine.bestDish)}（${mine.bestDishN}食）` : ''}</div></div>`;
    if (mine.newTrophies.length) h += `<div class="sec">🎉 トロフィーをもらった！</div><div class="trophies">${mine.newTrophies.map((id) => { const T = TROPHIES.find((x) => x.id === id); return `<span class="trophy">${T.icon} ${T.name}</span>`; }).join('')}</div>`;
  }
  h += `<div class="sec">今日のランキング（売上）</div><table class="res"><tr><th>お店</th><th>来店</th><th>売上</th><th>もうけ</th><th>評判</th></tr>`;
  rows.forEach((r, i) => {
    h += `<tr class="${own(r) ? 'me' : ''}"><td><span class="rk">${i + 1}位</span> ${GENRE[r.genre].icon} ${esc(r.name)} <span class="note">${r.cpu ? 'CPU' : esc(r.ownerName)}</span></td><td>${r.cust}人</td><td>${yen(r.sales)}</td><td>${yen(r.profit)}</td><td>★${r.rating.toFixed(2)}</td></tr>`;
  });
  h += `</table>`;
  const up = sum.buzz - sum.buzzBefore;
  h += `<div class="buzz-line">🏙️ 町のにぎわい <b>${Math.round(sum.buzz)}</b>（${up >= 0 ? '+' : ''}${up.toFixed(1)}）「${buzzName(sum.buzz)}」<br>
    <span class="note">今日は町全体で ${sum.dayCust}人 が食事しました。みんなのお店が人気になるほど、外の町からもお客さんが来ます。</span></div>`;
  for (const r of rows) if (!own(r) && r.newTrophies.length) h += `<p class="note">${esc(r.name)} が ${r.newTrophies.map((id) => TROPHIES.find((x) => x.id === id).icon + TROPHIES.find((x) => x.id === id).name).join('、')} をもらいました</p>`;
  return h;
}

// ---------- ランキング ----------
export const Rank = { tab: 'sales', scope: 'total' };
export function renderRanking(town, today, me) {
  const shops = Object.values(town.shops);
  const val = (s) => {
    if (Rank.scope === 'today') {
      const t = today?.[s.owner];
      if (Rank.tab === 'sales') return t?.sales || 0;
      if (Rank.tab === 'cust') return t?.cust || 0;
      return s.rating;
    }
    if (Rank.tab === 'sales') return s.stats.totalSales;
    if (Rank.tab === 'cust') return s.stats.totalCust;
    return s.rating;
  };
  const fmt = (v) => (Rank.tab === 'sales' ? yen(v) : Rank.tab === 'cust' ? `${v}人` : `★${v.toFixed(2)}`);
  const list = [...shops].sort((a, b) => val(b) - val(a));
  let h = `<h2>🏆 ${esc(town.name)} のランキング</h2>
    <div class="subtabs"><button data-rs="total" class="${Rank.scope === 'total' ? 'on' : ''}">これまで</button><button data-rs="today" class="${Rank.scope === 'today' ? 'on' : ''}">今日</button>
    <span style="width:12px"></span><button data-rt="sales" class="${Rank.tab === 'sales' ? 'on' : ''}">売上</button><button data-rt="rating" class="${Rank.tab === 'rating' ? 'on' : ''}">評判</button><button data-rt="cust" class="${Rank.tab === 'cust' ? 'on' : ''}">来店数</button></div>
    <table class="res"><tr><th>お店</th><th>レベル</th><th>${Rank.tab === 'sales' ? '売上' : Rank.tab === 'cust' ? '来店数' : '評判'}</th><th>トロフィー</th></tr>`;
  list.forEach((s, i) => {
    h += `<tr class="${playerOf(s) === me && !s.cpu ? 'me' : ''}"><td><span class="rk">${i + 1}位</span> ${GENRE[s.genre].icon} ${esc(s.name)} <span class="note">${s.cpu ? 'CPU' : esc(s.ownerName)}</span></td>
      <td>${LEVELS[s.level].name}</td><td>${fmt(val(s))}</td><td>${s.trophies.length}個</td></tr>`;
  });
  h += `</table><div class="buzz-line">🏙️ 町のにぎわい ${Math.round(town.buzz)}「${buzzName(town.buzz)}」・${town.day}日目</div>`;
  for (const s of list) {
    h += `<div class="sec">${GENRE[s.genre].icon} ${esc(s.name)} のトロフィー</div><div class="trophies">${TROPHIES.map((T) => `<span class="trophy ${s.trophies.includes(T.id) ? '' : 'off'}">${T.icon} ${T.name}</span>`).join('')}</div>`;
  }
  return h;
}

// ---------- ロビー：自分のお店の準備 ----------
export const Setup = { genre: 'ramen', lot: null, name: '' };
export function renderSetup(town, me) {
  const shops = Object.values(town.shops);
  const mine = shops.filter((x) => !x.cpu && playerOf(x) === me);
  const main = town.shops[me];
  if (main) {
    let h = mine.map((m) => `<div class="item"><span class="ic">${GENRE[m.genre].icon}</span><span class="nm"><b>${esc(m.name)}</b><small>${LEVELS[m.level].name} ・★${m.rating.toFixed(2)} ・空き地${m.lot + 1}</small></span></div>`).join('');
    h += `<p class="note">所持金 ${yen(main.money)}${mine.length < MAX_SHOPS ? ' ・準備の時間に「お店」タブから2店目を出せます' : ''}</p>`;
    const away = mine.filter((m) => m.away);
    if (away.length) {
      const cust = away.reduce((a, m) => a + m.away.cust, 0), earn = away.reduce((a, m) => a + m.away.earn, 0);
      h += `<p class="tip">🏠 おかえりなさい！ 留守のあいだ（約${away[0].away.hours}時間）も店員さんががんばって、${cust}人のお客さんが来ました。売上 ${yen(earn)}！</p>`;
    }
    return h;
  }
  const free = LOTS.map((L) => L.id).filter((id) => !shops.some((x) => x.lot === id));
  if (Setup.lot == null || !free.includes(Setup.lot)) Setup.lot = free[0] ?? null;
  const left = Setup.lot != null ? START_CAPITAL - LOTS[Setup.lot].price : 0;
  const lotBox = (L) => {
    const s = shops.find((x) => x.lot === L.id);
    if (s) return `<span class="lot taken"><b>空き地${L.id + 1}</b><small>${s.cpu ? 'CPUのお店' : esc(s.ownerName) + 'さん'}が使用中</small></span>`;
    return `<span class="lot ${Setup.lot === L.id ? 'on' : ''}" data-lot="${L.id}"><b>空き地${L.id + 1}</b><i>${'●'.repeat(Math.round(L.traffic * 3))}</i><em>${yen(L.price)}</em><small>家賃 ${yen(L.rent)}</small></span>`;
  };
  // 駅（左）に近い順に、北側と南側を並べる
  const row = (side) => LOTS.filter((L) => L.side === side).sort((a, b) => a.x - b.x).map(lotBox).join('');
  return `<p class="note">ジャンルを選んで、お店を出す場所を決めよう。メニューや内装はあとから自由に変えられます。</p>
    <div class="genres">${Object.values(GENRE).map((g) => `<div class="genre ${Setup.genre === g.id ? 'on' : ''}" data-genre="${g.id}"><i>${g.icon}</i>${g.name}</div>`).join('')}</div>
    <label class="field"><span>お店の名前</span><input id="in-shop" maxlength="12" placeholder="${GENRE[Setup.genre].name}" value="${esc(Setup.name)}"></label>
    <div>お店を出す場所（資本金 ${yen(START_CAPITAL)}・早い者勝ち）</div>
    <p class="note">🚉 駅に近いほど人通り（●）が多いけれど、土地代と1日の家賃が高くなります。残ったお金で家具や店員をそろえます。</p>
    <div class="lotmap"><div class="lotrow">${row(-1)}</div><div class="lotroad">🚉 駅 ← 大通り →</div><div class="lotrow">${row(1)}</div></div>
    ${Setup.lot != null ? `<p class="note">空き地${Setup.lot + 1}を買うと、残りの所持金は <b>${yen(left)}</b> です</p>` : '<p class="note">空き地がありません</p>'}
    <button class="btn primary" data-act="open-shop" ${Setup.lot == null ? 'disabled' : ''}>このお店を出す！</button>`;
}
export { PLAYER_COLORS };

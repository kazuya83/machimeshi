// 準備のパネル・結果・ランキングの画面
import {
  GENRE, RECIPES, FURNITURE, FURN, FLOORS, WALLS, LEVELS, LOTS, ADS, ROLES, TROPHIES, PLAYER_COLORS,
  CUSTOM_BASES, CUSTOM_MAINS, CUSTOM_FLAVORS, CUSTOM_DEV_COST, MOVE_COST, buzzName, makeCustomRecipe,
} from './data.js';
import { recipeOf } from './sim.js';
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
    document.querySelectorAll('#prep-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    $('prep-money').textContent = `所持金 ${yen(s.money)}`;
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
    h += `<div class="sec">席：${seatCount(s.layout)}席</div>`;
    if (e.sel != null && s.layout[e.sel]) {
      const it = s.layout[e.sel];
      h += `<div class="item on"><span class="nm">えらんだ家具：${FURN[it.id].name}</span>
        <button class="btn" data-ed="rotsel">回す</button><button class="btn" data-ed="movesel">動かす</button><button class="btn" data-ed="sell">売る（${yen(FURN[it.id].cost / 2)}）</button><button class="btn" data-ed="unsel">✕</button></div>`;
    }
    if (e.place) h += `<div class="item on"><span class="nm">${e.move != null ? '動かす先をクリック' : `「${FURN[e.place].name}」を置く場所をクリック`}</span><button class="btn" data-ed="rot">回す</button><button class="btn" data-ed="cancel">やめる</button></div>`;
    h += `<div class="sec">家具を買う</div>`;
    for (const F of FURNITURE) {
      h += `<div class="item ${e.place === F.id && e.move == null ? 'on' : ''}"><span class="nm">${F.name}<small>${F.seats ? `${F.seats}席 ・` : ''}居心地 +${F.comfort} ・見た目 +${F.look} ・${F.w}×${F.d}マス</small></span>
        <button class="btn" data-ed="pick:${F.id}" ${s.money < F.cost ? 'disabled' : ''}>${yen(F.cost)}</button></div>`;
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
    let h = `<div class="sec">はたらいている人（${s.staff.length}/${L.staff}人）</div>`;
    for (const st of s.staff) h += card(st, `<button class="btn" data-c='{"op":"fire","id":"${st.id}"}'>やめてもらう</button>`);
    if (!s.staff.length) h += `<p class="note">店員がいないと、自分がいないときにお店が回りません。</p>`;
    h += `<div class="sec">はたらきたい人（毎日かわります）</div>`;
    for (const st of s.cands || []) h += card(st, `<button class="btn" data-c='{"op":"hire","id":"${st.id}"}' ${s.staff.length >= L.staff ? 'disabled' : ''}>やとう</button>`);
    h += `<p class="note">料理人は料理だけ、ホール係は運ぶのと片づけだけ、アルバイトはどちらも少しずつやります。給料は毎日の終わりに払います。</p>`;
    return h;
  },

  ads(s) {
    let h = `<div class="sec">宣伝・イベント</div>`;
    for (const A of ADS) {
      const on = A.once ? s.perm[A.id] : s.ads[A.id];
      h += `<div class="item ${on ? 'on' : ''}"><span class="nm">${A.name}${A.once ? '（ずっと）' : '（今日だけ）'}<small>${A.desc}</small></span>
        <button class="btn" data-c='{"op":"ad","id":"${A.id}"}' ${on || s.money < A.cost ? 'disabled' : ''}>${on ? '使用中' : A.cost ? yen(A.cost) : '無料'}</button></div>`;
    }
    return h;
  },

  shop(s, ctx) {
    const L = LEVELS[s.level], N = LEVELS[s.level + 1];
    let h = `<label class="field"><span>お店の名前</span><input id="shop-name" maxlength="12" value="${esc(s.name)}"></label><button class="btn" data-rename="1">名前を変える</button>`;
    h += `<div class="sec">お店の大きさ：${L.name}（レベル${s.level}）</div>
      <p class="note">広さ ${L.W}×${L.D}m ・コンロ ${L.stoves}台 ・店員 ${L.staff}人まで ・メニュー ${L.menu}品まで</p>`;
    if (N) {
      const okR = s.rating >= N.needRating, okC = s.stats.totalCust >= N.needCust, okM = s.money >= N.cost;
      h += `<div class="item"><span class="nm">「${N.name}」に広げる<small>${okR ? '✅' : '❌'} 評判 ★${N.needRating}以上（いま ${s.rating.toFixed(2)}）<br>${okC ? '✅' : '❌'} のべ来店 ${N.needCust}人（いま ${s.stats.totalCust}人）<br>${okM ? '✅' : '❌'} 工事費 ${yen(N.cost)}</small></span>
        <button class="btn primary" data-c='{"op":"levelUp"}' ${okR && okC && okM ? '' : 'disabled'}>広げる</button></div>`;
    } else h += `<p class="note">最高のお店です！</p>`;
    const free = ctx.freeLots || [];
    h += `<div class="sec">引っ越し（${yen(MOVE_COST)}）</div><p class="note">いまの場所：空き地${s.lot + 1}（人通り ${'●'.repeat(Math.round(LOTS[s.lot].traffic * 3))}・家賃 ${yen(LOTS[s.lot].rent)}）。駅に近いほど人通りが多く、家賃も高くなります。</p>`;
    for (const id of free) {
      const L2 = LOTS[id];
      h += `<div class="item"><span class="nm">空き地${id + 1}（${L2.side < 0 ? '北' : '南'}側）<small>人通り ${'●'.repeat(Math.round(L2.traffic * 3))} ・家賃 ${yen(L2.rent)}</small></span><button class="btn" data-c='{"op":"moveLot","lot":${id}}' ${s.money < MOVE_COST ? 'disabled' : ''}>ここへ</button></div>`;
    }
    const st = s.stats;
    h += `<div class="sec">お店の記録</div><p class="note">営業 ${st.days}日 ・のべ ${st.totalCust}人 ・売上合計 ${yen(st.totalSales)}<br>1日の最高：${st.bestDayCust}人 / ${yen(st.bestDaySales)} ・最長の行列 ${st.bestQueue}人</p>`;
    h += `<div class="trophies">${TROPHIES.map((T) => `<span class="trophy ${s.trophies.includes(T.id) ? '' : 'off'}">${T.icon} ${T.name}</span>`).join('')}</div>`;
    return h;
  },

  // クリックの処理（main から渡された send で命令を送る）
  async click(e) {
    const t = e.target.closest('[data-c],[data-dev],[data-dev-go],[data-ed],[data-rename],[data-tab]');
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
  const mine = sum.results.find((r) => r.owner === me);
  let h = '';
  if (mine) {
    h += `<div class="cols"><div><div class="note">今日の売上</div><div class="big-num">${yen(mine.sales)}</div>
      <div class="note">来店 ${mine.cust}人 ・怒って帰った人 ${mine.angry}人 ・今日の口コミ ${mine.review ? stars(mine.review) : '-'}</div></div>
      <div class="note">材料費 ${yen(-mine.cost)} ・給料 ${yen(-mine.wages)} ・家賃 ${yen(-mine.rent)}${mine.adCost ? ` ・宣伝 ${yen(-mine.adCost)}` : ''}<br>
      <b>今日のもうけ ${yen(mine.profit)}</b> ・所持金 ${yen(mine.money)}<br>${mine.bestDish ? `いちばん売れた料理：${esc(mine.bestDish)}（${mine.bestDishN}食）` : ''}</div></div>`;
    if (mine.newTrophies.length) h += `<div class="sec">🎉 トロフィーをもらった！</div><div class="trophies">${mine.newTrophies.map((id) => { const T = TROPHIES.find((x) => x.id === id); return `<span class="trophy">${T.icon} ${T.name}</span>`; }).join('')}</div>`;
  }
  h += `<div class="sec">今日のランキング（売上）</div><table class="res"><tr><th>お店</th><th>来店</th><th>売上</th><th>もうけ</th><th>評判</th></tr>`;
  rows.forEach((r, i) => {
    h += `<tr class="${r.owner === me ? 'me' : ''}"><td><span class="rk">${i + 1}位</span> ${GENRE[r.genre].icon} ${esc(r.name)} <span class="note">${r.cpu ? 'CPU' : esc(r.ownerName)}</span></td><td>${r.cust}人</td><td>${yen(r.sales)}</td><td>${yen(r.profit)}</td><td>★${r.rating.toFixed(2)}</td></tr>`;
  });
  h += `</table>`;
  const up = sum.buzz - sum.buzzBefore;
  h += `<div class="buzz-line">🏙️ 町のにぎわい <b>${Math.round(sum.buzz)}</b>（${up >= 0 ? '+' : ''}${up.toFixed(1)}）「${buzzName(sum.buzz)}」<br>
    <span class="note">今日は町全体で ${sum.dayCust}人 が食事しました。みんなのお店が人気になるほど、外の町からもお客さんが来ます。</span></div>`;
  for (const r of rows) if (r.owner !== me && r.newTrophies.length) h += `<p class="note">${esc(r.name)} が ${r.newTrophies.map((id) => TROPHIES.find((x) => x.id === id).icon + TROPHIES.find((x) => x.id === id).name).join('、')} をもらいました</p>`;
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
    h += `<tr class="${s.owner === me ? 'me' : ''}"><td><span class="rk">${i + 1}位</span> ${GENRE[s.genre].icon} ${esc(s.name)} <span class="note">${s.cpu ? 'CPU' : esc(s.ownerName)}</span></td>
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
export function renderSetup(free, hasShop, myShop) {
  if (hasShop && myShop) {
    return `<div class="item"><span class="ic">${GENRE[myShop.genre].icon}</span><span class="nm"><b>${esc(myShop.name)}</b><small>${LEVELS[myShop.level].name} ・★${myShop.rating.toFixed(2)} ・所持金 ${yen(myShop.money)} ・空き地${myShop.lot + 1}</small></span></div>
      ${myShop.away ? `<p class="tip">🏠 おかえりなさい！ 留守のあいだ（約${myShop.away.hours}時間）も店員さんががんばって、${myShop.away.cust}人のお客さんが来ました。売上 ${yen(myShop.away.earn)}！</p>` : ''}`;
  }
  if (Setup.lot == null || !free.includes(Setup.lot)) Setup.lot = free[0] ?? null;
  let h = `<p class="note">ジャンルを選んで、お店を出す場所を決めよう。メニューや内装はあとから自由に変えられます。</p>
    <div class="genres">${Object.values(GENRE).map((g) => `<div class="genre ${Setup.genre === g.id ? 'on' : ''}" data-genre="${g.id}"><i>${g.icon}</i>${g.name}</div>`).join('')}</div>
    <label class="field"><span>お店の名前</span><input id="in-shop" maxlength="12" placeholder="${GENRE[Setup.genre].name}" value="${esc(Setup.name)}"></label>
    <div>お店を出す場所（駅に近いほど人通りが多い）</div>
    <div class="lots">${free.map((id) => `<span class="lot ${Setup.lot === id ? 'on' : ''}" data-lot="${id}">空き地${id + 1}<small> ${'●'.repeat(Math.round(LOTS[id].traffic * 3))}</small></span>`).join('')}</div>
    <button class="btn primary" data-act="open-shop">このお店を出す！</button>`;
  return h;
}
export { PLAYER_COLORS };

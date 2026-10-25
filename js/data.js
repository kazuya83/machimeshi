// ゲームのデータ（ジャンル・料理・お客さん・家具・店員・宣伝・お店のレベル・トロフィー）

export const MAX_PLAYERS = 4;
export const PREP_TIME = 180; // 準備 3分
export const OPEN_TIME = 420; // 営業 7分
export const OPEN_HOUR = 11, CLOSE_HOUR = 21; // ゲーム内の営業時間
export const PLAYER_COLORS = [0xff5a5a, 0x4f9dff, 0x3ccf6e, 0xffb020];

// ---------- ジャンル ----------
export const GENRES = [
  { id: 'ramen', name: 'ラーメン屋', icon: '🍜', color: 0xc0392b, sign: '#b32418', awning: 0x9e1b12, wall: 0xe9dcc7 },
  { id: 'cafe', name: 'カフェ', icon: '☕', color: 0x8d6e63, sign: '#5d4037', awning: 0x2e5e4e, wall: 0xf3ede4 },
  { id: 'sushi', name: '寿司屋', icon: '🍣', color: 0x1f3a5f, sign: '#16324f', awning: 0x1f3a5f, wall: 0xe8dcc0 },
  { id: 'burger', name: 'ハンバーガー屋', icon: '🍔', color: 0xe67e22, sign: '#d35400', awning: 0xd4a017, wall: 0xf1e3cf },
  { id: 'curry', name: 'カレー屋', icon: '🍛', color: 0xd4a017, sign: '#9c6b00', awning: 0x7a4a12, wall: 0xf0e2c2 },
  { id: 'yakiniku', name: '焼肉屋', icon: '🥩', color: 0x5b2c2c, sign: '#3b1a1a', awning: 0x2b2b2b, wall: 0x6b5a4e },
];
export const GENRE = Object.fromEntries(GENRES.map((g) => [g.id, g]));

// ---------- 料理 ----------
// base: 器の形（bowl どんぶり / plate 皿 / sushi 寿司げた / bun バーガー / cup カップ / grill 焼き網 / cake ケーキ皿）
// taste: おいしさ（1〜5） price: 基本の値段（円） cost: 材料費（円） time: 作る時間（秒）
export const RECIPES = [
  { id: 'shoyu', genre: 'ramen', name: '醤油ラーメン', base: 'bowl', col: [0x8a4b1c, 0xf3d58a], taste: 3, price: 800, cost: 220, time: 9 },
  { id: 'miso', genre: 'ramen', name: '味噌ラーメン', base: 'bowl', col: [0xb9772a, 0xf3d58a], taste: 3.4, price: 900, cost: 260, time: 10 },
  { id: 'tonkotsu', genre: 'ramen', name: '豚骨ラーメン', base: 'bowl', col: [0xeee0c4, 0xf3d58a], taste: 3.8, price: 950, cost: 300, time: 12 },
  { id: 'chahan', genre: 'ramen', name: 'チャーハン', base: 'plate', col: [0xe9c46a, 0x6aa84f], taste: 3, price: 700, cost: 180, time: 7 },
  { id: 'gyoza', genre: 'ramen', name: '餃子', base: 'plate', col: [0xe8c48c, 0xa8692f], taste: 3.2, price: 450, cost: 120, time: 6 },

  { id: 'coffee', genre: 'cafe', name: 'コーヒー', base: 'cup', col: [0x4a2c1a, 0xffffff], taste: 3, price: 450, cost: 80, time: 4 },
  { id: 'latte', genre: 'cafe', name: 'カフェラテ', base: 'cup', col: [0xc8a27a, 0xffffff], taste: 3.4, price: 550, cost: 110, time: 5 },
  { id: 'cake', genre: 'cafe', name: 'ショートケーキ', base: 'cake', col: [0xfff4ea, 0xe53950], taste: 3.8, price: 600, cost: 160, time: 5 },
  { id: 'sandwich', genre: 'cafe', name: 'サンドイッチ', base: 'plate', col: [0xf2dfb0, 0x7cb342], taste: 3.2, price: 700, cost: 190, time: 6 },
  { id: 'pancake', genre: 'cafe', name: 'パンケーキ', base: 'cake', col: [0xd9a05b, 0xfff1c1], taste: 3.9, price: 950, cost: 230, time: 9 },

  { id: 'maguro', genre: 'sushi', name: 'マグロ', base: 'sushi', col: [0xc0263b, 0xffffff], taste: 3.6, price: 900, cost: 360, time: 6 },
  { id: 'salmon', genre: 'sushi', name: 'サーモン', base: 'sushi', col: [0xff8a5c, 0xffffff], taste: 3.4, price: 800, cost: 300, time: 6 },
  { id: 'ebi', genre: 'sushi', name: 'えび', base: 'sushi', col: [0xff7f50, 0xffffff], taste: 3.1, price: 700, cost: 250, time: 6 },
  { id: 'makizushi', genre: 'sushi', name: '巻き寿司', base: 'sushi', col: [0x1d2b1d, 0xffffff], taste: 3, price: 650, cost: 200, time: 7 },
  { id: 'omakase', genre: 'sushi', name: 'おまかせ握り', base: 'sushi', col: [0xc0263b, 0xf6b26b], taste: 4.4, price: 2800, cost: 1100, time: 14 },

  { id: 'hamburger', genre: 'burger', name: 'ハンバーガー', base: 'bun', col: [0xd99a4e, 0x5a3418], taste: 3, price: 500, cost: 150, time: 6 },
  { id: 'cheese', genre: 'burger', name: 'チーズバーガー', base: 'bun', col: [0xd99a4e, 0xf4c430], taste: 3.3, price: 600, cost: 180, time: 6 },
  { id: 'teriyaki', genre: 'burger', name: 'てりやきバーガー', base: 'bun', col: [0xd99a4e, 0x7a3e12], taste: 3.5, price: 650, cost: 200, time: 7 },
  { id: 'fries', genre: 'burger', name: 'ポテト', base: 'plate', col: [0xf2c14e, 0xd62828], taste: 3, price: 300, cost: 70, time: 4 },
  { id: 'shake', genre: 'burger', name: 'シェイク', base: 'cup', col: [0xffc0cb, 0xffffff], taste: 3.2, price: 400, cost: 100, time: 4 },

  { id: 'beefcurry', genre: 'curry', name: 'ビーフカレー', base: 'plate', col: [0x7a4416, 0xfff8e7], taste: 3.4, price: 850, cost: 260, time: 8 },
  { id: 'katsucurry', genre: 'curry', name: 'カツカレー', base: 'plate', col: [0x7a4416, 0xd99a4e], taste: 3.8, price: 1000, cost: 330, time: 10 },
  { id: 'chickencurry', genre: 'curry', name: 'バターチキンカレー', base: 'plate', col: [0xd2691e, 0xf4e1c1], taste: 3.6, price: 950, cost: 290, time: 9 },
  { id: 'naan', genre: 'curry', name: 'ナン', base: 'plate', col: [0xe8c48c, 0xc68b4b], taste: 3, price: 350, cost: 80, time: 5 },
  { id: 'lassi', genre: 'curry', name: 'ラッシー', base: 'cup', col: [0xfff7e0, 0xffffff], taste: 3, price: 350, cost: 80, time: 3 },

  { id: 'karubi', genre: 'yakiniku', name: 'カルビ', base: 'grill', col: [0x9b2d30, 0xf2d0c0], taste: 3.6, price: 1200, cost: 450, time: 8 },
  { id: 'tanshio', genre: 'yakiniku', name: 'タン塩', base: 'grill', col: [0xd9a0a0, 0xffffff], taste: 3.7, price: 1300, cost: 480, time: 8 },
  { id: 'harami', genre: 'yakiniku', name: 'ハラミ', base: 'grill', col: [0x8b2020, 0xf2d0c0], taste: 3.5, price: 1100, cost: 420, time: 8 },
  { id: 'rice', genre: 'yakiniku', name: 'ごはん', base: 'bowl', col: [0xffffff, 0xffffff], taste: 2.6, price: 250, cost: 40, time: 2 },
  { id: 'reimen', genre: 'yakiniku', name: '冷麺', base: 'bowl', col: [0xdcd3b5, 0xc0392b], taste: 3.3, price: 900, cost: 260, time: 7 },
];
export const RECIPE = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

// オリジナル料理の材料（土台・メイン・味つけ）
export const CUSTOM_BASES = [
  { id: 'men', name: '麺', word: 'ラーメン', base: 'bowl', genres: ['ramen'], price: 800, cost: 150, time: 9, col: 0xf3d58a },
  { id: 'gohan', name: 'ごはん', word: '丼', base: 'bowl', genres: ['sushi', 'yakiniku', 'curry'], price: 750, cost: 120, time: 7, col: 0xffffff },
  { id: 'pan', name: 'パン', word: 'サンド', base: 'bun', genres: ['burger', 'cafe'], price: 600, cost: 120, time: 6, col: 0xd99a4e },
  { id: 'nan', name: 'ナン', word: 'ナンロール', base: 'plate', genres: ['curry'], price: 650, cost: 110, time: 6, col: 0xe8c48c },
  { id: 'cup', name: 'カップ', word: 'ドリンク', base: 'cup', genres: ['cafe', 'burger'], price: 450, cost: 70, time: 4, col: 0xffffff },
  { id: 'plate', name: 'お皿', word: 'プレート', base: 'plate', genres: ['cafe', 'curry', 'yakiniku'], price: 900, cost: 160, time: 8, col: 0xf4f4f4 },
];
export const CUSTOM_MAINS = [
  { id: 'buta', name: '豚肉', word: 'ポーク', cost: 120, taste: 0.3, col: 0xd9a07a, good: ['men', 'gohan', 'pan'] },
  { id: 'gyu', name: '牛肉', word: 'ビーフ', cost: 220, taste: 0.5, col: 0x7a3a2a, good: ['gohan', 'pan', 'plate'] },
  { id: 'tori', name: '鶏肉', word: 'チキン', cost: 100, taste: 0.3, col: 0xe0b080, good: ['men', 'nan', 'pan'] },
  { id: 'sakana', name: '魚', word: 'シーフード', cost: 180, taste: 0.4, col: 0xff8a5c, good: ['gohan', 'men'] },
  { id: 'yasai', name: '野菜', word: 'ベジ', cost: 60, taste: 0.1, col: 0x6aa84f, good: ['plate', 'pan', 'nan'] },
  { id: 'cheese', name: 'チーズ', word: 'チーズ', cost: 90, taste: 0.35, col: 0xf4c430, good: ['pan', 'nan', 'men'] },
  { id: 'fruit', name: 'フルーツ', word: 'フルーツ', cost: 110, taste: 0.35, col: 0xe53950, good: ['cup', 'pan', 'plate'] },
  { id: 'egg', name: 'たまご', word: 'たまご', cost: 40, taste: 0.2, col: 0xffd54f, good: ['gohan', 'men', 'pan'] },
];
export const CUSTOM_FLAVORS = [
  { id: 'shoyu', name: '醤油', word: '醤油', taste: 0.2, col: 0x6b3a14, good: ['gohan', 'men', 'buta'] },
  { id: 'miso', name: '味噌', word: '味噌', taste: 0.2, col: 0xb9772a, good: ['men', 'buta', 'yasai'] },
  { id: 'spice', name: 'スパイス', word: 'スパイシー', taste: 0.3, col: 0xc0392b, good: ['nan', 'tori', 'gyu'] },
  { id: 'amai', name: '甘口', word: 'ハニー', taste: 0.25, col: 0xf6b26b, good: ['cup', 'fruit', 'pan'] },
  { id: 'shio', name: '塩', word: '塩', taste: 0.15, col: 0xeeeeee, good: ['sakana', 'men', 'tori'] },
  { id: 'cream', name: 'クリーム', word: 'クリーミー', taste: 0.3, col: 0xfff8e7, good: ['cup', 'cheese', 'plate'] },
];

// オリジナル料理の作り方（同じ組み合わせなら必ず同じ味）
export function makeCustomRecipe(baseId, mainId, flavorId, name) {
  const b = CUSTOM_BASES.find((x) => x.id === baseId);
  const m = CUSTOM_MAINS.find((x) => x.id === mainId);
  const f = CUSTOM_FLAVORS.find((x) => x.id === flavorId);
  if (!b || !m || !f) return null;
  let taste = 2.4 + m.taste + f.taste;
  if (m.good.includes(b.id)) taste += 0.5;
  if (f.good.includes(b.id)) taste += 0.3;
  if (f.good.includes(m.id)) taste += 0.4;
  // ちょっとした「意外なおいしさ」
  let h = 0; for (const c of b.id + m.id + f.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  taste += ((h % 7) - 3) * 0.08;
  taste = Math.max(1.5, Math.min(4.8, Math.round(taste * 10) / 10));
  const id = 'c_' + b.id + '_' + m.id + '_' + f.id;
  return {
    id, custom: true, genre: b.genres[0], genres: b.genres,
    name: (name || `${f.word}${m.word}${b.word}`).slice(0, 14),
    base: b.base, col: [m.col, f.col === 0xeeeeee ? b.col : f.col],
    taste, price: Math.round((b.price + m.cost * 1.5) / 50) * 50, cost: b.cost + m.cost, time: b.time + 1,
    parts: [b.id, m.id, f.id],
  };
}
export const CUSTOM_DEV_COST = 5000;

// ---------- お客さん ----------
// like: ジャンルの好み  tasteW: 味をどれだけ気にするか  priceW: 値段  speedW: 待ち時間  lookW: 見た目  ratingW: 評判
export const CUSTOMERS = {
  student: { name: '学生', budget: 800, patience: 50, eat: 14, tasteW: 0.6, priceW: 1.6, speedW: 0.8, lookW: 0.6, ratingW: 0.5,
    like: { ramen: 1.3, cafe: 1.0, sushi: 0.6, burger: 1.4, curry: 1.2, yakiniku: 0.8 } },
  worker: { name: '会社員', budget: 1100, patience: 38, eat: 12, tasteW: 0.8, priceW: 1.0, speedW: 1.6, lookW: 0.4, ratingW: 0.7,
    like: { ramen: 1.4, cafe: 0.8, sushi: 0.9, burger: 1.0, curry: 1.3, yakiniku: 1.0 } },
  gourmet: { name: 'グルメ', budget: 3200, patience: 75, eat: 20, tasteW: 1.8, priceW: 0.3, speedW: 0.5, lookW: 0.9, ratingW: 1.4,
    like: { ramen: 1.0, cafe: 0.9, sushi: 1.5, burger: 0.6, curry: 0.9, yakiniku: 1.4 } },
  family: { name: '家族連れ', budget: 1300, patience: 55, eat: 18, tasteW: 0.9, priceW: 1.1, speedW: 0.9, lookW: 1.2, ratingW: 0.8,
    like: { ramen: 0.9, cafe: 1.0, sushi: 1.3, burger: 1.3, curry: 1.0, yakiniku: 1.3 } },
  relax: { name: 'のんびりさん', budget: 1200, patience: 80, eat: 24, tasteW: 0.9, priceW: 0.8, speedW: 0.3, lookW: 1.8, ratingW: 0.8,
    like: { ramen: 0.7, cafe: 1.6, sushi: 1.0, burger: 0.8, curry: 0.9, yakiniku: 0.8 } },
  tourist: { name: '観光客', budget: 2200, patience: 65, eat: 16, tasteW: 1.2, priceW: 0.5, speedW: 0.6, lookW: 1.3, ratingW: 1.6,
    like: { ramen: 1.3, cafe: 1.0, sushi: 1.5, burger: 0.8, curry: 1.0, yakiniku: 1.2 } },
};
// 時間帯ごとの来る人の割合
export function customerMix(hour) {
  if (hour < 12) return { student: 1, worker: 1, gourmet: 1, family: 1, relax: 3 };
  if (hour < 14) return { student: 3, worker: 5, gourmet: 1, family: 1, relax: 1 };
  if (hour < 17) return { student: 3, worker: 1, gourmet: 1, family: 2, relax: 3 };
  if (hour < 19.5) return { student: 2, worker: 4, gourmet: 2, family: 3, relax: 1 };
  return { student: 1, worker: 3, gourmet: 3, family: 1, relax: 1 };
}
// 時間帯ごとの人の多さ（昼と夜が多い）
export function crowdCurve(hour) {
  const lunch = Math.exp(-((hour - 12.5) ** 2) / 1.2);
  const dinner = Math.exp(-((hour - 19) ** 2) / 1.8);
  return 0.35 + lunch * 1.0 + dinner * 1.1;
}

// ---------- 家具 ----------
// w,d: 何マス使うか（1マス=1m） seats: 座れる人数 comfort: 居心地 look: 見た目（通りからの印象）
export const FURNITURE = [
  { id: 'table2', name: '2人テーブル', w: 2, d: 2, seats: 2, comfort: 1, look: 0.5, cost: 6000 },
  { id: 'table4', name: '4人テーブル', w: 3, d: 3, seats: 4, comfort: 1.5, look: 0.7, cost: 11000 },
  { id: 'counter', name: 'カウンター席', w: 3, d: 2, seats: 3, comfort: 0.6, look: 0.4, cost: 8000 },
  { id: 'booth', name: 'ソファ席', w: 3, d: 3, seats: 4, comfort: 3, look: 1.3, cost: 24000 },
  { id: 'plant', name: '観葉植物', w: 1, d: 1, seats: 0, comfort: 1.2, look: 1.2, cost: 3500 },
  { id: 'lamp', name: 'フロアランプ', w: 1, d: 1, seats: 0, comfort: 1, look: 1, cost: 4500 },
  { id: 'shelf', name: 'かざり棚', w: 2, d: 1, seats: 0, comfort: 0.8, look: 1.4, cost: 9000 },
  { id: 'aquarium', name: '水そう', w: 2, d: 1, seats: 0, comfort: 2.2, look: 2.5, cost: 30000 },
  { id: 'piano', name: 'ピアノ', w: 2, d: 2, seats: 0, comfort: 3, look: 3, cost: 60000 },
];
export const FURN = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));
export const FLOORS = [
  { id: 'wood', name: '木の床', color: 0x9a6b43, cost: 0 },
  { id: 'tile', name: '白タイル', color: 0xe6e2da, cost: 5000 },
  { id: 'dark', name: 'こげ茶の床', color: 0x4a3326, cost: 5000 },
  { id: 'check', name: 'チェック柄', color: 0x222222, cost: 8000 },
  { id: 'marble', name: '大理石', color: 0xf0eee8, cost: 20000 },
];
export const WALLS = [
  { id: 'cream', name: 'クリーム', color: 0xf1e6d2 },
  { id: 'white', name: 'しっくい白', color: 0xf7f5f0 },
  { id: 'brick', name: 'レンガ', color: 0xa0523a },
  { id: 'wood', name: '板張り', color: 0x8a5a36 },
  { id: 'navy', name: 'ネイビー', color: 0x24344d },
  { id: 'green', name: 'ミントグリーン', color: 0xa9d8c3 },
];

// ---------- お店のレベル ----------
// W,D: 広さ  stoves: コンロの数  staff: 雇える人数  menu: 出せる料理の数
export const LEVELS = [
  null,
  { lv: 1, name: '屋台', W: 7, D: 7, stoves: 1, staff: 2, menu: 3, cost: 0, needRating: 0, needCust: 0 },
  { lv: 2, name: '小さなお店', W: 10, D: 10, stoves: 2, staff: 3, menu: 5, cost: 150000, needRating: 3.0, needCust: 60 },
  { lv: 3, name: '人気店', W: 12, D: 12, stoves: 2, staff: 4, menu: 6, cost: 450000, needRating: 3.4, needCust: 250 },
  { lv: 4, name: '大きなレストラン', W: 13, D: 14, stoves: 3, staff: 6, menu: 8, cost: 1200000, needRating: 3.8, needCust: 700 },
  { lv: 5, name: '高級店', W: 13, D: 15, stoves: 4, staff: 8, menu: 10, cost: 3000000, needRating: 4.2, needCust: 1600 },
];
export const KITCHEN_DEPTH = 3.2;

// ---------- 店員 ----------
export const ROLES = {
  all: { name: 'アルバイト', desc: '料理も運びも少しずつ' },
  cook: { name: '料理人', desc: '料理を作る' },
  hall: { name: 'ホール係', desc: '料理を運ぶ・片づける' },
};
const FIRST = ['たろう', 'はなこ', 'けんた', 'さくら', 'ゆうき', 'みゆ', 'そうた', 'あおい', 'りく', 'ひなた', 'こうじ', 'まな', 'しょう', 'えみ', 'だいち', 'ゆい'];
export const RECRUIT_COST = 3000; // 求人を出して、はたらきたい人を入れかえる
export function makeStaffCandidate(rnd, role) {
  const r = role || ['cook', 'hall', 'all'][Math.floor(rnd() * 3)];
  const skill = 1 + Math.floor(rnd() * rnd() * 5);
  const speed = 1 + Math.floor(rnd() * 5);
  const charm = 1 + Math.floor(rnd() * 5);
  const wage = Math.round((2500 + skill * 1800 + speed * 900 + charm * 700) / 100) * 100;
  return { id: 's' + Math.floor(rnd() * 1e9).toString(36), name: FIRST[Math.floor(rnd() * FIRST.length)], role: r, skill, speed, charm, wage, look: Math.floor(rnd() * 1e6) };
}

// ---------- 宣伝・イベント ----------
export const ADS = [
  { id: 'flyer', name: 'チラシ配り', desc: '今日は評判を聞いて来るお客さんが増える', cost: 4000, once: false },
  { id: 'sale', name: 'タイムセール', desc: '今日の夕方5〜7時は全品2割引き。通りがかりの人がたくさん入る', cost: 0, once: false },
  { id: 'tasting', name: '試食会', desc: '今日は通りがかりの人が入りやすくなる', cost: 6000, once: false },
  { id: 'signboard', name: '大きな看板', desc: 'ずっと効果。お店が目立って通りがかりの人が入りやすい', cost: 30000, once: true },
  { id: 'neon', name: 'ネオンサイン', desc: 'ずっと効果。夜に光って目立つ（夜のお客さんアップ）', cost: 50000, once: true },
];
export const AD = Object.fromEntries(ADS.map((a) => [a.id, a]));

// ---------- 町 ----------
// 区画：x は通りに沿った位置、side -1 は北側（扉は南向き）、+1 は南側
export const LOTS = [
  { id: 0, x: -50, side: -1, traffic: 1.5, rent: 9000, price: 150000 },
  { id: 1, x: -32, side: -1, traffic: 1.25, rent: 7000, price: 115000 },
  { id: 2, x: -14, side: -1, traffic: 1.15, rent: 6500, price: 90000 },
  { id: 3, x: 14, side: -1, traffic: 1.0, rent: 5000, price: 65000 },
  { id: 4, x: 32, side: -1, traffic: 0.85, rent: 4000, price: 50000 },
  { id: 5, x: 50, side: -1, traffic: 0.75, rent: 3000, price: 40000 },
  { id: 6, x: -50, side: 1, traffic: 1.45, rent: 8500, price: 140000 },
  { id: 7, x: -32, side: 1, traffic: 1.2, rent: 6500, price: 105000 },
  { id: 8, x: -14, side: 1, traffic: 1.1, rent: 6000, price: 85000 },
  { id: 9, x: 14, side: 1, traffic: 0.95, rent: 4500, price: 60000 },
  { id: 10, x: 32, side: 1, traffic: 0.8, rent: 3500, price: 46000 },
  { id: 11, x: 50, side: 1, traffic: 0.7, rent: 2800, price: 36000 },
];
export const MOVE_COST = 40000;
// 土地代：駅に近いほど高い。最初の資本金なら、どこでも買える
export const START_CAPITAL = 230000;
export const BRANCH_FEE = 30000; // 2店目からの開店準備費
export const MAX_SHOPS = 3; // 1人が持てるお店の数
// 引っ越し：新しい土地代から、今の土地を売った分（7割）を引く
export const moveCost = (from, to) => Math.max(20000, LOTS[to].price - Math.round(LOTS[from].price * 0.7));
export const BUZZ_LEVELS = [
  { min: 0, name: 'さびしい町' },
  { min: 15, name: 'ふつうの町' },
  { min: 35, name: 'にぎやかな町' },
  { min: 60, name: '大にぎわいの町' },
  { min: 85, name: 'みんなの観光名所' },
];
export function buzzName(b) { let n = BUZZ_LEVELS[0].name; for (const l of BUZZ_LEVELS) if (b >= l.min) n = l.name; return n; }

// ---------- トロフィー ----------
export const TROPHIES = [
  { id: 'first', name: 'はじめてのお客さん', icon: '🎉', check: (s) => s.stats.totalCust >= 1 },
  { id: 'c100', name: '1日100人来店', icon: '👥', check: (s) => s.stats.bestDayCust >= 100 },
  { id: 'c50', name: '1日50人来店', icon: '🙋', check: (s) => s.stats.bestDayCust >= 50 },
  { id: 'queue10', name: '行列10人', icon: '🚶', check: (s) => s.stats.bestQueue >= 10 },
  { id: 'queue30', name: '行列30人', icon: '🏃', check: (s) => s.stats.bestQueue >= 30 },
  { id: 'star4', name: '星4つ', icon: '⭐', check: (s) => s.rating >= 4 },
  { id: 'star5', name: '星5つ', icon: '🌟', check: (s) => s.rating >= 4.8 },
  { id: 'sales100k', name: '1日の売上10万円', icon: '💴', check: (s) => s.stats.bestDaySales >= 100000 },
  { id: 'sales1m', name: '1日の売上100万円', icon: '💰', check: (s) => s.stats.bestDaySales >= 1000000 },
  { id: 'total1000', name: 'のべ1000人', icon: '🏅', check: (s) => s.stats.totalCust >= 1000 },
  { id: 'dev1', name: 'オリジナル料理開発', icon: '🧑‍🍳', check: (s) => (s.customs || []).length >= 1 },
  { id: 'dev10', name: '新料理10品開発', icon: '📖', check: (s) => (s.customs || []).length >= 10 },
  { id: 'lv3', name: '人気店になった', icon: '🏪', check: (s) => s.level >= 3 },
  { id: 'lv5', name: '高級店になった', icon: '🏰', check: (s) => s.level >= 5 },
  { id: 'perfect', name: '1日だれも怒らせない（30人以上）', icon: '😊', check: (s) => s.stats.perfectDay },
  { id: 'piano', name: 'ピアノのあるお店', icon: '🎹', check: (s) => s.layout.some((f) => f.id === 'piano') },
];

// ---------- コンピューターのお店 ----------
export const CPU_NAMES = {
  ramen: ['麺屋 たいよう', 'らーめん 大将', '中華そば みなと'],
  cafe: ['カフェ こもれび', 'Café Lumière', '喫茶 ひだまり'],
  sushi: ['寿司 まつ', '鮨 はなぶさ', 'すし処 うしお'],
  burger: ['BIG BITE', 'バーガー スター', 'GOOD BURGER'],
  curry: ['カレーの店 ガネーシャ', 'スパイス亭', 'カレー工房 ルウ'],
  yakiniku: ['焼肉 ぎゅう太', '炭火焼肉 ほむら', '焼肉 牛若'],
};

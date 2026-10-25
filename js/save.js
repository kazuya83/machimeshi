// 町の保存（Firebase が使えればクラウド、使えなければこのブラウザの中）
import { firebaseConfig, FIREBASE_SDK } from './firebase-config.js';
import { uid } from './util.js';

const LS = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても続行 */ } },
};

function localTowns() {
  try { return JSON.parse(LS.get('mm-towns', '{}')) || {}; } catch (e) { return {}; }
}
function summary(t) {
  return {
    id: t.id, name: t.name, day: t.day, buzz: t.buzz, updated: t.lastPlayed,
    shops: Object.values(t.shops).map((s) => ({ owner: s.owner, name: s.name, ownerName: s.ownerName, cpu: s.cpu, genre: s.genre, rating: s.rating, level: s.level, money: s.money, totalCust: s.stats.totalCust, totalSales: s.stats.totalSales })),
  };
}

export const Store = {
  mode: 'local', uid: null, google: false, displayName: '', fb: null, ready: null,

  async init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      this.uid = LS.get('mm-pid', null);
      if (!this.uid) { this.uid = 'p_' + uid(); LS.set('mm-pid', this.uid); }
      if (new URLSearchParams(location.search).has('local')) return this;
      try {
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
        const load = (async () => {
          const [app, auth, fs] = await Promise.all([
            import(`${FIREBASE_SDK}/firebase-app.js`),
            import(`${FIREBASE_SDK}/firebase-auth.js`),
            import(`${FIREBASE_SDK}/firebase-firestore.js`),
          ]);
          const fapp = app.initializeApp(firebaseConfig);
          const a = auth.getAuth(fapp);
          const db = fs.getFirestore(fapp);
          this.fb = { auth, fs, a, db };
          const user = await new Promise((res) => {
            const off = auth.onAuthStateChanged(a, (u) => { off(); res(u); });
          });
          if (!user) await auth.signInAnonymously(a);
          this.applyUser(a.currentUser);
          this.mode = 'cloud';
        })();
        await Promise.race([load, timeout]);
      } catch (e) {
        console.warn('Firebase が使えないのでブラウザに保存します', e);
        this.mode = 'local';
      }
      return this;
    })();
    return this.ready;
  },
  applyUser(u) {
    if (!u) return;
    this.uid = u.uid;
    this.google = !u.isAnonymous;
    this.displayName = u.displayName || '';
  },

  async loginGoogle() {
    if (this.mode !== 'cloud') throw new Error('いまはクラウドに接続できません');
    const { auth, a } = this.fb;
    const provider = new auth.GoogleAuthProvider();
    try {
      // いまの記録を引き継いだままGoogleにつなぐ
      if (a.currentUser?.isAnonymous) await auth.linkWithPopup(a.currentUser, provider);
      else await auth.signInWithPopup(a, provider);
    } catch (e) {
      // すでに別の端末で使っているGoogleアカウントならそちらに切り替える
      if (e.code === 'auth/credential-already-in-use' || e.code === 'auth/email-already-in-use') await auth.signInWithPopup(a, provider);
      else throw e;
    }
    this.applyUser(a.currentUser);
    return this.google;
  },
  async logout() {
    if (this.mode !== 'cloud') return;
    const { auth, a } = this.fb;
    await auth.signOut(a);
    await auth.signInAnonymously(a);
    this.applyUser(a.currentUser);
  },

  // 自分が入っている町の一覧
  async listTowns() {
    const out = new Map();
    for (const t of Object.values(localTowns())) if (t.members?.includes(this.uid) || t.shops?.[this.uid] || t.host === this.uid) out.set(t.id, summary(t));
    if (this.mode === 'cloud') {
      try {
        const { fs, db } = this.fb;
        const q = fs.query(fs.collection(db, 'towns'), fs.where('members', 'array-contains', this.uid));
        const snap = await fs.getDocs(q);
        snap.forEach((d) => { try { const t = JSON.parse(d.data().data); out.set(t.id, summary(t)); } catch (e) { /* 壊れたデータは無視 */ } });
      } catch (e) { console.warn('町の一覧を読めませんでした', e); }
    }
    return [...out.values()].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  },

  async loadTown(id) {
    let town = localTowns()[id] || null;
    if (this.mode === 'cloud') {
      try {
        const { fs, db } = this.fb;
        const d = await fs.getDoc(fs.doc(db, 'towns', id));
        if (d.exists()) {
          const t = JSON.parse(d.data().data);
          if (!town || (t.lastPlayed || 0) >= (town.lastPlayed || 0)) town = t;
        }
      } catch (e) { console.warn('クラウドから読めませんでした', e); }
    }
    return town;
  },

  async saveTown(town) {
    town.members = [...new Set([...(town.members || []), ...Object.keys(town.shops).filter((k) => !k.startsWith('cpu'))])];
    town.host = town.host || this.uid;
    const all = localTowns(); all[town.id] = town;
    LS.set('mm-towns', JSON.stringify(all));
    if (this.mode !== 'cloud') return 'local';
    try {
      const { fs, db } = this.fb;
      await fs.setDoc(fs.doc(db, 'towns', town.id), {
        name: town.name, host: town.host, members: town.members, day: town.day,
        updatedAt: fs.serverTimestamp(), data: JSON.stringify(town),
      });
      return 'cloud';
    } catch (e) {
      console.warn('クラウドに保存できませんでした', e);
      return 'local';
    }
  },

  async deleteTown(id) {
    const all = localTowns(); delete all[id]; LS.set('mm-towns', JSON.stringify(all));
    if (this.mode === 'cloud') {
      try { const { fs, db } = this.fb; await fs.deleteDoc(fs.doc(db, 'towns', id)); } catch (e) { /* 自分の町でなければ消せない */ }
    }
  },

  local: LS,
};

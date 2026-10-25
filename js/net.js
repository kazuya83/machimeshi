// オンライン通信（部屋を作った人のPCが親になるP2P方式。PeerJSを使用）
const PREFIX = 'machimeshi-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// 動作確認用：?peerserver=host:port で自前のシグナリングサーバーを使う
function peerOptions() {
  const ps = new URLSearchParams(location.search).get('peerserver');
  if (!ps) return { debug: 0 };
  const [host, port] = ps.split(':');
  return { debug: 0, host, port: Number(port) || 9000, path: '/', secure: false };
}

export function makeCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export class Net {
  constructor() {
    this.peer = null;
    this.conns = new Map();
    this.hostConn = null;
    this.isHost = false;
    this.myId = '';
    this.handlers = {};
    this.closed = false;
  }

  on(type, fn) { this.handlers[type] = fn; }
  emit(type, ...a) { this.handlers[type]?.(...a); }

  host(code) {
    this.isHost = true;
    return new Promise((resolve, reject) => {
      const peer = new window.Peer(PREFIX + code, peerOptions());
      this.peer = peer;
      let opened = false;
      peer.on('open', (id) => { opened = true; this.myId = id; resolve(code); });
      peer.on('error', (e) => { if (!opened) reject(e); else this.emit('error', e); });
      peer.on('disconnected', () => { if (!this.closed) { try { peer.reconnect(); } catch (e) { /* 無視 */ } } });
      peer.on('connection', (conn) => {
        conn.on('open', () => { this.conns.set(conn.peer, conn); this.emit('join', conn.peer); });
        conn.on('data', (d) => this.emit('data', d, conn.peer));
        conn.on('close', () => { if (this.conns.delete(conn.peer)) this.emit('leave', conn.peer); });
        conn.on('error', () => { if (this.conns.delete(conn.peer)) this.emit('leave', conn.peer); });
      });
    });
  }

  join(code) {
    this.isHost = false;
    return new Promise((resolve, reject) => {
      const peer = new window.Peer(peerOptions());
      this.peer = peer;
      let done = false;
      const fail = (e) => { if (!done) { done = true; reject(e); } else if (!this.closed) this.emit('hostLost'); };
      const timer = setTimeout(() => fail(new Error('timeout')), 12000);
      peer.on('open', (id) => {
        this.myId = id;
        const conn = peer.connect(PREFIX + code, { reliable: true });
        this.hostConn = conn;
        conn.on('open', () => { clearTimeout(timer); done = true; resolve(); });
        conn.on('data', (d) => this.emit('data', d, 'host'));
        conn.on('close', () => { if (!this.closed) this.emit('hostLost'); });
        conn.on('error', () => { if (!this.closed && done) this.emit('hostLost'); });
      });
      peer.on('error', (e) => { clearTimeout(timer); fail(e); });
    });
  }

  send(id, msg) { const c = this.conns.get(id); if (c && c.open) c.send(msg); }
  toHost(msg) { if (this.hostConn && this.hostConn.open) this.hostConn.send(msg); }
  broadcast(msg, except) {
    for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg);
  }
  kick(id) { const c = this.conns.get(id); if (c) { this.conns.delete(id); setTimeout(() => c.close(), 300); } }

  close() {
    this.closed = true;
    try { this.peer?.destroy(); } catch (e) { /* 無視 */ }
  }
}

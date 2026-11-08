'use strict';
/* Car Merge Pro — игровой сервер. Без зависимостей, нужен Node.js 18+.
   Запуск: node server.js   (порт: PORT, папка данных: DATA_DIR) */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_FILE = path.join(DATA_DIR, 'data.json');
const GARAGE = 12, MAX = 20, BIG = 1e40;
const SESSION_TTL = 60 * 24 * 3600 * 1000;

/* ---------- хранилище (JSON-файл, запись раз в 2 сек) ---------- */
let db = { users: {}, sessions: {} };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
db.users = db.users || {}; db.sessions = db.sessions || {};
let dirty = false;
const save = () => { dirty = true; };
function flush() {
  if (!dirty) return; dirty = false;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
setInterval(flush, 2000);
['SIGINT', 'SIGTERM'].forEach(s => process.on(s, () => { flush(); process.exit(0); }));

/* ---------- утилиты ---------- */
const err = (m, s) => Object.assign(new Error(m), { status: s });
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const newToken = () => crypto.randomBytes(24).toString('hex');
const rid = () => crypto.randomBytes(5).toString('hex');

const hits = new Map(); // простой лимит попыток входа: 10 в минуту с IP
function limited(ip) {
  const now = Date.now(), h = hits.get(ip) || { n: 0, t: now };
  if (now - h.t > 60000) { h.n = 0; h.t = now; }
  h.n++; hits.set(ip, h);
  return h.n > 10;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n - v.t > 60000) hits.delete(k); }, 60000);

/* ---------- состояние игрока ---------- */
const newState = () => {
  const g = Array(GARAGE).fill(0); g[0] = 1;
  return { money: 100, coins: 0, garage: g, bought: 0, upg: { inc: 0, spawn: 0, cheap: 0 }, perm: { mult: 0, auto: 0 }, boostUntil: 0, maxLevel: 1, applied: [] };
};
const num = (v, max = BIG) => { v = +v; return Number.isFinite(v) && v > 0 ? Math.min(v, max) : 0; };
const int = (v, max) => Math.floor(num(v, max));
function cleanState(s, old) {
  if (!s || typeof s !== 'object') return old;
  const garage = (Array.isArray(s.garage) ? s.garage : old.garage).slice(0, GARAGE).map(x => int(x, MAX));
  while (garage.length < GARAGE) garage.push(0);
  const u = s.upg || {}, p = s.perm || {};
  return {
    money: num(s.money), coins: num(s.coins), garage, bought: int(s.bought, 1e6),
    upg: { inc: int(u.inc, 100), spawn: int(u.spawn, 5), cheap: int(u.cheap, 10) },
    perm: { mult: int(p.mult, 1000), auto: int(p.auto, 1) },
    boostUntil: num(s.boostUntil, 8e15),
    maxLevel: Math.max(1, int(s.maxLevel, MAX), ...garage),
    applied: (Array.isArray(s.applied) ? s.applied : []).map(String).slice(-200)
  };
}
const income = s => {
  const m = (1 + .15 * s.upg.inc) * (1 + .25 * s.perm.mult) * (s.boostUntil > Date.now() ? 2 : 1);
  return s.garage.reduce((a, l) => a + (l ? Math.pow(2.3, l - 1) : 0), 0) * m;
};

/* ---------- авторизация ---------- */
function session(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const ss = t && db.sessions[t];
  if (!ss || Date.now() - ss.t > SESSION_TTL || !db.users[ss.k]) return null;
  return { token: t, k: ss.k, u: db.users[ss.k] };
}
const need = req => { const s = session(req); if (!s) throw err('Требуется вход', 401); return s; };
const admin = req => { const s = need(req); if (!s.u.isAdmin) throw err('Нет доступа', 403); return s; };
const profile = (k, extra) => Object.assign({ nick: db.users[k].nick, isAdmin: !!db.users[k].isAdmin, state: db.users[k].state, grants: db.users[k].grants }, extra);
function login(k) {
  const token = newToken();
  db.sessions[token] = { k, t: Date.now() }; save();
  return profile(k, { token });
}

/* ---------- рейтинг ---------- */
const SORTS = ['maxLevel', 'money', 'coins'];
function board(sort, me) {
  const rows = Object.values(db.users).map(u => ({ nick: u.nick, maxLevel: u.state.maxLevel, money: Math.floor(u.state.money), coins: Math.round(u.state.coins * 10) / 10, income: Math.floor(income(u.state)) }));
  rows.sort((a, b) => b[sort] - a[sort] || b.maxLevel - a.maxLevel || b.income - a.income || a.nick.localeCompare(b.nick));
  rows.forEach((r, i) => r.rank = i + 1);
  return { sort, total: rows.length, players: rows.slice(0, 50), me: me ? rows.find(r => r.nick === me.u.nick) || null : null };
}

/* ---------- маршруты ---------- */
function route(req, p, q, b, ip) {
  const M = req.method;
  if (p === '/api/health') return { ok: true };

  if (p === '/api/register' && M === 'POST') {
    if (limited(ip)) throw err('Слишком много попыток, подождите минуту', 429);
    const nick = String(b.nick || '').trim(), k = nick.toLowerCase();
    if (!/^[A-Za-z0-9_\-а-яА-ЯёЁ]{3,16}$/.test(nick)) throw err('Ник: 3–16 символов (буквы, цифры, _ и -)', 400);
    if (String(b.password || '').length < 4) throw err('Пароль: минимум 4 символа', 400);
    if (db.users[k]) throw err('Этот ник уже занят', 409);
    const salt = crypto.randomBytes(16).toString('hex');
    db.users[k] = { nick, salt, pw: hashPw(String(b.password), salt), isAdmin: !Object.keys(db.users).length, grants: [], state: newState() };
    return login(k);
  }
  if (p === '/api/login' && M === 'POST') {
    if (limited(ip)) throw err('Слишком много попыток, подождите минуту', 429);
    const k = String(b.nick || '').trim().toLowerCase(), u = db.users[k];
    const ok = u && crypto.timingSafeEqual(Buffer.from(hashPw(String(b.password || ''), u.salt), 'hex'), Buffer.from(u.pw, 'hex'));
    if (!ok) throw err('Неверный ник или пароль', 401);
    return login(k);
  }
  if (p === '/api/me') { const s = need(req); return profile(s.k); }
  if (p === '/api/logout') { const s = session(req); if (s) { delete db.sessions[s.token]; save(); } return { ok: true }; }
  if (p === '/api/sync' && M === 'POST') {
    const s = need(req);
    if (b.state) s.u.state = cleanState(b.state, s.u.state);
    const ack = new Set(b.ack || []);
    s.u.grants = s.u.grants.filter(g => !ack.has(g.id));
    save(); return { ok: true, grants: s.u.grants };
  }
  if (p === '/api/leaderboard') {
    const sort = SORTS.includes(q.get('sort')) ? q.get('sort') : 'maxLevel';
    return board(sort, session(req));
  }
  if (p === '/api/admin/players') {
    const s = admin(req), qq = (q.get('q') || '').toLowerCase(), all = Object.entries(db.users);
    return { total: all.length, players: all.filter(([n]) => n.includes(qq)).slice(0, 100).map(([n, u]) => ({ nick: u.nick, isAdmin: !!u.isAdmin, online: n === s.k, money: u.state.money, coins: u.state.coins, cars: u.state.garage.filter(Boolean).length })) };
  }
  if (p === '/api/admin/grant' && M === 'POST') {
    const s = admin(req), u = db.users[String(b.nick || '').trim().toLowerCase()];
    if (!u) throw err('Игрок не найден', 404);
    const money = num(b.money), coins = num(b.coins), car = int(b.car, MAX), cnt = Math.min(GARAGE, Math.max(1, int(b.count, GARAGE) || 1));
    let n = 0;
    if (money) { u.grants.push({ id: rid(), type: 'money', amount: money }); n++; }
    if (coins) { u.grants.push({ id: rid(), type: 'coins', amount: coins }); n++; }
    if (car) for (let i = 0; i < cnt; i++) { u.grants.push({ id: rid(), type: 'car', level: car }); n++; }
    if (!n) throw err('Нечего выдавать', 400);
    save(); return { ok: true, nick: u.nick, online: u === s.u };
  }
  throw err('Неизвестный метод', 404);
}

/* ---------- HTTP ---------- */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const send = (res, code, obj, type = 'application/json; charset=utf-8') =>
  { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...CORS }); res.end(typeof obj === 'string' || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj)); };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  if (!p.startsWith('/api/')) {
    if (p === '/' || p === '/index.html') {
      return fs.readFile(path.join(__dirname, 'index.html'), (e, d) => e ? send(res, 404, 'index.html не найден', 'text/plain; charset=utf-8') : send(res, 200, d, 'text/html; charset=utf-8'));
    }
    return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  let raw = '', big = false;
  req.on('data', c => { raw += c; if (raw.length > 300000) { big = true; req.destroy(); } });
  req.on('end', () => {
    if (big) return;
    try {
      let b = {}; if (raw) { try { b = JSON.parse(raw); } catch (e) { throw err('Некорректный JSON', 400); } }
      send(res, 200, route(req, p, url.searchParams, b, ip));
    } catch (e) {
      send(res, e.status || 500, { error: e.status ? e.message : 'Ошибка сервера' });
      if (!e.status) console.error(e);
    }
  });
}).listen(PORT, () => console.log('Car Merge Pro: http://localhost:' + PORT));

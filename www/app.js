/* Terpene — medical cannabis session journal.
 * Everything runs on-device. Data lives in this phone's app storage only. */
(() => {
'use strict';

/* ───────────────────────── constants ───────────────────────── */
const STRAINS = window.STRAINS || [];
const STRAIN = Object.fromEntries(STRAINS.map(s => [s.id, s]));
const Cap = window.Capacitor;
const NATIVE = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const PL = (Cap && Cap.Plugins) || {};

const SYMPTOMS = [
  ['anxiety', 'Anxiety'], ['pain', 'Chronic pain'], ['insomnia', 'Sleep'], ['nausea', 'Nausea'],
  ['appetite', 'Low appetite'], ['focus', 'Focus'], ['ptsd', 'PTSD'], ['depression', 'Low mood'],
  ['inflammation', 'Inflammation'], ['spasticity', 'Muscle spasms'], ['migraine', 'Migraine / headache'],
  ['recreational', 'Unwinding'],
].map(([id, label]) => ({ id, label }));
const SYM = Object.fromEntries(SYMPTOMS.map(s => [s.id, s]));

// timing (minutes): when effects start, peak, fade — and when we ask how it went
const METHODS = [
  { id: 'vape_cart', label: 'Vape cart', short: 'vape', inhaled: true, onset: 5, peak: 30, dur: 180, checks: [15, 60, 180] },
  { id: 'flower_vape', label: 'Dry herb vape', short: 'vape', inhaled: true, onset: 5, peak: 30, dur: 180, checks: [15, 60, 180] },
  { id: 'flower_smoke', label: 'Smoked flower', short: 'smoke', inhaled: true, onset: 5, peak: 30, dur: 180, checks: [15, 60, 180] },
  { id: 'concentrate', label: 'Concentrate', short: 'dab', inhaled: true, onset: 3, peak: 30, dur: 180, checks: [15, 60, 180] },
  { id: 'tincture', label: 'Tincture', short: 'tincture', inhaled: false, onset: 30, peak: 90, dur: 300, checks: [30, 90, 240] },
  { id: 'edible', label: 'Edible', short: 'edible', inhaled: false, onset: 60, peak: 150, dur: 480, checks: [60, 150, 300] },
  { id: 'capsule', label: 'Capsule', short: 'capsule', inhaled: false, onset: 60, peak: 150, dur: 480, checks: [60, 150, 300] },
  { id: 'topical', label: 'Topical', short: 'topical', inhaled: false, onset: 15, peak: 60, dur: 180, checks: [30, 120] },
];
const METH = Object.fromEntries(METHODS.map(m => [m.id, m]));

const VIBES = [
  ['calm', 'Calm'], ['body_relaxed', 'Body relaxed'], ['uplifted', 'Uplifted'], ['focused', 'Focused'],
  ['sleepy', 'Sleepy'], ['hungry', 'Hungry'], ['giggly', 'Giggly'], ['talkative', 'Talkative'],
  ['creative', 'Creative'], ['sociable', 'Sociable'], ['energetic', 'Energetic'], ['euphoric', 'Euphoric'],
].map(([id, label]) => ({ id, label }));
const VIBE = Object.fromEntries(VIBES.map(v => [v.id, v]));

const NEGATIVES = [
  ['dry_mouth', 'Dry mouth'], ['anxious', 'Anxious'], ['paranoid', 'Paranoid'], ['foggy', 'Foggy'],
  ['dizzy', 'Dizzy'], ['headache', 'Headache'], ['lethargic', 'Lethargic'], ['racing_heart', 'Racing heart'],
].map(([id, label]) => ({ id, label }));
const NEG = Object.fromEntries(NEGATIVES.map(n => [n.id, n]));
const SERIOUS_NEG = ['anxious', 'paranoid', 'racing_heart'];

const TERPS = {
  myrcene: { label: 'Myrcene', aroma: 'Earthy, musky', note: 'often linked with body relaxation and sedation' },
  limonene: { label: 'Limonene', aroma: 'Citrus', note: 'often linked with mood lift and stress relief' },
  caryophyllene: { label: 'Caryophyllene', aroma: 'Peppery, spicy', note: 'often linked with calm and body comfort' },
  pinene: { label: 'Pinene', aroma: 'Pine', note: 'often linked with alertness and a clear head' },
  linalool: { label: 'Linalool', aroma: 'Floral, lavender', note: 'often linked with calm and sleep' },
  humulene: { label: 'Humulene', aroma: 'Woody, hoppy', note: 'often linked with body comfort' },
  terpinolene: { label: 'Terpinolene', aroma: 'Fruity, herbal', note: 'often linked with energy — some find it racy' },
  ocimene: { label: 'Ocimene', aroma: 'Sweet, herbal', note: 'often linked with an uplifted feel' },
  bisabolol: { label: 'Bisabolol', aroma: 'Floral, chamomile', note: 'often linked with soothing effects' },
  nerolidol: { label: 'Nerolidol', aroma: 'Woody, floral', note: 'often linked with relaxation' },
};
const TERP_IDS = Object.keys(TERPS);

const FREQS = [['daily', 'Daily'], ['few_per_week', 'Few times a week'], ['weekly', 'Weekly'], ['occasionally', 'Occasionally']];
const POPULAR_LIKED = ['blue-dream', 'wedding-cake', 'gsc', 'granddaddy-purple', 'og-kush', 'jack-herer', 'pineapple-express', 'northern-lights', 'gelato', 'gorilla-glue-4'];
const POPULAR_DISLIKED = ['sour-diesel', 'durban-poison', 'green-crack', 'trainwreck', 'jack-herer', 'tangie'];

/* ───────────────────────── storage ───────────────────────── */
const store = {
  get(k, d) { try { const v = localStorage.getItem('terpene:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('terpene:' + k, JSON.stringify(v)); } catch (e) { toast('Could not save — storage full?'); } },
  clear() { Object.keys(localStorage).filter(k => k.startsWith('terpene:')).forEach(k => localStorage.removeItem(k)); },
};
let profile = store.get('profile', null);
let sessions = store.get('sessions', []);
let products = store.get('products', []);
let settings = Object.assign({ reminders: true, eligible: false }, store.get('settings', {}));
const saveAll = () => { store.set('profile', profile); store.set('sessions', sessions); store.set('products', products); store.set('settings', settings); };

/* ───────────────────────── utilities ───────────────────────── */
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const round1 = v => Math.round(v * 10) / 10;
const fmtNum = v => (Math.round(v * 10) / 10).toString();
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const DAY = 86400000;
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const minsSince = t => Math.max(0, Math.round((Date.now() - t) / 60000));
const fmtMin = m => m < 60 ? `${m} min` : (m % 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : plural(m / 60, 'hr').replace('hrs', 'hr'));
const fmtTime = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function fmtDay(t) {
  const d = startOfDay(t), today = startOfDay(Date.now());
  if (d === today) return 'Today';
  if (d === today - DAY) return 'Yesterday';
  if (today - d < 6 * DAY) return new Date(t).toLocaleDateString([], { weekday: 'long' });
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
const fmtWhen = t => `${fmtDay(t)} ${fmtTime(t)}`;
const money = v => '$' + (Math.round(v * 100) / 100).toFixed(2).replace(/\.00$/, '');

function normalize(v) {
  const out = {}; let total = 0;
  for (const k in v) if (v[k] > 0) total += v[k];
  if (!total) return {};
  for (const k in v) if (v[k] > 0) out[k] = v[k] / total;
  return out;
}
function cosine(a, b) {
  let dot = 0, ma = 0, mb = 0;
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const x = (a && a[k]) || 0, y = (b && b[k]) || 0;
    dot += x * y; ma += x * x; mb += y * y;
  }
  return ma && mb ? dot / Math.sqrt(ma * mb) : 0;
}
// Share of terpene "mix" two profiles have in common (0–1). Both are normalized first.
function overlap(a, b) {
  const x = normalize(a || {}), y = normalize(b || {});
  if (!Object.keys(x).length || !Object.keys(y).length) return 0;
  let s = 0; for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) s += Math.min(x[k] || 0, y[k] || 0);
  return s;
}
const topTerps = (v, n = 3) => Object.entries(v || {}).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
const terpLabel = id => (TERPS[id] && TERPS[id].label) || id;
const cap1 = s => s ? s[0].toUpperCase() + s.slice(1) : s;

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const norm = s => String(s || '').toLowerCase().replace(/#/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const sim = (a, b) => { const L = Math.max(a.length, b.length); return L ? 1 - lev(a, b) / L : 0; };

function searchStrains(q, limit = 12) {
  const nq = norm(q);
  if (!nq) return [];
  const scored = STRAINS.map(s => {
    let best = 0;
    for (const n of [s.name, ...(s.aliases || [])].map(norm)) {
      if (n === nq) best = Math.max(best, 1);
      else if (n.startsWith(nq)) best = Math.max(best, 0.92);
      else if (n.includes(nq)) best = Math.max(best, 0.8);
      else if (nq.length >= 3) best = Math.max(best, sim(nq, n.slice(0, Math.max(nq.length, 3))) * 0.75, sim(nq, n) * 0.7);
    }
    return { s, best };
  }).filter(x => x.best >= 0.5).sort((a, b) => b.best - a.best);
  return scored.slice(0, limit).map(x => x.s);
}

/* ───────────────────────── icons ───────────────────────── */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-6"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M5 3h14"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  mol: '<path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
  dose: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ───────────────────────── native helpers ───────────────────────── */
function haptic() { try { PL.Haptics && PL.Haptics.impact({ style: 'LIGHT' }).catch(() => {}); } catch {} }
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function confetti() {
  const colors = ['#534AB7', '#5DCAA5', '#EF9F27', '#D85A30', '#EEEDFE'];
  for (let i = 0; i < 44; i++) {
    const d = document.createElement('div');
    d.className = 'confetti';
    d.style.left = Math.random() * 100 + 'vw';
    d.style.background = colors[i % colors.length];
    d.style.animationDelay = Math.random() * 0.4 + 's';
    d.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2400);
  }
}
async function shareFile(name, text, mime) {
  if (NATIVE && PL.Filesystem && PL.Share) {
    try {
      const r = await PL.Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
      await PL.Share.share({ title: name, files: [r.uri], dialogTitle: 'Save or send' });
      return;
    } catch (e) {
      if (String(e && e.message).toLowerCase().includes('cancel')) return;
      console.error(e);
    }
  }
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const LN = () => PL.LocalNotifications;
async function notifPermission(ask) {
  const ln = LN(); if (!ln) return false;
  try {
    let p = await ln.checkPermissions();
    if (p.display !== 'granted' && ask) p = await ln.requestPermissions();
    return p.display === 'granted';
  } catch { return false; }
}
async function scheduleCheckins(s, onlyAfterLast) {
  const ln = LN(); if (!ln || !settings.reminders) return false;
  if (!(await notifPermission(true))) return false;
  const m = METH[s.method];
  const last = onlyAfterLast && s.checkIns.length ? s.checkIns[s.checkIns.length - 1].minutesAfter + 10 : -1;
  const list = m.checks.map((min, i) => ({
    id: s.nBase + i,
    title: 'How are you feeling?',
    body: `It's been ${fmtMin(min)} since your ${s.name} ${m.short}. Tap to check in.`,
    schedule: { at: new Date(s.startedAt + min * 60000), allowWhileIdle: true },
    extra: { sessionId: s.id },
  })).filter((n, i) => n.schedule.at.getTime() > Date.now() + 5000 && m.checks[i] > last);
  try { if (list.length) await ln.schedule({ notifications: list }); return true; } catch (e) { console.error(e); return false; }
}
async function cancelCheckins(s, fromIndex = 0) {
  const ln = LN(); if (!ln || !s.nBase) return;
  const ids = []; for (let i = fromIndex; i < 4; i++) ids.push({ id: s.nBase + i });
  try { await ln.cancel({ notifications: ids }); } catch {}
}

/* ───────────────────────── domain logic ───────────────────────── */
function sessionRelief(s) { return s.checkIns && s.checkIns.length ? Math.max(...s.checkIns.map(c => c.relief)) : null; }
function sessionNegs(s) { return [...new Set((s.checkIns || []).flatMap(c => c.negatives || []))]; }
function sessionVibes(s) { return [...new Set((s.checkIns || []).flatMap(c => c.vibes || []))]; }
const rated = () => sessions.filter(s => sessionRelief(s) != null);

function computeOnboardingProfile(liked, disliked) {
  const sums = {};
  for (const [id, helped] of Object.entries(liked)) {
    const s = STRAIN[id]; if (!s) continue;
    const w = 1 + Math.min(helped.length, 3) * 0.15;
    const t = normalize(s.terpenes);
    for (const k in t) sums[k] = (sums[k] || 0) + t[k] * w;
  }
  const terpeneProfile = normalize(sums);
  const bad = {};
  for (const id of Object.keys(disliked)) {
    const t = normalize((STRAIN[id] || {}).terpenes || {});
    for (const k in t) bad[k] = (bad[k] || 0) + t[k];
  }
  const nBad = Object.keys(disliked).length || 1;
  const avoidanceTerpenes = Object.entries(bad)
    .filter(([k, v]) => v / nBad >= 0.22 && (terpeneProfile[k] || 0) < 0.15)
    .sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 2);
  return { terpeneProfile, avoidanceTerpenes };
}

function avoidTerps() {
  const set = new Set((profile && profile.avoidanceTerpenes) || []);
  const counts = {};
  for (const s of sessions) {
    if (!s.terps) continue;
    if (sessionNegs(s).some(n => SERIOUS_NEG.includes(n))) {
      const t = topTerps(s.terps, 1)[0];
      if (t) counts[t] = (counts[t] || 0) + 1;
    }
  }
  const liked = blendedProfile(null, true);
  for (const [t, c] of Object.entries(counts)) if (c >= 2 && (liked[t] || 0) < 0.2) set.add(t);
  return [...set];
}

// Onboarding profile blended with what logged sessions actually show.
function blendedProfile(goal, baseOnly) {
  const base = (profile && profile.terpeneProfile) || {};
  if (baseOnly) return base;
  const r = rated().filter(s => s.terps && (!goal || s.symptom === goal));
  if (r.length < 3) return base;
  const pers = {};
  for (const s of r) {
    const w = (sessionRelief(s) - 5.5) / 4.5;
    for (const k in s.terps) pers[k] = (pers[k] || 0) + w * s.terps[k];
  }
  const maxAbs = Math.max(...Object.values(pers).map(Math.abs), 0.0001);
  const alpha = r.length < 6 ? 0.3 : r.length < 21 ? 0.5 : 0.75;
  const out = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(pers)])) {
    out[k] = Math.max(0, (1 - alpha) * (base[k] || 0) + alpha * ((pers[k] || 0) / maxAbs) * 0.5);
  }
  return normalize(out);
}

function strainOutcomes(strainId) {
  const list = rated().filter(s => s.strainId === strainId);
  return { n: list.length, avg: avg(list.map(sessionRelief)), bad: list.filter(s => sessionNegs(s).some(n => SERIOUS_NEG.includes(n))).length };
}

function recommend(goal, n = 3, excludeTried = true) {
  const target = blendedProfile(goal);
  if (!Object.keys(target).length) return [];
  const avoid = avoidTerps();
  const tried = new Set([
    ...Object.keys((profile && profile.liked) || {}),
    ...sessions.map(s => s.strainId).filter(Boolean),
  ]);
  const disliked = new Set(Object.keys((profile && profile.disliked) || {}));
  return STRAINS.filter(s => !disliked.has(s.id) && (!excludeTried || !tried.has(s.id))).map(s => {
    const st = normalize(s.terpenes);
    let score = 0.6 * overlap(target, st) + 0.4 * cosine(target, st);
    let hits = 0;
    for (const a of avoid) if ((st[a] || 0) > 0.2) { score -= 0.25; hits++; }
    if (goal && s.uses.includes(goal)) score += 0.04;
    const o = strainOutcomes(s.id);
    if (o.n >= 2 && o.avg >= 7) score += 0.1;
    if (o.n >= 1 && (o.avg <= 4 || o.bad)) score -= 0.35;
    score = clamp(score, 0, 0.99);
    const shared = Object.keys(st).map(k => [k, Math.min(st[k], target[k] || 0)]).sort((a, b) => b[1] - a[1]).filter(e => e[1] > 0.05).slice(0, 2).map(e => terpLabel(e[0]).toLowerCase());
    const reason = shared.length ? `Shares your ${shared.join(' + ')} preference` : 'Closest overall terpene match';
    return { strain: s, score, pct: Math.round(score * 100), reason, avoidHits: hits };
  }).sort((a, b) => b.score - a.score).slice(0, n);
}

function confidenceLabel(goal) {
  const r = rated().filter(s => !goal || s.symptom === goal).length;
  if (r < 3) return { text: 'Starter profile — from the strains you told us about', cls: 'gray' };
  if (r < 6) return { text: `Learning — based on ${plural(r, 'rated session')}`, cls: 'amber' };
  return { text: `Tuned to you — ${plural(r, 'rated session')}`, cls: 'teal' };
}

function activeSession() {
  const now = Date.now();
  return sessions.slice().sort((a, b) => b.startedAt - a.startedAt).find(s => {
    const m = METH[s.method] || METHODS[0];
    return now - s.startedAt < m.dur * 60000 && nextCheckDue(s) != null;
  }) || null;
}
function phase(s) {
  const m = METH[s.method] || METHODS[0], el = minsSince(s.startedAt);
  if (el < m.onset) return { label: 'Kicking in', cls: 'purple' };
  if (el < m.peak * 1.6) return { label: 'Peak', cls: 'teal' };
  return { label: 'Coming down', cls: 'amber' };
}
function nextCheckDue(s) {
  const m = METH[s.method] || METHODS[0];
  const c = s.checkIns || [];
  const last = c.length ? c[c.length - 1].minutesAfter : -1;
  const i = m.checks.findIndex(min => min > last + 10);
  if (i < 0) return null;
  return { index: i, at: s.startedAt + m.checks[i] * 60000, min: m.checks[i] };
}
function usualDose(method, unit) {
  const list = sessions.filter(s => s.method === method && s.unit === unit).slice(-10).map(s => s.dose).sort((a, b) => a - b);
  if (list.length < 2) return null;
  return list[Math.floor(list.length / 2)];
}
function dominantUnit() {
  const mg = sessions.filter(s => s.unit !== 'puffs').length;
  return mg >= sessions.length - mg ? 'mg' : 'puffs';
}
const unitLabel = u => u === 'puffs' ? 'puffs' : 'mg';
const doseText = s => s.unit === 'puffs' ? plural(s.dose, 'puff') : `${fmtNum(s.dose)} mg`;

/* ───────────────────────── OCR / label parsing ───────────────────────── */
let ocrWorker = null, ocrProgressCb = null;
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
async function getOcr() {
  if (!window.Tesseract) await loadScript('ocr/tesseract.min.js');
  if (ocrWorker) return ocrWorker;
  const logger = m => ocrProgressCb && ocrProgressCb(m);
  const base = new URL('ocr/', location.href).href;
  try { // fully offline: engine + language data bundled in the app
    ocrWorker = await withTimeout(window.Tesseract.createWorker('eng', 1, {
      workerPath: base + 'worker.min.js', corePath: base, langPath: base + 'lang', gzip: true, cacheMethod: 'none', logger,
    }), 45000);
  } catch (e) { // fallback: fetch the same engine from the CDN (needs internet once, then cached)
    console.warn('local OCR failed, using CDN', e);
    ocrWorker = await withTimeout(window.Tesseract.createWorker('eng', 1, { logger }), 60000);
  }
  return ocrWorker;
}
function prepImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 2000, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
      for (let i = 0; i < p.length; i += 4) { // grayscale + contrast
        let y = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
        y = clamp((y - 128) * 1.45 + 128, 0, 255);
        p[i] = p[i + 1] = p[i + 2] = y;
      }
      g.putImageData(d, 0, 0);
      res({ canvas: c, preview: url });
    };
    img.onerror = () => rej(new Error('Could not read that image'));
    img.src = url;
  });
}
const TERP_RX = {
  myrcene: /(?:β|beta|b)?[\s-]*myrcene/i,
  limonene: /(?:d|r)?[\s-]*limonene/i,
  caryophyllene: /(?:β|beta|b)?[\s-]*caryoph?[yi]l+ene(?!\s*oxide)/i,
  pinene: /(?:α|β|alpha|beta|a|b)?[\s-]*pinene/i,
  linalool: /linal+o+l/i,
  humulene: /(?:α|alpha|a)?[\s-]*humulene/i,
  terpinolene: /terpinolene/i,
  ocimene: /ocimene/i,
  bisabolol: /bisabolol/i,
  nerolidol: /nerolidol/i,
};
const NUM = '(\\d{1,3}(?:[.,]\\d{1,4})?)';
function pctFrom(valStr, unitStr) {
  let v = parseFloat(String(valStr).replace(',', '.'));
  if (isNaN(v)) return null;
  const u = (unitStr || '').toLowerCase();
  if (u.includes('mg/g')) v = v / 10;
  return v;
}
function parseLabel(text) {
  const clean = text.replace(/[|]/g, 'l').replace(/[“”]/g, '"');
  const lines = clean.split(/\n/).map(l => l.trim()).filter(Boolean);
  const out = { thc: null, cbd: null, terps: {}, strainId: null, name: '', nameScore: 0 };
  const grab = (rx, max) => {
    for (const l of lines) {
      const m = l.match(rx);
      if (m) { const v = pctFrom(m[1], m[2]); if (v != null && v <= max) return v; }
    }
    return null;
  };
  out.thc = grab(new RegExp('total\\s*(?:Δ|delta)?\\s*-?\\s*9?\\s*-?\\s*thc[^\\d]{0,24}' + NUM + '\\s*(%|mg\\s*/\\s*g)?', 'i'), 99)
    ?? grab(new RegExp('\\bthc\\s*a?\\b[^\\d]{0,24}' + NUM + '\\s*(%|mg\\s*/\\s*g)?', 'i'), 99);
  out.cbd = grab(new RegExp('total\\s*cbd[^\\d]{0,24}' + NUM + '\\s*(%|mg\\s*/\\s*g)?', 'i'), 99)
    ?? grab(new RegExp('\\bcbd\\s*a?\\b[^\\d]{0,24}' + NUM + '\\s*(%|mg\\s*/\\s*g)?', 'i'), 99);
  for (const l of lines) {
    for (const [t, rx] of Object.entries(TERP_RX)) {
      const m = l.match(rx); if (!m) continue;
      const rest = l.slice(m.index + m[0].length);
      const n = rest.match(new RegExp(NUM + '\\s*(%|mg\\s*/\\s*g)?'));
      if (!n) continue;
      const v = pctFrom(n[1], n[2]);
      if (v == null || v <= 0 || v > 6) continue;
      out.terps[t] = round1((out.terps[t] || 0) + v * 100) / 100;
    }
  }
  // strain name: best fuzzy match of any line against the strain list
  let best = { s: null, score: 0, line: '' };
  for (const l of lines.slice(0, 40)) {
    const nl = norm(l); if (nl.length < 3) continue;
    for (const s of STRAINS) {
      for (const n of [s.name, ...(s.aliases || [])].map(norm)) {
        if (n.length < 3) continue;
        let sc = 0;
        if (nl === n) sc = 1;
        else if ((' ' + nl + ' ').includes(' ' + n + ' ')) sc = 0.95;
        else {
          const words = nl.split(' '), k = n.split(' ').length;
          for (let i = 0; i + k <= words.length; i++) sc = Math.max(sc, sim(words.slice(i, i + k).join(' '), n));
        }
        if (n.length <= 3 && sc < 0.95) sc = 0;
        if (sc > best.score) best = { s, score: sc, line: l };
      }
    }
  }
  if (best.s && best.score >= 0.78) { out.strainId = best.s.id; out.name = best.s.name; out.nameScore = best.score; }
  return out;
}
function chemMatches(terps, n = 3) {
  const t = normalize(terps); if (!Object.keys(t).length) return [];
  return STRAINS.map(s => ({ s, score: overlap(t, s.terpenes) })).sort((a, b) => b.score - a.score).slice(0, n);
}

/* ───────────────────────── UI state ───────────────────────── */
let ob = null;           // onboarding draft
let logDraft = null;     // session being logged
let checkDraft = null;   // check-in being filled
let scan = { phase: 'idle' };
let ui = { expanded: null, insGoal: null, revealReady: false, gate: [false, false] };

function newOnboarding() {
  const p = profile || {};
  return {
    goals: (p.goals || []).slice(),
    liked: JSON.parse(JSON.stringify(p.liked || {})),
    disliked: JSON.parse(JSON.stringify(p.disliked || {})),
    methods: (p.methods || ['vape_cart', 'flower_vape']).slice(),
    dose: p.typicalDose == null ? 10 : p.typicalDose, doseKnown: p.typicalDose !== null || !p.createdAt,
    unit: p.unit || 'mg', freq: p.frequency || 'few_per_week', q: '', open: null,
  };
}

/* ───────────────────────── router ───────────────────────── */
function go(hash, replace) {
  if (replace) location.replace(hash); else location.hash = hash;
}
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(query || ''));
  return { parts, params, path: parts.join('/') };
}
const NAV_ROUTES = { home: 'home', history: 'history', scan: 'scan', insights: 'insights', settings: 'settings', products: 'scan', strain: 'insights', about: 'settings' };

let lastPath = null;
function render(keepScroll) {
  const r = parseRoute();
  // guards
  if (!settings.eligible) { if (r.path !== 'gate') return go('#/gate', true); }
  else if (!profile || !profile.onboarded) { if (r.parts[0] !== 'ob') return go('#/ob/welcome', true); }
  else if (!r.path || r.path === 'gate') return go('#/home', true);

  if (lastPath !== r.path) {
    if (r.parts[0] === 'log') logDraft = null;
    if (r.parts[0] === 'checkin') checkDraft = null;
  }
  const view = VIEWS[r.parts[0]] || VIEWS.home;
  const y = window.scrollY;
  const app = $('#app');
  app.innerHTML = view(r);
  const navKey = NAV_ROUTES[r.parts[0]];
  const showNav = !!navKey && r.parts[0] !== 'gate';
  app.classList.toggle('no-nav', !showNav);
  renderNav(showNav ? navKey : null);
  if (keepScroll && lastPath === r.path) window.scrollTo(0, y); else window.scrollTo(0, 0);
  lastPath = r.path;
  syncRanges();
  const after = AFTER[r.parts[0]]; if (after) after(r);
}
const rerender = () => render(true);
function renderNav(active) {
  const nav = $('#nav');
  if (!active) { nav.classList.add('hidden'); return; }
  nav.classList.remove('hidden');
  const item = (key, icon, label) => `<a href="#/${key}" class="${active === key ? 'on' : ''}">${ic(icon)}<span>${label}</span></a>`;
  nav.innerHTML = item('home', 'home', 'Home') + item('history', 'list', 'History') +
    `<a href="#/log" class="fab" aria-label="Log a dose"><span class="fab-c">${ic('plus')}</span></a>` +
    item('insights', 'chart', 'Insights') + item('settings', 'sliders', 'Settings');
}
function syncRanges() {
  document.querySelectorAll('input[type=range]').forEach(el => {
    const p = ((el.value - el.min) / (el.max - el.min)) * 100; el.style.setProperty('--p', p + '%');
  });
}

/* ───────────────────────── shared fragments ───────────────────────── */
const topbar = (title, back = true, right = '') =>
  `<div class="topbar">${back ? `<button class="icon-btn" data-a="back" aria-label="Back">${ic('back')}</button>` : ''}<div class="h2 grow">${esc(title)}</div>${right}</div>`;
const dots = (n, of = 6) => `<div class="dots">${Array.from({ length: of }, (_, i) => `<span class="${i < n ? 'done' : i === n ? 'cur' : ''}"></span>`).join('')}</div>`;
const chip = (label, on, a, v, variant = '') => `<button class="chip ${variant} ${on ? 'on' : ''}" data-a="${a}" data-v="${esc(v)}">${esc(label)}</button>`;
const scaleHtml = (value, a, kind) => `<div class="scale ${kind}">${Array.from({ length: 10 }, (_, i) => `<button data-a="${a}" data-v="${i + 1}" class="${value && i + 1 <= value ? 'f' : ''} ${value === i + 1 ? 'cur' : ''}">${i + 1}</button>`).join('')}</div>`;
const terpBar = (id, val, label, kind = '') => `<div class="terp-row"><div class="between mb4"><span class="strong">${esc(terpLabel(id))}</span><span class="hint">${esc(label)}</span></div><div class="bar ${kind}"><span style="width:${Math.round(clamp(val, 0.04, 1) * 100)}%"></span></div></div>`;
const terpTags = (terps, n = 3) => topTerps(terps, n).map((t, i) => `<span class="tag ${['', 'amber', 'teal'][i] || 'gray'}">${esc(terpLabel(t))}</span>`).join(' ');
const empty = (icon, title, sub, cta) => `<div class="empty"><div class="ic">${ic(icon)}</div><div class="h2">${esc(title)}</div><p class="sub mt4">${esc(sub)}</p>${cta || ''}</div>`;
function recCard(rec) {
  const s = rec.strain;
  return `<button class="card tap" style="display:block;width:100%;text-align:left" data-a="nav" data-v="#/strain/${s.id}">
    <div class="between"><div class="grow"><div class="strong">${esc(s.name)}</div>
    <div class="hint">${esc(topTerps(s.terpenes, 2).map(terpLabel).join(' + '))} · ${esc(s.type)}</div></div>
    <span class="tag">${rec.pct}% match</span></div>
    <div class="tiny mt4">${esc(rec.reason)}</div></button>`;
}

/* ───────────────────────── views ───────────────────────── */
const VIEWS = {};
const AFTER = {};

VIEWS.gate = () => {
  const [a, b] = ui.gate;
  const row = (i, on, text) => `<button class="list-row ${on ? 'sel' : ''}" data-a="gate" data-v="${i}"><span class="check">${on ? ic('check') : ''}</span><span class="grow">${text}</span></button>`;
  return `<div class="hero" style="text-align:left">
    <div class="logo-mark mb16">${ic('mol')}</div>
    <h1 class="title center">Welcome to Terpene</h1>
    <p class="sub center mt8 mb16">A private journal for your medical cannabis — learn what actually works for you.</p>
    ${row(0, a, 'I\'m a registered medical cannabis patient, or of legal age for cannabis where I live')}
    ${row(1, b, 'I understand Terpene is a personal journal, not medical advice')}
    <button class="btn btn-primary mt24" data-a="gate-ok" ${a && b ? '' : 'disabled'}>Continue</button>
    <p class="tiny center mt12">Everything you log stays on this phone.</p>
  </div>`;
};

VIEWS.ob = (r) => {
  if (!ob) ob = newOnboarding();
  const step = r.parts[1] || 'welcome';
  return (OB[step] || OB.welcome)();
};
const OB = {};
OB.welcome = () => `<div class="hero">
  <div class="logo-mark">${ic('mol')}</div>
  <h1 class="title mt24">${profile && profile.onboarded ? 'Update your profile' : 'Let\'s tune your medicine'}</h1>
  <p class="sub mt8" style="padding:0 12px">A few quick questions about strains you already know — we'll turn that into a terpene profile and suggestions that fit you.</p>
  <div class="mt16"><span class="pill" style="background:var(--teal-bg);color:var(--teal-text)">${ic('check')} All your data stays on your device</span></div>
  <p class="tiny mt24">Takes about 90 seconds</p>
  <button class="btn btn-primary mt12" data-a="nav" data-v="#/ob/goals">Get started</button>
  ${profile && profile.onboarded ? '<button class="btn btn-ghost mt8" data-a="ob-cancel" style="margin:8px auto 0">Cancel</button>' : ''}
</div>`;
OB.goals = () => `${dots(1)}<p class="eyebrow">Step 2 of 6</p>
  <h1 class="title mt4">What are you looking for relief from?</h1>
  <p class="sub mt4 mb16">Pick all that apply — everything gets tuned to these.</p>
  <div class="chips">${SYMPTOMS.map(s => chip(s.label, ob.goals.includes(s.id), 'ob-goal', s.id)).join('')}</div>
  <div class="sticky-cta"><div class="btn-row"><button class="btn btn-secondary" data-a="back">Back</button>
  <button class="btn btn-primary" data-a="nav" data-v="#/ob/liked" ${ob.goals.length ? '' : 'disabled'}>Continue</button></div></div>`;

function strainPickRows(ids, kind) {
  const map = kind === 'liked' ? ob.liked : ob.disliked;
  return ids.map(id => {
    const s = STRAIN[id]; if (!s) return '';
    const on = id in map;
    const sub = on && map[id].length
      ? (kind === 'liked' ? 'Helped: ' : 'Caused: ') + map[id].map(x => (kind === 'liked' ? SYM[x] : NEG[x]).label.toLowerCase()).join(', ')
      : `${cap1(s.type)} · ${topTerps(s.terpenes, 2).map(terpLabel).join(', ')}`;
    const row = `<button class="list-row ${on ? 'sel' : ''} ${kind === 'disliked' ? 'coral' : ''}" data-a="ob-pick" data-v="${kind}:${id}" ${on && ob.open === id ? 'style="border-radius:10px 10px 0 0;margin-bottom:0"' : ''}>
      <div class="grow"><div class="strong">${esc(s.name)}</div><div class="hint">${esc(sub)}</div></div>
      <span class="check">${on ? ic(kind === 'liked' ? 'check' : 'x') : ''}</span></button>`;
    let q = '';
    if (on && ob.open === id) {
      const opts = kind === 'liked' ? (ob.goals.length ? ob.goals : SYMPTOMS.map(x => x.id)).map(g => SYM[g]) : NEGATIVES;
      q = `<div class="inline-q"><p class="hint mb8">${kind === 'liked' ? 'What did it help with?' : 'What happened?'}</p>
        <div class="chips">${opts.map(o => chip(o.label, map[id].includes(o.id), 'ob-sub', `${kind}:${id}:${o.id}`, kind === 'liked' ? '' : 'coral')).join('')}</div>
        <button class="btn btn-ghost mt8" data-a="ob-close" style="padding:4px 0">Done</button></div>`;
    }
    return row + q;
  }).join('');
}
function obPickList(kind) {
  const map = kind === 'liked' ? ob.liked : ob.disliked;
  const popular = kind === 'liked' ? POPULAR_LIKED : POPULAR_DISLIKED;
  const chosen = Object.keys(map);
  if (ob.q) {
    const res = searchStrains(ob.q, 15).map(s => s.id);
    return res.length ? strainPickRows(res, kind) : `<p class="hint center mt16">No strain called “${esc(ob.q)}” in our library yet.</p>`;
  }
  const other = popular.filter(id => !chosen.includes(id));
  return (chosen.length ? `<p class="eyebrow section-label">Your picks</p>${strainPickRows(chosen, kind)}` : '') +
    `<p class="eyebrow section-label">${kind === 'liked' ? 'Popular picks' : 'Common culprits'}</p>${strainPickRows(other, kind)}`;
}
OB.liked = () => {
  const n = Object.keys(ob.liked).length;
  return `${dots(2)}<p class="eyebrow">Step 3 of 6</p>
  <h1 class="title mt4">Strains that worked for you</h1>
  <p class="sub mt4 mb12">Tap any you've liked, then tell us what each one helped with.</p>
  <div class="row" style="position:relative"><input id="ob-search" type="search" placeholder="Search ${STRAINS.length} strains…" value="${esc(ob.q)}" autocomplete="off"></div>
  <div id="ob-list">${obPickList('liked')}</div>
  <div class="sticky-cta"><div class="btn-row"><button class="btn btn-secondary" data-a="back">Back</button>
  <button class="btn btn-primary" data-a="ob-next" data-v="#/ob/disliked" ${n ? '' : 'disabled'}>${n ? `${n} selected · continue` : 'Pick at least one'}</button></div>
  <button class="btn btn-ghost" style="margin:6px auto 0;display:block" data-a="ob-next" data-v="#/ob/disliked">I'm new — skip this</button></div>`;
};
OB.disliked = () => `${dots(3)}<p class="eyebrow">Step 4 of 6</p>
  <h1 class="title mt4">Anything that didn't sit right?</h1>
  <p class="sub mt4 mb12">Optional — but bad reactions teach us the most about what to steer you away from.</p>
  <input id="ob-search" type="search" placeholder="Search strains…" value="${esc(ob.q)}" autocomplete="off">
  <div id="ob-list">${obPickList('disliked')}</div>
  <div class="sticky-cta"><div class="btn-row"><button class="btn btn-secondary" data-a="back">Back</button>
  <button class="btn btn-primary" data-a="ob-next" data-v="#/ob/method">${Object.keys(ob.disliked).length ? 'Continue' : 'Skip'}</button></div></div>`;
OB.method = () => {
  const max = ob.unit === 'mg' ? 100 : 20;
  return `${dots(4)}<p class="eyebrow">Step 5 of 6</p>
  <h1 class="title mt4">How you medicate</h1>
  <p class="eyebrow section-label">Methods you use</p>
  <div class="chips">${METHODS.map(m => chip(m.label, ob.methods.includes(m.id), 'ob-method', m.id, 'teal')).join('')}</div>
  <p class="eyebrow section-label">Typical dose</p>
  <div class="seg mb8"><button class="${ob.unit === 'mg' ? 'on' : ''}" data-a="ob-unit" data-v="mg">mg THC</button><button class="${ob.unit === 'puffs' ? 'on' : ''}" data-a="ob-unit" data-v="puffs">Puffs / hits</button></div>
  ${ob.doseKnown ? `<div class="row"><input type="range" id="ob-dose" min="1" max="${max}" step="1" value="${clamp(ob.dose, 1, max)}" class="grow"><span class="dose-readout" id="ob-dose-out">${clamp(ob.dose, 1, max)} ${unitLabel(ob.unit)}</span></div>
  <button class="chip mt8" data-a="ob-dose-unknown">I don't know</button>` : `<div class="callout purple">No problem — we'll learn your usual dose as you log. <button class="btn-ghost" data-a="ob-dose-known" style="font-weight:500;color:var(--purple)">Set one anyway</button></div>`}
  <p class="eyebrow section-label">How often</p>
  <div class="chips">${FREQS.map(([id, l]) => chip(l, ob.freq === id, 'ob-freq', id)).join('')}</div>
  <div class="sticky-cta"><div class="btn-row"><button class="btn btn-secondary" data-a="back">Back</button>
  <button class="btn btn-primary" data-a="ob-finish" ${ob.methods.length ? '' : 'disabled'}>See my profile</button></div></div>`;
};
OB.reveal = () => {
  if (!profile) { setTimeout(() => go('#/ob/goals', true)); return ''; }
  if (!ui.revealReady) {
    setTimeout(() => { ui.revealReady = true; rerender(); }, 1100);
    return `<div class="hero"><div class="spinner"></div><p class="sub mt16 pulse">Building your terpene signature…</p></div>`;
  }
  const tp = profile.terpeneProfile || {};
  const top = topTerps(tp, 4);
  const maxV = Math.max(...top.map(t => tp[t]), 0.01);
  const avoid = profile.avoidanceTerpenes || [];
  const recs = recommend(null, 3);
  const firstBad = Object.entries(profile.disliked || {})[0];
  let callout = '';
  if (avoid.length && firstBad) {
    const s = STRAIN[firstBad[0]];
    const negs = firstBad[1].map(n => NEG[n].label.toLowerCase());
    callout = `<div class="callout coral mt12"><span class="strong">Heads up.</span> ${esc(s.name)} leans ${esc(terpLabel(avoid[0]).toLowerCase())}-heavy${negs.length ? ` — that may be behind the ${esc(negs.join(' and '))}` : ''}. We'll flag strains like it.</div>`;
  }
  const hasProfile = top.length > 0;
  return `<span class="pill" style="background:var(--teal-bg);color:var(--teal-text)">${ic('check')} Profile ready</span>
  <h1 class="title mt12">${hasProfile ? 'Here\'s what we learned' : 'You\'re all set'}</h1>
  ${hasProfile ? `<p class="sub mt4">From the strains you picked, you seem to respond well to:</p>
  <div class="card muted mt16"><p class="eyebrow mb12">Your terpene signature</p>
    ${top.map((t, i) => terpBar(t, tp[t] / maxV, i < 2 ? 'Strong fit' : 'Good fit')).join('')}
    ${avoid.slice(0, 1).map(t => terpBar(t, 0.22, 'Watch out', 'coral')).join('')}
    <p class="tiny mt12">${esc(terpLabel(top[0]))}: ${esc(TERPS[top[0]].aroma.toLowerCase())}, ${esc(TERPS[top[0]].note)}.</p>
  </div>${callout}
  <p class="eyebrow section-label">Try these next</p>${recs.map(recCard).join('')}`
    : `<p class="sub mt4">Since you're starting fresh, log a few sessions and Terpene will build your profile from what actually works.</p>`}
  <p class="tiny mt12">Starter profile — it sharpens every time you log a session.</p>
  <div class="sticky-cta"><button class="btn btn-primary" data-a="ob-enter">Enter the app</button></div>`;
};
AFTER.ob = () => {
  const s = $('#ob-search');
  if (s) s.addEventListener('input', e => {
    ob.q = e.target.value;
    const kind = parseRoute().parts[1] === 'disliked' ? 'disliked' : 'liked';
    $('#ob-list').innerHTML = obPickList(kind);
  });
  const d = $('#ob-dose');
  if (d) d.addEventListener('input', e => { ob.dose = +e.target.value; $('#ob-dose-out').textContent = `${ob.dose} ${unitLabel(ob.unit)}`; syncRanges(); });
};

/* home */
VIEWS.home = () => {
  const h = new Date().getHours();
  const greet = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const today = sessions.filter(s => s.startedAt >= startOfDay(Date.now()));
  const mgToday = today.filter(s => s.unit !== 'puffs').reduce((a, s) => a + s.dose, 0);
  const puffsToday = today.filter(s => s.unit === 'puffs').reduce((a, s) => a + s.dose, 0);
  const act = activeSession();
  const overdue = sessions.filter(s => s !== act && Date.now() - s.startedAt < 12 * 3600000 && !(s.checkIns || []).length);
  let actHtml = '';
  if (act) {
    const ph = phase(act), due = nextCheckDue(act);
    const dueNow = due && due.at <= Date.now();
    actHtml = `<div class="card mt12"><div class="between mb8"><span class="eyebrow">Active session</span>
      <span class="tag ${ph.cls === 'purple' ? '' : ph.cls}">${ph.label}</span></div>
      <div class="h2" style="font-size:16px">${esc(act.name)} · ${esc(METH[act.method].short)}</div>
      <p class="hint mb12">${doseText(act)} · ${fmtMin(minsSince(act.startedAt))} ago${due && !dueNow ? ` · next check-in in ${fmtMin(Math.max(1, Math.round((due.at - Date.now()) / 60000)))}` : ''}</p>
      <button class="btn btn-primary" data-a="nav" data-v="#/checkin/${act.id}">${dueNow ? 'Check-in due — how are you feeling?' : 'How are you feeling?'}</button></div>`;
  }
  const recs = profile.terpeneProfile && Object.keys(profile.terpeneProfile).length ? recommend(null, 1) : [];
  return `<p class="eyebrow">${greet}</p><h1 class="title">Your regimen</h1>
  <div class="card muted mt16"><p class="eyebrow mb4">Today so far</p>
    <div class="row" style="align-items:baseline;gap:6px">${mgToday || !puffsToday ? `<span class="stat">${fmtNum(mgToday)}</span><span class="sub">mg THC</span>` : ''}${puffsToday ? `<span class="stat" style="margin-left:${mgToday ? 8 : 0}px">${puffsToday}</span><span class="sub">puffs</span>` : ''}<span class="sub">· ${plural(today.length, 'session')}</span></div>
    <div class="row mt8" style="gap:4px">${[0, 1, 2, 3].map(i => `<span style="flex:1;height:4px;border-radius:2px;background:${i < today.length ? 'var(--purple)' : 'var(--border)'}"></span>`).join('')}</div>
  </div>
  ${actHtml}
  ${overdue.length ? `<button class="callout amber mt12" style="display:block;width:100%;text-align:left" data-a="nav" data-v="#/checkin/${overdue[0].id}"><span class="strong">Quick rating?</span> Your ${esc(overdue[0].name)} session from ${fmtTime(overdue[0].startedAt)} has no check-in yet — rating it is how Terpene learns.</button>` : ''}
  <p class="eyebrow section-label">Quick actions</p>
  <div class="grid2">
    <button class="card tap" style="text-align:left" data-a="nav" data-v="#/scan">${ic('camera')}<div class="strong mt8">Scan label</div><div class="tiny">Add a product</div></button>
    <button class="card tap" style="text-align:left;margin:0" data-a="nav" data-v="#/log">${ic('dose')}<div class="strong mt8">Log a dose</div><div class="tiny">Start a session</div></button>
  </div>
  ${recs.length ? `<p class="eyebrow section-label">Worth trying next</p>${recCard(recs[0])}` : ''}
  <p class="eyebrow section-label">Insight</p>${insightOfDay()}`;
};
function insightOfDay() {
  const r = rated();
  const tips = [];
  if (r.length >= 3) {
    const by = {};
    for (const s of r) { if (!s.terps) continue; const t = topTerps(s.terps, 1)[0]; if (!t) continue; (by[t] = by[t] || []).push(sessionRelief(s)); }
    const best = Object.entries(by).filter(e => e[1].length >= 2).sort((a, b) => avg(b[1]) - avg(a[1]))[0];
    if (best) tips.push(`<span class="strong">${esc(terpLabel(best[0]))}-led products</span> have averaged ${fmtNum(avg(best[1]))}/10 relief across ${plural(best[1].length, 'session')}.`);
    const byM = {};
    for (const s of r) (byM[s.method] = byM[s.method] || []).push(sessionRelief(s));
    const bm = Object.entries(byM).filter(e => e[1].length >= 2).sort((a, b) => avg(b[1]) - avg(a[1]))[0];
    if (bm && Object.keys(byM).length > 1) tips.push(`Your best results so far come from <span class="strong">${esc(METH[bm[0]].label.toLowerCase())}</span> — ${fmtNum(avg(bm[1]))}/10 average.`);
  }
  if (!tips.length) {
    const left = Math.max(0, 3 - r.length);
    return `<div class="callout teal">${left ? `Rate ${plural(left, 'more session')} to unlock personal insights. Check-ins after each dose are what make the suggestions get smarter.` : 'Keep logging — patterns show up after a few more sessions.'}</div>`;
  }
  return `<div class="callout teal">${tips[new Date().getDate() % tips.length]}</div>`;
}

/* scan */
VIEWS.scan = () => {
  if (scan.phase === 'review') return scanReview();
  const reading = scan.phase === 'reading';
  return `${topbar('Scan a product', false, `<button class="btn btn-ghost" data-a="nav" data-v="#/products">My products${products.length ? ` (${products.length})` : ''}</button>`)}
  <p class="sub mb12">Photograph the label or certificate of analysis. Terpene reads THC, CBD and terpene numbers right on your phone — nothing is uploaded.</p>
  <div class="viewfinder">${scan.preview ? `<img src="${scan.preview}" alt="">` : ''}
    <span class="corner c1"></span><span class="corner c2"></span><span class="corner c3"></span><span class="corner c4"></span>
    ${reading ? '<span class="scanline"></span>' : ''}
    <div class="vf-msg">${reading ? `<div class="strong" style="color:#fff">${esc(scan.status || 'Reading label…')}</div><div class="progress"><span style="width:${Math.round((scan.progress || 0) * 100)}%"></span></div>`
      : scan.error ? `<span style="color:#fff">${esc(scan.error)}</span>` : 'Fill the frame with the label. Flat, well lit, no glare works best.'}</div>
  </div>
  <div class="mt16">
    <label class="btn btn-primary ${reading ? 'disabled' : ''}" style="${reading ? 'opacity:.4;pointer-events:none' : ''}">${ic('camera')} Take photo of label<input type="file" accept="image/*" capture="environment" data-file="scan" hidden></label>
    <div class="btn-row mt8">
      <label class="btn btn-secondary grow" style="width:100%;${reading ? 'opacity:.4;pointer-events:none' : ''}">${ic('image')} From gallery<input type="file" accept="image/*" data-file="scan" hidden></label>
      <button class="btn btn-secondary grow" style="width:100%" data-a="scan-manual" ${reading ? 'disabled' : ''}>${ic('edit')} Enter manually</button>
    </div>
  </div>
  <p class="tiny center mt12">First scan takes a few extra seconds while the reader warms up.</p>`;
};
function scanReview() {
  const d = scan.draft;
  const strain = STRAIN[d.strainId];
  const chem = chemMatches(Object.fromEntries(d.terps.filter(t => t.id && t.val > 0).map(t => [t.id, t.val])));
  const nameMatches = d.name && !strain ? searchStrains(d.name, 3) : [];
  return `${topbar(scan.source === 'manual' ? 'Add a product' : 'Check what we read')}
  ${scan.source === 'ocr' ? `<div class="callout ${scan.found ? 'teal' : 'amber'} mb12">${scan.found ? `Found ${scan.found} value${scan.found === 1 ? '' : 's'} on the label. Fix anything that looks off.` : 'Couldn\'t pick out numbers clearly — fill in what you can, or retake the photo closer and flatter.'}</div>` : ''}
  <p class="eyebrow mb4">Product or strain name</p>
  <input id="sc-name" value="${esc(d.name)}" placeholder="e.g. Wedding Cake" autocomplete="off">
  <div id="sc-namehint" class="mt8">${scanNameHint(strain, nameMatches)}</div>
  <div class="grid2 mt12"><div><p class="eyebrow mb4">THC %</p><input id="sc-thc" inputmode="decimal" value="${d.thc ?? ''}" placeholder="—"></div>
  <div><p class="eyebrow mb4">CBD %</p><input id="sc-cbd" inputmode="decimal" value="${d.cbd ?? ''}" placeholder="—"></div></div>
  <p class="eyebrow section-label">Terpenes (% from label)</p>
  ${d.terps.map((t, i) => `<div class="row mb8"><select data-terp-id="${i}" class="grow"><option value="">Choose…</option>${TERP_IDS.map(id => `<option value="${id}" ${t.id === id ? 'selected' : ''}>${TERPS[id].label}</option>`).join('')}</select>
    <input data-terp-val="${i}" inputmode="decimal" style="width:84px" value="${t.val || ''}" placeholder="%"><button class="icon-btn" data-a="scan-terp-del" data-v="${i}" aria-label="Remove">${ic('x')}</button></div>`).join('')}
  ${d.terps.length < 6 ? `<button class="chip" data-a="scan-terp-add">+ Add terpene</button>` : ''}
  ${!d.terps.some(t => t.val > 0) && strain ? `<p class="tiny mt8">No terpene numbers? We'll use ${esc(strain.name)}'s typical profile.</p>` : ''}
  ${chem.length && chem[0].score > 0.7 ? `<div class="callout purple mt12">Chemically closest: <span class="strong">${esc(chem[0].s.name)}</span> (${Math.round(chem[0].score * 100)}% similar)${chem[1] ? `, then ${esc(chem[1].s.name)}` : ''}.</div>` : ''}
  <p class="eyebrow section-label">Form</p>
  <div class="chips">${METHODS.map(m => chip(m.label, d.method === m.id, 'scan-method', m.id, 'teal')).join('')}</div>
  <div class="grid2 mt12"><div><p class="eyebrow mb4">Price paid ($)</p><input id="sc-price" inputmode="decimal" value="${d.price ?? ''}" placeholder="optional"></div>
  <div><p class="eyebrow mb4">Doses in package</p><input id="sc-units" inputmode="numeric" value="${d.units ?? ''}" placeholder="optional"></div></div>
  <p class="tiny mt4">Price ÷ doses gives your cost per session.</p>
  ${scan.text ? `<details class="mt16"><summary class="hint">What the scanner read</summary><pre style="white-space:pre-wrap;font-size:11px;color:var(--text-2);background:var(--bg-subtle);padding:10px;border-radius:8px;max-height:220px;overflow:auto">${esc(scan.text)}</pre></details>` : ''}
  <div class="mt24"><button class="btn btn-primary" data-a="scan-save" data-v="log">Save & log a dose</button>
  <div class="btn-row mt8"><button class="btn btn-secondary grow" style="width:100%" data-a="scan-save" data-v="list">Just save</button><button class="btn btn-secondary grow" style="width:100%" data-a="scan-reset">Start over</button></div></div>`;
}
function scanNameHint(strain, matches) {
  if (strain) return `<span class="tag teal">${ic('check', '')} Matched ${esc(strain.name)}</span> <span class="tiny">${esc(cap1(strain.type))} · typical ${strain.thcRange[0]}–${strain.thcRange[1]}% THC</span> <button class="btn-ghost tiny" data-a="scan-unlink">not this?</button>`;
  if (matches.length) return `<span class="tiny">Did you mean </span>${matches.map(s => chip(s.name, false, 'scan-link', s.id)).join(' ')}`;
  return '<span class="tiny">Not in the strain library? That\'s fine — the label numbers are what matter.</span>';
}
function readScanInputs() {
  const d = scan.draft; if (!d) return;
  const num = sel => { const el = $(sel); if (!el) return undefined; const v = parseFloat(el.value.replace(',', '.')); return isNaN(v) ? null : v; };
  const n = $('#sc-name'); if (n) d.name = n.value.trim();
  const thc = num('#sc-thc'), cbd = num('#sc-cbd'), price = num('#sc-price'), units = num('#sc-units');
  if (thc !== undefined) d.thc = thc; if (cbd !== undefined) d.cbd = cbd;
  if (price !== undefined) d.price = price; if (units !== undefined) d.units = units;
  document.querySelectorAll('[data-terp-id]').forEach(el => { d.terps[+el.dataset.terpId].id = el.value; });
  document.querySelectorAll('[data-terp-val]').forEach(el => { const v = parseFloat(el.value.replace(',', '.')); d.terps[+el.dataset.terpVal].val = isNaN(v) ? 0 : v; });
}
AFTER.scan = () => {
  const n = $('#sc-name');
  if (n) n.addEventListener('input', e => {
    scan.draft.name = e.target.value; scan.draft.strainId = null;
    const ex = STRAINS.find(s => [s.name, ...s.aliases].some(a => norm(a) === norm(e.target.value)));
    if (ex) scan.draft.strainId = ex.id;
    $('#sc-namehint').innerHTML = scanNameHint(STRAIN[scan.draft.strainId], scan.draft.strainId ? [] : searchStrains(e.target.value, 3));
  });
};
async function runScan(file) {
  scan = { phase: 'reading', progress: 0, status: 'Preparing photo…' };
  rerender();
  try {
    const { canvas, preview } = await prepImage(file);
    scan.preview = preview; scan.status = 'Warming up the reader…'; rerender();
    ocrProgressCb = m => {
      if (m.status === 'recognizing text') { scan.status = 'Reading label…'; scan.progress = m.progress; }
      else { scan.status = 'Warming up the reader…'; scan.progress = (m.progress || 0) * 0.3; }
      const bar = document.querySelector('.progress > span'); if (bar) bar.style.width = Math.round(scan.progress * 100) + '%';
      const st = document.querySelector('.vf-msg .strong'); if (st) st.textContent = scan.status;
    };
    const w = await getOcr();
    const { data } = await w.recognize(canvas);
    const parsed = parseLabel(data.text || '');
    const terps = Object.entries(parsed.terps).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, val]) => ({ id, val }));
    const found = (parsed.thc != null) + (parsed.cbd != null) + terps.length + (parsed.strainId ? 1 : 0);
    scan = {
      phase: 'review', source: 'ocr', text: data.text, preview, found,
      draft: { name: parsed.name, strainId: parsed.strainId, thc: parsed.thc, cbd: parsed.cbd, terps: terps.length ? terps : [{ id: '', val: 0 }], method: (profile.methods || [])[0] || 'vape_cart', price: null, units: null },
    };
  } catch (e) {
    console.error(e);
    scan = { phase: 'idle', error: 'Couldn\'t read that photo. Try again, or enter it manually.' };
  }
  rerender();
}

/* products */
VIEWS.products = () => {
  const list = products.slice().sort((a, b) => b.addedAt - a.addedAt);
  return `${topbar('My products')}
  ${list.length ? list.map(p => {
    const o = sessions.filter(s => s.productId === p.id);
    const r = o.map(sessionRelief).filter(x => x != null);
    return `<button class="card tap" style="display:block;width:100%;text-align:left" data-a="product" data-v="${p.id}">
      <div class="between"><div class="grow"><div class="strong">${esc(p.name)}</div>
      <div class="hint">${METH[p.method] ? esc(METH[p.method].label) : ''}${p.thc != null ? ` · ${fmtNum(p.thc)}% THC` : ''}${p.cbd ? ` · ${fmtNum(p.cbd)}% CBD` : ''}</div></div>
      ${r.length ? `<span class="tag teal">${fmtNum(avg(r))}/10</span>` : '<span class="tag gray">untried</span>'}</div>
      <div class="mt8">${terpTags(p.terps)}</div></button>`;
  }).join('') : empty('box', 'No products yet', 'Scan a label or add one manually to track it.', '<button class="btn btn-primary mt16" data-a="nav" data-v="#/scan">Scan a label</button>')}`;
};
function productSheet(p) {
  const o = sessions.filter(s => s.productId === p.id);
  const r = o.map(sessionRelief).filter(x => x != null);
  const tt = topTerps(p.terps, 6);
  const maxV = Math.max(...tt.map(t => p.terps[t]), 0.0001);
  const perDose = p.price && p.units ? p.price / p.units : null;
  openSheet(`<div class="h2">${esc(p.name)}</div>
    <p class="hint">${METH[p.method] ? esc(METH[p.method].label) : ''}${p.strainId && STRAIN[p.strainId] && STRAIN[p.strainId].name !== p.name ? ` · ${esc(STRAIN[p.strainId].name)}` : ''} · added ${esc(fmtDay(p.addedAt).toLowerCase())}</p>
    <div class="grid2 mt12"><div class="card muted"><p class="eyebrow">THC / CBD</p><div class="strong">${p.thc != null ? fmtNum(p.thc) + '%' : '—'} / ${p.cbd != null ? fmtNum(p.cbd) + '%' : '—'}</div></div>
    <div class="card muted" style="margin:0"><p class="eyebrow">Your results</p><div class="strong">${r.length ? `${fmtNum(avg(r))}/10 · ${plural(r.length, 'session')}` : 'Not rated yet'}</div></div></div>
    ${tt.length ? `<p class="eyebrow section-label">Terpenes${p.terpsFrom === 'strain' ? ' (typical for strain)' : ''}</p>${tt.map(t => terpBar(t, p.terps[t] / maxV, p.terpsFrom === 'strain' ? '' : fmtNum(p.terps[t]) + '%')).join('')}` : ''}
    ${p.price ? `<p class="hint mt12">Paid ${money(p.price)}${perDose ? ` · about ${money(perDose)} per dose` : ''}</p>` : ''}
    <button class="btn btn-primary mt16" data-a="nav-close" data-v="#/log?product=${p.id}">Log a dose with this</button>
    <button class="btn btn-danger mt8" data-a="product-del" data-v="${p.id}">${ic('trash')} Remove product</button>`);
}

/* log */
function newLogDraft(params) {
  const p = params.product && products.find(x => x.id === params.product);
  const st = params.strain && STRAIN[params.strain];
  const last = sessions[sessions.length - 1];
  const method = p ? p.method : (last ? last.method : (profile.methods || [])[0]) || 'vape_cart';
  const unit = last ? last.unit : (profile.unit || 'mg');
  const d = {
    productId: p ? p.id : null, strainId: p ? p.strainId : st ? st.id : null,
    name: p ? p.name : st ? st.name : '', method, unit, dose: null,
    symptom: (last && profile.goals.includes(last.symptom) ? last.symptom : profile.goals[0]) || 'recreational',
    severity: null, cost: null, picking: !p && !st, q: '',
  };
  d.dose = usualDose(method, unit) || (unit === 'mg' ? profile.typicalDose || 5 : 3);
  if (p && p.price && p.units) d.cost = round1(p.price / p.units * 100) / 100;
  return d;
}
VIEWS.log = (r) => {
  if (!logDraft) logDraft = newLogDraft(r.params);
  const d = logDraft;
  const max = d.unit === 'mg' ? 100 : 20;
  const usual = usualDose(d.method, d.unit);
  const goals = profile.goals && profile.goals.length ? profile.goals : SYMPTOMS.map(s => s.id);
  let pick = '';
  if (d.picking || !d.name) {
    const prods = products.slice().sort((a, b) => b.addedAt - a.addedAt).slice(0, 6);
    const res = d.q ? searchStrains(d.q, 8) : [];
    pick = `<p class="eyebrow mb8">What are you using?</p>
      ${prods.length ? `<div class="chips mb12">${prods.map(p => chip(p.name, d.productId === p.id, 'log-product', p.id)).join('')}</div>` : ''}
      <input id="log-search" type="search" placeholder="${prods.length ? 'Or search a strain…' : 'Search a strain…'}" value="${esc(d.q)}" autocomplete="off">
      <div id="log-results" class="mt8">${logResults(res)}</div>
      ${products.length ? '' : `<button class="btn btn-ghost mt4" data-a="nav" data-v="#/scan">${ic('camera')} Or scan the label</button>`}`;
  } else {
    pick = `<div class="card muted between"><div class="grow"><p class="eyebrow">Using</p><div class="strong">${esc(d.name)}</div></div><button class="btn btn-ghost" data-a="log-change">Change</button></div>`;
  }
  return `${topbar('Log a dose', true)}
  ${pick}
  <p class="eyebrow section-label">Method</p>
  <div class="chips">${METHODS.map(m => chip(m.label, d.method === m.id, 'log-method', m.id, 'teal')).join('')}</div>
  <p class="eyebrow section-label">Dose</p>
  <div class="seg mb8"><button class="${d.unit === 'mg' ? 'on' : ''}" data-a="log-unit" data-v="mg">mg THC</button><button class="${d.unit === 'puffs' ? 'on' : ''}" data-a="log-unit" data-v="puffs">Puffs / hits</button></div>
  <div class="row"><input type="range" id="log-dose" min="${d.unit === 'mg' ? 0.5 : 1}" max="${max}" step="${d.unit === 'mg' ? 0.5 : 1}" value="${clamp(d.dose, 0.5, max)}" class="grow"><span class="dose-readout" id="log-dose-out">${d.unit === 'mg' ? fmtNum(d.dose) + ' mg' : plural(d.dose, 'puff')}</span></div>
  <p class="hint">${usual ? `Your usual with ${esc(METH[d.method].label.toLowerCase())} is ${d.unit === 'mg' ? fmtNum(usual) + ' mg' : plural(usual, 'puff')}.` : 'Estimate is fine — consistency matters more than precision.'}</p>
  <p class="eyebrow section-label">Logging this for</p>
  <div class="chips">${goals.map(g => chip(SYM[g].label, d.symptom === g, 'log-sym', g)).join('')}</div>
  <p class="eyebrow section-label">How strong is it right now?</p>
  ${scaleHtml(d.severity, 'log-sev', 'severity')}
  <div class="scale-labels"><span>Mild</span><span>Severe</span></div>
  <p class="eyebrow section-label">Cost of this dose (optional)</p>
  <input id="log-cost" inputmode="decimal" placeholder="$" value="${d.cost ?? ''}">
  <div class="sticky-cta"><button class="btn btn-primary" data-a="log-start" ${d.name ? '' : 'disabled'}>Start session</button>
  <p class="tiny center mt8">We'll ask how you're feeling at ${METH[d.method].checks.map(fmtMin).join(', ')}.</p></div>`;
};
function logResults(res) {
  return res.map(s => `<button class="list-row" data-a="log-strain" data-v="${s.id}"><div class="grow"><div class="strong">${esc(s.name)}</div><div class="hint">${esc(cap1(s.type))} · ${esc(topTerps(s.terpenes, 2).map(terpLabel).join(', '))}</div></div>${ic('chev')}</button>`).join('')
    + (logDraft && logDraft.q && !res.some(s => norm(s.name) === norm(logDraft.q)) ? `<button class="list-row" data-a="log-custom"><div class="grow"><div class="strong">Use “${esc(logDraft.q)}”</div><div class="hint">Not in the library — log it anyway</div></div>${ic('plus')}</button>` : '');
}
AFTER.log = () => {
  const s = $('#log-search');
  if (s) s.addEventListener('input', e => { logDraft.q = e.target.value; $('#log-results').innerHTML = logResults(searchStrains(logDraft.q, 8)); });
  const dz = $('#log-dose');
  if (dz) dz.addEventListener('input', e => { logDraft.dose = +e.target.value; $('#log-dose-out').textContent = logDraft.unit === 'mg' ? fmtNum(logDraft.dose) + ' mg' : plural(logDraft.dose, 'puff'); syncRanges(); });
  const c = $('#log-cost');
  if (c) c.addEventListener('input', e => { const v = parseFloat(e.target.value.replace(/[$,]/g, '')); logDraft.cost = isNaN(v) ? null : v; });
};

/* check-in */
VIEWS.checkin = (r) => {
  const s = sessions.find(x => x.id === r.parts[1]);
  if (!s) return `${topbar('Check-in')}${empty('alert', 'Session not found', 'It may have been deleted.', '')}`;
  if (!checkDraft || checkDraft.sid !== s.id) {
    const prev = (s.checkIns || [])[s.checkIns.length - 1];
    checkDraft = { sid: s.id, relief: null, vibes: prev ? prev.vibes.slice() : [], negatives: [], notes: '' };
  }
  const d = checkDraft, m = METH[s.method];
  const label = s.symptom === 'recreational' ? 'How good do you feel?' : `${SYM[s.symptom].label} relief`;
  return `${topbar('How are you feeling?')}
  <p class="sub">${fmtMin(minsSince(s.startedAt))} after ${doseText(s)} ${esc(m.short)} · ${esc(s.name)}</p>
  ${s.checkIns.length ? `<div class="card subtle mt12">${s.checkIns.map(c => `<div class="kv"><span>${fmtMin(c.minutesAfter)} in</span><span class="strong">${c.relief}/10</span></div>`).join('')}</div>` : ''}
  <p class="eyebrow section-label">${esc(label)}</p>
  ${scaleHtml(d.relief, 'ck-relief', 'relief')}
  <div class="scale-labels"><span>None</span><span>Complete</span></div>
  <p class="eyebrow section-label">What you're feeling</p>
  <div class="chips">${VIBES.map(v => chip(v.label, d.vibes.includes(v.id), 'ck-vibe', v.id)).join('')}</div>
  <p class="eyebrow section-label">Anything off?</p>
  <div class="chips">${NEGATIVES.map(n => chip(n.label, d.negatives.includes(n.id), 'ck-neg', n.id, 'coral')).join('')}</div>
  <p class="eyebrow section-label">Notes</p>
  <textarea id="ck-notes" placeholder="Optional — anything worth remembering">${esc(d.notes)}</textarea>
  <div class="sticky-cta"><button class="btn btn-primary" data-a="ck-save" ${d.relief ? '' : 'disabled'}>Save check-in</button>
  ${(() => { const nx = m.checks.find(x => x > minsSince(s.startedAt) + 10); return nx ? `<p class="tiny center mt8">Next check-in around ${fmtMin(nx)} after your dose.</p>` : ''; })()}</div>`;
};
AFTER.checkin = () => { const n = $('#ck-notes'); if (n) n.addEventListener('input', e => { checkDraft.notes = e.target.value; }); };

/* history */
VIEWS.history = () => {
  if (!sessions.length) return `<h1 class="title mb8">History</h1>${empty('list', 'No sessions yet', 'Log your first dose and it will show up here.', '<button class="btn btn-primary mt16" data-a="nav" data-v="#/log">Log a dose</button>')}`;
  const weekAgo = Date.now() - 7 * DAY;
  const week = sessions.filter(s => s.startedAt >= weekAgo);
  const wmg = week.filter(s => s.unit !== 'puffs').reduce((a, s) => a + s.dose, 0);
  const wp = week.filter(s => s.unit === 'puffs').reduce((a, s) => a + s.dose, 0);
  const costed = week.filter(s => s.cost);
  const spend = costed.reduce((a, s) => a + s.cost, 0);
  const sorted = sessions.slice().sort((a, b) => b.startedAt - a.startedAt);
  let lastDay = null, html = '';
  for (const s of sorted.slice(0, 200)) {
    const day = fmtDay(s.startedAt);
    if (day !== lastDay) { html += `<p class="eyebrow day-label">${esc(day)}</p>`; lastDay = day; }
    const rel = sessionRelief(s);
    const cls = rel == null ? '' : rel >= 7 ? 'good' : rel >= 4 ? 'mid' : 'bad';
    const open = ui.expanded === s.id;
    html += `<div class="card sess ${cls}" style="margin-top:6px"><button style="display:block;width:100%;text-align:left" data-a="hist-toggle" data-v="${s.id}">
      <div class="between"><div class="grow"><div class="strong ellipsis">${esc(s.name)}</div>
      <div class="hint">${doseText(s)} ${esc(METH[s.method].short)} · ${esc(SYM[s.symptom] ? SYM[s.symptom].label.toLowerCase() : s.symptom)}${rel != null ? ` · <span class="strong" style="color:var(--text)">${rel}/10</span>` : ' · not rated'}</div></div>
      <span class="tiny">${fmtTime(s.startedAt)}</span></div>
      ${sessionVibes(s).length || sessionNegs(s).length ? `<div class="mt8" style="display:flex;flex-wrap:wrap;gap:4px">${sessionVibes(s).map(v => `<span class="tag">${esc(VIBE[v].label.toLowerCase())}</span>`).join('')}${sessionNegs(s).map(n => `<span class="tag coral">${esc(NEG[n].label.toLowerCase())}</span>`).join('')}</div>` : ''}</button>
      ${open ? `<div class="mt12">
        ${s.severity ? `<div class="kv"><span>Strength before</span><span>${s.severity}/10</span></div>` : ''}
        ${s.checkIns.map(c => `<div class="kv"><span>${fmtMin(c.minutesAfter)} in${c.notes ? ` — <span class="muted">${esc(c.notes)}</span>` : ''}</span><span class="strong">${c.relief}/10</span></div>`).join('')}
        ${s.cost ? `<div class="kv"><span>Cost</span><span>${money(s.cost)}</span></div>` : ''}
        <div class="btn-row mt12"><button class="btn btn-secondary grow" style="width:100%" data-a="nav" data-v="#/checkin/${s.id}">Add check-in</button><button class="btn btn-danger" style="width:auto" data-a="hist-del" data-v="${s.id}" aria-label="Delete">${ic('trash')}</button></div>
      </div>` : ''}</div>`;
  }
  return `<h1 class="title">History</h1>
  <div class="grid2 mt16"><div class="card muted"><p class="eyebrow">This week</p><div class="stat">${wmg || !wp ? fmtNum(wmg) + '<span class="sub"> mg</span>' : wp + '<span class="sub"> puffs</span>'}</div><p class="tiny">${plural(week.length, 'session')}${wmg && wp ? ` · ${wp} puffs` : ''}</p></div>
  <div class="card muted" style="margin:0"><p class="eyebrow">Spend</p><div class="stat">${costed.length ? money(spend) : '—'}</div><p class="tiny">${costed.length ? `${money(spend / costed.length)} per session` : 'Add costs when logging'}</p></div></div>
  ${html}`;
};

/* insights */
VIEWS.insights = () => {
  const r = rated();
  const goals = profile.goals || [];
  const g = ui.insGoal;
  const tp = blendedProfile(g);
  const top = topTerps(tp, 4); const maxV = Math.max(...top.map(t => tp[t]), 0.01);
  const avoid = avoidTerps();
  const recs = recommend(g, 3);
  const conf = confidenceLabel(g);
  let html = `<h1 class="title">Insights</h1>`;
  if (r.length < 3) html += `<div class="card muted mt16"><div class="between"><span class="strong">Personal insights unlock at 3 rated sessions</span><span class="tag">${r.length}/3</span></div><div class="bar mt8"><span style="width:${r.length / 3 * 100}%"></span></div><p class="hint mt8">Rate how you feel after each dose — that's the data that makes everything here yours.</p></div>`;

  html += `<p class="eyebrow section-label">Suggestions for</p>
  <div class="chips mb12">${chip('Everything', !g, 'ins-goal', '')}${goals.map(x => chip(SYM[x].label, g === x, 'ins-goal', x)).join('')}</div>
  ${top.length ? `<div class="card muted"><div class="between mb12"><p class="eyebrow">Your terpene signature</p><span class="tag ${conf.cls}" style="font-size:10px">${esc(conf.text.split(' — ')[0])}</span></div>
    ${top.map((t, i) => terpBar(t, tp[t] / maxV, i < 2 ? 'Strong fit' : 'Good fit')).join('')}
    ${avoid.slice(0, 2).map(t => terpBar(t, 0.2, 'Watch out', 'coral')).join('')}
    <p class="tiny mt12">${esc(conf.text)}</p></div>
  <p class="eyebrow section-label">Try next</p>${recs.length ? recs.map(recCard).join('') : '<p class="hint">You\'ve tried every close match in the library — nice.</p>'}`
    : `<div class="callout purple">Log and rate a few sessions and your terpene signature will appear here.</div>`}`;

  if (r.length) {
    // best for each symptom
    const bySym = {};
    for (const s of r) {
      const k = s.symptom; bySym[k] = bySym[k] || {};
      const key = (s.productId || s.strainId || s.name) + '|' + s.method;
      (bySym[k][key] = bySym[k][key] || { name: s.name, method: s.method, strainId: s.strainId, vals: [] }).vals.push(sessionRelief(s));
    }
    const bestCards = Object.entries(bySym).map(([sym, items]) => {
      const best = Object.values(items).sort((a, b) => (avg(b.vals) + Math.min(b.vals.length, 5) * 0.1) - (avg(a.vals) + Math.min(a.vals.length, 5) * 0.1))[0];
      return `<div class="card"><p class="eyebrow">Best for ${esc((SYM[sym] || { label: sym }).label.toLowerCase())}</p>
        <div class="strong mt4">${esc(best.name)} <span class="muted" style="font-weight:400">· ${esc(METH[best.method].label.toLowerCase())}</span></div>
        <p class="hint">${fmtNum(avg(best.vals))}/10 average across ${plural(best.vals.length, 'session')}</p></div>`;
    });
    html += `<p class="eyebrow section-label">What's working</p>${bestCards.join('')}`;

    // terpene effectiveness (weighted by share in each product)
    const tw = {};
    for (const s of r) { if (!s.terps) continue; for (const [t, v] of Object.entries(s.terps)) { tw[t] = tw[t] || { w: 0, sum: 0, n: 0 }; tw[t].w += v; tw[t].sum += v * sessionRelief(s); if (v >= 0.15) tw[t].n++; } }
    const terpRows = Object.entries(tw).filter(([, o]) => o.n >= 1 && o.w > 0.2).map(([t, o]) => [t, o.sum / o.w, o.n]).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (terpRows.length) html += `<p class="eyebrow section-label">Terpenes that work for you</p><div class="card">${terpRows.map(([t, v, n]) => `<div class="terp-row"><div class="between mb4"><span class="strong">${esc(terpLabel(t))}</span><span class="hint">${fmtNum(v)}/10 · ${plural(n, 'session')}</span></div><div class="bar ${v >= 7 ? 'teal' : v < 4.5 ? 'coral' : ''}"><span style="width:${v * 10}%"></span></div></div>`).join('')}<p class="tiny mt12">Average relief, weighted by how much of each terpene was in what you used.</p></div>`;

    // methods
    const byM = {};
    for (const s of r) { (byM[s.method] = byM[s.method] || []).push(s); }
    if (Object.keys(byM).length > 1) html += `<p class="eyebrow section-label">By method</p><div class="card">${Object.entries(byM).sort((a, b) => avg(b[1].map(sessionRelief)) - avg(a[1].map(sessionRelief))).map(([m, l]) => `<div class="kv"><span>${esc(METH[m].label)} <span class="tiny">· ${plural(l.length, 'session')}</span></span><span class="strong">${fmtNum(avg(l.map(sessionRelief)))}/10</span></div>`).join('')}</div>`;

    // side effects
    const negCount = {}, negStrains = {};
    for (const s of sessions) for (const n of sessionNegs(s)) { negCount[n] = (negCount[n] || 0) + 1; (negStrains[n] = negStrains[n] || new Set()).add(s.name); }
    const negRows = Object.entries(negCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
    if (negRows.length) html += `<p class="eyebrow section-label">Side effects to watch</p><div class="card">${negRows.map(([n, c]) => `<div class="kv"><span>${esc(NEG[n].label)} <span class="tiny">· ${esc([...negStrains[n]].slice(0, 2).join(', '))}</span></span><span>${c}×</span></div>`).join('')}</div>`;
  }

  html += toleranceSection();

  const costed = sessions.filter(s => s.cost && sessionRelief(s) != null);
  if (costed.length >= 3) {
    const per = costed.map(s => ({ s, v: s.cost / Math.max(1, sessionRelief(s)) })).sort((a, b) => a.v - b.v);
    html += `<p class="eyebrow section-label">Value</p><div class="card"><div class="kv"><span>Avg cost per session</span><span class="strong">${money(avg(costed.map(s => s.cost)))}</span></div><div class="kv"><span>Best value</span><span class="strong">${esc(per[0].s.name)}</span></div><p class="tiny mt8">Best value = lowest cost per point of relief.</p></div>`;
  }

  html += `<button class="btn btn-secondary mt24" data-a="doctor">${ic('doc')} Share a summary with your doctor</button>
  <p class="tiny center mt8">Terpene suggestions come from your own logs and typical strain profiles — not medical advice.</p>`;
  return html;
};
function toleranceSection() {
  if (sessions.length < 2) return '';
  const unit = dominantUnit();
  const list = sessions.filter(s => (s.unit === 'puffs') === (unit === 'puffs'));
  const now = Date.now(), days = 60, start = startOfDay(now) - (days - 1) * DAY;
  const daily = Array(days).fill(0);
  for (const s of list) { const i = Math.floor((startOfDay(s.startedAt) - start) / DAY); if (i >= 0 && i < days) daily[i] += s.dose; }
  const roll = daily.map((_, i) => { const w = daily.slice(Math.max(0, i - 6), i + 1).filter(v => v > 0); return w.length ? avg(w) : null; });
  const maxY = Math.max(...daily, 1);
  const W = 320, H = 130, pad = 18, bw = (W - pad) / days;
  const y = v => H - 16 - (v / maxY) * (H - 30);
  let bars = '', path = '';
  daily.forEach((v, i) => { if (v) bars += `<rect x="${pad + i * bw + 0.5}" y="${y(v)}" width="${Math.max(1.5, bw - 1.5)}" height="${H - 16 - y(v)}" rx="1" fill="#EEEDFE"/>`; });
  roll.forEach((v, i) => { if (v == null) return; path += `${path ? 'L' : 'M'}${(pad + i * bw + bw / 2).toFixed(1)},${y(v).toFixed(1)}`; });
  const svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Daily dose, last 60 days">
    <line x1="${pad}" x2="${W}" y1="${H - 16}" y2="${H - 16}" stroke="rgba(0,0,0,0.1)"/>
    <text x="0" y="${y(maxY) + 4}">${fmtNum(maxY)}</text><text x="${pad}" y="${H - 2}">60d ago</text><text x="${W - 30}" y="${H - 2}">today</text>
    ${bars}<path d="${path}" fill="none" stroke="#534AB7" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  const recent = list.filter(s => s.startedAt >= now - 30 * DAY), prior = list.filter(s => s.startedAt < now - 30 * DAY && s.startedAt >= now - 60 * DAY);
  const ra = avg(recent.map(s => s.dose)), pa = avg(prior.map(s => s.dose));
  let note = '';
  if (recent.length >= 3 && prior.length >= 3 && pa > 0) {
    const ch = (ra - pa) / pa;
    if (ch >= 0.5) note = `<div class="callout amber mt12"><span class="strong">Tolerance creep likely.</span> Your average dose is up ${Math.round(ch * 100)}% versus the month before (${fmtNum(pa)} → ${fmtNum(ra)} ${unitLabel(unit)}). A 48-hour break often resets this — worth raising with your provider before simply dosing higher.</div>`;
    else if (ch <= -0.2) note = `<div class="callout teal mt12">Your average dose is down ${Math.round(-ch * 100)}% from the month before — same relief on less is a win.</div>`;
    else note = `<p class="hint mt8">Average dose steady: ${fmtNum(pa)} → ${fmtNum(ra)} ${unitLabel(unit)} per session.</p>`;
  } else note = `<p class="hint mt8">Trend comparisons start once you have a couple of months of logs.</p>`;
  return `<p class="eyebrow section-label">Dose trend · ${unit === 'mg' ? 'mg THC' : 'puffs'} per day</p><div class="card">${svg}<div class="row tiny mt4"><span style="width:10px;height:10px;background:#EEEDFE;border-radius:2px;display:inline-block"></span>daily total <span style="width:12px;height:2px;background:#534AB7;display:inline-block;margin-left:8px"></span>7-day average</div>${note}</div>`;
}

/* strain detail */
VIEWS.strain = (r) => {
  const s = STRAIN[r.parts[1]];
  if (!s) return `${topbar('Strain')}${empty('alert', 'Not found', '', '')}`;
  const t = normalize(s.terpenes), tt = topTerps(t, 6), maxV = Math.max(...tt.map(k => t[k]));
  const bp = blendedProfile(ui.insGoal);
  const match = Math.round(clamp(0.6 * overlap(bp, t) + 0.4 * cosine(bp, t), 0, 0.99) * 100);
  const o = strainOutcomes(s.id);
  const avoid = avoidTerps().filter(a => (t[a] || 0) > 0.2);
  return `${topbar(s.name)}
  <p class="sub">${esc(cap1(s.type))}${s.parents ? ` · ${esc(s.parents)}` : ''}</p>
  <div class="grid2 mt12"><div class="card muted"><p class="eyebrow">Your match</p><div class="stat">${match}%</div></div>
  <div class="card muted" style="margin:0"><p class="eyebrow">Typical THC / CBD</p><div class="strong mt4">${s.thcRange[0]}–${s.thcRange[1]}% / ${s.cbdRange[0]}–${s.cbdRange[1]}%</div></div></div>
  ${avoid.length ? `<div class="callout coral mt12">Leans on ${esc(avoid.map(a => terpLabel(a).toLowerCase()).join(' and '))}, which hasn't agreed with you before.</div>` : ''}
  ${o.n ? `<div class="callout teal mt12">You've rated it ${fmtNum(o.avg)}/10 across ${plural(o.n, 'session')}.</div>` : ''}
  <p class="sub mt12">${esc(s.description)}</p>
  <p class="eyebrow section-label">Typical terpenes</p>
  <div class="card">${tt.map(k => terpBar(k, t[k] / maxV, TERPS[k] ? TERPS[k].aroma : '')).join('')}<p class="tiny mt12">Typical profile — your jar may differ. Scan its label for the real numbers.</p></div>
  <p class="eyebrow section-label">Commonly reported</p>
  <div style="display:flex;flex-wrap:wrap;gap:4px">${s.effects.map(e => `<span class="tag">${esc((VIBE[e] || { label: e }).label.toLowerCase())}</span>`).join('')}${s.uses.map(u => `<span class="tag gray">${esc((SYM[u] || { label: u }).label.toLowerCase())}</span>`).join('')}</div>
  <button class="btn btn-primary mt24" data-a="nav" data-v="#/log?strain=${s.id}">Log a dose of this</button>`;
};

/* settings */
VIEWS.settings = () => `<h1 class="title">Settings</h1>
  <div class="card muted mt16"><p class="eyebrow">Your profile</p>
    <p class="mt4">Created ${esc(new Date(profile.createdAt).toLocaleDateString())} · ${plural(sessions.length, 'session')} · ${plural(products.length, 'product')}</p>
    <p class="hint mt4">Looking for relief from: ${esc(profile.goals.map(g => SYM[g].label.toLowerCase()).join(', ') || '—')}</p></div>
  <p class="eyebrow section-label">Preferences</p>
  <button class="list-row" data-a="toggle-reminders">${ic('bell')}<div class="grow"><div class="strong">Check-in reminders</div><div class="hint">Notifications after each dose</div></div>
    <span class="seg" style="padding:2px"><span style="padding:4px 10px;border-radius:7px;font-size:12px;${settings.reminders ? 'background:var(--purple);color:#fff' : ''}">${settings.reminders ? 'On' : 'Off'}</span></span></button>
  <button class="list-row" data-a="edit-profile">${ic('edit')}<div class="grow"><div class="strong">Edit my profile</div><div class="hint">Goals, strains you like, methods</div></div>${ic('chev')}</button>
  <p class="eyebrow section-label">Your data</p>
  <button class="list-row" data-a="export">${ic('share')}<div class="grow"><div class="strong">Back up my data</div><div class="hint">Save everything as a file</div></div>${ic('chev')}</button>
  <label class="list-row">${ic('upload')}<div class="grow"><div class="strong">Restore from backup</div><div class="hint">Load a Terpene backup file</div></div>${ic('chev')}<input type="file" accept="application/json,.json" data-file="import" hidden></label>
  <button class="list-row" data-a="clear">${ic('trash')}<div class="grow"><div class="strong" style="color:var(--coral-text)">Erase everything</div><div class="hint">Permanently delete all logs</div></div></button>
  <p class="eyebrow section-label">About</p>
  <button class="list-row" data-a="nav" data-v="#/about">${ic('info')}<div class="grow"><div class="strong">About Terpene</div><div class="hint">Privacy and disclaimer</div></div>${ic('chev')}</button>
  <p class="tiny center mt24">Terpene v1.0 · your data never leaves this phone</p>`;

VIEWS.about = () => `${topbar('About Terpene')}
  <div class="card"><p class="strong">Private by design</p><p class="sub mt4">Terpene has no account and no server. Sessions, products and photos stay in this app's storage on your phone. Label scanning runs entirely on-device. Back up from Settings if you change phones.</p></div>
  <div class="card"><p class="strong">How suggestions work</p><p class="sub mt4">Your starter profile comes from the terpenes in strains you said worked (and didn't). As you rate sessions, Terpene shifts weight from that starting guess to what your own check-ins show. Strain profiles are typical values — real batches vary, so scanned label numbers always win.</p></div>
  <div class="card"><p class="strong">Not medical advice</p><p class="sub mt4">Terpene is a wellness journal, not a medical device. Research on terpenes is still early, and effects vary person to person. Talk with your healthcare provider before changing your regimen. You're responsible for following the cannabis laws where you live.</p></div>`;

/* ───────────────────────── sheet ───────────────────────── */
function openSheet(html) {
  document.body.classList.add('sheet-open');
  $('#sheet-root').innerHTML = `<div class="backdrop" data-a="sheet-close"></div><div class="sheet" role="dialog"><div class="grab"></div>${html}</div>`;
}
const closeSheet = () => { $('#sheet-root').innerHTML = ''; document.body.classList.remove('sheet-open'); };
function confirmSheet(title, body, okLabel, onOk, danger) {
  pendingConfirm = onOk;
  openSheet(`<div class="h2">${esc(title)}</div><p class="sub mt8">${esc(body)}</p>
    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} mt16" data-a="confirm-ok">${esc(okLabel)}</button>
    <button class="btn btn-secondary mt8" data-a="sheet-close">Cancel</button>`);
}
let pendingConfirm = null;

/* ───────────────────────── actions ───────────────────────── */
const toggle = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); };
const A = {
  nav: v => go(v),
  'nav-close': v => { closeSheet(); go(v); },
  back: () => { if (history.length > 1) history.back(); else go('#/home'); },
  'sheet-close': () => { closeSheet(); pendingConfirm = null; },
  'confirm-ok': () => { const f = pendingConfirm; pendingConfirm = null; closeSheet(); f && f(); },

  gate: v => { ui.gate[+v] = !ui.gate[+v]; rerender(); },
  'gate-ok': () => { settings.eligible = true; saveAll(); go('#/ob/welcome', true); },

  'ob-goal': v => { toggle(ob.goals, v); rerender(); },
  'ob-pick': v => {
    const [kind, id] = v.split(':'); const map = kind === 'liked' ? ob.liked : ob.disliked;
    if (id in map) { if (ob.open === id) { delete map[id]; ob.open = null; } else ob.open = id; }
    else { map[id] = []; ob.open = id; const other = kind === 'liked' ? ob.disliked : ob.liked; delete other[id]; }
    rerenderObList(kind);
  },
  'ob-sub': v => { const [kind, id, opt] = v.split(':'); toggle((kind === 'liked' ? ob.liked : ob.disliked)[id], opt); rerenderObList(kind); },
  'ob-close': () => { ob.open = null; rerenderObList(parseRoute().parts[1] === 'disliked' ? 'disliked' : 'liked'); },
  'ob-next': v => { ob.q = ''; ob.open = null; go(v); },
  'ob-method': v => { toggle(ob.methods, v); rerender(); },
  'ob-unit': v => { if (ob.unit !== v) { ob.unit = v; ob.dose = v === 'mg' ? 10 : 3; } rerender(); },
  'ob-dose-unknown': () => { ob.doseKnown = false; rerender(); },
  'ob-dose-known': () => { ob.doseKnown = true; rerender(); },
  'ob-freq': v => { ob.freq = v; rerender(); },
  'ob-cancel': () => { ob = null; go('#/settings', true); },
  'ob-finish': () => {
    const { terpeneProfile, avoidanceTerpenes } = computeOnboardingProfile(ob.liked, ob.disliked);
    const wasOnboarded = profile && profile.onboarded;
    profile = Object.assign({}, profile || {}, {
      goals: ob.goals, liked: ob.liked, disliked: ob.disliked, methods: ob.methods,
      typicalDose: ob.doseKnown ? ob.dose : null, unit: ob.unit, frequency: ob.freq,
      terpeneProfile, avoidanceTerpenes, createdAt: (profile && profile.createdAt) || Date.now(),
      onboarded: !!wasOnboarded, updatedAt: Date.now(),
    });
    saveAll(); ui.revealReady = false; go('#/ob/reveal');
  },
  'ob-enter': () => { profile.onboarded = true; saveAll(); ob = null; go('#/home', true); },

  'scan-manual': () => { scan = { phase: 'review', source: 'manual', draft: { name: '', strainId: null, thc: null, cbd: null, terps: [{ id: '', val: 0 }], method: (profile.methods || [])[0] || 'vape_cart', price: null, units: null } }; rerender(); },
  'scan-reset': () => { scan = { phase: 'idle' }; rerender(); },
  'scan-terp-add': () => { readScanInputs(); scan.draft.terps.push({ id: '', val: 0 }); rerender(); },
  'scan-terp-del': v => { readScanInputs(); scan.draft.terps.splice(+v, 1); if (!scan.draft.terps.length) scan.draft.terps.push({ id: '', val: 0 }); rerender(); },
  'scan-method': v => { readScanInputs(); scan.draft.method = v; rerender(); },
  'scan-link': v => { readScanInputs(); scan.draft.strainId = v; scan.draft.name = STRAIN[v].name; rerender(); },
  'scan-unlink': () => { readScanInputs(); scan.draft.strainId = null; rerender(); },
  'scan-save': v => {
    readScanInputs();
    const d = scan.draft;
    if (!d.name && !d.strainId) { toast('Give it a name first'); return; }
    let terps = {}; d.terps.filter(t => t.id && t.val > 0).forEach(t => { terps[t.id] = (terps[t.id] || 0) + t.val; });
    let terpsFrom = 'label';
    if (!Object.keys(terps).length && d.strainId) { terps = STRAIN[d.strainId].terpenes; terpsFrom = 'strain'; }
    const p = { id: uid(), name: d.name || STRAIN[d.strainId].name, strainId: d.strainId, thc: d.thc, cbd: d.cbd, terps, terpsFrom, method: d.method, price: d.price, units: d.units, addedAt: Date.now(), source: scan.source };
    products.push(p); saveAll(); scan = { phase: 'idle' };
    toast('Product saved');
    if (v === 'log') { logDraft = null; go(`#/log?product=${p.id}`); } else go('#/products');
  },
  product: v => { const p = products.find(x => x.id === v); if (p) productSheet(p); },
  'product-del': v => confirmSheet('Remove this product?', 'Your past sessions with it stay in your history.', 'Remove', () => { products = products.filter(p => p.id !== v); saveAll(); rerender(); toast('Removed'); }, true),

  'log-product': v => { const p = products.find(x => x.id === v); Object.assign(logDraft, { productId: p.id, strainId: p.strainId, name: p.name, method: p.method || logDraft.method, picking: false, q: '' }); if (p.price && p.units) logDraft.cost = Math.round(p.price / p.units * 100) / 100; rerender(); },
  'log-strain': v => { Object.assign(logDraft, { productId: null, strainId: v, name: STRAIN[v].name, picking: false, q: '' }); rerender(); },
  'log-custom': () => { Object.assign(logDraft, { productId: null, strainId: null, name: logDraft.q.trim(), picking: false, q: '' }); rerender(); },
  'log-change': () => { logDraft.picking = true; rerender(); },
  'log-method': v => { logDraft.method = v; const u = usualDose(v, logDraft.unit); if (u) logDraft.dose = u; rerender(); },
  'log-unit': v => { if (logDraft.unit !== v) { logDraft.unit = v; logDraft.dose = usualDose(logDraft.method, v) || (v === 'mg' ? 5 : 3); } rerender(); },
  'log-sym': v => { logDraft.symptom = v; rerender(); },
  'log-sev': v => { logDraft.severity = +v; rerender(); },
  'log-start': async () => {
    const d = logDraft;
    const p = d.productId && products.find(x => x.id === d.productId);
    let terps = p && Object.keys(p.terps || {}).length ? normalize(p.terps) : d.strainId ? normalize(STRAIN[d.strainId].terpenes) : null;
    const s = {
      id: uid(), startedAt: Date.now(), productId: d.productId, strainId: d.strainId, name: d.name,
      method: d.method, dose: d.dose, unit: d.unit, symptom: d.symptom, severity: d.severity, cost: d.cost,
      terps, thc: p ? p.thc : null, checkIns: [], nBase: (Date.now() % 100000000) * 10,
    };
    sessions.push(s); saveAll(); logDraft = null;
    go('#/home');
    const ok = await scheduleCheckins(s);
    toast(ok ? `Session started — we'll check in at ${fmtMin(METH[s.method].checks[0])}` : 'Session started');
  },

  'ck-relief': v => { checkDraft.relief = +v; rerender(); },
  'ck-vibe': v => { toggle(checkDraft.vibes, v); rerender(); },
  'ck-neg': v => { toggle(checkDraft.negatives, v); rerender(); },
  'ck-save': () => {
    const s = sessions.find(x => x.id === checkDraft.sid); if (!s) return;
    const n = $('#ck-notes'); if (n) checkDraft.notes = n.value.trim();
    const first = !rated().length;
    s.checkIns.push({ at: Date.now(), minutesAfter: minsSince(s.startedAt), relief: checkDraft.relief, vibes: checkDraft.vibes, negatives: checkDraft.negatives, notes: checkDraft.notes });
    const rel = checkDraft.relief;
    // drop reminders that are now redundant, keep any still ahead
    cancelCheckins(s, 0).then(() => { if (nextCheckDue(s)) scheduleCheckins(s, true); });
    saveAll(); checkDraft = null;
    if (rel >= 7) confetti();
    toast(first ? 'First check-in saved — Terpene is learning' : 'Check-in saved');
    go('#/home');
  },

  'hist-toggle': v => { ui.expanded = ui.expanded === v ? null : v; rerender(); },
  'hist-del': v => confirmSheet('Delete this session?', 'This can\'t be undone.', 'Delete', () => { const s = sessions.find(x => x.id === v); if (s) cancelCheckins(s); sessions = sessions.filter(x => x.id !== v); saveAll(); rerender(); toast('Deleted'); }, true),

  'ins-goal': v => { ui.insGoal = v || null; rerender(); },
  doctor: () => shareFile(`terpene-summary-${new Date().toISOString().slice(0, 10)}.html`, doctorReport(), 'text/html'),

  'toggle-reminders': async () => {
    settings.reminders = !settings.reminders;
    if (settings.reminders && NATIVE && !(await notifPermission(true))) { settings.reminders = false; toast('Notifications are blocked — allow them in Android settings'); }
    if (!settings.reminders) for (const s of sessions) if (Date.now() - s.startedAt < 12 * 3600000) cancelCheckins(s);
    saveAll(); rerender();
  },
  'edit-profile': () => { ob = newOnboarding(); go('#/ob/welcome'); },
  export: () => shareFile(`terpene-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'terpene', version: 1, exportedAt: new Date().toISOString(), profile, sessions, products, settings }, null, 1), 'application/json'),
  clear: () => confirmSheet('Erase everything?', 'All sessions, products and your profile will be permanently deleted from this phone. Back up first if you might want them.', 'Erase everything', () => {
    for (const s of sessions) cancelCheckins(s);
    store.clear(); profile = null; sessions = []; products = []; settings = { reminders: true, eligible: false }; ob = null; ui.gate = [false, false];
    go('#/gate', true);
  }, true),
};
function rerenderObList(kind) {
  const list = $('#ob-list');
  if (!list) return rerender();
  list.innerHTML = obPickList(kind);
  // refresh CTA label/state without losing search focus
  const btn = document.querySelector('.sticky-cta .btn-primary');
  if (btn && kind === 'liked') { const n = Object.keys(ob.liked).length; btn.disabled = !n; btn.textContent = n ? `${n} selected · continue` : 'Pick at least one'; }
  if (btn && kind === 'disliked') btn.textContent = Object.keys(ob.disliked).length ? 'Continue' : 'Skip';
}

function doctorReport() {
  const r = rated();
  const bySym = {};
  for (const s of r) (bySym[s.symptom] = bySym[s.symptom] || []).push(s);
  const symRows = Object.entries(bySym).map(([k, l]) => {
    const names = {}; for (const s of l) (names[s.name + ' (' + METH[s.method].label.toLowerCase() + ')'] = names[s.name + ' (' + METH[s.method].label.toLowerCase() + ')'] || []).push(sessionRelief(s));
    const best = Object.entries(names).sort((a, b) => avg(b[1]) - avg(a[1]))[0];
    return `<tr><td>${esc(SYM[k].label)}</td><td>${l.length}</td><td>${l.some(s => s.severity) ? fmtNum(avg(l.filter(s => s.severity).map(s => s.severity))) + '/10' : '—'}</td><td>${fmtNum(avg(l.map(sessionRelief)))}/10</td><td>${esc(best[0])} — ${fmtNum(avg(best[1]))}/10</td></tr>`;
  }).join('');
  const unit = dominantUnit();
  const list = sessions.filter(s => (s.unit === 'puffs') === (unit === 'puffs'));
  const now = Date.now();
  const recent = list.filter(s => s.startedAt >= now - 30 * DAY), prior = list.filter(s => s.startedAt < now - 30 * DAY && s.startedAt >= now - 60 * DAY);
  const negCount = {}; for (const s of sessions) for (const n of sessionNegs(s)) negCount[n] = (negCount[n] || 0) + 1;
  const first = sessions.length ? Math.min(...sessions.map(s => s.startedAt)) : now;
  const methods = {}; for (const s of sessions) methods[s.method] = (methods[s.method] || 0) + 1;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Medical cannabis summary</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#1a1a1a;line-height:1.5}h1{font-size:22px;font-weight:500;margin-bottom:0}h2{font-size:15px;font-weight:500;margin-top:24px;color:#534AB7}table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #eee}th{font-weight:500;color:#6b6b6b}.muted{color:#6b6b6b;font-size:13px}@media print{body{margin:0}}</style></head><body>
<h1>Medical cannabis summary</h1><p class="muted">Patient-kept journal from the Terpene app · ${esc(new Date(first).toLocaleDateString())} – ${esc(new Date().toLocaleDateString())} · ${plural(sessions.length, 'session')} (${r.length} rated)</p>
<h2>Relief by symptom</h2><table><tr><th>Symptom</th><th>Sessions</th><th>Avg severity before</th><th>Avg relief</th><th>Most effective</th></tr>${symRows || '<tr><td colspan="5">No rated sessions yet</td></tr>'}</table>
<h2>Methods used</h2><table>${Object.entries(methods).map(([m, c]) => `<tr><td>${esc(METH[m].label)}</td><td>${plural(c, 'session')}</td></tr>`).join('')}</table>
<h2>Dose trend (${unit === 'mg' ? 'mg THC' : 'puffs'} per session)</h2><p>Last 30 days: ${recent.length ? fmtNum(avg(recent.map(s => s.dose))) : '—'} avg over ${plural(recent.length, 'session')}. Prior 30 days: ${prior.length ? fmtNum(avg(prior.map(s => s.dose))) : '—'} avg over ${plural(prior.length, 'session')}.</p>
<h2>Reported side effects</h2><p>${Object.keys(negCount).length ? Object.entries(negCount).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${esc(NEG[n].label)} (${c}×)`).join(', ') : 'None reported'}</p>
<h2>Terpenes associated with best relief</h2><p>${esc(topTerps(blendedProfile(null), 3).map(terpLabel).join(', ') || '—')}</p>
<p class="muted" style="margin-top:32px">Self-reported data from a personal journal. Relief and severity are 1–10 self-ratings. Not a clinical record.</p></body></html>`;
}

/* ───────────────────────── wiring ───────────────────────── */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  e.preventDefault();
  if (el.classList.contains('chip') || el.closest('.scale') || el.classList.contains('btn-primary')) haptic();
  fn(el.dataset.v, el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.file === 'scan' && el.files && el.files[0]) { runScan(el.files[0]); el.value = ''; }
  if (el.dataset.file === 'import' && el.files && el.files[0]) {
    const f = el.files[0]; el.value = '';
    f.text().then(txt => {
      const data = JSON.parse(txt);
      if (data.app !== 'terpene' || !Array.isArray(data.sessions)) throw new Error('bad');
      confirmSheet('Restore this backup?', `It has ${plural(data.sessions.length, 'session')} from ${new Date(data.exportedAt).toLocaleDateString()}. It replaces what's on this phone now.`, 'Restore', () => {
        profile = data.profile; sessions = data.sessions; products = data.products || []; settings = Object.assign(settings, data.settings || {}, { eligible: true });
        saveAll(); toast('Backup restored'); go('#/home', true); rerender();
      });
    }).catch(() => toast('That doesn\'t look like a Terpene backup'));
  }
  if (el.dataset.terpId != null || el.dataset.terpVal != null) readScanInputs();
});
window.addEventListener('hashchange', () => { closeSheet(); render(false); });

// refresh time-based UI (active session timers) every minute
setInterval(() => { const p = parseRoute().parts[0]; if (p === 'home' && !$('#sheet-root').innerHTML) rerender(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && parseRoute().parts[0] === 'home') rerender(); });

if (NATIVE) {
  try {
    if (LN()) LN().addListener('localNotificationActionPerformed', a => {
      const sid = a && a.notification && a.notification.extra && a.notification.extra.sessionId;
      if (sid && sessions.some(s => s.id === sid)) go('#/checkin/' + sid);
    });
    if (PL.App) PL.App.addListener('backButton', () => {
      if ($('#sheet-root').innerHTML) { closeSheet(); return; }
      const p = parseRoute().path;
      if (['home', 'gate', 'ob/welcome', ''].includes(p) || (p === 'ob/reveal' && ui.revealReady)) PL.App.exitApp();
      else if (['history', 'insights', 'settings', 'scan'].includes(p)) go('#/home', true);
      else history.back();
    });
  } catch (e) { console.error(e); }
}

render(false);
})();

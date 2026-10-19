/**
 * Worker « ecran-salon » : prochains passages Fil Bleu pour l'écran du salon.
 *
 * Il combine :
 *  - les horaires prévus (bloc HORAIRES ci-dessous, tiré du GTFS Fil Bleu),
 *  - le temps réel GTFS-RT open data de Fil Bleu (licence ouverte, sans clé),
 *  - les alertes trafic GTFS-RT.
 * et renvoie un petit JSON lisible par le cadre (avec autorisation CORS).
 *
 * Adresse à appeler : https://<ton-worker>.workers.dev/transports
 */

const ARRETS = {           // ligne → identifiant du quai dans ta direction
  'A': 'TTR:MONC-1T',      // Monconseil, vers Lycée J. Monnet
  '2': 'TTR:MAJUB-1'       // Maréchal Juin, vers CHU Trousseau
};
const ROUTES = { 'TTR:LINE:A': 'A', 'TTR:LINE:2': '2' };
const ORIGINE_AUTORISEE = '*';   // tu pourras mettre 'https://chonchon37.github.io'
const FLUX_TR = 'https://data.filbleu.fr/ws-tr/gtfs-rt/opendata/trip-updates';
const FLUX_ALERTES = 'https://data.filbleu.fr/ws-tr/gtfs-rt/opendata/service-alerts';
const CACHE_SECONDES = 20;

// Horaires prévus, format compact : "jours" = n° de grille pour chaque jour depuis "debut",
// chaque ligne "g=" = minutes depuis minuit, écrites en écarts successifs.
const HORAIRES = `
debut=20261018
jusqua=20270101
arret=TTR:MONC-1T
jours=0112213022221304444430440443044444304444456444445644444564444456111103011111
g=341,19,18,19,21,21,14,15,15,15,15,15,17,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,19,21,20,20,18,22,20,34,29,29,32
g=279,35,13,16,15,14,5,7,11,6,6,6,10,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,8,9,8,9,8,9,8,9,8,9,8,8,8,9,8,9,8,8,9,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,7,7,7,7,7,7,7,7,7,6,8,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,8,6,7,10,8,10,9,7,7,9,15,15,16,14,15,17,17,30,22,30,33
g=279,35,13,16,15,14,5,7,11,6,6,6,10,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,8,9,8,9,8,9,8,9,8,9,8,8,8,9,8,9,8,8,9,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,7,7,7,7,7,7,7,7,7,6,8,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,8,6,7,10,8,10,9,7,7,9
g=278,35,14,16,15,14,12,10,11,9,10,9,9,8,10,10,10,10,9,8,8,9,9,9,10,9,10,10,10,10,10,10,11,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,8,9,8,9,8,9,8,9,9,8,6,8,7,7,7,7,7,8,6,7,7,7,7,8,8,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,7,5,9,9,8,8,16,15,17,13,15,15,10,20,21,17,23,20,20
g=279,35,13,13,18,14,5,7,5,6,6,6,5,6,6,6,6,6,6,6,6,6,5,6,6,6,6,6,6,6,6,6,6,6,5,6,7,8,7,7,7,7,7,7,7,7,7,7,7,6,7,8,6,7,8,7,7,6,6,7,6,7,7,7,7,7,7,6,7,7,6,8,7,6,7,7,6,7,7,6,7,7,6,7,7,6,7,7,5,6,6,5,6,6,6,6,6,6,6,6,6,6,6,5,7,6,6,6,6,6,6,6,6,6,6,5,6,6,6,6,6,6,6,6,6,6,6,5,6,6,6,10,9,7,7,9,15,15,16,14,15,17,17,30,22,30,33
g=278,35,14,16,15,14,12,10,11,9,10,9,9,8,10,10,10,10,9,8,8,9,9,9,10,9,10,10,10,10,10,10,11,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,8,9,8,9,8,9,8,9,9,8,7,7,7,7,7,7,7,8,6,7,7,7,7,8,8,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,7,5,9,9,8,8,16,15,17,13,15,15,10,20,21,17,23,20,20
g=341,19,18,19,21,21,14,15,15,15,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,12,12,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,18,19,21,20,20,18,22,20,34,26,32,32
arret=TTR:MAJUB-1
jours=0111123011112304444530440453044445304444530444453044445304444530111103011111
g=351,50,30,30,30,29,30,30,30,30,30,30,29,30,30,30,29,30,30,30,31,30,30,30,30,30,31,30,31,30,30,34,26,30,30,30
g=313,32,27,20,14,7,6,8,9,8,9,8,8,8,8,9,8,10,8,9,8,10,9,8,8,9,8,9,8,9,8,9,8,9,8,9,8,9,8,9,9,9,8,8,9,8,8,9,9,8,8,9,8,9,8,9,9,8,9,9,8,9,9,8,8,9,8,9,8,9,8,9,9,8,8,8,8,8,8,9,8,9,8,9,9,8,10,10,10,7,7,13,14,10,16,20,20,17,21,19,26,26,28,29,29
g=313,32,27,20,14,7,6,8,9,8,9,8,8,8,8,9,8,10,8,9,8,10,9,8,8,9,8,9,8,9,8,9,8,9,8,9,8,9,8,9,9,9,8,8,9,8,8,9,9,8,8,9,8,9,8,9,9,8,9,9,8,9,9,8,8,9,8,9,8,9,8,9,9,8,8,8,8,8,8,9,8,9,8,9,9,8,10,10,10,7,7,13,14,10,16,20,20,17,21,19,26,26,28,29,29,60
g=314,19,21,25,24,26,23,15,15,15,15,16,15,14,15,15,15,15,15,15,15,15,15,15,15,15,11,18,12,13,12,13,12,13,12,13,12,13,12,13,12,13,12,13,12,13,12,13,12,13,13,13,12,13,12,13,12,12,12,13,12,14,12,18,14,17,18,19,20,20,16,22,18,22,18
g=313,32,27,20,14,7,6,8,7,9,6,10,5,7,8,8,7,8,7,8,6,9,8,8,8,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,8,7,7,8,7,9,5,8,6,8,7,8,7,8,4,6,8,6,6,9,9,6,8,8,7,13,14,10,16,20,20,17,21,19,26,26,28,29,29
g=313,32,27,20,14,7,6,8,7,9,6,10,5,7,8,8,7,8,7,8,6,9,8,8,8,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,7,8,8,7,7,8,7,9,5,8,6,8,7,8,7,8,4,6,8,6,6,9,9,6,8,8,7,13,14,10,16,20,20,17,21,19,26,26,28,29,29,60
`;

/* ---------------- Horaires prévus ---------------- */
let PREVU = null;
function lirePrevus() {
  if (PREVU) return PREVU;
  const res = { arrets: {} };
  let cur = null;
  for (const ligne of HORAIRES.trim().split('\n')) {
    const i = ligne.indexOf('='), k = ligne.slice(0, i), v = ligne.slice(i + 1);
    if (k === 'debut' || k === 'jusqua') res[k] = v;
    else if (k === 'arret') { cur = { jours: '', grilles: [] }; res.arrets[v] = cur; }
    else if (k === 'jours') cur.jours = v;
    else if (k === 'g') { let acc = 0; cur.grilles.push(v.split(',').map(d => (acc += +d))); }
  }
  PREVU = res;
  return res;
}

// Décalage Paris/UTC (en minutes) à un instant donné : gère l'heure d'été tout seul
const FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
function partiesParis(ms) {
  const p = {}; for (const x of FMT.formatToParts(new Date(ms))) p[x.type] = x.value;
  return p;
}
function decalageParis(ms) {
  const p = partiesParis(ms);
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000) / 60000;
}
function ymd(y, m, d) { const t = new Date(Date.UTC(y, m - 1, d)); return t.toISOString().slice(0, 10).replace(/-/g, ''); }
function joursEntre(a, b) {
  const A = Date.UTC(+a.slice(0, 4), +a.slice(4, 6) - 1, +a.slice(6, 8));
  const B = Date.UTC(+b.slice(0, 4), +b.slice(4, 6) - 1, +b.slice(6, 8));
  return Math.round((B - A) / 86400000);
}

function passagesPrevus(stop, maintenant, finFenetre) {
  const P = lirePrevus(), A = P.arrets[stop], out = [];
  if (!A) return out;
  const p = partiesParis(maintenant);
  for (let delta = -1; delta <= 1; delta++) {        // hier (services après minuit), aujourd'hui, demain
    const D = ymd(+p.year, +p.month, +p.day + delta);
    const idx = joursEntre(P.debut, D);
    if (idx < 0 || idx >= A.jours.length) continue;
    const grille = A.grilles[+A.jours[idx]];
    const minuitUTC = Date.UTC(+D.slice(0, 4), +D.slice(4, 6) - 1, +D.slice(6, 8));
    for (const m of grille) {
      let t = minuitUTC + m * 60000;
      t -= decalageParis(t) * 60000;
      if (t >= maintenant - 60000 && t <= finFenetre) out.push(t);
    }
  }
  return out.sort((a, b) => a - b);
}

/* ---------------- Lecture protobuf minimale (GTFS-RT) ---------------- */
function lecteur(b) {
  let p = 0;
  const varint = () => { let x = 0, m = 1, c; do { c = b[p++]; x += (c & 127) * m; m *= 128; } while (c & 128); return x; };
  function parcourir(debut, fin, fn) {
    p = debut;
    while (p < fin) {
      const cle = varint(), champ = Math.floor(cle / 8), type = cle & 7;
      if (type === 0) fn(champ, varint());
      else if (type === 2) { const l = varint(), a = p; p += l; const retour = p; fn(champ, null, a, a + l); p = retour; }
      else if (type === 1) p += 8;
      else if (type === 5) p += 4;
      else return;
    }
  }
  return parcourir;
}
const DEC = new TextDecoder();

function lirePassagesTR(b, stopsVoulus) {
  const parcourir = lecteur(b), res = {};
  parcourir(0, b.length, (f, v, a, z) => {
    if (f !== 2) return;                                   // FeedEntity
    parcourir(a, z, (f2, v2, a2, z2) => {
      if (f2 !== 3) return;                                // TripUpdate
      let annule = false; const trouves = [];
      parcourir(a2, z2, (f3, v3, a3, z3) => {
        if (f3 === 1) parcourir(a3, z3, (f4, v4) => { if (f4 === 4 && v4 === 3) annule = true; }); // trip CANCELED
        if (f3 !== 2) return;                              // StopTimeUpdate
        let stop = null, dep = 0, arr = 0, saute = false;
        parcourir(a3, z3, (f4, v4, a4, z4) => {
          if (f4 === 4) stop = DEC.decode(b.subarray(a4, z4));
          else if (f4 === 5 && v4 === 1) saute = true;     // SKIPPED
          else if (f4 === 2 || f4 === 3) parcourir(a4, z4, (f5, v5) => { if (f5 === 2 && v5) { if (f4 === 3) dep = v5; else arr = v5; } });
        });
        if (stop && stopsVoulus.has(stop) && !saute && (dep || arr)) trouves.push([stop, (dep || arr) * 1000]);
      });
      if (!annule) for (const [s, t] of trouves) (res[s] = res[s] || []).push(t);
    });
  });
  return res;
}

function lireAlertes(b, maintenant) {
  const parcourir = lecteur(b), res = {};
  parcourir(0, b.length, (f, v, a, z) => {
    if (f !== 2) return;
    parcourir(a, z, (f2, v2, a2, z2) => {
      if (f2 !== 5) return;                                // Alert
      const lignes = new Set(); let texte = '', active = true, periodes = 0, dedans = false;
      parcourir(a2, z2, (f3, v3, a3, z3) => {
        if (f3 === 1) { periodes++; let s = 0, e = 0; parcourir(a3, z3, (f4, v4) => { if (f4 === 1) s = v4; if (f4 === 2) e = v4; });
          const t = maintenant / 1000; if ((!s || t >= s) && (!e || t <= e)) dedans = true; }
        if (f3 === 5) parcourir(a3, z3, (f4, v4, a4, z4) => {
          if (f4 === 2) { const r = DEC.decode(b.subarray(a4, z4)); if (ROUTES[r]) lignes.add(ROUTES[r]); }
          if (f4 === 4) { const st = DEC.decode(b.subarray(a4, z4)); for (const l in ARRETS) if (ARRETS[l] === st) lignes.add(l); }
        });
        if ((f3 === 10 || f3 === 6) && !texte) parcourir(a3, z3, (f4, v4, a4, z4) => {   // header_text, sinon description
          if (f4 === 1 && !texte) parcourir(a4, z4, (f5, v5, a5, z5) => { if (f5 === 1 && !texte) texte = DEC.decode(b.subarray(a5, z5)); });
        });
      });
      if (periodes && !dedans) active = false;
      if (active && texte) for (const l of lignes) if (!res[l]) res[l] = texte.slice(0, 160);
    });
  });
  return res;
}

/* ---------------- Fusion prévu + temps réel ---------------- */
function fusionner(prevus, reels, maintenant) {
  const utilise = new Array(prevus.length).fill(false), out = [];
  for (const t of reels.sort((x, y) => x - y)) {
    if (t < maintenant - 30000) continue;
    let meilleur = -1, ecart = 1e15;
    for (let i = 0; i < prevus.length; i++) {
      if (utilise[i]) continue;
      const d = t - prevus[i];                      // retard (positif) ou avance (négatif)
      if (d >= -6 * 60000 && d <= 15 * 60000 && Math.abs(d) < ecart) { ecart = Math.abs(d); meilleur = i; }
    }
    if (meilleur >= 0) utilise[meilleur] = true;
    out.push({ t: t, tempsReel: true });
  }
  for (let i = 0; i < prevus.length; i++) if (!utilise[i] && prevus[i] >= maintenant) out.push({ t: prevus[i], tempsReel: false });
  return out.sort((a, b) => a.t - b.t).slice(0, 6);
}

async function binaire(url) {
  const r = await fetch(url, { cf: { cacheTtl: 15, cacheEverything: true } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}

async function construire() {
  const maintenant = Date.now(), fin = maintenant + 2 * 3600000;
  const stops = new Set(Object.values(ARRETS));
  const [tr, al] = await Promise.allSettled([binaire(FLUX_TR), binaire(FLUX_ALERTES)]);
  const reels = tr.status === 'fulfilled' ? lirePassagesTR(tr.value, stops) : {};
  const alertes = al.status === 'fulfilled' ? lireAlertes(al.value, maintenant) : {};
  const lignes = {};
  for (const l in ARRETS) {
    lignes[l] = {
      passages: fusionner(passagesPrevus(ARRETS[l], maintenant, fin), reels[ARRETS[l]] || [], maintenant),
      perturbation: alertes[l] || null
    };
  }
  const P = lirePrevus();
  return {
    maj: maintenant,
    tempsReelDisponible: tr.status === 'fulfilled',
    horairesJusqua: P.jusqua,
    horairesAMettreAJour: joursEntre(ymd(...(() => { const p = partiesParis(maintenant); return [+p.year, +p.month, +p.day]; })()), P.jusqua) < 7,
    lignes: lignes
  };
}

export default {
  async fetch(request, env, ctx) {
    const entetes = {
      'Access-Control-Allow-Origin': ORIGINE_AUTORISEE,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=' + CACHE_SECONDES
    };
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: entetes });
    if (url.pathname !== '/transports') {
      return new Response(JSON.stringify({ ok: true, aide: 'Appelle /transports' }), { headers: entetes });
    }
    const cache = caches.default, cle = new Request(url.origin + '/transports');
    const enCache = await cache.match(cle);
    if (enCache) return enCache;
    try {
      const corps = JSON.stringify(await construire());
      const rep = new Response(corps, { headers: entetes });
      ctx.waitUntil(cache.put(cle, rep.clone()));
      return rep;
    } catch (e) {
      return new Response(JSON.stringify({ erreur: String(e) }), { status: 502, headers: entetes });
    }
  }
};

/**
 * Worker « ecran-salon » : les données de l'écran du salon.
 *
 *  /transports      Fil Bleu : horaires prévus + temps réel + alertes (public, open data)
 *  /agenda          Google Agenda : 14 prochains jours + anniversaires 🎂   (clé requise)
 *  /maison          Home Assistant : lumières et scènes                     (clé requise)
 *  /maison/action   Home Assistant : allumer/éteindre, lancer une scène     (clé requise)
 *
 * Réglages à saisir dans Cloudflare (Settings → Variables and Secrets) :
 *  ECRAN_CLE   (secret) mot de passe de l'écran, ajouté à l'adresse du cadre : ?cle=…
 *  GOOGLE_ICS1, GOOGLE_ICS2… (secrets) adresses secrètes au format iCal de tes Google Agenda
 *  HA_URL      (texte)  https://ha.petitgeranium.duckdns.org
 *  HA_TOKEN    (secret) jeton d'accès longue durée Home Assistant
 *  ADMIN_CLE   (secret, facultatif) mot de passe de la page admin (sinon : ECRAN_CLE)
 *  Liaison KV « REGLAGES » : stockage des réglages modifiés depuis la page admin
 *
 *  /reglages         lecture (clé écran ou admin) / enregistrement POST (clé admin)
 *  /maison/catalogue lumières, automatisations, scènes et scripts disponibles (clé admin)
 */

const ARRETS = {           // ligne → identifiant du quai dans ta direction
  'A': 'TTR:MONC-1T',      // Monconseil, vers Lycée J. Monnet
  '2': 'TTR:MAJUB-1'       // Maréchal Juin, vers CHU Trousseau
};
const ROUTES = { 'TTR:LINE:A': 'A', 'TTR:LINE:2': '2' };
const ORIGINE_AUTORISEE = '*';   // tu pourras mettre 'https://chonchon37.github.io'
const FLUX_TR = 'https://data.filbleu.fr/ws-tr/gtfs-rt/opendata/trip-updates';
const FLUX_ALERTES = 'https://data.filbleu.fr/ws-tr/gtfs-rt/opendata/service-alerts';
const FLUX_INCIDENTS = 'https://www.filbleu.fr/rss-incident.xml';   // l'info trafic du site filbleu.fr (travaux, déviations…)
const NOMS_ARRETS = { 'A': 'Monconseil', '2': 'Maréchal Juin' };
const CACHE_SECONDES = 20;
const VERSION = '14';   // à changer à chaque mise à jour du code : vide les caches

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

// Décalage Paris/UTC (en minutes) : règle européenne de l'heure d'été
// (de 1 h UTC le dernier dimanche de mars à 1 h UTC le dernier dimanche d'octobre)
function dernierDimanche(annee, mois) {          // mois 1-12, renvoie l'instant à 1 h UTC
  const fin = new Date(Date.UTC(annee, mois, 0));
  return Date.UTC(annee, mois - 1, fin.getUTCDate() - fin.getUTCDay(), 1);
}
const CACHE_ETE = {};
function decalageParis(ms) {
  const an = new Date(ms).getUTCFullYear();
  const e = CACHE_ETE[an] || (CACHE_ETE[an] = [dernierDimanche(an, 3), dernierDimanche(an, 10)]);
  return ms >= e[0] && ms < e[1] ? 120 : 60;
}
function partiesParis(ms) {
  const d = new Date(ms + decalageParis(ms) * 60000), p2 = n => (n < 10 ? '0' : '') + n;
  return { year: String(d.getUTCFullYear()), month: p2(d.getUTCMonth() + 1), day: p2(d.getUTCDate()),
    hour: p2(d.getUTCHours()), minute: p2(d.getUTCMinutes()), second: p2(d.getUTCSeconds()) };
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

/* ---------------- Info trafic du site filbleu.fr (flux RSS) ---------------- */
function decoderXml(t) {
  // le site encode deux fois (« &amp;nbsp; », « &lt;p&gt; ») : on décode en deux passes
  return decoder1(decoder1(t)).replace(/\s*\u274C\uFE0F?\s*/g, '. ').replace(/[\u26A0\uFE0F]/g, '').replace(/\s+/g, ' ').trim();
}
function decoder1(t) {
  return t.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&apos;/g, "'")
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à').replace(/&ccedil;/g, 'ç').replace(/&ecirc;/g, 'ê')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
}
// Lignes citées dans un texte : « lignes 2, 10, 72 et N1 », « ligne 2 direction CHU Trousseau, 5… », « Tram A »
function lignesCitees(t) {
  const res = new Set(), re = /\blignes?\s+/gi; let m;
  if (/\btram\s*A\b/i.test(t)) res.add('A');
  while ((m = re.exec(t))) {
    let i = re.lastIndex;
    for (;;) {
      const c = /^([0-9]{1,3}[a-z]?|[A-Z][0-9A-Za-z]{0,3})(?![\wÀ-ÿ])/.exec(t.slice(i));
      if (!c) break;
      res.add(c[1]); i += c[1].length;
      const d = /^\s+direction\s+[^,.;>]*?(?=,|\s+et\s|[.;>]|$)/i.exec(t.slice(i)); if (d) i += d[0].length;
      const sep = /^(\s*,\s*|\s+et\s+)/.exec(t.slice(i)); if (!sep) break;
      i += sep[0].length;
    }
  }
  return res;
}
function nettoyerDetail(t) {
  return t.replace(/\s*(Voir|Consulter) le plan.*$/i, '').replace(/\s*:\s*-\s*/g, ' : ').replace(/\s*-\s+du /g, ', du ').replace(/\.\s*\./g, '.')
    .replace(/([a-zé)])(?=[A-ZÉ][a-zé])/g, '$1. ').replace(/,(?=\S)/g, ', ').replace(/\s*>\s*/g, ' → ').replace(/\s+/g, ' ').trim();
}
function lireIncidents(xml, maintenant) {
  const res = {}, vus = {};
  for (const l in ARRETS) { res[l] = []; vus[l] = new Set(); }
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  for (const it of items) {
    const champ = n => { const m = new RegExp('<' + n + '[^>]*>([\\s\\S]*?)</' + n + '>').exec(it); return m ? decoderXml(m[1]) : ''; };
    const titre = champ('title'), texte = champ('description'), debut = Date.parse(champ('pubDate')) || 0;
    if (!titre || debut > maintenant + 36 * 3600000) continue;          // plus de 36 h à l'avance : pas encore utile
    const lignes = lignesCitees(titre + ' . ' + texte);
    const court = titre.replace(/^\[[^\]]*\]\s*-\s*/, '').replace(/^[^-]{2,40}\s-\s(?=\S)/, '');   // sans « [Info réseau] - » ni « Tours - »
    const cle = court.toLowerCase();
    for (const l in ARRETS) {
      if (!lignes.has(l) || vus[l].has(cle)) continue;
      vus[l].add(cle);
      res[l].push({
        titre: court.slice(0, 90),
        texte: texte.split(/Arrêt\(s\) de report|Voir le plan|Consulter le plan/i)[0].replace(/([a-zé])\.?\s*$/, '$1.').replace(/:\s*-\s*/g, ' : ').replace(/\s*-\s+du /g, ', du ').replace(/^En raison d[e'’][^,]{0,60},\s*(\S)/i, (m, c) => c.toUpperCase()).trim().slice(0, 200),
        detail: nettoyerDetail(texte.split(/Arrêt\(s\) de report/i)[0]).slice(0, 700),
        report: nettoyerDetail((texte.split(/Arrêt\(s\) de report\s*:?/i)[1] || '')).slice(0, 400),
        debut: debut,
        aVenir: debut > maintenant,
        arret: texte.indexOf(NOMS_ARRETS[l]) >= 0 || titre.indexOf(NOMS_ARRETS[l]) >= 0
      });
    }
  }
  for (const l in res) res[l].sort((a, b) => (a.aVenir - b.aVenir) || (b.arret - a.arret) || (b.debut - a.debut));
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
    out.push({ t: t, tempsReel: true, retard: meilleur >= 0 ? Math.round((t - prevus[meilleur]) / 60000) : null });
  }
  for (let i = 0; i < prevus.length; i++) if (!utilise[i] && prevus[i] >= maintenant) out.push({ t: prevus[i], tempsReel: false });
  return out.sort((a, b) => a.t - b.t).slice(0, 6);
}

async function texteDistant(url) {
  const r = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true }, headers: { 'User-Agent': 'ecran-salon (cadre photo perso)' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
async function binaire(url) {
  const r = await fetch(url, { cf: { cacheTtl: 15, cacheEverything: true } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}

async function construire() {
  const maintenant = Date.now(), fin = maintenant + 2 * 3600000;
  const stops = new Set(Object.values(ARRETS));
  const [tr, al, inc] = await Promise.allSettled([binaire(FLUX_TR), binaire(FLUX_ALERTES), texteDistant(FLUX_INCIDENTS)]);
  const reels = tr.status === 'fulfilled' ? lirePassagesTR(tr.value, stops) : {};
  const alertes = al.status === 'fulfilled' ? lireAlertes(al.value, maintenant) : {};
  let incidents = null;
  if (inc.status === 'fulfilled') { try { incidents = lireIncidents(inc.value, maintenant); } catch (e) {} }
  const lignes = {};
  for (const l in ARRETS) {
    lignes[l] = {
      passages: fusionner(passagesPrevus(ARRETS[l], maintenant, fin), reels[ARRETS[l]] || [], maintenant),
      perturbation: alertes[l] || null,
      incidents: incidents ? incidents[l] : null      // null = info trafic indisponible
    };
  }
  const P = lirePrevus();
  return {
    maj: maintenant,
    tempsReelDisponible: tr.status === 'fulfilled',
    infoTraficDisponible: !!incidents || al.status === 'fulfilled',
    horairesJusqua: P.jusqua,
    horairesAMettreAJour: joursEntre(ymd(...(() => { const p = partiesParis(maintenant); return [+p.year, +p.month, +p.day]; })()), P.jusqua) < 7,
    lignes: lignes
  };
}

/* =====================================================================
   AGENDA GOOGLE (fichier iCal secret) + ANNIVERSAIRES 🎂
   ===================================================================== */

// Date iCal → composants { y, m, d, h, mi, s, utc, jour }
function lireDateIcs(valeur, params) {
  const v = valeur.trim();
  const jour = /VALUE=DATE(?!-)/.test(params) || /^\d{8}$/.test(v);
  return {
    y: +v.slice(0, 4), m: +v.slice(4, 6), d: +v.slice(6, 8),
    h: jour ? 0 : +v.slice(9, 11), mi: jour ? 0 : +v.slice(11, 13), s: jour ? 0 : +v.slice(13, 15),
    utc: /Z$/.test(v), jour: jour
  };
}
// Composants → instant (ms). Heure « locale » = heure de Paris.
function versMs(c) {
  const t = Date.UTC(c.y, c.m - 1, c.d, c.h, c.mi, c.s);
  if (c.utc) return t;
  return t - decalageParis(t - 2 * 3600000) * 60000;
}
function dureeIso(v) {   // P1D, PT1H30M…
  const m = /P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/.exec(v || '');
  if (!m) return 0;
  return ((+m[1] || 0) * 7 * 86400 + (+m[2] || 0) * 86400 + (+m[3] || 0) * 3600 + (+m[4] || 0) * 60 + (+m[5] || 0)) * 1000;
}
function texteIcs(v) { return v.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim(); }

function lireEvenements(ics, debutFenetreYmd) {
  const evts = [];
  const blocs = ics.replace(/\r?\n[ \t]/g, '').split('BEGIN:VEVENT');
  for (let b = 1; b < blocs.length; b++) {
    const bloc = blocs[b];
    // Tri rapide : un événement unique déjà passé ne nous intéresse pas
    if (bloc.indexOf('RRULE') < 0 && bloc.indexOf('RECURRENCE-ID') < 0) {
      const p = bloc.indexOf('\nDTSTART');
      if (p >= 0) {
        const deux = bloc.indexOf(':', p), date = bloc.slice(deux + 1, deux + 9);
        if (date < debutFenetreYmd && bloc.indexOf('🎂') < 0) {
          // garder quand même les longs événements sur plusieurs jours
          const q = bloc.indexOf('\nDTEND');
          if (q < 0) continue;
          const d2 = bloc.indexOf(':', q);
          if (bloc.slice(d2 + 1, d2 + 9) < debutFenetreYmd) continue;
        }
      }
    }
    const ev = { exdates: [] };
    for (const ligne of bloc.split(/\r?\n/)) {
      if (ligne.startsWith('END:VEVENT')) break;
      const deux = ligne.indexOf(':'); if (deux < 0) continue;
      const tete = ligne.slice(0, deux), valeur = ligne.slice(deux + 1);
      const pv = tete.indexOf(';'), nom = pv < 0 ? tete : tete.slice(0, pv), params = pv < 0 ? '' : tete.slice(pv + 1);
      if (nom === 'DTSTART') ev.debut = lireDateIcs(valeur, params);
      else if (nom === 'DTEND') ev.fin = lireDateIcs(valeur, params);
      else if (nom === 'DURATION') ev.duree = dureeIso(valeur);
      else if (nom === 'SUMMARY') ev.titre = texteIcs(valeur);
      else if (nom === 'RRULE') ev.rrule = valeur;
      else if (nom === 'EXDATE') for (const x of valeur.split(',')) ev.exdates.push(versMs(lireDateIcs(x, params)));
      else if (nom === 'RECURRENCE-ID') ev.recurrence = versMs(lireDateIcs(valeur, params));
      else if (nom === 'UID') ev.uid = valeur;
      else if (nom === 'STATUS') ev.statut = valeur.trim();
    }
    if (!ev.debut) continue;
    const t0 = versMs(ev.debut);
    ev.dureeMs = ev.fin ? Math.max(0, versMs(ev.fin) - t0) : (ev.duree || (ev.debut.jour ? 86400000 : 0));
    evts.push(ev);
  }
  return evts;
}

const JOURS_ICS = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };
function lireRegle(txt) {
  const r = { freq: '', intervalle: 1, compte: 0, jusqua: 0, parJour: [], parJourMois: [], parMois: [] };
  for (const morceau of txt.split(';')) {
    const [k, v] = morceau.split('=');
    if (k === 'FREQ') r.freq = v;
    else if (k === 'INTERVAL') r.intervalle = Math.max(1, +v);
    else if (k === 'COUNT') r.compte = +v;
    else if (k === 'UNTIL') r.jusqua = versMs(lireDateIcs(v, /T/.test(v) ? '' : 'VALUE=DATE')) + (/T/.test(v) ? 0 : 86399999);
    else if (k === 'BYDAY') r.parJour = v.split(',').map(x => { const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(x); return m ? { n: m[1] ? +m[1] : 0, j: JOURS_ICS[m[2]] } : null; }).filter(Boolean);
    else if (k === 'BYMONTHDAY') r.parJourMois = v.split(',').map(Number);
    else if (k === 'BYMONTH') r.parMois = v.split(',').map(Number);
  }
  return r;
}
// Jours (en n° de jour UTC) d'un mois correspondant à BYDAY / BYMONTHDAY
function joursDuMois(y, m, r, jourDefaut) {
  const nb = new Date(Date.UTC(y, m, 0)).getUTCDate(), res = [];
  if (r.parJour.length) {
    for (const bj of r.parJour) {
      const liste = [];
      for (let d = 1; d <= nb; d++) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === bj.j) liste.push(d);
      if (!bj.n) res.push(...liste);
      else { const d = bj.n > 0 ? liste[bj.n - 1] : liste[liste.length + bj.n]; if (d) res.push(d); }
    }
  } else if (r.parJourMois.length) {
    for (const x of r.parJourMois) { const d = x > 0 ? x : nb + 1 + x; if (d >= 1 && d <= nb) res.push(d); }
  } else if (jourDefaut <= nb) res.push(jourDefaut);
  return res.sort((a, b) => a - b);
}

// Toutes les occurrences d'un événement qui touchent la fenêtre [debut, fin]
function occurrences(ev, debut, fin) {
  const s = ev.debut, res = [];
  const pousser = c => { const t = versMs(c); if (t + Math.max(ev.dureeMs, 1) > debut && t < fin) res.push(t); return t; };
  if (!ev.rrule) { pousser(s); return res; }
  const r = lireRegle(ev.rrule), ex = new Set(ev.exdates);
  const jour0 = Date.UTC(s.y, s.m - 1, s.d) / 86400000;
  let n = 0;
  const essayer = (y, m, d) => {           // renvoie false quand on peut s'arrêter
    const c = { y, m, d, h: s.h, mi: s.mi, s: s.s, utc: s.utc, jour: s.jour };
    if (Date.UTC(y, m - 1, d) / 86400000 < jour0) return true;
    const t = versMs(c);
    if (r.jusqua && t > r.jusqua) return false;
    n++;
    if (r.compte && n > r.compte) return false;
    if (t >= fin) return false;
    if (!ex.has(t)) pousser(c);
    return true;
  };
  const sautPossible = !r.compte;
  const finJour = fin / 86400000 + 2, debutJour = debut / 86400000 - 3;
  if (r.freq === 'DAILY') {
    let k = 0;
    if (sautPossible && debutJour > jour0) k = Math.floor((debutJour - jour0) / r.intervalle);
    for (; ; k++) {
      const jj = jour0 + k * r.intervalle; if (jj > finJour) break;
      const dt = new Date(jj * 86400000);
      if (r.parJour.length && !r.parJour.some(b => b.j === dt.getUTCDay())) continue;
      if (r.parMois.length && r.parMois.indexOf(dt.getUTCMonth() + 1) < 0) continue;
      if (!essayer(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())) break;
    }
  } else if (r.freq === 'WEEKLY') {
    const jours = r.parJour.length ? r.parJour.map(b => b.j) : [new Date(jour0 * 86400000).getUTCDay()];
    const lundi0 = jour0 - ((new Date(jour0 * 86400000).getUTCDay() + 6) % 7);
    let k = 0;
    if (sautPossible && debutJour > lundi0) k = Math.floor((debutJour - lundi0) / 7 / r.intervalle);
    let continuer = true;
    for (; continuer; k++) {
      const lundi = lundi0 + k * 7 * r.intervalle; if (lundi > finJour) break;
      const ordre = jours.map(j => (j + 6) % 7).sort((a, b) => a - b);
      for (const o of ordre) {
        const dt = new Date((lundi + o) * 86400000);
        if (!essayer(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())) { continuer = false; break; }
      }
    }
  } else if (r.freq === 'MONTHLY') {
    let k = 0;
    const moisDebut = new Date(debut).getUTCFullYear() * 12 + new Date(debut).getUTCMonth() - 1;
    const mois0 = s.y * 12 + (s.m - 1);
    if (sautPossible && moisDebut > mois0) k = Math.floor((moisDebut - mois0) / r.intervalle);
    let continuer = true;
    for (; continuer; k++) {
      const mm = mois0 + k * r.intervalle, y = Math.floor(mm / 12), m = mm % 12 + 1;
      if (Date.UTC(y, m - 1, 1) > fin + 86400000) break;
      for (const d of joursDuMois(y, m, r, s.d)) if (!essayer(y, m, d)) { continuer = false; break; }
    }
  } else if (r.freq === 'YEARLY') {
    let k = 0;
    const anDebut = new Date(debut).getUTCFullYear() - 1;
    if (sautPossible && anDebut > s.y) k = Math.floor((anDebut - s.y) / r.intervalle);
    let continuer = true;
    for (; continuer; k++) {
      const y = s.y + k * r.intervalle;
      if (Date.UTC(y, 0, 1) > fin + 86400000) break;
      const moisListe = r.parMois.length ? r.parMois : [s.m];
      for (const m of moisListe) {
        const jours = (r.parJour.length || r.parJourMois.length) ? joursDuMois(y, m, r, s.d) : (s.d <= new Date(Date.UTC(y, m, 0)).getUTCDate() ? [s.d] : []);
        for (const d of jours) if (!essayer(y, m, d)) { continuer = false; break; }
        if (!continuer) break;
      }
    }
  }
  return res;
}

function ymdParis(ms) { const p = partiesParis(ms); return p.year + p.month + p.day; }
function minuitParis(ms) {
  const p = partiesParis(ms);
  return versMs({ y: +p.year, m: +p.month, d: +p.day, h: 0, mi: 0, s: 0, utc: false });
}

async function construireAgenda(env) {
  // Tous les agendas déclarés : GOOGLE_ICS, GOOGLE_ICS1, GOOGLE_ICS2… (autant que tu veux)
  const cles = Object.keys(env).filter(k => /^GOOGLE_ICS\d*$/.test(k) && env[k]).sort();
  const adresses = cles.map(k => env[k]);
  if (!adresses.length) throw new Error('Aucun agenda : ajoute GOOGLE_ICS1 dans les réglages du Worker');
  const reponses = await Promise.allSettled(adresses.map(u => fetch(u, { cf: { cacheTtl: 300 } }).then(r => { if (!r.ok) throw new Error('Google Agenda a répondu ' + r.status); return r.text(); })));
  const sources = [];
  reponses.forEach((x, i) => { if (x.status === 'fulfilled') sources.push({ cle: cles[i], texte: x.value, nom: ((/X-WR-CALNAME:(.*)/.exec(x.value) || [])[1] || '').trim() }); });
  if (!sources.length) throw new Error(String(reponses[0].reason && reponses[0].reason.message || 'agendas illisibles'));
  const agendasEnErreur = reponses.length - sources.length;
  const maintenant = Date.now(), aujourdhui = minuitParis(maintenant);
  const finAgenda = aujourdhui + 15 * 86400000, finAnniv = aujourdhui + 367 * 86400000;
  let evts = [];
  for (const src of sources) {
    const liste = lireEvenements(src.texte, ymdParis(aujourdhui - 40 * 86400000));
    for (const e of liste) e.agenda = src.cle;
    evts = evts.concat(liste);
  }

  // Occurrences modifiées (RECURRENCE-ID) : elles remplacent l'occurrence d'origine
  const remplacees = {};
  for (const e of evts) if (e.recurrence && e.uid) (remplacees[e.uid] = remplacees[e.uid] || new Set()).add(e.recurrence);

  const agenda = [], anniversaires = [];
  for (const e of evts) {
    const titre = e.titre || '(sans titre)';
    const estAnniv = titre.indexOf('🎂') === 0;
    if (e.statut === 'CANCELLED') continue;
    const fenetreFin = estAnniv ? finAnniv : finAgenda;
    let liste = occurrences(e, aujourdhui, fenetreFin);
    if (!e.recurrence && e.uid && remplacees[e.uid]) liste = liste.filter(t => !remplacees[e.uid].has(t));
    for (const t of liste) {
      if (estAnniv) {
        let nom = titre.replace(/^🎂\s*/, '');
        const an = /\b(19\d\d|20\d\d)\b/.exec(nom);
        nom = nom.replace(/\(?\b(19\d\d|20\d\d)\b\)?/, '').replace(/\s{2,}/g, ' ').trim();
        anniversaires.push({ nom: nom, date: t, annee: an ? +an[1] : 0 });
      } else {
        agenda.push({ debut: t, fin: t + e.dureeMs, journee: !!e.debut.jour, titre: titre, agenda: e.agenda });
      }
    }
  }
  agenda.sort((a, b) => a.debut - b.debut);
  // même événement présent dans deux agendas (invitation partagée) : on ne le garde qu'une fois
  // (s'il est dans deux agendas différents, il est marqué « commun »)
  const dejaVu = new Map();
  for (let i = agenda.length - 1; i >= 0; i--) {
    const k = agenda[i].debut + '|' + agenda[i].titre, autre = dejaVu.get(k);
    if (autre) { if (autre.agenda !== agenda[i].agenda) autre.agenda = 'commun'; agenda.splice(i, 1); }
    else dejaVu.set(k, agenda[i]);
  }
  anniversaires.sort((a, b) => a.date - b.date);
  // un anniversaire n'apparaît qu'une fois (le prochain)
  const vus = new Set(), annivUniques = [];
  for (const a of anniversaires) { if (vus.has(a.nom)) continue; vus.add(a.nom); annivUniques.push(a); }
  return { maj: maintenant, aujourdhui: aujourdhui, agendas: sources.map(x => ({ cle: x.cle, nom: x.nom })), agendasEnErreur: agendasEnErreur, evenements: agenda.slice(0, 200), anniversaires: annivUniques.slice(0, 12) };
}

/* =====================================================================
   HOME ASSISTANT
   ===================================================================== */
function haUrl(env, chemin) {
  if (!env.HA_URL || !env.HA_TOKEN) throw new Error('HA_URL ou HA_TOKEN manquant dans les réglages du Worker');
  return env.HA_URL.replace(/\/+$/, '') + chemin;
}
// Lumières masquées par défaut (les « segments » des rubans LED)
const LUMIERES_MASQUEES = /segment/i;

/* =====================================================================
   RÉGLAGES (modifiables depuis la page admin, stockés dans Cloudflare KV)
   ===================================================================== */
const SLIDES_CONNUES = { accueil: 'Accueil', meteo: 'Météo', transports: 'Transports', agenda: 'Agenda', maison: 'Maison', anniversaires: 'Anniversaires' };
const REGLAGES_DEFAUT = {
  rotation: {
    pause: 90,
    slides: [
      { id: 'accueil', actif: true, duree: 40 }, { id: 'meteo', actif: true, duree: 30 },
      { id: 'transports', actif: true, duree: 30 }, { id: 'agenda', actif: true, duree: 30 },
      { id: 'maison', actif: true, duree: 30 }, { id: 'anniversaires', actif: true, duree: 30 }
    ],
    // Écran fixe selon l'heure (jours : 0 = dimanche … 6 = samedi)
    plages: [{ debut: '07:00', fin: '09:00', jours: [1, 2, 3, 4, 5], page: 'transports' }]
  },
  theme: { mode: 'auto', nuitDebut: 19, nuitFin: 7 },
  veille: { actif: true, debut: '23:00', fin: '07:00', reveil: 120 },
  transports: { A: { actif: true, marche: 7 }, '2': { actif: true, marche: 9 } },
  agenda: { personnes: { moi: 'Nico', flo: 'Flo' }, agendas: { GOOGLE_ICS1: 'flo', GOOGLE_ICS2: 'moi', GOOGLE_ICS3: 'nous' } },
  maison: { lumieres: [], modes: ['automation.apero', 'automation.all_cine', 'special.tout_eteindre'], noms: { 'automation.apero': 'Apéro', 'automation.all_cine': 'Ciné' } },
  message: ''
};
const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
const texte = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);

// Ne garde que des valeurs valides : rien d'autre ne peut être enregistré
function nettoyerReglages(r) {
  r = r && typeof r === 'object' ? r : {};
  const D = REGLAGES_DEFAUT, res = {};
  const rot = r.rotation || {};
  const vues = new Set(), slides = [];
  for (const s of Array.isArray(rot.slides) ? rot.slides : []) {
    if (!s || !SLIDES_CONNUES[s.id] || vues.has(s.id)) continue;
    vues.add(s.id);
    const actif = s.actif !== false;
    // onglet = page visible dans la barre du bas même si elle n'est pas dans la rotation
    slides.push({ id: s.id, actif: actif, onglet: actif || (s.onglet === undefined ? false : !!s.onglet), duree: entier(s.duree, 5, 600, 30) });
  }
  for (const s of D.rotation.slides) if (!vues.has(s.id)) slides.push(Object.assign({}, s));
  if (!slides.some(s => s.actif)) slides[0].actif = true;
  const heure = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : null;
  const plages = [];
  for (const p of Array.isArray(rot.plages) ? rot.plages : (rot.plages === undefined ? D.rotation.plages : [])) {
    if (!p || !SLIDES_CONNUES[p.page]) continue;
    const debut = heure(p.debut), fin = heure(p.fin);
    if (!debut || !fin || debut === fin) continue;
    const jours = [...new Set((Array.isArray(p.jours) ? p.jours : []).map(Number).filter(j => j >= 0 && j <= 6 && Number.isInteger(j)))].sort();
    if (jours.length) plages.push({ debut, fin, jours, page: p.page });
    if (plages.length >= 8) break;
  }
  res.rotation = { pause: entier(rot.pause, 10, 600, D.rotation.pause), slides: slides, plages: plages };
  const th = r.theme || {};
  res.theme = {
    mode: ['auto', 'soleil', 'jour', 'nuit'].indexOf(th.mode) >= 0 ? th.mode : 'auto',
    nuitDebut: entier(th.nuitDebut, 0, 23, D.theme.nuitDebut), nuitFin: entier(th.nuitFin, 0, 23, D.theme.nuitFin)
  };
  const ve = r.veille || {};
  const hv = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : null;
  res.veille = {
    actif: ve.actif === undefined ? D.veille.actif : !!ve.actif,
    debut: hv(ve.debut) || D.veille.debut, fin: hv(ve.fin) || D.veille.fin,
    reveil: entier(ve.reveil, 15, 1800, D.veille.reveil)
  };
  if (res.veille.debut === res.veille.fin) res.veille.actif = false;
  const tr = r.transports || {};
  res.transports = {};
  for (const l of Object.keys(D.transports)) {
    const x = tr[l] || {};
    res.transports[l] = { actif: x.actif !== false, marche: entier(x.marche, 0, 60, D.transports[l].marche) };
  }
  const ag = r.agenda || {}, pers = ag.personnes || {};
  res.agenda = {
    personnes: { moi: texte(pers.moi, 20) || D.agenda.personnes.moi, flo: texte(pers.flo, 20) || D.agenda.personnes.flo },
    agendas: Object.assign({}, D.agenda.agendas)
  };
  const agd = ag.agendas && typeof ag.agendas === 'object' ? ag.agendas : {};
  for (const k of Object.keys(agd)) if (/^GOOGLE_ICS\d*$/.test(k) && ['moi', 'flo', 'nous'].indexOf(agd[k]) >= 0) res.agenda.agendas[k] = agd[k];
  const ma = r.maison || {};
  res.maison = {
    lumieres: (Array.isArray(ma.lumieres) ? ma.lumieres : []).filter(x => /^light\.[a-z0-9_]+$/.test(x)).slice(0, 8),
    modes: (Array.isArray(ma.modes) ? ma.modes : D.maison.modes).filter(x => /^(automation|scene|script)\.[a-z0-9_]+$/.test(x) || x === 'special.tout_eteindre').slice(0, 5),
    noms: {}
  };
  const noms = ma.noms && typeof ma.noms === 'object' ? ma.noms : D.maison.noms;
  for (const id of res.maison.modes) { const n = texte(noms[id], 24); if (n) res.maison.noms[id] = n; }
  res.message = texte(r.message, 140);
  return res;
}
let REGLAGES_MEMOIRE = null, REGLAGES_LUS = 0;
async function lireReglages(env) {
  if (REGLAGES_MEMOIRE && Date.now() - REGLAGES_LUS < 30000) return REGLAGES_MEMOIRE;
  let brut = null;
  if (env.REGLAGES) { try { brut = await env.REGLAGES.get('reglages', 'json'); } catch (e) {} }
  const res = { reglages: nettoyerReglages(brut ? brut.reglages : REGLAGES_DEFAUT), maj: brut ? brut.maj : 0, stockage: !!env.REGLAGES };
  REGLAGES_MEMOIRE = res; REGLAGES_LUS = Date.now();
  return res;
}
async function ecrireReglages(env, corps) {
  if (!env.REGLAGES) throw new Error('Stockage des réglages non configuré (liaison KV « REGLAGES » manquante)');
  const propre = nettoyerReglages(corps), maj = Date.now();
  await env.REGLAGES.put('reglages', JSON.stringify({ reglages: propre, maj: maj }));
  REGLAGES_MEMOIRE = { reglages: propre, maj: maj, stockage: true }; REGLAGES_LUS = Date.now();
  return REGLAGES_MEMOIRE;
}

/* =====================================================================
   HOME ASSISTANT (suite)
   ===================================================================== */
async function etatsHA(env) {
  const r = await fetch(haUrl(env, '/api/states'), { headers: { Authorization: 'Bearer ' + env.HA_TOKEN } });
  if (!r.ok) throw new Error('Home Assistant a répondu ' + r.status);
  return r.json();
}
function lumiere(e) {
  const b = e.attributes && e.attributes.brightness;
  return { id: e.entity_id, nom: e.attributes.friendly_name, allumee: e.state === 'on', dispo: e.state !== 'unavailable', luminosite: e.state === 'on' && b ? Math.round(b / 2.55) : null };
}
const NOM_SPECIAL = { 'special.tout_eteindre': 'Tout éteindre' };

async function construireMaison(env) {
  const [etats, R] = await Promise.all([etatsHA(env), lireReglages(env)]);
  const parId = {}; for (const e of etats) parId[e.entity_id] = e;
  const choix = R.reglages.maison;
  let lumieres;
  if (choix.lumieres.length) {
    lumieres = choix.lumieres.map(id => parId[id]).filter(e => e && e.attributes && e.attributes.friendly_name).map(lumiere);
  } else {
    lumieres = etats.filter(e => e.entity_id.startsWith('light.') && e.attributes && e.attributes.friendly_name && !LUMIERES_MASQUEES.test(e.attributes.friendly_name)).map(lumiere);
    lumieres.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }
  const scenes = [];
  for (const id of choix.modes) {
    const e = parId[id];
    if (!e && !NOM_SPECIAL[id]) continue;
    const t = e && e.attributes && (e.attributes.last_triggered || (id.startsWith('scene.') && e.state !== 'unknown' ? e.state : null));
    scenes.push({ id: id, nom: choix.noms[id] || NOM_SPECIAL[id] || e.attributes.friendly_name || id, derniere: t ? Date.parse(t) || null : null });
  }
  return { maj: Date.now(), lumieres: lumieres, scenes: scenes };
}
// Liste de tout ce qui peut être choisi dans la page admin
async function catalogueMaison(env) {
  const etats = await etatsHA(env), res = { lumieres: [], modes: [{ id: 'special.tout_eteindre', nom: 'Tout éteindre (intégré)', type: 'intégré' }] };
  for (const e of etats) {
    const nom = e.attributes && e.attributes.friendly_name;
    if (!nom) continue;
    const domaine = e.entity_id.split('.')[0];
    if (domaine === 'light') res.lumieres.push({ id: e.entity_id, nom: nom, segment: LUMIERES_MASQUEES.test(nom), dispo: e.state !== 'unavailable' });
    else if (domaine === 'automation' || domaine === 'scene' || domaine === 'script') res.modes.push({ id: e.entity_id, nom: nom, type: { automation: 'automatisation', scene: 'scène', script: 'script' }[domaine] });
  }
  const tri = (a, b) => a.nom.localeCompare(b.nom, 'fr');
  res.lumieres.sort(tri); res.modes.sort((a, b) => a.type === 'intégré' ? -1 : b.type === 'intégré' ? 1 : tri(a, b));
  return res;
}
async function actionMaison(env, corps) {
  const id = String(corps.id || ''), R = await lireReglages(env);
  let service, donnees = { entity_id: id };
  if (corps.action === 'basculer' && /^light\.[a-z0-9_]+$/.test(id)) service = '/api/services/light/toggle';
  else if (corps.action === 'scene' && R.reglages.maison.modes.indexOf(id) >= 0) {     // seuls les modes choisis sont autorisés
    if (id === 'special.tout_eteindre') { service = '/api/services/light/turn_off'; donnees = { entity_id: 'all' }; }
    else if (id.startsWith('automation.')) { service = '/api/services/automation/trigger'; donnees = { entity_id: id, skip_condition: true }; }
    else if (id.startsWith('scene.')) service = '/api/services/scene/turn_on';
    else if (id.startsWith('script.')) service = '/api/services/script/turn_on';
  }
  if (!service) throw new Error('Action refusée');
  const r = await fetch(haUrl(env, service), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.HA_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(donnees)
  });
  if (!r.ok) throw new Error('Home Assistant a répondu ' + r.status);
  return { ok: true };
}

/* =====================================================================
   AIGUILLAGE
   ===================================================================== */
function repondre(objet, statut, entetes) {
  return new Response(JSON.stringify(objet), { status: statut || 200, headers: entetes });
}
async function avecCache(cle, secondes, fabriquer, entetes, ctx) {
  const cache = caches.default, req = new Request('https://cache.ecran-salon.local/v' + VERSION + '/' + cle);
  const enCache = await cache.match(req);
  if (enCache) return new Response(enCache.body, { headers: entetes });
  const corps = JSON.stringify(await fabriquer());
  ctx.waitUntil(cache.put(req, new Response(corps, { headers: { 'Cache-Control': 'max-age=' + secondes } })));
  return new Response(corps, { headers: entetes });
}

export default {
  async fetch(request, env, ctx) {
    const entetes = {
      'Access-Control-Allow-Origin': ORIGINE_AUTORISEE,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    };
    const url = new URL(request.url), chemin = url.pathname.replace(/\/+$/, '') || '/';
    if (request.method === 'OPTIONS') return new Response(null, { headers: entetes });
    try {
      if (chemin === '/transports') return await avecCache('transports', CACHE_SECONDES, construire, entetes, ctx);

      // Tout le reste est privé
      const cle = url.searchParams.get('cle') || '';
      const cleAdmin = env.ADMIN_CLE || env.ECRAN_CLE;
      if (!env.ECRAN_CLE) return repondre({ erreur: 'ECRAN_CLE manquant dans les réglages du Worker' }, 503, entetes);
      const estEcran = cle === env.ECRAN_CLE, estAdmin = !!cleAdmin && cle === cleAdmin;
      if (!estEcran && !estAdmin) return repondre({ erreur: 'Clé absente ou incorrecte' }, 401, entetes);

      if (chemin === '/agenda') return await avecCache('agenda', 300, () => construireAgenda(env), entetes, ctx);
      if (chemin === '/maison') return repondre(await construireMaison(env), 200, entetes);
      if (chemin === '/maison/action' && request.method === 'POST') {
        let corps = {};
        try { corps = JSON.parse(await request.text()); } catch (e) {}
        return repondre(await actionMaison(env, corps), 200, entetes);
      }
      if (chemin === '/reglages' && request.method === 'GET') {
        const R = await lireReglages(env);
        return repondre({ reglages: R.reglages, maj: R.maj, stockage: R.stockage, admin: estAdmin }, 200, entetes);
      }
      // Réservé à l'admin
      if (chemin === '/reglages' && request.method === 'POST') {
        if (!estAdmin) return repondre({ erreur: 'Clé admin requise' }, 403, entetes);
        let corps = null;
        try { corps = JSON.parse(await request.text()); } catch (e) {}
        if (!corps) return repondre({ erreur: 'Réglages illisibles' }, 400, entetes);
        const R = await ecrireReglages(env, corps);
        return repondre({ ok: true, reglages: R.reglages, maj: R.maj }, 200, entetes);
      }
      if (chemin === '/maison/catalogue') {
        if (!estAdmin) return repondre({ erreur: 'Clé admin requise' }, 403, entetes);
        return repondre(await catalogueMaison(env), 200, entetes);
      }
      return repondre({ ok: true, adresses: ['/transports', '/agenda', '/maison', '/reglages'] }, 200, entetes);
    } catch (e) {
      return repondre({ erreur: String(e.message || e) }, 502, entetes);
    }
  }
};

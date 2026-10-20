#!/usr/bin/env python3
"""Régénère horaires.txt (horaires prévus Fil Bleu) à partir du GTFS officiel.

Lancé chaque semaine par GitHub (.github/workflows/horaires.yml). Le Worker Cloudflare
lit le fichier publié sur GitHub Pages ; s'il est absent ou illisible, il garde
les horaires écrits dans son propre code.

Format produit (lu par lirePrevus() dans worker/worker.js) :
  debut=AAAAMMJJ        premier jour couvert
  jusqua=AAAAMMJJ       fin de validité du GTFS
  arret=<stop_id>       puis, pour cet arrêt :
  jours=0112…           n° de grille (0-9 puis a-z) pour chaque jour depuis « debut »
  g=341,19,18…          une grille = minutes depuis minuit, en écarts successifs
"""
import csv, io, sys, zipfile, datetime, urllib.request
from zoneinfo import ZoneInfo

URL = 'https://data.tours-metropole.fr/api/v2/catalog/datasets/horaires-temps-reel-gtfsrt-reseau-filbleu-tmvl/alternative_exports/filbleu_gtfszip'
# arrêt (quai dans ta direction) → ligne (route_short_name)
ARRETS = {'TTR:MONC-1T': 'A', 'TTR:MAJUB-1': '2'}
JOURS_MAX = 120          # on ne couvre pas plus de 4 mois d'un coup (taille du fichier)
SYMBOLES = '0123456789abcdefghijklmnopqrstuvwxyz'


def lire(z, nom):
    with z.open(nom) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding='utf-8-sig'))


def minutes(hms):
    # arrondi à la minute la plus proche (le tram a des horaires à la seconde)
    p = [int(x) for x in hms.strip().split(':')] + [0, 0]
    return (p[0] * 3600 + p[1] * 60 + p[2] + 30) // 60


def jour(s):
    return datetime.date(int(s[:4]), int(s[4:6]), int(s[6:8]))


def main(source, sortie, aujourdhui=None):
    donnees = open(source, 'rb').read() if source != '-' else urllib.request.urlopen(URL, timeout=120).read()
    z = zipfile.ZipFile(io.BytesIO(donnees))
    noms = set(z.namelist())

    lignes = {r['route_id']: r['route_short_name'].strip() for r in lire(z, 'routes.txt')}
    voulues = set(ARRETS.values())
    trajets = {}
    for r in lire(z, 'trips.txt'):
        court = lignes.get(r['route_id'])
        if court in voulues:
            trajets[r['trip_id']] = (court, r['service_id'])

    # passages : arrêt → service → liste de minutes
    passages = {a: {} for a in ARRETS}
    for r in lire(z, 'stop_times.txt'):
        a = r['stop_id']
        if a not in ARRETS:
            continue
        t = trajets.get(r['trip_id'])
        if not t or t[0] != ARRETS[a] or r.get('pickup_type', '0').strip() == '1':
            continue
        passages[a].setdefault(t[1], []).append(minutes(r['departure_time'] or r['arrival_time']))

    # calendrier : service → jours actifs
    regles, ajouts, retraits = {}, {}, {}
    if 'calendar.txt' in noms:
        for r in lire(z, 'calendar.txt'):
            regles[r['service_id']] = (jour(r['start_date']), jour(r['end_date']),
                                       [r[k] == '1' for k in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')])
    if 'calendar_dates.txt' in noms:
        for r in lire(z, 'calendar_dates.txt'):
            (ajouts if r['exception_type'].strip() == '1' else retraits).setdefault(jour(r['date']), set()).add(r['service_id'])

    fins = [f for (_, f, _) in regles.values()] + list(ajouts.keys())
    if not fins:
        sys.exit('GTFS sans calendrier lisible')
    fin = max(fins)
    if 'feed_info.txt' in noms:
        for r in lire(z, 'feed_info.txt'):
            if r.get('feed_end_date', '').strip():
                fin = max(fin, jour(r['feed_end_date'].strip()))

    debut = aujourdhui or datetime.datetime.now(ZoneInfo('Europe/Paris')).date()
    nb = min((fin - debut).days + 1, JOURS_MAX)
    if nb < 7:
        sys.exit('GTFS périmé ou presque : fin de validité le %s' % fin)

    def actifs(d):
        s = {sid for sid, (a, b, sem) in regles.items() if a <= d <= b and sem[d.weekday()]}
        return (s | ajouts.get(d, set())) - retraits.get(d, set())

    out = ['debut=' + debut.strftime('%Y%m%d'), 'jusqua=' + (fin + datetime.timedelta(days=1)).strftime('%Y%m%d')]
    total = 0
    for a in ARRETS:
        grilles, index, codes = [], {}, []
        for i in range(nb):
            d = debut + datetime.timedelta(days=i)
            g = tuple(sorted({m for sid in actifs(d) for m in passages[a].get(sid, [])}))
            if g not in index:
                index[g] = len(grilles)
                grilles.append(g)
            if index[g] >= len(SYMBOLES):
                sys.exit('trop de grilles différentes pour ' + a)
            codes.append(SYMBOLES[index[g]])
        out.append('arret=' + a)
        out.append('jours=' + ''.join(codes))
        for g in grilles:
            ecarts, prec = [], 0
            for m in g:
                ecarts.append(str(m - prec)); prec = m
            out.append('g=' + ','.join(ecarts))
        total += sum(len(g) for g in grilles)
    if total == 0:
        sys.exit('aucun passage trouvé : les identifiants d\'arrêt ont peut-être changé')
    open(sortie, 'w').write('\n'.join(out) + '\n')
    print('écrit', sortie, ':', nb, 'jours depuis', debut, '— GTFS valable jusqu\'au', fin)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '-', sys.argv[2] if len(sys.argv) > 2 else 'horaires.txt')

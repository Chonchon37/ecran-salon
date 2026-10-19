# Écran du salon

Tableau de bord mural pour un cadre photo Frameo (Android 6, 1280×800), affiché avec Fully Kiosk Browser.

| Fichier | Rôle |
|---|---|
| `index.html` | Coquille : onglets, rotation toutes les 30 s, horloge, thème jour/nuit, rechargement chaque heure |
| `accueil.html` | Résumé : bonjour, météo, prochains départs, à venir, anniversaire, scènes |
| `meteo.html` | Météo Tours Nord (Open-Meteo, vraies données) |
| `transports.html` | Tram A Monconseil et ligne 2 Maréchal Juin, temps réel Fil Bleu |
| `agenda.html` | Semaine à venir (2 agendas Google) |
| `maison.html` | Lumières et modes Home Assistant |
| `admin.html` | Page de réglages (navigateur, clé requise) |
| `anniversaires.html` | Prochains anniversaires (événements 🎂) |

Réglages : bloc `CONFIG` en haut de chaque fichier. Aucune clé d'API ici : elles restent dans les Workers Cloudflare.

Réglages modifiables sans toucher au code : https://chonchon37.github.io/ecran-salon/admin.html (stockés dans Cloudflare KV).

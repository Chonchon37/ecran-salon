# Écran du salon

Tableau de bord mural pour un cadre photo Frameo (Android 6, 1280×800), affiché avec Fully Kiosk Browser.

| Fichier | Rôle |
|---|---|
| `index.html` | Coquille : onglets, rotation toutes les 30 s, horloge, thème jour/nuit, rechargement chaque heure |
| `accueil.html` | Résumé : bonjour, météo, prochains départs, à venir, anniversaire, scènes |
| `meteo.html` | Météo Tours Nord (Open-Meteo, vraies données) |
| `transports.html` | Tram A Monconseil et ligne 2 Maréchal Juin (exemple pour l'instant) |
| `agenda.html` | Semaine à venir (exemple pour l'instant) |
| `maison.html` | Scènes et lumières Home Assistant (exemple pour l'instant) |
| `anniversaires.html` | Prochains anniversaires (exemple pour l'instant) |

Réglages : bloc `CONFIG` en haut de chaque fichier. Aucune clé d'API ici : elles restent dans les Workers Cloudflare.

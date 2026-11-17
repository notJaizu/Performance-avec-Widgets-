# Performance Widgets

Application de bureau complète et installable qui surveille les **performances de votre PC en temps réel** avec des **widgets**, un **thème personnalisable** et une **alerte sonore de surcharge** activable/désactivable.

## Captures des fonctionnalités

- ✅ Widgets temps réel : Processeur (CPU), Mémoire (RAM), Disque, Réseau (débit instantané), Batterie, Carte graphique (GPU), Infos système
- ✅ Jauges circulaires et valeurs numériques mises à jour toutes les secondes
- ✅ Thème sombre / clair / système, avec choix de la couleur d'accent
- ✅ Alerte sonore (bip d'alarme) lorsque le PC est en surcharge, activable/désactivable
- ✅ Seuils de surcharge personnalisables (CPU et RAM en %)
- ✅ Bandeau d'alerte visuel + mise en surbrillance des widgets en cas de dépassement
- ✅ Installable : AppImage, .deb (Linux), .dmg (macOS), .exe/NSIS (Windows)

## Prérequis

- [Node.js](https://nodejs.org/) (version 18 ou plus récente)
- npm (installé avec Node.js)
- Une connexion internet pour le premier `npm install` (télécharge le binaire Electron)

## Installation et lancement (développement)

```bash
# Cloner / ouvrir le dossier du projet
cd Performance-avec-Widgets-

# Installer les dépendances
npm install

# Lancer l'application en mode développement
npm start
```

## Construire les installeurs (production)

```bash
# Créer un dossier d'installation non signé
npm run pack

# Générer les installeurs plateforme (dans le dossier dist/)
npm run dist
```

Résultats selon votre système :
- **Linux** : `.AppImage` et `.deb` dans `dist/`
- **Windows** : `.exe` (installeur NSIS) dans `dist/`
- **macOS** : `.dmg` dans `dist/`

Puis installez le fichier généré sur votre PC comme n'importe quel logiciel.

## Comment ça marche

| Fichier | Rôle |
|---------|------|
| `main.js` | Processus principal Electron + collecte des métriques système via `systeminformation` |
| `preload.js` | Pont sécurisé (contextBridge) entre le processus principal et l'interface |
| `renderer/index.html` | Structure de l'interface (barre d'état, panneau paramètres, grille de widgets) |
| `renderer/style.css` | Thèmes (sombre/clair/système), jauges, animations, surcharge visuelle |
| `renderer/app.js` | Logique temps réel, détection de surcharge, son d'alerte Web Audio API |
| `assets/icon.png` | Icône de l'application |

Les métriques sont récoltées avec [systeminformation](https://github.com/systeminformation/systeminformation), une bibliothèque Node.js robuste qui lit le matériel réel (CPU, RAM, disques, réseau, batterie, GPU, température, OS).

## Personnalisation

Ouvrez le panneau **Paramètres** (⚙️ en haut à droite) pour :
- Choisir le thème (Sombre, Clair ou Suivre le système)
- Changer la couleur d'accent
- Activer/désactiver l'alerte sonore de surcharge
- Régler les seuils de déclenchement (processeur et mémoire, en %)
- Ajuster l'intervalle de rafraîchissement

Tous les réglages sont mémorisés localement.

## Licence

MIT

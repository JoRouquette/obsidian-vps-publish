# Progressive Web App (PWA)

## Purpose

Le support PWA permet à l'application Angular de fonctionner comme une application installable avec capacités offline. Les utilisateurs peuvent :

- Installer l'app sur leur écran d'accueil (mobile/desktop)
- Bénéficier d'un chargement rapide grâce au cache des assets
- Recevoir des notifications de mise à jour de l'application

## When to Use

- **Production uniquement** : Le service worker est activé uniquement en build production
- **Pas en SSR** : Le SW ne s'exécute jamais côté serveur (Node.js)
- **Pas en développement** : Désactivé via `isDevMode()` pour éviter les conflits de cache

## Key Concepts

### Architecture

```
┌─────────────────┐
│   Browser       │
│ ┌─────────────┐ │
│ │ Angular App │ │
│ └──────┬──────┘ │
│        │        │
│ ┌──────▼──────┐ │
│ │ ngsw-worker │ │  ← Service Worker (prod only)
│ └──────┬──────┘ │
│        │        │
└────────┼────────┘
         │
┌────────▼────────┐
│   Cache API     │
│ ┌─────────────┐ │
│ │ App Shell   │ │  ← prefetch: index.html, JS, CSS
│ │ Assets      │ │  ← lazy: images, fonts, icons
│ │ Data Groups │ │  ← freshness: /content, /_manifest.json
│ └─────────────┘ │
└─────────────────┘
```

### Fichiers clés

| Fichier                | Rôle                                           |
| ---------------------- | ---------------------------------------------- |
| `ngsw-config.json`     | Configuration du cache et des stratégies       |
| `manifest.webmanifest` | Métadonnées PWA (nom, icônes, thème)           |
| `assets/icons/`        | Icônes PWA pour différentes tailles            |
| `app.config.ts`        | `provideServiceWorker()` pour l'enregistrement |
| `sw-update.service.ts` | Gestion des mises à jour                       |

### Stratégies de cache

| Groupe           | Stratégie | TTL      | Usage                                 |
| ---------------- | --------- | -------- | ------------------------------------- |
| `app`            | prefetch  | ∞        | Shell de l'app (JS/CSS hashés)        |
| `assets`         | lazy      | ∞        | Images, fonts statiques               |
| `manifest`       | freshness | 7 jours  | `/content/_manifest.json` - dynamique |
| `content-pages`  | freshness | 30 jours | `/content/**` - pages HTML            |
| `backend-assets` | freshness | 365 j    | `/assets/**` - médias publiés         |
| `api-config`     | freshness | 1h       | `/api/config`, `/public-config`       |

**Pourquoi `freshness` pour le contenu ?**  
Le contenu publié peut changer à tout moment. La stratégie `freshness` essaie le réseau d'abord, puis tombe sur le cache si offline. Cela évite de "figer" du contenu périmé.

### Content Versioning (Cache Invalidation)

Pour invalider les caches lors d'une mise à jour de contenu sans hack (suppression de caches ngsw), le système utilise un paramètre de version dans les URLs :

```
/content/_manifest.json?cv=abc123def456
/content/my-page.html?cv=abc123def456
```

**Composants impliqués :**

| Composant                   | Rôle                                               |
| --------------------------- | -------------------------------------------------- |
| `ContentVersionService`     | Maintient la version actuelle (localStorage + SSE) |
| `contentVersionInterceptor` | Ajoute `?cv=version` aux requêtes de contenu       |
| `/_content-version.json`    | Endpoint backend retournant la version courante    |
| `/events/content`           | SSE pour les mises à jour en temps réel            |

**Flux de mise à jour :**

```
1. Publication (FinishSession)
   ↓
2. Backend calcule nouvelle version (SHA256 du manifest)
   ↓
3. Mise à jour de _content-version.json
   ↓
4. Broadcast SSE vers tous les clients connectés
   ↓
5. Client reçoit nouvelle version
   ↓
6. Prochaines requêtes utilisent ?cv=nouvelleVersion
   ↓
7. Nouvelles entrées de cache créées (URLs différentes)
```

**Note :** Les assets Angular (JS/CSS) NE sont PAS versionnés par ce système car ils sont déjà fingerprinted par Angular.

### Offline Support

Le système implémente un mode offline gracieux avec les fonctionnalités suivantes :

**Services impliqués :**

| Service                   | Rôle                                           |
| ------------------------- | ---------------------------------------------- |
| `OfflineDetectionService` | Détection réactive du statut online/offline    |
| `VisitedPagesService`     | Tracking des pages consultées (localStorage)   |
| `/offline` route          | Page de fallback avec liste des pages en cache |

**Comportement :**

1. **Pages visitées** : Chaque page consultée est automatiquement mise en cache par ngsw ET enregistrée dans `VisitedPagesService`
2. **Navigation offline** : Si une page échoue à charger et que l'utilisateur est offline, redirection vers `/offline`
3. **Page /offline** : Affiche un message clair + liste des pages récemment consultées (potentiellement disponibles en cache)

**Limitations :**

- Les pages non visitées ne sont pas disponibles offline
- Le cache ngsw a des limites de taille (`maxSize` dans dataGroups)
- Les pages très anciennes peuvent être évincées du cache

## Configuration

### ngsw-config.json

```json
{
  "$schema": "./node_modules/@angular/service-worker/config/schema.json",
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "app",
      "installMode": "prefetch",
      "resources": {
        "files": ["/favicon.ico", "/index.html", "/*.css", "/*.js"]
      }
    }
  ],
  "dataGroups": [
    {
      "name": "manifest",
      "urls": ["/_manifest.json"],
      "cacheConfig": {
        "maxAge": "5m",
        "strategy": "freshness",
        "timeout": "3s"
      }
    }
  ]
}
```

### manifest.webmanifest

```json
{
  "name": "Scribe d'Ektaron",
  "short_name": "Scribe",
  "theme_color": "#1a1a2e",
  "display": "standalone",
  "icons": [
    { "src": "assets/icons/icon-192x192.png", "sizes": "192x192" },
    { "src": "assets/icons/icon-512x512.png", "sizes": "512x512" }
  ]
}
```

### Activation dans project.json

```json
{
  "configurations": {
    "production": {
      "serviceWorker": "apps/site/ngsw-config.json"
    }
  }
}
```

### Registration dans app.config.ts

```typescript
import { provideServiceWorker } from '@angular/service-worker';

provideServiceWorker('ngsw-worker.js', {
  enabled: !isDevMode(),
  registrationStrategy: 'registerWhenStable:30000',
});
```

## Usage

### Vérification de l'installation PWA

1. Build production : `npm run build:site`
2. Servir via le backend : `npm run start node`
3. Ouvrir DevTools → Application → Service Workers
4. Le SW `ngsw-worker.js` doit être "activated and running"

### Gestion des mises à jour

Le `SwUpdateService` gère automatiquement les mises à jour :

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { SwUpdateService } from '../application/services/sw-update.service';

@Component({ ... })
export class AppComponent implements OnInit {
  private swUpdate = inject(SwUpdateService);

  ngOnInit() {
    // Démarre les vérifications périodiques
    this.swUpdate.initializeUpdateCheck();
  }
}
```

### Test manuel d'une mise à jour

1. Build et déployer une version
2. Modifier du code (ex: ajouter un `console.log` dans un component)
3. Re-build avec un nouveau hash
4. Recharger la page → Le SW détecte la nouvelle version
5. Un prompt s'affiche pour recharger

## Troubleshooting

### Le SW ne se registre pas

**Symptôme** : Pas de SW dans DevTools → Application → Service Workers

**Solutions** :

- Vérifier que c'est un build production (`npm run build:site`)
- Vérifier HTTPS (requis sauf localhost)
- Vérifier que `ngsw-worker.js` est présent dans `dist/apps/site/browser/`

### Contenu bloqué sur vieille version

**Symptôme** : Les pages affichent du contenu périmé même après publication

**Solutions** :

- Vérifier que les dataGroups utilisent `strategy: "freshness"` (pas `performance`)
- Réduire `maxAge` pour le groupe concerné
- Force refresh : Maj+F5 ou vider le cache via DevTools

### Erreur "Hash mismatch"

**Symptôme** : Erreur dans la console `Hash mismatch`

**Cause** : Les fichiers sur le serveur ne correspondent pas au `ngsw.json`

**Solutions** :

- Re-build et re-déployer complètement
- Vérifier qu'aucun CDN/proxy ne modifie les fichiers

### SW non actif en SSR

**C'est normal !** Le SW ne s'exécute que côté browser. En SSR (Node.js) :

- `navigator.serviceWorker` n'existe pas
- `provideServiceWorker()` détecte automatiquement la plateforme et ne fait rien

### Lighthouse PWA score faible

**Vérifications** :

- `manifest.webmanifest` accessible et valide
- Icônes 192x192 et 512x512 présentes
- `theme-color` défini dans `<head>`
- `display: standalone` dans le manifest
- HTTPS activé

## References

- [Angular Service Worker](https://angular.io/guide/service-worker-intro)
- [ngsw-config.json Schema](https://angular.io/guide/service-worker-config)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Lighthouse PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Worker](sw-update.service.ts) - Code source du service de mise à jour

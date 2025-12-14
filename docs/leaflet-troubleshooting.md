# Test des cartes Leaflet

## Vérification rapide

Pour vérifier si les cartes Leaflet fonctionnent, suivez ces étapes :

### 1. Créer une note de test dans votre vault Obsidian

Créez un fichier `test-leaflet.md` avec ce contenu :

## \`\`\`markdown

title: Test Leaflet
tags: [test, leaflet]

---

# Test de carte Leaflet

Voici une carte interactive :

\`\`\`leaflet
id: test-map-paris
lat: 48.8566
long: 2.3522
defaultZoom: 13
height: 400px
marker: default, 48.8566, 2.3522, Tour Eiffel
\`\`\`

La carte devrait s'afficher ci-dessus.
\`\`\`

### 2. Publier la note

Utilisez le plugin Obsidian VPS Publish pour publier cette note.

### 3. Vérifier dans le navigateur

1. Ouvrez la console du navigateur (F12)
2. Naviguez vers la page publiée
3. Cherchez ces logs dans la console :
   - `[ViewerComponent] Found page:` - devrait montrer `leafletBlocks: [...]`
   - `[LeafletMapComponent] ngAfterViewInit` - confirme que le composant se charge
   - `[LeafletMapComponent] Loading Leaflet...` - confirme l'import dynamique
   - `[LeafletMapComponent] Initializing map` - confirme l'initialisation

### 4. Vérifier l'affichage

- Une section "Cartes interactives" devrait apparaître après le contenu
- Un container avec bordure devrait être visible
- La carte Leaflet devrait s'afficher avec un marqueur sur la Tour Eiffel

## Débogage

### Si aucune carte ne s'affiche

1. **Vérifier le manifest** :
   - Ouvrez `<votre-site>/api/manifest` ou `/_manifest.json`
   - Cherchez la page de test
   - Vérifiez que `leafletBlocks` contient un tableau avec votre carte

2. **Console navigateur** :
   - Log `[ViewerComponent] Found page:` doit afficher `leafletBlocks: [{id: "test-map-paris", ...}]`
   - Si `leafletBlocks: []`, le problème vient du backend/parsing

3. **Réseau** :
   - Vérifiez que le CSS Leaflet est chargé : `leaflet.css`
   - Vérifiez qu'il n'y a pas d'erreurs 404

### Si la section apparaît mais pas la carte

1. Cherchez les logs `[LeafletMapComponent]` dans la console
2. Si "No map container element found" → problème de template/ViewChild
3. Si erreur lors du chargement de Leaflet → problème d'import dynamique

### Format du bloc Leaflet

Le format minimum requis :

\`\`\`leaflet
id: mon-identifiant-unique
lat: 48.8566
long: 2.3522
\`\`\`

Propriétés optionnelles :

- `height`: hauteur (défaut: 500px)
- `width`: largeur (défaut: 100%)
- `defaultZoom`: zoom initial (défaut: 13)
- `minZoom`: zoom minimum (défaut: 1)
- `maxZoom`: zoom maximum (défaut: 18)
- `marker`: format `type, lat, long, [[lien optionnel]]`
- `darkMode`: true/false
- `tileServer`: URL du serveur de tuiles personnalisé

## Problèmes connus

1. **SSR** : Les cartes ne s'affichent pas côté serveur (c'est normal, elles sont générées côté client)
2. **Import dynamique** : Leaflet est chargé dynamiquement pour éviter les problèmes SSR
3. **Styles** : Le CSS Leaflet doit être importé dans `styles.scss`

## Checklist technique

- [x] LeafletBlock entity créée
- [x] DetectLeafletBlocksService implémenté
- [x] Service appelé dans ParseContentHandler (AVANT ContentSanitizerService)
- [x] leafletBlocks ajouté à PublishableNote
- [x] leafletBlocks ajouté à ManifestPage
- [x] leafletBlocks mappé dans UploadNotesHandler
- [x] LeafletMapComponent créé (SSR-safe)
- [x] Import dynamique de Leaflet
- [x] CSS Leaflet importé dans styles.scss
- [x] Composant intégré dans ViewerComponent
- [x] Logs de débogage ajoutés

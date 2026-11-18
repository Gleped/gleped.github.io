# Mit

Mit er din personlige app med to dele:

- **Opskrifter**: opskriftsbibliotek med billeder, kategorier og links, plus en log over, hvad I fik, når I havde gæster.
- **Træning**: rutiner, træninger med forudfyldte sæt fra sidste gang, øvelser med statistik og historik.

Appen kører helt på din telefon og virker også uden internet.

## Læg den på GitHub Pages

1. Opret et nyt repository på github.com, fx `mit`. Det skal være **Public** med en gratis konto.
2. Vælg **Add file → Upload files**. Træk **alle filerne og mappen `icons`** ind fra en computer. Mappen kommer kun med, hvis du trækker den ind. Bruger du "choose your files", kommer den ikke med.
3. Klik **Commit changes**.
4. Gå til **Settings → Pages**, og vælg **Deploy from a branch**, branch `main` og mappen `/ (root)`. Klik **Save**.
5. Efter et minut eller to ligger appen på `https://<dit-brugernavn>.github.io/mit/`.

Tjek, at `…/mit/icons/icon-192.png` viser ikonet. Ellers kan appen ikke installeres på Android.

## Installér på telefonen

- **Android:** Åbn adressen direkte i **Chrome**, ikke via et link i Messenger eller Gmail. Tryk på ⋮ og vælg **Installer app**.
- **iPhone:** Åbn adressen i **Safari**, tryk på Del-knappen og vælg **Føj til hjemmeskærm**.

## Backup

Alt bliver gemt lokalt på telefonen. Under **Indstillinger → Eksportér backup** får du én fil med både opskrifter (med billeder) og træning. Gem filen i Drev, iCloud eller lignende, og tag en backup jævnligt.

**Importér backup** kan læse filer fra Mit og fra de gamle apps Madly og TrainLog. Du kan vælge at **flette** (tilføjer og opdaterer) eller **erstatte**.

## Filer

| Fil | Indhold |
|---|---|
| `index.html` | Selve siden |
| `app.js` | Kernen (startskærm, navigation, backup) og delen Opskrifter |
| `train.js` | Delen Træning |
| `styles.css` | Udseende og farvetemaer (grøn til Opskrifter, blå til Træning, lys/mørk) |
| `sw.js` | Gør appen tilgængelig offline |
| `manifest.webmanifest`, `icons/` | Navn og ikon ved installation |

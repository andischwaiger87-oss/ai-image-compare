# KI-Bildvergleich – Ein Prompt. Vier Modelle. Drei Jahre.

Derselbe Prompt in Midjourney V4 (Jänner 2023) und in den Modellen von heute:
Midjourney V8.2, ChatGPT und Gemini. Statische Seite, ausgeliefert als
Cloudflare Worker (Static Assets). Kein Framework, kein Build-Schritt für den Code.

## Aufbau

```
public/
  index.html, styles.css, app.js   App (Übersicht, Detail, Slider, Lightbox)
  data/gallery.json                ALLE Inhalte: Modelle + Prompts
  images/<prompt-id>/<model-id>.webp      Bild (max. 1600 px)
  images/<prompt-id>/<model-id>-sm.webp   Vorschau (max. 640 px)
originals/                         Originalbilder (nicht im Git, siehe .gitignore)
scripts/build-images.mjs           originals/ → public/images/ (WebP)
wrangler.jsonc                     Cloudflare-Konfiguration
```

## Neuen Prompt hinzufügen

1. Originale ablegen: `originals/<prompt-id>/<model-id>.png` (oder .jpg)
   z. B. `originals/robot-cafe/mj-v4.png`, `originals/robot-cafe/gemini.jpg`
2. Bilder umwandeln:
   ```
   npm install        # nur beim ersten Mal
   npm run images
   ```
   Das Skript meldet am Ende, ob zu jedem Eintrag in `gallery.json` ein Bild existiert.
3. In `public/data/gallery.json` unter `prompts` einen Eintrag ergänzen:
   ```json
   {
     "id": "robot-cafe",
     "title": "Roboter im Kaffeehaus",
     "prompt": "…exakter Prompt…",
     "images": ["mj-v4", "mj-v8-2", "chatgpt", "gemini"]
   }
   ```
   `images` listet nur die Modelle, für die es ein Bild gibt.
4. Committen und pushen – Cloudflare deployt automatisch (siehe unten).

## Neues Modell hinzufügen

In `gallery.json` unter `models` einen Eintrag ergänzen (Reihenfolge = Reihenfolge
in der App, am besten chronologisch):

```json
{ "id": "flux-2", "name": "FLUX", "version": "2", "maker": "Black Forest Labs", "date": "2027-03-01", "color": "#c98fb0" }
```

Danach die Bilder als `originals/<prompt-id>/flux-2.png` ablegen und `npm run images`.
Für ChatGPT und Gemini ist `version` leer – bei Bedarf eintragen, die App zeigt sie dann an.

## Lokal ansehen

```
npm run dev        # http://localhost:8787
```

## Deploy

### Einmalig: GitHub
```
git init
git add .
git commit -m "KI-Bildvergleich: erste Version"
git branch -M main
git remote add origin https://github.com/andischwaiger87-oss/ai-image-compare.git
git push -u origin main
```

### Einmalig: Cloudflare mit GitHub verbinden (empfohlen)
Cloudflare Dashboard → **Workers & Pages** → **Create** → **Import a repository** →
`ai-image-compare` wählen. Build command leer lassen, Deploy command `npx wrangler deploy`.
Ab dann wird jeder Push auf `main` automatisch veröffentlicht.

### Alternativ: direkt vom Rechner
```
npx wrangler login
npm run deploy
```

# Terpene

A private Android journal for medical cannabis: log doses, rate how you feel, and learn which terpenes, products and methods actually work for you.

<img src="icon-512.png" width="96" alt="Terpene icon">

## Get the APK

Every push to `main` builds a signed APK in GitHub Actions.

1. On your phone, open this repo → **Releases** → newest **Terpene build N**
2. Tap `Terpene-v1.0.N.apk`, then open the download
3. Allow your browser to install unknown apps if Android asks

Newer builds install over older ones and keep your data. To rebuild without code changes: **Actions → Build Android APK → Run workflow**.

## What it does

- **Onboarding** — pick goals, strains that worked (and what they helped), strains that didn't (and what happened), methods and typical dose. Builds a starter terpene signature and flags terpenes to avoid.
- **Label scanning** — photograph a label or COA; on-device OCR (tesseract.js, bundled — nothing uploaded) pulls strain name, THC/CBD and terpene percentages. Editable before saving.
- **Sessions** — product or strain, method, dose (mg or puffs), what it's for, severity before, optional cost.
- **Check-ins** — notifications timed to the method (vape 15 min / 1 hr / 3 hr; edible 1 hr / 2.5 hr / 5 hr). Relief 1–10, feelings, side effects, notes.
- **Insights** — personal terpene signature that shifts from the starter profile toward your own results, suggestions per goal, best product per symptom, terpene and method effectiveness, side-effect patterns, 60-day dose trend with tolerance warning, cost per session.
- **Doctor summary** — shareable HTML report. **Backup/restore** as JSON.

All data stays in on-device app storage. No accounts, no server.

## Project layout

```
www/            the app (index.html, styles.css, app.js, strains.js)
scripts/        copy-ocr.js bundles the OCR engine into www/ocr
android/        Capacitor 8 native project
.github/        APK build workflow
```

## Develop

```bash
npm ci
npm run sync                 # bundle OCR + copy www into android/
npx cap open android         # optional: Android Studio
cd www && python3 -m http.server   # quick browser preview
```

## Notes

- `android/app/terpene-sideload.keystore` is a sideload-only signing key committed so builds can update each other. Before any Play Store release, create a private upload key and keep it out of git.
- Strain terpene profiles in `www/strains.js` are typical values; scanned label numbers always take precedence.
- Terpene is a personal journal, not medical advice.

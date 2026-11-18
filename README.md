# Recovery Habit – PWA

Osobná aplikácia na budovanie disciplíny a každodenných návykov.
Beží ako webová stránka, ktorú si pridáš na plochu iPhonu (alebo Androidu / počítača)
a otvára sa ako bežná aplikácia. **Žiadny App Store, žiadny Mac, žiadny server.**

## Čo je v balíku

```
index.html             štruktúra aplikácie
app.css                dizajn (svetlý aj tmavý režim, iPhone safe-area)
app.js                 celá funkcionalita
manifest.webmanifest   PWA manifest (ikona, názov, farby, skratky)
sw.js                  service worker – offline režim + notifikácie
icons/                 ikony (vrátane apple-touch-icon pre iOS)
```

## Funkcie

- **Domov** – denný prehľad predsavzatí, označovanie splnených, kruh pokroku, série 🔥, citát dňa, listovanie dňami
- **Pridať / upraviť** – názov, opis, ikona, farba, dátum začiatku, čas pripomienky, každý deň alebo vybrané dni
- **Kalendár** – mesačný prehľad (tmavšie = viac splnené), história po dňoch, spätné doplnenie
- **Štatistiky** – celkový progres, denná úspešnosť, séria dní, posledných 7 dní, mesačný progres, najlepší výsledok, úspešnosť podľa predsavzatia
- **Pripomienky** – v čase pripomienky upozornenie v aplikácii + systémová notifikácia (ak je povolená)
- **Zdieľanie** – zdieľaj svoj deň alebo pošli kamarátovi výzvu (odkaz, ktorý mu predsavzatie predvyplní)
- **Záloha** – export do JSON (do Súborov / iCloud), import s nahradením alebo zlúčením
- **Dáta** – iba lokálne v zariadení (localStorage). Každý používateľ má svoje vlastné dáta.

## Zverejnenie na GitHub Pages (zadarmo, 5 minút)

1. Na [github.com](https://github.com) vytvor nový **verejný** repozitár, napr. `recovery-habit`.
2. Nahraj doň **obsah tohto priečinka** (`index.html`, `app.css`, `app.js`, `manifest.webmanifest`, `sw.js`, priečinok `icons/`).
   Dá sa to aj priamo v prehliadači: *Add file → Upload files*.
3. V repozitári otvor **Settings → Pages**.
   V časti *Build and deployment* vyber **Deploy from a branch**, vetvu `main`, priečinok `/ (root)` a ulož.
4. Po minúte-dvoch bude aplikácia dostupná na adrese
   `https://TVOJE-MENO.github.io/recovery-habit/`
5. Tento odkaz môžeš poslať komukoľvek. Každý bude mať vlastné dáta – nikto neuvidí tie tvoje.

> Alternatívy: Netlify Drop (pretiahni priečinok do prehliadača), Cloudflare Pages, Vercel.
> Dôležité je len HTTPS – to majú všetky.

## Pridanie na plochu iPhonu

1. Otvor odkaz v **Safari** (nie v Chrome ani v Instagrame).
2. Klepni na **Zdieľať** (štvorec so šípkou nahor).
3. Vyber **Pridať na plochu** → **Pridať**.
4. Na ploche sa objaví ikona *Recovery*. Otvára sa na celú obrazovku, bez panela prehliadača, funguje aj offline.

**Notifikácie na iPhone:** fungujú až po pridaní na plochu (iOS 16.4 a novší).
Potom v aplikácii: *Nastavenia → Systémové notifikácie → Povoliť*.

## Android / počítač

- **Android (Chrome):** menu ⋮ → *Pridať na plochu* / *Inštalovať aplikáciu*.
- **Windows / macOS (Chrome, Edge):** ikona inštalácie v adresnom riadku.

## Lokálne spustenie (na testovanie)

Service worker vyžaduje HTTPS alebo `localhost`:

```bash
npx serve .          # alebo: python3 -m http.server 8080
```

a otvor `http://localhost:3000` (resp. `:8080`).

## Obmedzenia a ďalší vývoj

- **Pripomienky na pozadí:** bez serverovej časti fungujú pripomienky len pri otvorenej aplikácii
  (prípadne krátko po jej zatvorení). Spoľahlivé upozornenia aj pri zatvorenej aplikácii vyžadujú
  **Web Push** – `sw.js` už obsahuje `push` handler, chýba iba server, ktorý správy posiela
  (napr. malá Node funkcia + VAPID kľúče).
- **Synchronizácia medzi zariadeniami:** zámerne nie je. Použi Export → Import.
- Dáta v localStorage môže Safari po dlhšej nečinnosti (cca 7 dní bez otvorenia, ak nie je aplikácia
  na ploche) vymazať – preto je tu záloha. Po pridaní na plochu je úložisko stabilné.

## Verzia

1.0 · 18. 11. 2026

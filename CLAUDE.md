# Lékový Strážce – Deployment Guide

## Deployment na Vercel

### 1. Push na GitHub

```bash
git add .
git commit -m "Příprava na Vercel deployment"
git push origin main
```

### 2. Propojení s Vercel

1. Jdi na [vercel.com](https://vercel.com) a přihlas se přes GitHub
2. Klikni **Add New → Project**
3. Vyber repozitář `lekovy_strazce`
4. V nastavení projektu:
   - **Framework Preset**: Other
   - **Build Command**: `npx expo export --platform web`
   - **Output Directory**: `dist`
   - **Root Directory**: `/` (ponechat prázdné)

5. **Environment Variables** – přidej:
   - `EXPO_PUBLIC_DEEPSEEK_API_KEY` = tvůj DeepSeek API klíč

6. Klikni **Deploy**

### 3. Po nasazení

- Webová verze poběží na `https://lekovy-strazce.vercel.app`
- API endpoint: `https://lekovy-strazce.vercel.app/api/analyze`

## Lokální vývoj

```bash
# Spuštění frontendu + proxy serveru
npm run dev

# Nebo zvlášť:
npm run server    # Express proxy na portu 3001
npm run web       # Expo web na portu 8081
```

## Struktura projektu

```
lekovy_strazce/
├── api/analyze.js          # Vercel serverless funkce (produkce)
├── server/index.js         # Express proxy server (lokální vývoj)
├── services/
│   ├── deepseekService.ts  # Volání API (detekuje DEV vs PROD)
│   └── ocrService.ts       # OCR logika
├── components/
│   └── CameraScanner.tsx   # Komponenta kamery
├── data/
│   └── medicinesDatabase.json  # Databáze léků
├── App.tsx                 # Hlavní komponenta
├── vercel.json             # Vercel konfigurace
└── package.json
```

## Důležité

- **API klíč** se nastavuje v Vercel dashboardu (Environment Variables), nikdy necommitovat do repa
- **Kamera** na webu nefunguje – aplikace zobrazí hlášku a uživatel může přidávat léky ručně
- **Serverless funkce** mají na Vercel free tieru timeout 10s, na Pro 60s – DeepSeek API by mělo stihnout odpovědět

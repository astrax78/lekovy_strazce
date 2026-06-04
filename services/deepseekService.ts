// ─── Typy ──────────────────────────────────────────────────────────────────────

interface Medicine {
  id: number;
  name: string;
  leafletText: string;
}

interface Interakce {
  lek_A: string;
  lek_B: string;
  zavaznost: 'warning' | 'danger';
  popis_problemu: string;
  doporuceni: string;
}

export interface AnalyzeResult {
  celkovy_status: 'safe' | 'warning' | 'danger';
  shrnuti: string;
  nalezené_interakce: Interakce[];
}

// ─── Systémový prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Jsi expert na klinickou farmacii a lékařskou bezpečnost. Tvým úkolem je analyzovat seznam léků a na základě poskytnutých textů z příbalových letáků zjistit, zda mezi nimi nedochází k nebezpečným interakcím (vzájemnému ovlivňování účinků, zvýšení toxicity, snížení účinnosti nebo ohrožení zdraví pacienta).

Uživatel ti dodá data ve formátu pole objektů, kde každý objekt obsahuje:
- "nazev": Název léku
- "pribalovy_letak": Relevantní výňatek z oficiální dokumentace (sekce o interakcích a kontraindikacích).

Tvým úkolem je provést křížovou analýzu VŠECH léků mezi sebou (každý s každým) a vyhodnotit celkové riziko.

Odpověď MUSÍŠ vrátit striktně ve formátu JSON. Odpověď nesmí obsahovat žádný úvodní ani závěrečný text, pouze validní JSON objekt s následující strukturou:

{
  "celkovy_status": "safe" | "warning" | "danger",
  "shrnuti": "Stručné celkové zhodnocení kombinace léků lidskou řečí v češtině (2-3 věty).",
  "nalezené_interakce": [
    {
      "lek_A": "Název prvního léku",
      "lek_B": "Název druhého léku",
      "zavaznost": "warning" | "danger",
      "popis_problemu": "Detailní vysvětlení v češtině, k čemu při kombinaci dochází a proč je to nebezpečné. VŽDY zde uveď konkrétní větu z letáku, o kterou se hodnocení opírá (v uvozovkách).",
      "doporuceni": "Konkrétní laické doporučení (např. 'Užívejte s odstupem 2 hodin', 'Konzultujte s lékařem změnu dávkování')."
    }
  ]
}

Pravidla pro vyhodnocení závažnosti – řiď se PŘísně následujícími stupni:

🔴 Červená ("danger") – ZÁVAŽNÉ / HIGH RISK:
Použij POUZE tehdy, pokud je v letáku výslovně napsáno, že se léky nesmí užívat současně (kontraindikace), nebo pokud hrozí selhání orgánů či ohrožení života. Pokud v letácích není výslovná kontraindikace, nesmíš použít "danger". Celkový status bude "danger", pokud je alespoň jedna interakce v seznamu označena jako "danger".

🟠 Oranžová ("warning") – STŘEDNÍ / MEDIUM RISK:
Použij pro případy, kdy léky mají podobný vedlejší účinek (např. oba trochu zatěžují žaludek nebo způsobují ospalost), ale jejich společné užívání je běžné – přidej varování typu "Užívejte s opatrností / sledujte se".

🟢 Zelená ("safe") – NÍZKÉ / LOW RISK:
Pokud v textech letáků není žádná zmínka o interakci a léky působí na úplně jiné věci, status musí být "safe". Pole "nalezené_interakce" bude prázdné.

DŮLEŽITÉ – POVINNÉ ZDŮVODNĚNÍ:
Do pole "popis_problemu" u každé interakce VŽDY napiš konkrétní větu z letáku (v uvozovkách), o kterou své rozhodnutí opíráš. Pokud v letácích není žádná relevantní věta, uveď: "V letácích není uvedena žádná informace o vzájemné interakci."

Všechny texty v JSONu musí být v českém jazyce, srozumitelné pro běžného laického pacienta, ale medicínsky přesné.`;

// ─── API funkce ────────────────────────────────────────────────────────────────

// ─── Detekce prostředí ──────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  // 1. Pokud je nastavena proměnná EXPO_PUBLIC_API_URL (např. při EAS build), použijeme ji
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envApiUrl) {
    return envApiUrl;
  }

  // 2. Ve vývojovém prostředí používáme lokální proxy server
  if (__DEV__) {
    return 'http://localhost:3001/api';
  }

  // 3. V produkci (nativní APK) – fallback, ale mělo by být nastaveno přes EXPO_PUBLIC_API_URL
  return 'http://localhost:3001/api';
}

export async function analyzeMedicines(
  medicines: Medicine[]
): Promise<AnalyzeResult> {
  const API_URL = `${getApiBaseUrl()}/analyze`;

  console.log('📤 Odesílám požadavek na API...');
  console.log('📦 URL:', API_URL);
  console.log('📦 Léky:', medicines.map((m) => m.name).join(', '));

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ medicines }),
    });
  } catch (networkError) {
    console.error('❌ Network Error – API není dostupné:', networkError);
    console.error('❌ Cause:', (networkError as Error).cause);
    throw new Error(
      `Nelze se připojit k API na ${API_URL}. ${
        __DEV__
          ? "Spustili jste 'npm run server' v druhém terminálu?"
          : 'Zkontrolujte, zda je backend nasazený a dostupný.'
      }`
    );
  }

  console.log('📥 Status odpovědi:', response.status);

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ API vrátilo chybu:', response.status, data);
    throw new Error(
      data.error || `API vrátilo chybu (${response.status})`
    );
  }

  console.log('✅ Data přijata z API');
  return data as AnalyzeResult;
}

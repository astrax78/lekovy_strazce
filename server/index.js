require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Povolíme CORS pro všechny origins (vývojové prostředí)
app.use(cors());
app.use(express.json());

app.post('/api/analyze', async (req, res) => {
  const { medicines } = req.body;

  if (!medicines || !Array.isArray(medicines) || medicines.length < 2) {
    return res.status(400).json({
      error: 'Je třeba zadat alespoň 2 léky k analýze.',
    });
  }

  const apiKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error:
        'Chybí API klíč pro DeepSeek. Nastavte ho v .env souboru jako EXPO_PUBLIC_DEEPSEEK_API_KEY.',
    });
  }

  // ─── Systémový prompt (stejný jako v deepseekService.ts) ──────────────────

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

  // ─── Příprava payloadu ────────────────────────────────────────────────────

  const medicinesPayload = medicines.map((m) => ({
    nazev: m.name,
    pribalovy_letak: m.leafletText,
  }));

  try {
    console.log('📤 Odesílám požadavek na DeepSeek API...');
    console.log('📦 Data:', JSON.stringify(medicinesPayload, null, 2));

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify(medicinesPayload),
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ DeepSeek API error:', response.status, errorText);
      return res.status(response.status).json({
        error: `DeepSeek API vrátilo chybu (${response.status}): ${errorText}`,
      });
    }

    const data = await response.json();
    console.log('📥 Odpověď z DeepSeek API:', JSON.stringify(data, null, 2));

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        error: 'DeepSeek API nevrátilo žádný obsah.',
      });
    }

    // Pokusíme se parsovat JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ Chyba parsování JSON:', content);
      return res.status(500).json({
        error: `Odpověď z DeepSeek není validní JSON: ${content}`,
      });
    }

    console.log('✅ Výsledek analýzy:', JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error) {
    console.error('❌ Neočekávaná chyba:', error.message);
    res.status(500).json({
      error: `Neočekávaná chyba při komunikaci s DeepSeek API: ${error.message}`,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server běží na http://localhost:${PORT}`);
  console.log(`📡 Endpoint: POST http://localhost:${PORT}/api/analyze`);
});

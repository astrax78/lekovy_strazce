import MEDICINES_DATABASE from '../data/medicinesDatabase.json';

interface Medicine {
  id: number;
  name: string;
  leafletText: string;
}

const medicines = MEDICINES_DATABASE as Medicine[];

/**
 * Normalizuje text pro porovnání – odstraní diakritiku, převede na lowercase.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // odstraní diakritiku
    .replace(/[^a-z0-9\s]/g, '')     // odstraní speciální znaky
    .trim();
}

/**
 * Hledá shodu názvu léku v daném textu.
 * Vrací první nalezený lék, nebo null.
 */
export function findMedicineInText(text: string): Medicine | null {
  const normalizedText = normalize(text);
  const words = normalizedText.split(/\s+/);

  // 1. Přesná shoda celého názvu v textu
  for (const medicine of medicines) {
    const normalizedName = normalize(medicine.name);
    if (normalizedText.includes(normalizedName)) {
      return medicine;
    }
  }

  // 2. Hledání po jednotlivých slovech – pokud některé slovo v textu
  //    přesně odpovídá názvu léku (např. "Prestarium")
  for (const medicine of medicines) {
    const normalizedName = normalize(medicine.name);
    for (const word of words) {
      if (word === normalizedName) {
        return medicine;
      }
    }
  }

  // 3. Fuzzy – pokud název léku obsahuje slovo z textu nebo naopak
  for (const medicine of medicines) {
    const normalizedName = normalize(medicine.name);
    const nameParts = normalizedName.split(/\s+/);
    for (const word of words) {
      for (const part of nameParts) {
        if (word === part || word.includes(part) || part.includes(word)) {
          return medicine;
        }
      }
    }
  }

  return null;
}

/**
 * Vrací seznam léků, jejichž název částečně odpovídá danému textu.
 * Používá se pro našeptávač po naskenování.
 */
export function getMedicineSuggestions(text: string): Medicine[] {
  const normalizedText = normalize(text);
  if (normalizedText.length === 0) return [];

  const words = normalizedText.split(/\s+/).filter((w) => w.length > 0);

  const scored = medicines.map((medicine) => {
    const normalizedName = normalize(medicine.name);
    let score = 0;

    // Přesná shoda celého názvu
    if (normalizedText.includes(normalizedName)) {
      score += 100;
    }

    // Shoda jednotlivých slov
    const nameParts = normalizedName.split(/\s+/);
    for (const word of words) {
      for (const part of nameParts) {
        if (word === part) {
          score += 50;
        } else if (part.startsWith(word) || word.startsWith(part)) {
          score += 30;
        } else if (part.includes(word) || word.includes(part)) {
          score += 10;
        }
      }
    }

    return { medicine, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.medicine)
    .slice(0, 5);
}

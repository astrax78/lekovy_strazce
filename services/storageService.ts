// ─── AsyncStorage helper pro uživatelsky přidané léky ────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

const CUSTOM_MEDICINES_KEY = '@custom_medicines';
const CUSTOM_ID_START = 1000; // IDs pro custom léky začínají na 1000, aby nekolidovaly s oficiálními

export interface Medicine {
  id: number;
  name: string;
  leafletText: string;
}

/**
 * Načte všechny uživatelsky přidané léky z AsyncStorage.
 */
export async function loadCustomMedicines(): Promise<Medicine[]> {
  try {
    const json = await AsyncStorage.getItem(CUSTOM_MEDICINES_KEY);
    if (json !== null) {
      const data = JSON.parse(json) as Medicine[];
      return data;
    }
    return [];
  } catch (error) {
    console.error('❌ Chyba při načítání custom léků:', error);
    return [];
  }
}

/**
 * Uloží nový uživatelský lék do AsyncStorage.
 * Automaticky mu přidělí unikátní ID (1000+).
 */
export async function saveCustomMedicine(
  name: string,
  leafletText: string
): Promise<Medicine> {
  const existing = await loadCustomMedicines();

  // Najdeme nejvyšší ID mezi custom léky
  const maxId = existing.reduce(
    (max, m) => (m.id > max ? m.id : max),
    CUSTOM_ID_START - 1
  );

  const newMedicine: Medicine = {
    id: maxId + 1,
    name: name.trim(),
    leafletText: leafletText.trim(),
  };

  const updated = [...existing, newMedicine];
  await AsyncStorage.setItem(CUSTOM_MEDICINES_KEY, JSON.stringify(updated));

  return newMedicine;
}

/**
 * Smaže konkrétní uživatelský lék podle ID.
 */
export async function deleteCustomMedicine(id: number): Promise<Medicine[]> {
  const existing = await loadCustomMedicines();
  const updated = existing.filter((m) => m.id !== id);
  await AsyncStorage.setItem(CUSTOM_MEDICINES_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Smaže všechny uživatelsky přidané léky.
 */
export async function clearCustomMedicines(): Promise<void> {
  await AsyncStorage.removeItem(CUSTOM_MEDICINES_KEY);
}

/**
 * Zkontroluje, zda lék s daným názvem již existuje v seznamu.
 * Porovnává case-insensitive.
 */
export function medicineExists(
  name: string,
  allMedicines: Medicine[]
): boolean {
  const lowerName = name.trim().toLowerCase();
  return allMedicines.some((m) => m.name.toLowerCase() === lowerName);
}

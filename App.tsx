import { useState, useMemo, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Keyboard,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { analyzeMedicines, AnalyzeResult } from './services/deepseekService';
import MEDICINES_DATABASE from './data/medicinesDatabase.json';
import CameraScanner from './components/CameraScanner';
import {
  loadCustomMedicines,
  saveCustomMedicine,
  deleteCustomMedicine,
  clearCustomMedicines,
  medicineExists,
  Medicine,
} from './services/storageService';

// ─── Hlavní komponenta ───────────────────────────────────────────────────────

export default function App() {
  const [query, setQuery] = useState('');
  const [selectedMedicines, setSelectedMedicines] = useState<Medicine[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // ─── AsyncStorage – custom léky ──────────────────────────────────────────

  const [customMedicines, setCustomMedicines] = useState<Medicine[]>([]);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newMedicineName, setNewMedicineName] = useState('');
  const [newMedicineLeaflet, setNewMedicineLeaflet] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Sloučená databáze (oficiální + custom)
  const allMedicines = useMemo<Medicine[]>(() => {
    return [...(MEDICINES_DATABASE as Medicine[]), ...customMedicines];
  }, [customMedicines]);

  // Načtení custom léků při startu
  useEffect(() => {
    (async () => {
      const custom = await loadCustomMedicines();
      setCustomMedicines(custom);
    })();
  }, []);

  // ─── Našeptávač ──────────────────────────────────────────────────────────

  const suggestions = useMemo(() => {
    if (query.trim().length === 0) return [];
    const lowerQuery = query.toLowerCase().trim();
    return allMedicines.filter(
      (m) =>
        m.name.toLowerCase().includes(lowerQuery) &&
        !selectedMedicines.some((s) => s.id === m.id)
    );
  }, [query, selectedMedicines, allMedicines]);

  // ─── Přidání / odebrání léků ze seznamu ──────────────────────────────────

  const addMedicine = (medicine: Medicine) => {
    if (selectedMedicines.some((m) => m.id === medicine.id)) {
      Alert.alert('Lék již přidán', `${medicine.name} je již v seznamu.`);
      return;
    }
    setSelectedMedicines((prev) => [...prev, medicine]);
    setQuery('');
    Keyboard.dismiss();
  };

  const handleAddFromInput = () => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;

    const match = allMedicines.find(
      (m) => m.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (match) {
      addMedicine(match);
    } else if (suggestions.length > 0) {
      addMedicine(suggestions[0]);
    } else {
      Alert.alert('Lék nenalezen', `Lék "${trimmed}" není v databázi.`);
    }
  };

  const removeMedicine = (id: number) => {
    setSelectedMedicines((prev) => prev.filter((m) => m.id !== id));
  };

  const handleClearAll = () => {
    setSelectedMedicines([]);
    setResult(null);
    setErrorMessage(null);
    setQuery('');
    Keyboard.dismiss();
  };

  const count = selectedMedicines.length;
  const isCheckDisabled = count < 2 || isAnalyzing;

  // ─── Analýza ─────────────────────────────────────────────────────────────

  const handleCheckCombination = async () => {
    console.log('🔄 Spouštím analýzu...');
    console.log('📋 Vybrané léky:', selectedMedicines.map((m) => m.name).join(', '));
    setResult(null);
    setErrorMessage(null);
    setIsAnalyzing(true);
    try {
      const data = await analyzeMedicines(selectedMedicines);
      console.log('✅ Výsledek analýzy:', JSON.stringify(data, null, 2));
      setResult(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Neočekávaná chyba';
      console.error('❌ Chyba při analýze:', message);
      console.error('❌ Celý error objekt:', error);
      setErrorMessage(message);
    } finally {
      console.log('🏁 Analýza dokončena (loading = false)');
      setIsAnalyzing(false);
    }
  };

  // ─── Kamera ──────────────────────────────────────────────────────────────

  const handleMedicineScanned = (medicine: Medicine) => {
    addMedicine(medicine);
    Alert.alert(
      '✅ Lék naskenován',
      `${medicine.name} byl úspěšně přidán do seznamu.`
    );
  };

  // ─── Formulář – přidání nového léku ──────────────────────────────────────

  const resetForm = useCallback(() => {
    setNewMedicineName('');
    setNewMedicineLeaflet('');
    setFormError(null);
  }, []);

  const openAddModal = useCallback(() => {
    resetForm();
    setIsAddModalVisible(true);
  }, [resetForm]);

  const closeAddModal = useCallback(() => {
    setIsAddModalVisible(false);
    resetForm();
  }, [resetForm]);

  const validateForm = useCallback((): boolean => {
    const name = newMedicineName.trim();
    const leaflet = newMedicineLeaflet.trim();

    if (name.length === 0) {
      setFormError('Prosím, vyplňte název léku.');
      return false;
    }

    if (medicineExists(name, allMedicines)) {
      setFormError(`Lék "${name}" již v databázi existuje.`);
      return false;
    }

    if (leaflet.length < 10) {
      setFormError(
        'Prosím, vložte text příbalového letáku. Bez něj nedokáže AI lék správně zkontrolovat.'
      );
      return false;
    }

    setFormError(null);
    return true;
  }, [newMedicineName, newMedicineLeaflet, allMedicines]);

  const handleSaveNewMedicine = async () => {
    if (!validateForm()) return;

    try {
      const saved = await saveCustomMedicine(newMedicineName, newMedicineLeaflet);
      setCustomMedicines((prev) => [...prev, saved]);
      Alert.alert('✅ Lék přidán', `Lék "${saved.name}" byl úspěšně přidán do databáze.`);
      closeAddModal();
    } catch (error) {
      Alert.alert('Chyba', 'Nepodařilo se uložit lék. Zkuste to prosím znovu.');
    }
  };

  // ─── Mazání custom léků ──────────────────────────────────────────────────

  const handleDeleteCustomMedicine = async (id: number) => {
    const medicine = customMedicines.find((m) => m.id === id);
    if (!medicine) return;

    Alert.alert(
      'Smazat lék',
      `Opravdu chcete trvale odstranit lék "${medicine.name}" z databáze?`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Smazat',
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteCustomMedicine(id);
            setCustomMedicines(updated);
            // Pokud byl lék i v seznamu pro analýzu, odebereme ho
            setSelectedMedicines((prev) => prev.filter((m) => m.id !== id));
            Alert.alert('🗑️ Lék smazán', `Lék "${medicine.name}" byl trvale odebrán z databáze.`);
          },
        },
      ]
    );
  };

  const handleClearAllCustom = () => {
    const count = customMedicines.length;
    if (count === 0) {
      Alert.alert('Žádné léky', 'Nemáte žádné uživatelsky přidané léky.');
      return;
    }

    Alert.alert(
      'Smazat všechny uživatelské léky',
      `Opravdu chcete smazat všech ${count} uživatelsky přidaných léků? Tuto akci nelze vrátit.`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Smazat vše',
          style: 'destructive',
          onPress: async () => {
            await clearCustomMedicines();
            setCustomMedicines([]);
            // Odebereme smazané léky i ze seznamu pro analýzu
            setSelectedMedicines((prev) =>
              prev.filter((m) => m.id < 1000)
            );
            Alert.alert('✅ Hotovo', 'Všechny uživatelsky přidané léky byly smazány.');
          },
        },
      ]
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <StatusBar style="dark" />

        {/* Hlavička */}
        <View style={styles.header}>
          <Text style={styles.title}>💊 Lékový Strážce</Text>
          <Text style={styles.subtitle}>
            Zkontrolujte interakce mezi vašimi léky
          </Text>
        </View>

        {/* Input + tlačítka */}
        <View style={styles.inputRow}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Název léku..."
              placeholderTextColor="#999"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleAddFromInput}
              returnKeyType="done"
            />
            {/* Našeptávač */}
            {suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <FlatList
                  data={suggestions}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.suggestionItem}
                      onPress={() => addMedicine(item)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.suggestionText}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                  scrollEnabled={false}
                />
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={() => setIsScanning(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.cameraButtonText}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddFromInput}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>Přidat</Text>
          </TouchableOpacity>
        </View>

        {/* Tlačítko pro přidání nového léku do databáze */}
        <TouchableOpacity
          style={styles.addMedicineDbButton}
          onPress={openAddModal}
          activeOpacity={0.7}
        >
          <Text style={styles.addMedicineDbButtonText}>➕ Přidat nový lék do databáze</Text>
        </TouchableOpacity>

        {/* Seznam přidaných léků */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>
            Váš seznam léků {count > 0 ? `(${count})` : ''}
          </Text>

          {count === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>
                Zatím nemáte přidané žádné léky.{'\n'}
                Vyhledejte je výše a přidejte je do seznamu.
              </Text>
            </View>
          ) : (
            selectedMedicines.map((item) => (
              <View key={item.id} style={styles.medicineRow}>
                <View style={styles.medicineInfo}>
                  <Text style={styles.medicineName}>{item.name}</Text>
                  {item.id >= 1000 && (
                    <Text style={styles.customBadge}>📂 Uživatelský</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeMedicine(item.id)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.deleteIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Hlavní tlačítko / Loading */}
        <View style={styles.mainActionContainer}>
          {isAnalyzing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#27AE60" />
              <Text style={styles.loadingText}>Lékový Strážce analyzuje kombinaci...</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.checkButton,
                  isCheckDisabled && styles.checkButtonDisabled,
                ]}
                onPress={handleCheckCombination}
                activeOpacity={0.7}
                disabled={isCheckDisabled}
              >
                <Text
                  style={[
                    styles.checkButtonText,
                    isCheckDisabled && styles.checkButtonTextDisabled,
                  ]}
                >
                  Zkontrolovat kombinaci ({count} léků)
                </Text>
              </TouchableOpacity>
              {/* Tlačítko Vyčistit vše – jen když jsou nějaké léky */}
              {count > 0 && (
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={handleClearAll}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearAllButtonText}>🗑️ Vyčistit vše</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Tlačítko pro smazání uživatelských léků */}
        {customMedicines.length > 0 && (
          <TouchableOpacity
            style={styles.clearCustomButton}
            onPress={handleClearAllCustom}
            activeOpacity={0.7}
          >
            <Text style={styles.clearCustomButtonText}>
              🗑️ Smazat uživatelské léky ({customMedicines.length})
            </Text>
          </TouchableOpacity>
        )}

        {/* Výsledek analýzy */}
        {result && (
          <View style={styles.resultSection}>
            {/* Hlavní karta stavu */}
            <View
              style={[
                styles.statusCard,
                result.celkovy_status === 'safe' && styles.statusCardSafe,
                result.celkovy_status === 'warning' && styles.statusCardWarning,
                result.celkovy_status === 'danger' && styles.statusCardDanger,
              ]}
            >
              <Text style={styles.statusCardIcon}>
                {result.celkovy_status === 'safe' && '✅'}
                {result.celkovy_status === 'warning' && '⚠️'}
                {result.celkovy_status === 'danger' && '🚨'}
              </Text>
              <Text
                style={[
                  styles.statusCardTitle,
                  result.celkovy_status === 'safe' && styles.statusCardTitleSafe,
                  result.celkovy_status === 'warning' && styles.statusCardTitleWarning,
                  result.celkovy_status === 'danger' && styles.statusCardTitleDanger,
                ]}
              >
                {result.celkovy_status === 'safe' && 'Kombinace je bezpečná'}
                {result.celkovy_status === 'warning' && 'Kombinace vyžaduje opatrnost'}
                {result.celkovy_status === 'danger' && 'Kombinace je nebezpečná!'}
              </Text>
              <Text
                style={[
                  styles.statusCardShrnuti,
                  result.celkovy_status === 'safe' && styles.statusCardShrnutiSafe,
                  result.celkovy_status === 'warning' && styles.statusCardShrnutiWarning,
                  result.celkovy_status === 'danger' && styles.statusCardShrnutiDanger,
                ]}
              >
                {result.shrnuti}
              </Text>
            </View>

            {/* Nalezené interakce */}
            {result.nalezené_interakce.length > 0 && (
              <>
                <Text style={styles.resultSectionTitle}>
                  Nalezené interakce ({result.nalezené_interakce.length})
                </Text>
                {result.nalezené_interakce.map((interakce, index) => (
                  <View key={index} style={styles.interactionCard}>
                    <View style={styles.interactionHeader}>
                      <Text style={styles.interactionLeky}>
                        {interakce.lek_A} + {interakce.lek_B}
                      </Text>
                      <View
                        style={[
                          styles.zavaznostBadge,
                          interakce.zavaznost === 'warning' && styles.zavaznostWarning,
                          interakce.zavaznost === 'danger' && styles.zavaznostDanger,
                        ]}
                      >
                        <Text style={styles.zavaznostText}>
                          {interakce.zavaznost === 'warning' ? 'Mírná' : 'Závažná'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.interactionPopis}>{interakce.popis_problemu}</Text>
                    <View style={styles.doporuceniBox}>
                      <Text style={styles.doporuceniLabel}>💡 Doporučení:</Text>
                      <Text style={styles.doporuceniText}>{interakce.doporuceni}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* Chybová hláška */}
        {errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>❌</Text>
            <Text style={styles.errorTitle}>Chyba</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.dismissErrorButton}
              onPress={() => setErrorMessage(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissErrorText}>Zavřít</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Právní disclaimer */}
        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimerText}>
            Upozornění: Tato aplikace je pouze volnočasový projekt využívající AI. Výsledky mají pouze informativní charakter a nenahrazují odborné lékařské posouzení. Všechny pochybnosti konzultujte se svým lékařem nebo lékárníkem.
          </Text>
        </View>
      </ScrollView>

      {/* Modal s kamerou */}
      <Modal
        visible={isScanning}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsScanning(false)}
      >
        <CameraScanner
          onMedicineScanned={handleMedicineScanned}
          onClose={() => setIsScanning(false)}
        />
      </Modal>

      {/* Modal – Přidat nový lék do databáze */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeAddModal}
      >
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Nadpis */}
            <Text style={styles.modalTitle}>💊 Přidat nový lék do databáze</Text>

            {/* Nápověda */}
            <View style={styles.helpBox}>
              <Text style={styles.helpIcon}>💡</Text>
              <Text style={styles.helpText}>
                Aplikace pracuje lokálně. Aby mohl Lékový Strážce správně vyhodnotit rizika, je nutné kromě názvu vložit také text příbalového letáku (stačí zkopírovat sekci {'"Nežádoucí účinky a interakce"'} z webu{' '}
                <Text style={styles.helpLink}>sukl.cz</Text> nebo{' '}
                <Text style={styles.helpLink}>pribalove-letaky.cz</Text>).
              </Text>
            </View>

            {/* Název léku */}
            <Text style={styles.fieldLabel}>Název léku</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Název léku..."
              placeholderTextColor="#999"
              value={newMedicineName}
              onChangeText={(text) => {
                setNewMedicineName(text);
                setFormError(null);
              }}
              autoCapitalize="sentences"
              returnKeyType="next"
            />

            {/* Text příbalového letáku */}
            <Text style={styles.fieldLabel}>Text příbalového letáku (interakce)</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Sem vložte nebo zkopírujte text příbalového letáku (zejména interakce s jinými léky)..."
              placeholderTextColor="#999"
              value={newMedicineLeaflet}
              onChangeText={(text) => {
                setNewMedicineLeaflet(text);
                setFormError(null);
              }}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            {/* Chybová hláška formuláře */}
            {formError && (
              <View style={styles.formErrorBox}>
                <Text style={styles.formErrorText}>⚠️ {formError}</Text>
              </View>
            )}

            {/* Tlačítka */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                (newMedicineName.trim().length === 0 || newMedicineLeaflet.trim().length < 10) &&
                  styles.saveButtonDisabled,
              ]}
              onPress={handleSaveNewMedicine}
              activeOpacity={0.7}
              disabled={
                newMedicineName.trim().length === 0 || newMedicineLeaflet.trim().length < 10
              }
            >
              <Text
                style={[
                  styles.saveButtonText,
                  (newMedicineName.trim().length === 0 || newMedicineLeaflet.trim().length < 10) &&
                    styles.saveButtonTextDisabled,
                ]}
              >
                💾 Uložit lék
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelModalButton}
              onPress={closeAddModal}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelModalButtonText}>Zrušit</Text>
            </TouchableOpacity>

            {/* Separátor */}
            {customMedicines.length > 0 && (
              <View style={styles.customListSection}>
                <View style={styles.separator} />
                <Text style={styles.customListTitle}>
                  📂 Moje přidané léky ({customMedicines.length})
                </Text>

                {customMedicines.map((item) => (
                  <View key={item.id} style={styles.customMedicineRow}>
                    <View style={styles.customMedicineInfo}>
                      <Text style={styles.customMedicineName}>{item.name}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.customDeleteButton}
                      onPress={() => handleDeleteCustomMedicine(item.id)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.customDeleteIcon}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Tlačítko smazat vše */}
                <TouchableOpacity
                  style={styles.clearCustomInModalButton}
                  onPress={handleClearAllCustom}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearCustomInModalText}>
                    🗑️ Smazat všechny uživatelské léky
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ─── Styly ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  contentContainer: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Hlavička
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },

  // Input řádek
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    zIndex: 10,
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#1A1A2E',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#D0D5DD',
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 100,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionText: {
    fontSize: 18,
    color: '#1A1A2E',
  },
  cameraButton: {
    backgroundColor: '#27AE60',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButtonText: {
    fontSize: 22,
  },
  addButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },

  // Tlačítko pro přidání nového léku do DB
  addMedicineDbButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#4A90D9',
    borderStyle: 'dashed',
  },
  addMedicineDbButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90D9',
  },

  // Seznam
  listContainer: {
    flex: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
  },
  list: {
    flex: 1,
  },
  medicineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  medicineInfo: {
    flex: 1,
  },
  medicineName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  customBadge: {
    fontSize: 12,
    color: '#4A90D9',
    fontWeight: '600',
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteIcon: {
    fontSize: 24,
  },

  // Hlavní akční tlačítka
  mainActionContainer: {
    marginBottom: 12,
  },
  clearAllButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  clearAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },

  // Tlačítko smazat uživatelské léky (hlavní obrazovka)
  clearCustomButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FFCDD2',
  },
  clearCustomButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C62828',
  },

  // Loading
  loadingContainer: {
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#27AE60',
  },

  // Výsledek analýzy – sekce
  resultSection: {
    marginBottom: 20,
  },

  // Hlavní karta stavu
  statusCard: {
    borderRadius: 20,
    padding: 28,
    marginBottom: 20,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  statusCardSafe: {
    backgroundColor: '#E8F5E9',
  },
  statusCardWarning: {
    backgroundColor: '#FFF3E0',
  },
  statusCardDanger: {
    backgroundColor: '#FFEBEE',
  },
  statusCardIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  statusCardTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  statusCardTitleSafe: {
    color: '#2E7D32',
  },
  statusCardTitleWarning: {
    color: '#E65100',
  },
  statusCardTitleDanger: {
    color: '#C62828',
  },
  statusCardShrnuti: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  statusCardShrnutiSafe: {
    color: '#1B5E20',
  },
  statusCardShrnutiWarning: {
    color: '#BF360C',
  },
  statusCardShrnutiDanger: {
    color: '#B71C1C',
  },

  // Sekce interakcí
  resultSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  interactionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 5,
    borderLeftColor: '#FFA726',
  },
  interactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  interactionLeky: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    flex: 1,
  },
  zavaznostBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 8,
  },
  zavaznostWarning: {
    backgroundColor: '#FFF3E0',
  },
  zavaznostDanger: {
    backgroundColor: '#FFEBEE',
  },
  zavaznostText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E65100',
  },
  interactionPopis: {
    fontSize: 15,
    color: '#444',
    lineHeight: 23,
    marginBottom: 14,
  },
  doporuceniBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  doporuceniLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F57F17',
    marginBottom: 6,
  },
  doporuceniText: {
    fontSize: 15,
    color: '#F57F17',
    lineHeight: 22,
    fontWeight: '500',
  },

  // Chybová hláška
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF5350',
  },
  errorIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#C62828',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: '#C62828',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  dismissErrorButton: {
    backgroundColor: '#EF5350',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  dismissErrorText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Disclaimer
  disclaimerContainer: {
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Dolní tlačítko
  checkButton: {
    backgroundColor: '#27AE60',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#27AE60',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  checkButtonDisabled: {
    backgroundColor: '#B0BEC5',
    elevation: 0,
    shadowOpacity: 0,
  },
  checkButtonText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
  },
  checkButtonTextDisabled: {
    color: '#ECEFF1',
  },

  // ─── Modal styly ────────────────────────────────────────────────────────

  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  modalContent: {
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 20,
  },

  // Nápověda
  helpBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  helpIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 21,
  },
  helpLink: {
    fontWeight: '700',
    color: '#0D47A1',
    textDecorationLine: 'underline',
  },

  // Pole formuláře
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A2E',
    marginBottom: 16,
  },
  modalTextArea: {
    minHeight: 140,
    textAlignVertical: 'top',
  },

  // Chyba formuláře
  formErrorBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  formErrorText: {
    fontSize: 14,
    color: '#E65100',
    lineHeight: 20,
    fontWeight: '500',
  },

  // Tlačítka v modalu
  saveButton: {
    backgroundColor: '#27AE60',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#B0BEC5',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  saveButtonTextDisabled: {
    color: '#ECEFF1',
  },
  cancelModalButton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  cancelModalButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },

  // Seznam custom léků v modalu
  customListSection: {
    marginTop: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 20,
  },
  customListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  customMedicineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  customMedicineInfo: {
    flex: 1,
  },
  customMedicineName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  customDeleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  customDeleteIcon: {
    fontSize: 22,
  },
  clearCustomInModalButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#FFCDD2',
  },
  clearCustomInModalText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#C62828',
  },
});

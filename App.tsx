import { useState, useMemo } from 'react';
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
} from 'react-native';

// ─── Mock databáze léků ──────────────────────────────────────────────────────

interface Medicine {
  id: number;
  name: string;
  leafletText: string;
}

const MOCK_MEDICINES: Medicine[] = [
  {
    id: 1,
    name: 'Paralen',
    leafletText:
      'Paralen může zeslabovat účinek warfarinu a zvyšovat riziko poškození jater při současném užívání s alkoholem.',
  },
  {
    id: 2,
    name: 'Ibalgin',
    leafletText:
      'Ibalgin zvyšuje riziko krvácení při užívání warfarinu a může snižovat účinnost některých léků na vysoký krevní tlak.',
  },
  {
    id: 3,
    name: 'Warfarin',
    leafletText:
      'Warfarin interaguje s mnoha léky – konzultujte prosím užívání s lékařem. Zvláště opatrní buďte u léků proti bolesti.',
  },
  {
    id: 4,
    name: 'Acylpyrin',
    leafletText:
      'Acylpyrin zvyšuje riziko žaludečního krvácení v kombinaci s Ibalginem a zesiluje účinek warfarinu.',
  },
  {
    id: 5,
    name: 'Lexaurin',
    leafletText:
      'Lexaurin může zesilovat účinky léků tlumících centrální nervovou soustavu – pozor na zvýšenou ospalost.',
  },
];

// ─── Hlavní komponenta ───────────────────────────────────────────────────────

export default function App() {
  const [query, setQuery] = useState('');
  const [selectedMedicines, setSelectedMedicines] = useState<Medicine[]>([]);

  // Filtrované návrhy podle textu v inputu
  const suggestions = useMemo(() => {
    if (query.trim().length === 0) return [];
    const lowerQuery = query.toLowerCase().trim();
    return MOCK_MEDICINES.filter(
      (m) =>
        m.name.toLowerCase().includes(lowerQuery) &&
        !selectedMedicines.some((s) => s.id === m.id)
    );
  }, [query, selectedMedicines]);

  // Přidání léku do seznamu
  const addMedicine = (medicine: Medicine) => {
    if (selectedMedicines.some((m) => m.id === medicine.id)) {
      Alert.alert('Lék již přidán', `${medicine.name} je již v seznamu.`);
      return;
    }
    setSelectedMedicines((prev) => [...prev, medicine]);
    setQuery('');
    Keyboard.dismiss();
  };

  // Přidání prvního návrhu z našeptávače (při stisku tlačítka Přidat)
  const handleAddFromInput = () => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;

    const match = MOCK_MEDICINES.find(
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

  // Smazání léku ze seznamu
  const removeMedicine = (id: number) => {
    setSelectedMedicines((prev) => prev.filter((m) => m.id !== id));
  };

  // Počet léků v seznamu
  const count = selectedMedicines.length;
  const isCheckDisabled = count < 2;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Hlavička */}
      <View style={styles.header}>
        <Text style={styles.title}>💊 Lékový Strážce</Text>
        <Text style={styles.subtitle}>
          Zkontrolujte interakce mezi vašimi léky
        </Text>
      </View>

      {/* Input + tlačítko Přidat */}
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
          style={styles.addButton}
          onPress={handleAddFromInput}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>Přidat</Text>
        </TouchableOpacity>
      </View>

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
          <FlatList
            data={selectedMedicines}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.medicineRow}>
                <View style={styles.medicineInfo}>
                  <Text style={styles.medicineName}>{item.name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeMedicine(item.id)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.deleteIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            )}
            style={styles.list}
          />
        )}
      </View>

      {/* Dolní tlačítko */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.checkButton,
            isCheckDisabled && styles.checkButtonDisabled,
          ]}
          onPress={() => {
            Alert.alert(
              'Info',
              'Kontrola kombinací bude implementována v dalším kroku.'
            );
          }}
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
      </View>
    </View>
  );
}

// ─── Styly ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    paddingTop: 60,
    paddingHorizontal: 20,
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
    marginBottom: 20,
    zIndex: 10,
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
  },

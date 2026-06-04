import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { findMedicineInText, getMedicineSuggestions } from '../services/ocrService';


interface Medicine {
  id: number;
  name: string;
  leafletText: string;
}

interface CameraScannerProps {
  onMedicineScanned: (medicine: Medicine) => void;
  onClose: () => void;
}

export default function CameraScanner({ onMedicineScanned, onClose }: CameraScannerProps) {
  // Web nepodporuje kameru – zobrazíme hlášku
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.overlay}>
          <Text style={styles.permissionTitle}>📷 Skenování kamerou</Text>
          <Text style={styles.permissionText}>
            Tato funkce je dostupná pouze v mobilní aplikaci.{'\n\n'}
            Prosím, otevřete aplikaci na svém telefonu nebo použijte ruční vyhledávání léků.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.permissionButtonText}>Zpět</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<Medicine[]>([]);
  const [scannedText, setScannedText] = useState<string | null>(null);

  // Zpracování vyfoceného snímku
  const handleTakePicture = useCallback(async () => {
    if (!cameraRef.current) return;

    setIsProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.6,
      });

      if (!photo?.base64) {
        Alert.alert('Chyba', 'Nepodařilo se pořídit snímek.');
        setIsProcessing(false);
        return;
      }

      setCapturedPhoto(photo.uri);

      // --- OCR logika: simulace rozpoznání textu z fotky ---
      // V reálné aplikaci bychom zde volali OCR API (Google Vision, Tesseract, atd.)
      // Pro MVP použijeme simulaci – zkusíme extrahovat text z base64 názvu souboru
      // a zároveň necháme uživatele vybrat lék z našeptávače
      
      // Simulace: zkusíme najít shodu v databázi podle "názvu" fotky
      // Ve skutečnosti by zde bylo volání OCR API
      await simulateOCR(photo.base64);
      
    } catch (error) {
      console.error('Chyba při focení:', error);
      Alert.alert('Chyba', 'Nepodařilo se zpracovat snímek.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Simulace OCR – v reálu by zde bylo volání OCR API
  // Pro MVP necháme uživatele vybrat lék z našeptávače
  const simulateOCR = async (base64: string) => {
    // Krátké zpoždění pro simulaci zpracování
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // Nastavíme prázdný text – uživatel si vybere z našeptávače
    setScannedText('Snímek byl pořízen. Vyberte lék z nabídky:');
    
    // Zobrazíme všechny léky jako našeptávač (uživatel vybere ručně)
    const { default: MEDICINES_DATABASE } = await import('../data/medicinesDatabase.json');
    setSuggestions(MEDICINES_DATABASE as Medicine[]);
  };

  // Výběr léku z našeptávače
  const handleSelectMedicine = (medicine: Medicine) => {
    onMedicineScanned(medicine);
    onClose();
  };

  // Znovu vyfotit
  const handleRetake = () => {
    setCapturedPhoto(null);
    setSuggestions([]);
    setScannedText(null);
  };

  // Pokud ještě nemáme povolení ke kameře
  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.overlay}>
          <Text style={styles.permissionText}>Získávám povolení ke kameře...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.overlay}>
          <Text style={styles.permissionTitle}>Povolení ke kameře</Text>
          <Text style={styles.permissionText}>
            Pro skenování krabiček léků potřebujeme přístup k vaší kameře.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            activeOpacity={0.7}
          >
            <Text style={styles.permissionButtonText}>Povolit kameru</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Zrušit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Zobrazení vyfocené fotky + našeptávač
  if (capturedPhoto) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
        
        <View style={styles.resultPanel}>
          <Text style={styles.resultTitle}>📸 Snímek pořízen</Text>
          
          {scannedText && (
            <Text style={styles.scannedText}>{scannedText}</Text>
          )}

          {isProcessing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#4A90D9" />
              <Text style={styles.loadingText}>Zpracovávám snímek...</Text>
            </View>
          ) : (
            <>
              {suggestions.length > 0 && (
                <View style={styles.suggestionsSection}>
                  <Text style={styles.suggestionsTitle}>
                    Vyberte lék z nabídky:
                  </Text>
                  <FlatList
                    data={suggestions}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => handleSelectMedicine(item)}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.suggestionIcon}>💊</Text>
                        <Text style={styles.suggestionText}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                    style={styles.suggestionsList}
                    scrollEnabled={true}
                  />
                </View>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={handleRetake}
                  activeOpacity={0.7}
                >
                  <Text style={styles.retakeButtonText}>📷 Vyfotit znovu</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.closeButtonText}>Zavřít</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

  // Živý náhled kamery
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      >
        <View style={styles.cameraOverlay}>
          <Text style={styles.cameraHint}>
            Namiřte kameru na krabičku léku a stiskněte spoušť
          </Text>
        </View>
      </CameraView>

      {/* Ovládací prvky */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.closeButtonCamera}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shutterButton, isProcessing && styles.shutterButtonDisabled]}
          onPress={handleTakePicture}
          activeOpacity={0.7}
          disabled={isProcessing}
        >
          <View style={styles.shutterInner} />
        </TouchableOpacity>

        {/* Placeholder pro zarovnání */}
        <View style={styles.placeholder} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Kamera
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  cameraHint: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Ovládání kamery
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 20,
    backgroundColor: '#1A1A2E',
  },
  closeButtonCamera: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  shutterButtonDisabled: {
    opacity: 0.5,
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
  },
  placeholder: {
    width: 50,
  },

  // Náhled fotky
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },

  // Panel s výsledkem
  resultPanel: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '50%',
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 8,
  },
  scannedText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },

  // Loading
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#4A90D9',
    marginTop: 12,
    fontWeight: '600',
  },

  // Našeptávač
  suggestionsSection: {
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 6,
  },
  suggestionIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  suggestionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
  },

  // Akční tlačítka
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Povolení
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#CCC',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

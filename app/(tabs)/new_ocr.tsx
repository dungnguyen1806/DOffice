import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, Button, Image, TextInput, StyleSheet, ScrollView,
    ActivityIndicator, Alert, Platform, Dimensions, TouchableOpacity
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

// --- Định nghĩa Type (Nếu cần type phức tạp hơn cho service) ---
interface MockOcrService {
    processImage: (imageUri: string) => Promise<string>;
}

interface MockStorageService {
    saveOcrResult: (imageUri: string, textContent: string) => Promise<string>; // Trả về ID dạng string
}

// --- Giả lập Service với Type ---
const mockOcrService: MockOcrService = {
    processImage: async (imageUri: string) => {
        console.log(`[Mock OCR TS] Processing image: ${imageUri}`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (Math.random() < 0.1) {
            throw new Error("Lỗi nhận diện ngẫu nhiên!");
        }
        return `TS: Đây là văn bản được nhận diện từ ảnh:\n${imageUri.split('/').pop()}\nTimestamp: ${new Date().toLocaleTimeString()}`;
    }
};



const mockStorageService: MockStorageService = {
    saveOcrResult: async (imageUri, textContent) => {
        console.log(`[Mock Storage TS] Saving OCR result for image: ${imageUri}`);
        console.log(`[Mock Storage TS] Text content: ${textContent.substring(0, 50)}...`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return `ocr_ts_${Date.now()}`;
    }
};
// --- Kết thúc Giả lập Service ---

const screenWidth = Dimensions.get('window').width;

export default function OcrScreen() {
    // --- State với Type ---
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [extractedText, setExtractedText] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [hasGalleryPermission, setHasGalleryPermission] = useState<boolean | null>(null);

    // --- Logic xin quyền ---
    const requestPermissions = useCallback(async () => {
        const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
        setHasCameraPermission(cameraStatus.status === 'granted');

        const galleryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
        setHasGalleryPermission(galleryStatus.status === 'granted');

        if (cameraStatus.status !== 'granted' || galleryStatus.status !== 'granted') {
            Alert.alert(
                "Yêu cầu quyền",
                "Ứng dụng cần quyền truy cập Camera và Thư viện ảnh để hoạt động."
            );
        }
    }, []);

    useEffect(() => {
        requestPermissions();
    }, [requestPermissions]);
    // --- Kết thúc Logic xin quyền ---

    // --- Các hàm xử lý với Type ---
    const handleAction = async (actionType: 'camera' | 'gallery'): Promise<void> => {
        let permissionGranted: boolean | null = false;
        let launchFunction: (options: ImagePicker.ImagePickerOptions) => Promise<ImagePicker.ImagePickerResult>;

        if (actionType === 'camera') {
            if (hasCameraPermission === null) await requestPermissions();
            permissionGranted = hasCameraPermission;
            launchFunction = ImagePicker.launchCameraAsync;
        } else { // gallery
            if (hasGalleryPermission === null) await requestPermissions();
            permissionGranted = hasGalleryPermission;
            launchFunction = ImagePicker.launchImageLibraryAsync;
        }

        if (!permissionGranted) {
            Alert.alert("Thiếu quyền", `Vui lòng cấp quyền truy cập ${actionType === 'camera' ? 'Camera' : 'Thư viện ảnh'} trong cài đặt.`);
            return;
        }

        setImageUri(null);
        setExtractedText('');
        setError(null);

        try {
            // Sử dụng type ImagePickerResult từ expo-image-picker
            const result: ImagePicker.ImagePickerResult = await launchFunction({
                allowsEditing: false,
                quality: 0.8,
            });

            // Kiểm tra kỹ hơn với type
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const selectedAsset = result.assets[0];
                if (selectedAsset.uri) {
                    setImageUri(selectedAsset.uri);
                    await processImage(selectedAsset.uri);
                }
            }
        } catch (err: any) { // Bắt lỗi với type any hoặc unknown
            console.error(`Error launching ${actionType}:`, err);
            setError(`Không thể ${actionType === 'camera' ? 'chụp ảnh' : 'chọn ảnh'}. Lỗi: ${err.message || 'Unknown error'}`);
            Alert.alert("Lỗi", `Đã xảy ra lỗi khi ${actionType === 'camera' ? 'mở camera' : 'mở thư viện'}.`);
        }
    };

    const processImage = async (uri: string): Promise<void> => {
        if (!uri) return;
        setIsLoading(true);
        setExtractedText('');
        setError(null);
        try {
            const text = await mockOcrService.processImage(uri);
            setExtractedText(text);
        } catch (err: any) {
            console.error("OCR Error:", err);
            setError(`Lỗi nhận diện: ${err.message || 'Unknown error'}`);
            Alert.alert("Lỗi nhận diện", "Không thể xử lý ảnh này. Vui lòng thử lại với ảnh khác.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyText = async (): Promise<void> => {
        if (!extractedText) return;
        try {
            await Clipboard.setStringAsync(extractedText);
            Alert.alert("Đã sao chép", "Văn bản đã được sao chép vào bộ nhớ tạm.");
        } catch (e: any) {
            console.error("Clipboard error:", e);
            Alert.alert("Lỗi", "Không thể sao chép văn bản.");
        }
    };

    const handleSave = async (): Promise<void> => {
        if (!imageUri || !extractedText) return;
        setIsSaving(true);
        setError(null);
        try {
            const historyId = await mockStorageService.saveOcrResult(imageUri, extractedText);
            Alert.alert("Đã lưu", `Kết quả nhận diện đã được lưu vào lịch sử (ID: ${historyId}).`);
            // Optional Reset
            // setImageUri(null);
            // setExtractedText('');
        } catch (err: any) {
            console.error("Save Error:", err);
            setError(`Lỗi lưu trữ: ${err.message || 'Unknown error'}`);
            Alert.alert("Lỗi lưu trữ", "Không thể lưu kết quả vào lịch sử.");
        } finally {
            setIsSaving(false);
        }
    };
    // --- Kết thúc Các hàm xử lý ---

    // --- Render UI (Tương tự JS, chỉ cần đảm bảo props đúng type nếu có) ---
    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Phần chọn/chụp ảnh */}
            <View style={styles.actionSection}>
                <Text style={styles.sectionTitle}>Chọn hoặc Chụp ảnh</Text>
                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        style={[styles.iconButton, hasCameraPermission === false && styles.buttonDisabled]} // Kiểm tra false rõ ràng
                        onPress={() => handleAction('camera')}
                        disabled={isLoading || isSaving || hasCameraPermission === false}
                    >
                        <Ionicons name="camera" size={30} color={hasCameraPermission === false ? 'grey' : "white"} />
                        <Text style={styles.iconButtonText}>Chụp ảnh</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.iconButton, hasGalleryPermission === false && styles.buttonDisabled]}
                        onPress={() => handleAction('gallery')}
                        disabled={isLoading || isSaving || hasGalleryPermission === false}
                    >
                        <Ionicons name="images" size={30} color={hasGalleryPermission === false ? 'grey' : "white"} />
                        <Text style={styles.iconButtonText}>Chọn ảnh</Text>
                    </TouchableOpacity>
                </View>
                {hasCameraPermission === false && <Text style={styles.permissionWarning}>Ứng dụng cần quyền Camera</Text>}
                {hasGalleryPermission === false && <Text style={styles.permissionWarning}>Ứng dụng cần quyền Thư viện ảnh</Text>}
            </View>

            {/* Phần hiển thị ảnh và kết quả */}
            {imageUri && (
                <View style={styles.resultSection}>
                    <Text style={styles.sectionTitle}>Ảnh đã chọn</Text>
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} />

                    {isLoading && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#1E90FF" />
                            <Text style={styles.loadingText}>Đang xử lý ảnh...</Text>
                        </View>
                    )}

                    {error && !isLoading && <Text style={styles.errorText}>{error}</Text>}

                    {!isLoading && extractedText ? (
                        <View style={styles.textResultContainer}>
                            <Text style={styles.sectionTitle}>Kết quả nhận diện</Text>
                            <TextInput
                                value={extractedText}
                                onChangeText={setExtractedText} // onChangeText nhận string, đã đúng type
                                multiline
                                editable={!isLoading && !isSaving}
                                style={styles.textInput}
                                scrollEnabled={true}
                            />
                            <View style={styles.buttonRow}>
                                <Button title="Sao chép" onPress={handleCopyText} disabled={isLoading || isSaving} />
                                <Button title={isSaving ? "Đang lưu..." : "Lưu vào lịch sử"} onPress={handleSave} disabled={isLoading || isSaving} />
                            </View>
                        </View>
                    ) : null}
                </View>
            )}

            {/* Thông báo khi chưa chọn ảnh */}
            {!imageUri && !isLoading && (
                <Text style={styles.infoText}>Vui lòng chụp ảnh hoặc chọn ảnh từ thư viện để bắt đầu.</Text>
            )}
        </ScrollView>
    );
}

// --- Styles (Giữ nguyên như phiên bản JS) ---
const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: '#f0f0f0',
    },
    actionSection: {
        backgroundColor: 'white',
        padding: 15,
        margin: 10,
        borderRadius: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    resultSection: {
        backgroundColor: 'white',
        padding: 15,
        marginHorizontal: 10,
        marginBottom: 10,
        borderRadius: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 15,
        color: '#333',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginVertical: 10,
    },
    iconButton: {
        backgroundColor: '#1E90FF',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 25,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 140,
    },
    iconButtonText: {
        color: 'white',
        marginLeft: 10,
        fontSize: 16,
        fontWeight: '500',
    },
    buttonDisabled: {
        backgroundColor: '#a9a9a9',
    },
    permissionWarning: {
        color: 'red',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 5,
    },
    imagePreview: {
        width: screenWidth - 60,
        height: (screenWidth - 60) * 0.6,
        resizeMode: 'contain',
        alignSelf: 'center',
        marginVertical: 15,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
    },
    loadingContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#555',
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginVertical: 15,
        fontSize: 14,
        paddingHorizontal: 10,
    },
    textResultContainer: {
        marginTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 15,
    },
    textInput: {
        backgroundColor: '#fff',
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 5,
        padding: 12,
        fontSize: 15,
        minHeight: 150,
        maxHeight: 300,
        textAlignVertical: 'top',
        marginBottom: 15,
    },
    infoText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        color: 'grey',
        paddingHorizontal: 20,
    },
});
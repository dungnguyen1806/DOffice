import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, Button, Image, TextInput, StyleSheet, ScrollView,
    ActivityIndicator, Alert, Platform, Dimensions, TouchableOpacity
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

// Định nghĩa trạng thái Job (phải khớp với backend)
enum JobStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
}

interface WebSocketMessage {
    job_id: string;
    status: JobStatus;
    text?: string; // Tên property khớp với backend
    error?: string; // Tên property khớp với backend
    filename?: string;
    type: 'status_update' | 'job_completed' | 'job_failed' | 'error';
}

interface OcrService {
    submitImageForOcr: (imageUri: string) => Promise<string>;
    listenToOcrJob: (jobId: string, onUpdate: (message: WebSocketMessage) => void) => WebSocket;
}

// Định nghĩa URL backend WebSocket
const BACKEND_BASE_URL = 'https://doffice-backend.onrender.com/api/v1'; // Base URL cho API
const BACKEND_WS_BASE_URL = 'wss://doffice-backend.onrender.com/api/v1'; // Base URL cho WebSocket (ws hoặc wss)


// interface OcrService {
//     processImage: (imageUri: string) => Promise<string>;
// }

interface MockStorageService {
    saveOcrResult: (imageUri: string, textContent: string) => Promise<string>; // Trả về ID dạng string
}

const OcrService: OcrService = {
    // Hàm gửi ảnh và nhận job_id
    submitImageForOcr: async (imageUri: string): Promise<string> => {
        console.log('[OCR Service] Submitting image for OCR:', imageUri);

        const formData = new FormData();

        const filename = imageUri.split('/').pop() || `photo.jpg`;
        const match = /\.(\w+)$/.exec(filename || '');
        const fileType = match ? `image/${match[1]}` : `image`;

        formData.append('file', {
            uri: imageUri,
            name: filename,
            type: fileType,
        } as any); // Type assertion for FormData.append is often needed in RN

        const response = await fetch(`${BACKEND_BASE_URL}/submit`, {
            method: 'POST',
            body: formData,
            headers: {
                // Do not set Content-Type for FormData, browser/RN will do it with boundary
                // 'Content-Type': 'multipart/form-data',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to submit image for OCR: ${response.status} - ${errorText}`);
        }

        const result: { job_id: string; status: string; message: string } = await response.json();
        console.log('[OCR Service] Job submitted:', result.job_id);
        return result.job_id;
    },

    // Hàm mở kết nối WebSocket và lắng nghe cập nhật
    listenToOcrJob: (jobId: string, onUpdate: (message: WebSocketMessage) => void): WebSocket => {
        const wsUrl = `${BACKEND_WS_BASE_URL}/ws/status/${jobId}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log(`[WebSocket] Connected to ${wsUrl}`);
            onUpdate({ job_id: jobId, status: JobStatus.PENDING, type: 'status_update', filename: '' }); // Initial state
        };

        ws.onmessage = (event) => {
            try {
                const message: WebSocketMessage = JSON.parse(event.data as string);
                console.log(`[WebSocket] Received message for job ${jobId}:`, message);
                onUpdate(message);
            } catch (e) {
                console.error(`[WebSocket] Failed to parse message for job ${jobId}:`, event.data, e);
                onUpdate({
                    job_id: jobId,
                    status: JobStatus.FAILED,
                    error: `Lỗi phân tích dữ liệu từ server: ${e}`,
                    type: 'error'
                });
            }
        };

        ws.onerror = (error) => {
            console.error(`[WebSocket] Error for job ${jobId}:`, error);
            onUpdate({
                job_id: jobId,
                status: JobStatus.FAILED,
                error: `Lỗi kết nối WebSocket: ${error || 'Unknown error'}`,
                type: 'error'
            });
        };

        ws.onclose = (event) => {
            console.log(`[WebSocket] Closed for job ${jobId}: Code=${event.code}, Reason=${event.reason}, Clean=${event.wasClean}`);
            // if (!event.wasClean) {
            //     // If the connection was not closed cleanly, it might be an error
            //     onUpdate({
            //         job_id: jobId,
            //         status: JobStatus.FAILED,
            //         error: `Kết nối WebSocket bị đóng bất ngờ (Code: ${event.code})`,
            //         type: 'error'
            //     });
            // }
        };

        return ws;
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
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null); // Ref để lưu trữ đối tượng WebSocket


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

    // Dọn dẹp WebSocket khi component unmount hoặc khi có job mới
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                console.log("[WebSocket Cleanup] Closing previous WebSocket.");
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []); // Chạy một lần khi mount và cleanup khi unmount

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

        // Đóng kết nối WebSocket cũ nếu có
        if (wsRef.current) {
            console.log("[WebSocket] Closing existing WebSocket for new action.");
            wsRef.current.close();
            wsRef.current = null;
        }

        setImageUri(null);
        setExtractedText('');
        setError(null);
        setIsLoading(true); // Bắt đầu loading khi chọn ảnh
        setCurrentJobId(null); // Reset current job ID

        // TODO: start from here

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
                    const jobId = await OcrService.submitImageForOcr(selectedAsset.uri);
                    setCurrentJobId(jobId);

                    // Mở WebSocket và lắng nghe cập nhật
                    wsRef.current = OcrService.listenToOcrJob(jobId, (message) => {
                        // Cập nhật UI dựa trên thông điệp WebSocket
                        if (message.job_id === jobId) { // Đảm bảo thông điệp đúng job
                            switch (message.type) {
                                case 'status_update':
                                    if (message.status === JobStatus.PROCESSING) {
                                        setIsLoading(true);
                                        setError(null);
                                    } else if (message.status === JobStatus.PENDING) {
                                        // Vẫn đang chờ, giữ loading
                                        setIsLoading(true);
                                        setError(null);
                                    }
                                    console.log(`Job ${jobId} Status: ${message.status}`);
                                    break;
                                case 'job_completed':
                                    setExtractedText(message.text || '');
                                    setIsLoading(false);
                                    setError(null);
                                    console.log(`Job ${jobId} Completed! Result:`, message.text);
                                    // Optionally close websocket here if it's job-specific
                                    if (wsRef.current) {
                                        wsRef.current.close();
                                        wsRef.current = null;
                                    }
                                    break;
                                case 'job_failed':
                                case 'error': // Backend gửi type 'error' nếu job_id không tồn tại hoặc lỗi chung
                                    setError(`Lỗi: ${message.error || 'Unknown error'}`);
                                    setIsLoading(false);
                                    setExtractedText('');
                                    console.error(`Job ${jobId} Failed! Error:`, message.error);
                                    if (wsRef.current) {
                                        wsRef.current.close();
                                        wsRef.current = null;
                                    }
                                    break;
                            }
                        }
                    });
                } else {
                    setIsLoading(false); // Ngừng loading nếu không có URI hợp lệ
                }
            } else {
                setIsLoading(false); // Ngừng loading nếu hủy chọn ảnh
            }
        } catch (err: any) { // Bắt lỗi với type any hoặc unknown
            console.error(`Error launching ${actionType}:`, err);
            setError(`Không thể ${actionType === 'camera' ? 'chụp ảnh' : 'chọn ảnh'}. Lỗi: ${err.message || 'Unknown error'}`);
            Alert.alert("Lỗi", `Đã xảy ra lỗi khi ${actionType === 'camera' ? 'mở camera' : 'mở thư viện'}.`);
        }
    };

    const processImage = async (uri: string): Promise<void> => {
        console.warn("processImage is no longer directly called. Use WebSocket for async processing.");
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

    // --- Render UI ---
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

// --- Style ---
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
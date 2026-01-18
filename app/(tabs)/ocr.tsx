// app/(tabs)/ocr.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, Button, Image, TextInput, StyleSheet, ScrollView,
    ActivityIndicator, Alert, Dimensions, TouchableOpacity
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { submitJob, BACKEND_WS_URL, updateJobText } from '../../api/client';
import { JobStatus, WebSocketMessage } from '../../types/jobs'; 

const screenWidth = Dimensions.get('window').width;

export default function OcrScreen() {
    const { user } = useAuth();

    // --- State với Type ---
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [extractedText, setExtractedText] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [hasBeenSaved, setHasBeenSaved] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [hasGalleryPermission, setHasGalleryPermission] = useState<boolean | null>(null);
    const [currentJobId, setCurrentJobId] = useState<number | string | null>(null);
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
            }
        };
    }, []); // Chạy một lần khi mount và cleanup khi unmount

    // Chuyển hàm listen vào trong Screen, không sử dụng interface
    const listenToJob = (jobId: number | string) => {
        const wsUrl = `${BACKEND_WS_URL}/ws/status/${jobId}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => console.log(`[WebSocket] Connected for job ${jobId}`);
        ws.onmessage = (event) => {
            try {
                const message: WebSocketMessage = JSON.parse(event.data);
                if (String(message.job_id) === String(jobId)) { // Ensure message is for the current job
                    switch (message.type) {
                        case 'status_update':
                            if (message.status === JobStatus.PROCESSING) setIsLoading(true);
                            break;
                        case 'job_completed':
                            setExtractedText(message.text || '');
                            setIsLoading(false);
                            setHasBeenSaved(false); // Reset save confirmation for new result
                            break;
                        case 'job_failed':
                        case 'error':
                            setError(`Lỗi: ${message.error || 'Unknown error'}`);
                            setIsLoading(false);
                            break;
                    }
                }
            } catch (e) {
                console.error(`[WebSocket] Failed to parse message:`, e);
                setError('Lỗi kết nối máy chủ.');
                setIsLoading(false);
            }
        };
        ws.onerror = (error) => {
            console.error(`[WebSocket] Error for job ${jobId}:`, error);
            setError('Lỗi kết nối WebSocket.');
            setIsLoading(false);
        };
        ws.onclose = () => console.log(`[WebSocket] Closed for job ${jobId}`);
    };

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
        }

        setImageUri(null);
        setExtractedText('');
        setError(null);
        setIsLoading(true); // Bắt đầu loading khi chọn ảnh
        setCurrentJobId(null); // Reset current job ID
        setHasBeenSaved(false);

        try {
            const result = await (actionType === 'camera' 
                ? ImagePicker.launchCameraAsync 
                : ImagePicker.launchImageLibraryAsync
            )({ allowsEditing: false, quality: 0.8 });

            if (!result.canceled && result.assets && result.assets[0].uri) {
                const uri = result.assets[0].uri;
                setImageUri(uri);

                // --- Use the centralized API client ---
                const response = await submitJob(uri);
                const { job_id } = response.data; 
                setCurrentJobId(job_id);
                
                // --- Start listening for updates ---
                listenToJob(job_id);
            } else {
                setIsLoading(false); // User cancelled selection
            }
        } catch (err: any) {
            console.error(`Error in handleAction:`, err.response?.data || err.message);
            setError(`Không thể gửi yêu cầu. Lỗi: ${err.response?.data?.detail || err.message}`);
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

    const handleSave = async () => {
        if (typeof currentJobId !== 'number') {
            Alert.alert("Lỗi", "Không thể lưu chỉnh sửa cho phiên khách. Vui lòng đăng nhập và thử lại.");
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await updateJobText(currentJobId, extractedText);
            setHasBeenSaved(true);
            Alert.alert("Thành công", "Nội dung chỉnh sửa đã được cập nhật vào lịch sử.");
        } catch (err: any) {
            console.error("Update error:", err);
            setError("Không thể cập nhật nội dung.");
            Alert.alert("Lỗi", "Đã xảy ra lỗi khi lưu chỉnh sửa.");
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
                                <Button title="Sao chép" onPress={handleCopyText} />
                                {user && (
                                    <Button 
                                        title={hasBeenSaved ? "Đang lưu..." : "Lưu vào lịch sử"} 
                                        onPress={handleSave} 
                                        disabled={hasBeenSaved} 
                                    />
                                )}
                            </View>
                        </View>
                    ) : null}
                </View>
            )}

            {/* Thông báo khi chưa chọn ảnh */}
            {!imageUri && !isLoading && (
                <Text style={styles.infoText}>Nhấn "Chụp ảnh" hoặc chọn ảnh từ thư viện để bắt đầu.</Text>
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
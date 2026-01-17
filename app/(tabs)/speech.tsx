import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, Button, TextInput, StyleSheet, ScrollView,
    ActivityIndicator, Alert, TouchableOpacity
} from 'react-native';
import { Audio } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@/context/AuthContext';
import { submitJob, BACKEND_WS_URL } from '../../api/client';
import { JobStatus, WebSocketMessage } from '../../types/jobs';

export default function SpeechToTextScreen() {
    const { user } = useAuth();

    // --- State với Type ---
    const [recording, setRecording] = useState<Audio.Recording | undefined>();
    const [recordingUri, setRecordingUri] = useState<string | null>(null);
    const [extractedText, setExtractedText] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    
    const [hasBeenSaved, setHasBeenSaved] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMicrophonePermission, setHasMicrophonePermission] = useState<boolean | null>(null);
    const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentJobId, setCurrentJobId] = useState<string | number | null>(null); // State cho Job ID
    const wsRef = useRef<WebSocket | null>(null); // Ref để lưu trữ đối tượng WebSocket

    // --- Logic xin quyền ---
    const requestPermissions = useCallback(async () => {
        const { status } = await Audio.requestPermissionsAsync();
        setHasMicrophonePermission(status === 'granted');

        if (status !== 'granted') {
            Alert.alert(
                "Yêu cầu quyền",
                "Ứng dụng cần quyền truy cập Micro để ghi âm."
            );
        }
    }, []);

    useEffect(() => {
        requestPermissions();
    }, [requestPermissions]);
    // --- Kết thúc Logic xin quyền ---

    // Cleanup WebSocket khi component unmount
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                console.log("[WebSocket Cleanup] Closing previous WebSocket.");
                wsRef.current.close();
                wsRef.current = null;
            }
            // Cũng đảm bảo dừng phát âm thanh nếu đang phát
            if (soundObject) {
                soundObject.unloadAsync();
                setSoundObject(null);
                setIsPlaying(false);
            }
        };
    }, [soundObject]);

    const listenToJob = (jobId: number | string) => {
        const wsUrl = `${BACKEND_WS_URL}/ws/status/${jobId}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => console.log(`[WebSocket] Connected for job ${jobId}`);
        ws.onmessage = (event) => {
            try {
                const message: WebSocketMessage = JSON.parse(event.data);
                if (String(message.job_id) === String(jobId)) {
                    switch (message.type) {
                        case 'status_update':
                            if (message.status === JobStatus.PROCESSING) setIsLoading(true);
                            break;
                        case 'job_completed':
                            setExtractedText(message.text || '');
                            setIsLoading(false);
                            setHasBeenSaved(false); // Reset save confirmation
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
    const handleFileSubmit = async (uri: string) => {
        try {
            const response = await submitJob(uri);
            const { job_id } = response.data;
            setCurrentJobId(job_id);
            listenToJob(job_id);
        } catch (err: any) {
            console.error(`Error in handleFileSubmit:`, err.response?.data || err.message);
            setError(`Không thể gửi yêu cầu. Lỗi: ${err.response?.data?.detail || err.message}`);
            setIsLoading(false);
        }
    };
    
    const startRecording = async (): Promise<void> => {
        if (hasMicrophonePermission === false) {
            Alert.alert("Thiếu quyền", "Vui lòng cấp quyền truy cập Micro trong cài đặt.");
            return;
        }

        // Đóng kết nối WebSocket cũ nếu có job mới
        if (wsRef.current) {
            console.log("[WebSocket] Closing existing WebSocket for new recording.");
            wsRef.current.close();
            wsRef.current = null;
        }

        // Đảm bảo dừng phát nhạc trước khi ghi âm mới
        if (isPlaying && soundObject) {
            await stopSound();
        }

        setError(null);
        setExtractedText('');
        setRecordingUri(null);
        setCurrentJobId(null); // Reset job ID

        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(recording);
            console.log('Recording started');
        } catch (err: any) {
            console.error('Failed to start recording', err);
            setError(`Không thể bắt đầu ghi âm. Lỗi: ${err.message || 'Unknown error'}`);
            Alert.alert("Lỗi ghi âm", "Không thể bắt đầu ghi âm. Vui lòng thử lại.");
        }
    };

    const stopRecording = async (): Promise<void> => {
        if (!recording) return;

        setIsLoading(true); // Bắt đầu hiển thị loading khi dừng và xử lý
        setError(null);
        setHasBeenSaved(false);

        try {
            await recording.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true, // Vẫn cho phép phát lại sau khi ghi
            });
            const uri = recording.getURI();
            setRecording(undefined);
            setRecordingUri(uri);
            console.log('Recording stopped and stored at', uri);

            if (uri) {
                await handleFileSubmit(uri);
            } else {
                setIsLoading(false); // Ngừng loading nếu không có URI hợp lệ
            }
        } catch (err: any) {
            console.error('Failed to stop recording', err);
            setError(`Không thể dừng ghi âm hoặc xử lý. Lỗi: ${err.message || 'Unknown error'}`);
            Alert.alert("Lỗi", "Đã xảy ra lỗi khi dừng ghi âm hoặc xử lý.");
            setIsLoading(false);
        }
    };

    const pickAudioFile = async (): Promise<void> => {
        // Đảm bảo dừng ghi âm hoặc phát nhạc nếu đang diễn ra
        if (recording) {
            await stopRecording(); // Dừng ghi âm nếu đang ghi
            setRecording(undefined);
        }
        if (isPlaying && soundObject) {
            await stopSound(); // Dừng phát nhạc nếu đang phát
        }

        setRecordingUri(null);
        setExtractedText('');
        setError(null);
        setIsLoading(true); // Bắt đầu loading khi chọn file
        setCurrentJobId(null); // Reset job ID
        setHasBeenSaved(false);

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'audio/*', // Chỉ cho phép chọn các file âm thanh
                copyToCacheDirectory: true, // Quan trọng để đảm bảo file có thể được đọc
            });

            if (!result.canceled && result.assets && result.assets[0].uri) {
                const uri = result.assets[0].uri;
                setRecordingUri(uri);
                await handleFileSubmit(uri);
            } else {
                setIsLoading(false);
            }
        } catch (err: any) {
            console.error("Error picking audio file:", err);
            setError(`Không thể chọn file âm thanh. Lỗi: ${err.message || 'Unknown error'}`);
            Alert.alert("Lỗi chọn file", "Đã xảy ra lỗi khi chọn file âm thanh.");
            setIsLoading(false); // Dừng loading nếu có lỗi
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

    const handleSave = () => {
        if (!user) {
            Alert.alert("Chưa đăng nhập", "Bạn cần đăng nhập để xem lịch sử.");
            return;
        }
        setHasBeenSaved(true);
        Alert.alert("Đã lưu", "Kết quả này đã được tự động lưu vào lịch sử của bạn.");
    };

    const playSound = async (): Promise<void> => {
        if (!recordingUri) {
            Alert.alert("Lỗi", "Không có bản ghi âm để phát.");
            return;
        }

        setIsPlaying(true);
        setError(null); // Clear previous errors

        try {
            // Unload previous sound if exists
            if (soundObject) {
                await soundObject.unloadAsync();
                setSoundObject(null);
            }

            // Create new sound object
            const { sound } = await Audio.Sound.createAsync(
                { uri: recordingUri },
                { shouldPlay: true },
                (status) => {
                    if ('isLoaded' in status && status.isLoaded && status.didJustFinish) {
                        // Khi phát xong, dừng lại và reset state
                        setIsPlaying(false);
                        if (soundObject) {
                            soundObject.unloadAsync(); // Dỡ bỏ âm thanh khỏi bộ nhớ
                            setSoundObject(null);
                        }
                    }
                }
            );
            setSoundObject(sound);
            await sound.playAsync();
            console.log('Playing sound from:', recordingUri);
        } catch (err: any) {
            console.error('Failed to play sound', err);
            setError(`Không thể phát bản ghi âm. Lỗi: ${err.message || 'Unknown error'}`);
            Alert.alert("Lỗi phát âm thanh", "Đã xảy ra lỗi khi phát bản ghi âm.");
            setIsPlaying(false); // Đảm bảo trạng thái phát là false khi có lỗi
            if (soundObject) {
                soundObject.unloadAsync();
                setSoundObject(null);
            }
        }
    };

    const stopSound = async (): Promise<void> => {
        if (soundObject) {
            try {
                await soundObject.stopAsync();
                await soundObject.unloadAsync();
                setSoundObject(null);
                setIsPlaying(false);
                console.log('Playback stopped');
            } catch (err: any) {
                console.error('Failed to stop sound', err);
                setError(`Không thể dừng phát. Lỗi: ${err.message || 'Unknown error'}`);
            }
        }
    };
    // --- Kết thúc Các hàm xử lý ---

    // --- Render UI ---
    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Phần ghi âm / chọn file */}
            <View style={styles.actionSection}>
                <Text style={styles.sectionTitle}>Nguồn âm thanh</Text>
                <View style={styles.buttonRow}>
                    {!recording ? (
                        <TouchableOpacity
                            style={[styles.iconButton, hasMicrophonePermission === false && styles.buttonDisabled]}
                            onPress={startRecording}
                            disabled={isLoading || hasBeenSaved || hasMicrophonePermission === false || isPlaying}
                        >
                            <Ionicons name="mic-circle" size={30} color={hasMicrophonePermission === false ? 'grey' : "white"} />
                            <Text style={styles.iconButtonText}>Ghi âm</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.iconButton, styles.stopButton]}
                            onPress={stopRecording}
                            disabled={isLoading || hasBeenSaved}
                        >
                            <Ionicons name="stop-circle" size={30} color="white" />
                            <Text style={styles.iconButtonText}>Dừng ghi</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.iconButton]}
                        onPress={pickAudioFile}
                        disabled={isLoading || hasBeenSaved || !!recording || isPlaying} // Vô hiệu hóa khi đang ghi âm hoặc phát nhạc
                    >
                        <Ionicons name="folder-open" size={30} color="white" />
                        <Text style={styles.iconButtonText}>Chọn file</Text>
                    </TouchableOpacity>
                </View>
                {hasMicrophonePermission === false && <Text style={styles.permissionWarning}>Ứng dụng cần quyền Micro</Text>}
            </View>

            {/* Phần hiển thị kết quả */}
            {(recordingUri || isLoading || error) && (
                <View style={styles.resultSection}>
                    {recordingUri && (
                        <View style={styles.audioPlaybackContainer}>
                            <Text style={styles.sectionTitle}>Bản ghi âm / File đã chọn</Text>
                            <View style={styles.buttonRow}>
                                {!isPlaying ? (
                                    <TouchableOpacity
                                        style={[styles.smallIconButton]}
                                        onPress={playSound}
                                        disabled={isLoading || hasBeenSaved || !recordingUri}
                                    >
                                        <Ionicons name="play-circle" size={24} color="white" />
                                        <Text style={styles.smallIconButtonText}>Phát lại</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.smallIconButton, styles.stopPlaybackButton]}
                                        onPress={stopSound}
                                        disabled={isLoading || hasBeenSaved}
                                    >
                                        <Ionicons name="stop-circle" size={24} color="white" />
                                        <Text style={styles.smallIconButtonText}>Dừng phát</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {/* Hiển thị tên file đã chọn/ghi âm */}
                            {recordingUri && <Text style={styles.fileNameText}>File: {recordingUri.split('/').pop()}</Text>}
                        </View>
                    )}

                    {isLoading && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#1E90FF" />
                            <Text style={styles.loadingText}>Đang chuyển đổi giọng nói...</Text>
                        </View>
                    )}

                    {error && !isLoading && <Text style={styles.errorText}>{error}</Text>}

                    {!isLoading && extractedText ? (
                        <View style={styles.textResultContainer}>
                            <Text style={styles.sectionTitle}>Văn bản đã chuyển đổi</Text>
                            <TextInput
                                value={extractedText}
                                onChangeText={setExtractedText}
                                multiline
                                editable={!isLoading && !hasBeenSaved && !isPlaying}
                                style={styles.textInput}
                                scrollEnabled={true}
                            />
                            <View style={styles.buttonRow}>
                                <Button title="Sao chép" onPress={handleCopyText} disabled={isLoading || hasBeenSaved || isPlaying} />
                                {user && (
                                    <Button 
                                        title={hasBeenSaved ? "Đang lưu..." : "Lưu vào lịch sử"} 
                                        onPress={handleSave} 
                                        disabled={isLoading || hasBeenSaved || isPlaying} 
                                    />
                                )}
                            </View>
                        </View>
                    ) : null}
                </View>
            )}

            {/* Thông báo khi chưa ghi âm */}
            {!recordingUri && !isLoading && !recording && (
                <Text style={styles.infoText}>Nhấn "Bắt đầu ghi âm" hoặc chọn file âm thanh.</Text>
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
    stopButton: {
        backgroundColor: '#FF4500', // Màu đỏ cho nút dừng
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
    audioPlaybackContainer: {
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        marginBottom: 15,
    },
    smallIconButton: {
        backgroundColor: '#28a745', // Màu xanh lá cho nút phát
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 120,
    },
    stopPlaybackButton: {
        backgroundColor: '#FF6347', // Màu cam cho nút dừng phát
    },
    smallIconButtonText: {
        color: 'white',
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '500',
    },
    fileNameText: {
        fontSize: 14,
        color: '#555',
        textAlign: 'center',
        marginTop: 10,
        fontStyle: 'italic',
    },
});
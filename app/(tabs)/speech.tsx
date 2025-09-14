import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, Button, TextInput, StyleSheet, ScrollView,
    ActivityIndicator, Alert, Platform, Dimensions, TouchableOpacity
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

// Định nghĩa trạng thái Job (phải khớp với backend)
enum JobStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
}

// Định nghĩa cấu trúc thông điệp WebSocket từ backend
interface WebSocketMessage {
    job_id: string;
    status: JobStatus;
    text?: string; // Kết quả transcribe (tên property khớp với backend)
    error?: string; // Tên property khớp với backend
    filename?: string;
    type: 'status_update' | 'job_completed' | 'job_failed' | 'error';
}

interface SpeechToTextService {
    submitAudioForTranscribe: (audioUri: string) => Promise<string>;
    listenToTranscribeJob: (jobId: string, onUpdate: (message: WebSocketMessage) => void) => WebSocket;
}

interface MockStorageService {
    saveSpeechResult: (audioUri: string, textContent: string) => Promise<string>; // Trả về ID dạng string
}

// Định nghĩa URL backend WebSocket
const BACKEND_BASE_URL = 'https://doffice-backend.onrender.com/api/v1'; // Base URL cho API
const BACKEND_WS_BASE_URL = 'wss://doffice-backend.onrender.com/api/v1'; // Base URL cho WebSocket (ws hoặc wss)

const SpeechToTextService: SpeechToTextService = {
    // Hàm gửi audio và nhận job_id
    submitAudioForTranscribe: async (audioUri: string): Promise<string> => {
        console.log('[STT Service] Submitting audio for transcribe:', audioUri);

        const formData = new FormData();

        const filename = audioUri.split('/').pop() || `audio.m4a`;
        const match = /\.(\w+)$/.exec(filename || '');
        // Cần đảm bảo rằng fileType đúng với backend mong đợi (ví dụ: audio/mpeg cho mp3, audio/wav, audio/flac, audio/x-m4a cho m4a)
        const fileType = match ? `audio/${match[1]}` : `audio/mpeg`; // Mặc định là mpeg nếu không tìm thấy, hoặc điều chỉnh cho phù hợp

        formData.append('file', {
            uri: audioUri,
            name: filename,
            type: fileType,
        } as any); // Type assertion for FormData.append is often needed in RN

        const response = await fetch(`${BACKEND_BASE_URL}/submit`, {
            method: 'POST',
            body: formData,
            headers: {
                // Do not set Content-Type for FormData, browser/RN will do it with boundary
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to submit audio for transcribe: ${response.status} - ${errorText}`);
        }

        const result: { job_id: string; status: string; message: string } = await response.json();
        console.log('[STT Service] Job submitted:', result.job_id);
        return result.job_id;
    },

    // Hàm mở kết nối WebSocket và lắng nghe cập nhật
    listenToTranscribeJob: (jobId: string, onUpdate: (message: WebSocketMessage) => void): WebSocket => {
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
    saveSpeechResult: async (audioUri, textContent) => {
        console.log(`[Mock Storage TS] Saving STT result for audio: ${audioUri}`);
        console.log(`[Mock Storage TS] Text content: ${textContent.substring(0, 50)}...`);
        // Giả lập độ trễ lưu trữ
        await new Promise(resolve => setTimeout(resolve, 500));
        return `stt_ts_${Date.now()}`;
    }
};
// --- Kết thúc Giả lập Service ---

const screenWidth = Dimensions.get('window').width;

export default function SpeechToTextScreen() {
    // --- State với Type ---
    const [recording, setRecording] = useState<Audio.Recording | undefined>();
    const [recordingUri, setRecordingUri] = useState<string | null>(null);
    const [extractedText, setExtractedText] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMicrophonePermission, setHasMicrophonePermission] = useState<boolean | null>(null);
    const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null); // State cho Job ID
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
    }, []);

    // --- Các hàm xử lý với Type ---
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
                const jobId = await SpeechToTextService.submitAudioForTranscribe(uri);
                setCurrentJobId(jobId);

                // Mở WebSocket và lắng nghe cập nhật
                wsRef.current = SpeechToTextService.listenToTranscribeJob(jobId, (message) => {
                    // Cập nhật UI dựa trên thông điệp WebSocket
                    if (message.job_id === jobId) { // Đảm bảo thông điệp đúng job
                        switch (message.type) {
                            case 'status_update':
                                if (message.status === JobStatus.PROCESSING) {
                                    setIsLoading(true);
                                    setError(null);
                                } else if (message.status === JobStatus.PENDING) {
                                    setIsLoading(true); // Vẫn đang chờ
                                    setError(null);
                                }
                                console.log(`Job ${jobId} Status: ${message.status}`);
                                break;
                            case 'job_completed':
                                setExtractedText(message.text || '');
                                setIsLoading(false);
                                setError(null);
                                console.log(`Job ${jobId} Completed! Result:`, message.text);
                                // Đóng websocket khi job hoàn thành
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

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'audio/*', // Chỉ cho phép chọn các file âm thanh
                copyToCacheDirectory: true, // Quan trọng để đảm bảo file có thể được đọc
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const pickedAsset = result.assets[0];
                if (pickedAsset.uri) {
                    setRecordingUri(pickedAsset.uri); // Sử dụng recordingUri để tái sử dụng logic
                    // --- Gửi job và lắng nghe WebSocket ---
                    const jobId = await SpeechToTextService.submitAudioForTranscribe(pickedAsset.uri);
                    setCurrentJobId(jobId);

                    wsRef.current = SpeechToTextService.listenToTranscribeJob(jobId, (message) => {
                        // Cập nhật UI dựa trên thông điệp WebSocket
                        if (message.job_id === jobId) {
                            switch (message.type) {
                                case 'status_update':
                                    if (message.status === JobStatus.PROCESSING) {
                                        setIsLoading(true);
                                        setError(null);
                                    } else if (message.status === JobStatus.PENDING) {
                                        setIsLoading(true); // Vẫn đang chờ
                                        setError(null);
                                    }
                                    console.log(`Job ${jobId} Status: ${message.status}`);
                                    break;
                                case 'job_completed':
                                    setExtractedText(message.text || '');
                                    setIsLoading(false);
                                    setError(null);
                                    console.log(`Job ${jobId} Completed! Result:`, message.text);
                                    if (wsRef.current) {
                                        wsRef.current.close();
                                        wsRef.current = null;
                                    }
                                    break;
                                case 'job_failed':
                                case 'error':
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
                setIsLoading(false); // Ngừng loading nếu hủy chọn file
            }
        } catch (err: any) {
            console.error("Error picking audio file:", err);
            setError(`Không thể chọn file âm thanh. Lỗi: ${err.message || 'Unknown error'}`);
            Alert.alert("Lỗi chọn file", "Đã xảy ra lỗi khi chọn file âm thanh.");
            setIsLoading(false); // Dừng loading nếu có lỗi
        }
    };

    const processAudio = async (uri: string): Promise<void> => {
        console.warn("processAudio is no longer directly called. Use WebSocket for async processing.");
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
        if (!recordingUri || !extractedText) return;
        setIsSaving(true);
        setError(null);
        try {
            const historyId = await mockStorageService.saveSpeechResult(recordingUri, extractedText);
            Alert.alert("Đã lưu", `Kết quả chuyển đổi đã được lưu vào lịch sử (ID: ${historyId}).`);
            // Optional: Reset states after saving
            // setRecordingUri(null);
            // setExtractedText('');
        } catch (err: any) {
            console.error("Save Error:", err);
            setError(`Lỗi lưu trữ: ${err.message || 'Unknown error'}`);
            Alert.alert("Lỗi lưu trữ", "Không thể lưu kết quả vào lịch sử.");
        } finally {
            setIsSaving(false);
        }
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
                            disabled={isLoading || isSaving || hasMicrophonePermission === false || isPlaying}
                        >
                            <Ionicons name="mic-circle" size={30} color={hasMicrophonePermission === false ? 'grey' : "white"} />
                            <Text style={styles.iconButtonText}>Ghi âm</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.iconButton, styles.stopButton]}
                            onPress={stopRecording}
                            disabled={isLoading || isSaving}
                        >
                            <Ionicons name="stop-circle" size={30} color="white" />
                            <Text style={styles.iconButtonText}>Dừng ghi</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.iconButton]}
                        onPress={pickAudioFile}
                        disabled={isLoading || isSaving || !!recording || isPlaying} // Vô hiệu hóa khi đang ghi âm hoặc phát nhạc
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
                                        disabled={isLoading || isSaving || !recordingUri}
                                    >
                                        <Ionicons name="play-circle" size={24} color="white" />
                                        <Text style={styles.smallIconButtonText}>Phát lại</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.smallIconButton, styles.stopPlaybackButton]}
                                        onPress={stopSound}
                                        disabled={isLoading || isSaving}
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
                                editable={!isLoading && !isSaving && !isPlaying}
                                style={styles.textInput}
                                scrollEnabled={true}
                            />
                            <View style={styles.buttonRow}>
                                <Button title="Sao chép" onPress={handleCopyText} disabled={isLoading || isSaving || isPlaying} />
                                <Button title={isSaving ? "Đang lưu..." : "Lưu vào lịch sử"} onPress={handleSave} disabled={isLoading || isSaving || isPlaying} />
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
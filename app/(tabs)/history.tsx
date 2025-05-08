import React, { useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet, Button, Alert,
    TouchableOpacity, ActivityIndicator, Image, ListRenderItemInfo // Import ListRenderItemInfo
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';

// --- Định nghĩa Interface cho Item Lịch sử ---
interface HistoryItem {
    id: string;
    type: 'ocr' | 'speech';
    originalUri: string | null; // URI file ảnh/âm thanh gốc
    textFilePath: string | null; // URI file text đã nhận diện
    previewText: string;        // Đoạn text ngắn để preview
    date: string;               // Ngày tạo dạng ISO string
}

// --- Định nghĩa Type cho Service (Nếu cần) ---
interface MockHistoryStorageService {
    loadHistory: () => Promise<HistoryItem[]>;
    deleteHistoryItem: (id: string, originalUri: string | null, textFilePath: string | null) => Promise<boolean>;
    loadTextFromFile: (filePath: string) => Promise<string>;
}

// --- Giả lập Service với Type ---
const mockStorageService: MockHistoryStorageService = {
    loadHistory: async () => {
        console.log("[Mock Storage TS] Loading history...");
        await new Promise(resolve => setTimeout(resolve, 800));
        if (Math.random() < 0.1) {
            throw new Error("TS: Không thể tải lịch sử từ DB giả lập!");
        }
        const data: HistoryItem[] = [ // Ép kiểu dữ liệu trả về
            { id: 'ocr_ts_1713500000000', type: 'ocr', originalUri: 'file:///path/to/fake_image1.jpg', textFilePath: 'file:///path/to/fake_text1.txt', previewText: 'TS: Văn bản nhận diện từ ảnh đầu tiên...', date: '2025-04-19T10:00:00Z' },
            { id: 'speech_ts_1713510000000', type: 'speech', originalUri: 'file:///path/to/fake_audio1.m4a', textFilePath: 'file:///path/to/fake_speech_text1.txt', previewText: 'TS: Đây là bản ghi âm thứ nhất đã được chuyển đổi...', date: '2025-04-19T13:00:00Z' },
            { id: 'ocr_ts_1713520000000', type: 'ocr', originalUri: 'file:///path/to/fake_image2.png', textFilePath: 'file:///path/to/fake_text2.txt', previewText: 'TS: Một ảnh khác với nội dung...', date: '2025-04-19T16:00:00Z' },
        ];
        return data;
    },
    deleteHistoryItem: async (id, originalUri, textFilePath) => {
        console.log(`[Mock Storage TS] Deleting history item: ${id}`);
        console.log(`[Mock Storage TS]   Original: ${originalUri}`);
        console.log(`[Mock Storage TS]   Text file: ${textFilePath}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        if (Math.random() < 0.05) {
            throw new Error("TS: Lỗi xóa file giả lập!");
        }
        return true;
    },
    loadTextFromFile: async (filePath) => {
        console.log(`[Mock Storage TS] Loading text from: ${filePath}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        return `TS: Nội dung đầy đủ của tệp:\n${filePath}`;
    }
};
// --- Kết thúc Giả lập Service ---

export default function HistoryScreen() {
    // --- State với Type ---
    const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // --- Logic Load dữ liệu với Type ---
    const loadData = useCallback(async (isRefreshing: boolean = false): Promise<void> => {
        if (!isRefreshing) {
            setIsLoading(true);
        }
        setError(null);
        try {
            const data = await mockStorageService.loadHistory();
            data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // So sánh getTime()
            setHistoryItems(data);
        } catch (err: any) {
            console.error("Load History Error:", err);
            setError(`Không thể tải lịch sử: ${err.message || 'Unknown error'}`);
            Alert.alert("Lỗi", "Không thể tải dữ liệu lịch sử.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
            return () => { };
        }, [loadData])
    );
    // --- Kết thúc Logic Load dữ liệu ---

    // --- Các hàm xử lý cho Item với Type ---
    const handleDelete = (item: HistoryItem): void => { // Type cho tham số item
        Alert.alert(
            "Xác nhận xóa",
            `Bạn có chắc muốn xóa mục "${item.previewText.substring(0, 30)}..." và các tệp liên quan? Hành động này không thể hoàn tác.`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa",
                    style: "destructive",
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            await mockStorageService.deleteHistoryItem(item.id, item.originalUri, item.textFilePath);
                            setHistoryItems(prev => prev.filter(i => i.id !== item.id));
                            Alert.alert("Đã xóa", "Mục lịch sử đã được xóa thành công.");
                        } catch (err: any) {
                            console.error("Delete Error:", err);
                            Alert.alert("Lỗi", `Không thể xóa mục lịch sử: ${err.message || 'Unknown error'}`);
                        } finally {
                            setIsLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleShare = async (uri: string | null, mimeType: string | null = null): Promise<void> => {
        if (!uri) {
            Alert.alert("Lỗi", "Không tìm thấy đường dẫn tệp để chia sẻ.");
            return;
        }
        // TODO: Kiểm tra file tồn tại

        try {
            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
                Alert.alert("Lỗi", "Chức năng chia sẻ không khả dụng trên thiết bị này.");
                return;
            }
            console.log(`Sharing file: ${uri}, MimeType: ${mimeType}`);
            await Sharing.shareAsync(uri, {
                mimeType: mimeType ?? undefined, // Truyền undefined nếu mimeType là null
                dialogTitle: 'Chia sẻ tệp'
            });
        } catch (error: any) {
            console.error("Sharing error:", error);
            Alert.alert("Lỗi", `Không thể chia sẻ tệp: ${error.message || 'Unknown error'}`);
        }
    };

    const handleViewEdit = (item: HistoryItem): void => { // Type cho tham số item
        Alert.alert(
            "Xem/Sửa (TODO)",
            `Loại: ${item.type}\nID: ${item.id}\nXem trước: ${item.previewText}`,
            [{ text: "OK" }]
        );
        // TODO: Navigate or open modal
        // router.push({ pathname: '/detail', params: { itemId: item.id } });
    };
    // --- Kết thúc Các hàm xử lý cho Item ---


    // --- Render Item trong FlatList với Type ---
    // Sử dụng ListRenderItemInfo<HistoryItem> để type cho renderItem
    const renderItem = ({ item }: ListRenderItemInfo<HistoryItem>): React.JSX.Element => {
        const isImage = item.type === 'ocr';
        let originalMimeType: string | null = null;
        if (item.originalUri) {
            if (isImage) {
                originalMimeType = item.originalUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
            } else {
                originalMimeType = item.originalUri.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4';
            }
        }

        return (
            <View style={styles.itemContainer}>
                <TouchableOpacity style={styles.itemContent} onPress={() => handleViewEdit(item)}>
                    <View style={styles.itemHeader}>
                        {isImage && item.originalUri ? ( // Hiển thị ảnh nếu là OCR và có URI
                            <Image source={{ uri: item.originalUri }} style={styles.itemThumbnail} />
                        ) : ( // Hoặc icon mặc định
                            <Ionicons
                                name={isImage ? "image-outline" : "mic-outline"}
                                size={24}
                                color="#1E90FF"
                                style={styles.itemIcon}
                            />
                        )}
                        <Text style={styles.itemText} numberOfLines={2}>{item.previewText}</Text>
                    </View>
                    <Text style={styles.itemDate}>{new Date(item.date).toLocaleString()}</Text>
                </TouchableOpacity>

                <View style={styles.itemActions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleShare(item.originalUri, originalMimeType)}
                        disabled={!item.originalUri}
                    >
                        <Ionicons name={isImage ? "share-outline" : "musical-notes-outline"} size={20} color={item.originalUri ? "#007AFF" : "grey"} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleShare(item.textFilePath, 'text/plain')}
                        disabled={!item.textFilePath}
                    >
                        <Ionicons name="document-text-outline" size={20} color={item.textFilePath ? "#007AFF" : "grey"} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDelete(item)}
                    >
                        <Ionicons name="trash-outline" size={20} color="red" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };
    // --- Kết thúc Render Item ---

    // --- Render Chính (Tương tự JS) ---
    if (isLoading && historyItems.length === 0) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1E90FF" />
                <Text>Đang tải lịch sử...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Ionicons name="cloud-offline-outline" size={50} color="grey" />
                <Text style={styles.errorText}>{error}</Text>
                <Button title="Thử lại" onPress={() => loadData()} />
            </View>
        );
    }

    if (!isLoading && historyItems.length === 0) {
        return (
            <View style={styles.centered}>
                <Ionicons name="file-tray-outline" size={50} color="grey" />
                <Text style={styles.emptyText}>Lịch sử trống.</Text>
                <Text style={styles.emptySubText}>Các kết quả nhận diện sẽ xuất hiện ở đây.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList<HistoryItem> // Chỉ định kiểu dữ liệu cho FlatList
                data={historyItems}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContentContainer}
                onRefresh={() => loadData(true)}
                refreshing={isLoading}
            />
        </View>
    );
}

// --- Styles (Giữ nguyên như phiên bản JS) ---
const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
    },
    listContentContainer: {
        paddingVertical: 5,
    },
    itemContainer: {
        backgroundColor: '#fff',
        padding: 12,
        marginVertical: 4,
        marginHorizontal: 8,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    itemContent: {
        flex: 1,
        marginRight: 8,
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    itemIcon: {
        marginRight: 10,
        width: 30, // Đảm bảo icon có kích thước cố định như thumbnail
        textAlign: 'center', // Căn giữa icon nếu cần
    },
    itemThumbnail: {
        width: 30,
        height: 30,
        borderRadius: 4,
        marginRight: 10,
        backgroundColor: '#e0e0e0'
    },
    itemText: {
        fontSize: 15,
        color: '#333',
        flexShrink: 1,
    },
    itemDate: {
        fontSize: 12,
        color: 'grey',
        marginTop: 4,
    },
    itemActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        padding: 8,
        marginLeft: 5,
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 15,
    },
    emptyText: {
        fontSize: 18,
        color: 'grey',
        marginBottom: 5,
    },
    emptySubText: {
        fontSize: 14,
        color: 'darkgrey',
        textAlign: 'center',
    },
});
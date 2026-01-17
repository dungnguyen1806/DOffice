import React, { useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet, Button, Alert,
    TouchableOpacity, ActivityIndicator, ListRenderItemInfo, Share, Modal, ScrollView
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext'
import { getHistory, deleteJob } from '@/api/client';

// --- Định nghĩa Interface cho Item Lịch sử ---
interface HistoryItem {
    id: number;
    file_type: string;
    status: string;
    transcribed_text: string;
    original_file_url: string | null;
    created_at: string;
}

export default function HistoryScreen() {
    const { user, signOut } = useAuth();
    const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isFetchingMore, setIsFetchingMore] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [canLoadMore, setCanLoadMore] = useState<boolean>(true);
    const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const PAGE_SIZE = 20;

    const router = useRouter();

    // --- Logic Load dữ liệu với Type ---
    const loadData = useCallback(async (isRefreshing: boolean = false) => {
        if (!user) return;
        if (!isRefreshing) {
            setIsLoading(true);
        }
        setError(null);
        setCanLoadMore(true);

        try {
            const response = await getHistory(0, PAGE_SIZE);
            setHistoryItems(response.data);
            if (response.data.length < PAGE_SIZE) {
                setCanLoadMore(false); // No more pages to load
            }
        } catch (err: any) {
            console.error("Load History Error:", err);
            setError(`Không thể tải lịch sử: ${err.message || 'Unknown error'}`);
            Alert.alert("Lỗi", "Không thể tải dữ liệu lịch sử.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const loadMoreData = async () => {
        if (isFetchingMore || !canLoadMore || !user) return;

        setIsFetchingMore(true);
        const currentSkip = historyItems.length;
        
        try {
            const response = await getHistory(currentSkip, PAGE_SIZE);
            if (response.data.length > 0) {
                setHistoryItems(prevItems => [...prevItems, ...response.data]);
            }
            if (response.data.length < PAGE_SIZE) {
                setCanLoadMore(false); // Reached the end
            }
        } catch (err: any) {
             console.error("Load More History Error:", err);
             // Optionally show a small error toast/message
        } finally {
            setIsFetchingMore(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
            return () => { };
        }, [loadData])
    );
    // --- Kết thúc Logic Load dữ liệu ---

    // --- Các hàm xử lý cho Item với Type ---
    const handleDelete = (item: HistoryItem) => {
        Alert.alert(
            "Xác nhận xóa",
            "Bạn có chắc muốn xóa mục này không? Hành động này không thể hoàn tác.",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa",
                    style: "destructive",
                    onPress: async () => {
                        // Optimistically remove from UI for speed
                        const previousItems = [...historyItems];
                        setHistoryItems(prev => prev.filter(i => i.id !== item.id));

                        try {
                            await deleteJob(item.id);
                        } catch (err) {
                            console.error("Delete failed", err);
                            Alert.alert("Lỗi", "Không thể xóa mục này trên máy chủ.");
                            // Revert UI if failed
                            setHistoryItems(previousItems);
                        }
                    },
                },
            ]
        );
    };

    const handleShareText = async (item: HistoryItem) => {
        if (!item.transcribed_text) {
            Alert.alert("Trống", "Không có nội dung văn bản để chia sẻ.");
            return;
        }
        try {
            await Share.share({
                message: item.transcribed_text,
                title: "Kết quả Smart Converter"
            });
        } catch (error: any) {
            Alert.alert("Lỗi", error.message);
        }
    };

    const handleShareFile = async (item: HistoryItem) => {
        if (!item.original_file_url) {
            Alert.alert("Lỗi", "Không tìm thấy file gốc.");
            return;
        }

        // Check if it's a remote URL (http) or local (file://)
        const isRemote = item.original_file_url.startsWith('http');
        let shareUri = item.original_file_url;

        try {
            if (isRemote) {
                // If remote, we must download it to cache first
                const fileName = item.original_file_url.split('/').pop() || 'shared_file';
                const fileUri = FileSystem.cacheDirectory + fileName;
                
                const downloadRes = await FileSystem.downloadAsync(
                    item.original_file_url,
                    fileUri
                );
                shareUri = downloadRes.uri;
            }

            // Check if sharing is available
            if (!(await Sharing.isAvailableAsync())) {
                Alert.alert("Lỗi", "Thiết bị không hỗ trợ chia sẻ file.");
                return;
            }

            await Sharing.shareAsync(shareUri);
        } catch (error) {
            console.error("Share File Error", error);
            Alert.alert("Lỗi", "Không thể tải xuống hoặc chia sẻ file.");
        }
    };

    const handleViewEdit = (item: HistoryItem) => {
        setSelectedItem(item);
        setModalVisible(true);
    };
    // --- Kết thúc Các hàm xử lý cho Item ---


    // --- Render Item trong FlatList với Type ---
    const renderFooter = () => {
        if (!isFetchingMore) return null;
        return <ActivityIndicator style={{ marginVertical: 20 }} />;
    };

    // Guest landing
    if (!user) {
        return (
            <View style={styles.guestContainer}>
                <View style={styles.guestIconCircle}>
                    <Ionicons name="lock-closed" size={50} color="#1E90FF" />
                </View>
                <Text style={styles.guestTitle}>Lịch sử bị khóa</Text>
                <Text style={styles.guestDescription}>
                    Tạo tài khoản để lưu trữ không giới hạn các bản ghi OCR và giọng nói của bạn. 
                    Truy cập từ bất kỳ thiết bị nào.
                </Text>
                
                <TouchableOpacity 
                    style={styles.guestButton} 
                    onPress={() => {
                        // We can use signOut to clear guest state and go to login
                        signOut(); 
                        router.replace('/login'); 
                    }}
                >
                    <Text style={styles.guestButtonText}>Đăng nhập / Đăng ký ngay</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const renderListHeader = () => (
        <View style={styles.profileHeader}>
            <View style={styles.profileInfo}>
                <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                        {user.email.charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View>
                    <Text style={styles.welcomeText}>Xin chào,</Text>
                    <Text style={styles.emailText}>{user.email}</Text>
                </View>
            </View>
            <View style={styles.statsContainer}>
                <Text style={styles.statsText}>
                    {/* You could eventually pass total count from backend */}
                    Đang hiển thị {historyItems.length} mục gần nhất
                </Text>
            </View>
        </View>
    );
    
    // Sử dụng ListRenderItemInfo<HistoryItem> để type cho renderItem
    const renderItem = ({ item }: ListRenderItemInfo<HistoryItem>): React.JSX.Element => {
        const isImage = item.file_type.startsWith('image') === true;
        // Use a snippet of the transcribed text as a preview
        const previewText = item.transcribed_text 
            ? item.transcribed_text.substring(0, 50) + '...'
            : `Trạng thái: ${item.status}`;

        return (
            <View style={styles.itemContainer}>
                <TouchableOpacity style={styles.itemContent} onPress={() => handleViewEdit(item)}>
                    <View style={styles.itemHeader}>
                        <Ionicons
                            name={isImage ? "image-outline" : "mic-outline"}
                            size={24} color="#1E90FF" style={styles.itemIcon}
                        />
                        <Text style={styles.itemText} numberOfLines={2}>{previewText}</Text>
                    </View>
                    <Text style={styles.itemDate}>{new Date(item.created_at).toLocaleString()}</Text>
                </TouchableOpacity>

                <View style={styles.itemActions}>
                    {/* Share Original File */}
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleShareFile(item)}
                        disabled={!item.original_file_url}
                    >
                        <Ionicons 
                            name={isImage ? "image" : "musical-note"} 
                            size={20} 
                            color={item.original_file_url ? "#007AFF" : "#ccc"} 
                        />
                    </TouchableOpacity>

                    {/* Share Text */}
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleShareText(item)}
                        disabled={!item.transcribed_text}
                    >
                        <Ionicons 
                            name="document-text" 
                            size={20} 
                            color={item.transcribed_text ? "#007AFF" : "#ccc"} 
                        />
                    </TouchableOpacity>

                    {/* Delete */}
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDelete(item)}
                    >
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                </View>
                
                {/* <View style={styles.itemActions}>
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
                </View> */}
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
                keyExtractor={(item) => item.id.toString()}
                ListHeaderComponent={renderListHeader}
                contentContainerStyle={styles.listContentContainer}
                onRefresh={() => loadData(true)}
                refreshing={isLoading}
                onEndReached={loadMoreData}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
            />

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalView}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Chi tiết kết quả</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.modalLabel}>Trạng thái:</Text>
                            <Text style={{marginBottom: 10, color: selectedItem?.status === 'COMPLETED' ? 'green' : 'orange'}}>
                                {selectedItem?.status}
                            </Text>

                            <Text style={styles.modalLabel}>Nội dung:</Text>
                            <Text style={styles.modalText}>
                                {selectedItem?.transcribed_text || "Không có nội dung văn bản."}
                            </Text>
                        </ScrollView>
                        
                        <View style={styles.modalFooter}>
                            <TouchableOpacity 
                                style={[styles.modalButton, {backgroundColor: '#1E90FF'}]}
                                onPress={() => {
                                    setModalVisible(false);
                                    if(selectedItem) handleShareText(selectedItem);
                                }}
                            >
                                <Text style={styles.modalButtonText}>Chia sẻ</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        flexGrow: 1,
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
        justifyContent: 'flex-end',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 10,
    },
    actionButton: {
        padding: 5,
        marginLeft: 20,
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
    guestContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        backgroundColor: '#f9f9f9',
    },
    guestIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#E6F2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    guestTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    guestDescription: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 24,
    },
    guestButton: {
        backgroundColor: '#1E90FF',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 25,
        elevation: 2,
    },
    guestButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },

    // --- Profile Header Styles ---
    profileHeader: {
        backgroundColor: '#fff',
        padding: 15,
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    profileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#1E90FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    avatarText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    welcomeText: {
        fontSize: 14,
        color: 'grey',
    },
    emailText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    statsContainer: {
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 10,
    },
    statsText: {
        fontSize: 12,
        color: 'grey',
    },
    emptyContainer: {
        alignItems: 'center', 
        marginTop: 50
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalView: {
        width: '90%',
        height: '70%',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        elevation: 5,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10,
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    modalBody: { flex: 1 },
    modalLabel: { fontWeight: 'bold', marginTop: 10, marginBottom: 5, color: '#555' },
    modalText: { fontSize: 16, lineHeight: 24, color: '#333' },
    modalFooter: {
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 15,
        alignItems: 'flex-end',
    },
    modalButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
    },
    modalButtonText: { color: 'white', fontWeight: 'bold' }
});
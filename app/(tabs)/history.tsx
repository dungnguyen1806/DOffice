import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, FlatList, StyleSheet, Button, Alert,
    TouchableOpacity, ActivityIndicator, ListRenderItemInfo, Share, Modal, 
    ScrollView, TextInput, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Audio } from 'expo-av';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext'
import { getHistory, deleteJob, updateJobText } from '@/api/client';

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
    const router = useRouter();

    const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isFetchingMore, setIsFetchingMore] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [canLoadMore, setCanLoadMore] = useState<boolean>(true);
    const PAGE_SIZE = 20;

    const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Xử lý các modal chưa đóng
    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

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

    const handleShareText = async (text: string) => {
        if (!text) {
            Alert.alert("Trống", "Không có nội dung văn bản để chia sẻ.");
            return;
        }
        try {
            await Share.share({
                message: text,
                title: "Transcribed Text from DOffice"
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

    // --- Xử lý media --- 
    const playSound = async (uri: string) => {
        try {
            if (sound) await sound.unloadAsync();
            const { sound: newSound } = await Audio.Sound.createAsync({ uri });
            setSound(newSound);
            setIsPlaying(true);
            await newSound.playAsync();
            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setIsPlaying(false);
                }
            });
        } catch (error) {
            console.error("Play sound error", error);
            Alert.alert("Lỗi", "Không thể phát file âm thanh này.");
        }
    };

    const stopSound = async () => {
        if (sound) {
            await sound.stopAsync();
            setIsPlaying(false);
        }
    };

    // --- MODAL & EDIT HANDLERS ---

    const openModal = (item: HistoryItem) => {
        setSelectedItem(item);
        setEditedText(item.transcribed_text || "");
        setIsEditing(false); // Reset edit mode
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        if (sound) {
            sound.stopAsync();
            setIsPlaying(false);
        }
    };

    const saveEdit = async () => {
        if (!selectedItem) return;
        setIsSavingEdit(true);
        try {
            // 1. Call Backend
            await updateJobText(selectedItem.id, editedText);
            
            // 2. Update Local List
            setHistoryItems(prev => prev.map(item => 
                item.id === selectedItem.id 
                    ? { ...item, transcribed_text: editedText } 
                    : item
            ));
            
            // 3. Update Selected Item
            setSelectedItem(prev => prev ? { ...prev, transcribed_text: editedText } : null);
            setIsEditing(false);
            Alert.alert("Thành công", "Đã cập nhật nội dung.");
        } catch (error) {
            Alert.alert("Lỗi", "Không thể lưu chỉnh sửa.");
        } finally {
            setIsSavingEdit(false);
        }
    };
    // --- Kết thúc xử lý media ---

    // --- Render Item trong FlatList với Type ---
    // const renderFooter = () => {
    //     if (!isFetchingMore) return null;
    //     return <ActivityIndicator style={{ marginVertical: 20 }} />;
    // };

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
    const renderItem = ({ item }: ListRenderItemInfo<HistoryItem>) => {
        const isImage = item.file_type.startsWith('image') === true;
        // Use a snippet of the transcribed text as a preview
        const previewText = item.transcribed_text 
            ? item.transcribed_text.substring(0, 50) + '...'
            : `Trạng thái: ${item.status}`;

        return (
            <View style={styles.itemContainer}>
                <TouchableOpacity style={styles.itemContent} onPress={() => handleViewEdit(item)}>
                    <View style={styles.iconContainer}>
                        {isImage && item.original_file_url ? (
                            <Image source={{uri: item.original_file_url}} style={styles.thumbnail} />
                        ) : (
                            <Ionicons name={isImage ? "image" : "mic"} size={24} color="#fff" />
                        )}
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={styles.itemText} numberOfLines={2}>{previewText}</Text>
                        <Text style={styles.itemDate}>{new Date(item.created_at).toLocaleString()}</Text>
                    </View>
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

                    {/* Delete */}
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDelete(item)}
                    >
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
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
            <FlatList // Chỉ định kiểu dữ liệu cho FlatList
                data={historyItems}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                ListHeaderComponent={renderListHeader}
                // contentContainerStyle={styles.listContentContainer}
                onRefresh={() => loadData(true)}
                refreshing={isLoading}
                onEndReached={loadMoreData}
                // onEndReachedThreshold={0.5}
                // ListFooterComponent={renderFooter}
                ListFooterComponent={() => isFetchingMore ? <ActivityIndicator /> : null}
            />

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlay}
                >
                    {/* <View style={styles.modalOverlay}>
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
                    </View> */}
                    <View style={styles.modalView}>
                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Chi tiết</Text>
                            <TouchableOpacity onPress={closeModal}>
                                <Ionicons name="close" size={28} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                            {/* 1. MEDIA DISPLAY SECTION */}
                            {selectedItem?.original_file_url && (
                                <View style={styles.mediaContainer}>
                                    {selectedItem.file_type.includes('image') ? (
                                        <Image 
                                            source={{ uri: selectedItem.original_file_url }} 
                                            style={styles.fullImage}
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <View style={styles.audioPlayer}>
                                            <Ionicons name="musical-notes" size={40} color="#1E90FF" />
                                            {!isPlaying ? (
                                                <TouchableOpacity style={styles.playButton} onPress={() => playSound(selectedItem.original_file_url!)}>
                                                    <Ionicons name="play" size={24} color="#fff" />
                                                    <Text style={styles.playText}>Nghe Audio</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity style={[styles.playButton, styles.stopButton]} onPress={stopSound}>
                                                    <Ionicons name="stop" size={24} color="#fff" />
                                                    <Text style={styles.playText}>Dừng</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* 2. TEXT EDITOR SECTION */}
                            <View style={styles.textHeaderRow}>
                                <Text style={styles.modalLabel}>Nội dung văn bản:</Text>
                                <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
                                    <Text style={styles.editLink}>{isEditing ? "Hủy sửa" : "Chỉnh sửa"}</Text>
                                </TouchableOpacity>
                            </View>

                            {isEditing ? (
                                <TextInput
                                    style={styles.textEditor}
                                    multiline
                                    value={editedText}
                                    onChangeText={setEditedText}
                                    textAlignVertical="top"
                                />
                            ) : (
                                <Text style={styles.modalText} selectable>
                                    {selectedItem?.transcribed_text || "Không có nội dung."}
                                </Text>
                            )}
                        </ScrollView>

                        {/* Footer Actions */}
                        <View style={styles.modalFooter}>
                            {isEditing ? (
                                <TouchableOpacity 
                                    style={[styles.modalButton, styles.saveButton]} 
                                    onPress={saveEdit}
                                    disabled={isSavingEdit}
                                >
                                    <Text style={styles.modalButtonText}>
                                        {isSavingEdit ? "Đang lưu..." : "Lưu thay đổi"}
                                    </Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity 
                                    style={[styles.modalButton, styles.shareButton]}
                                    onPress={() => handleShareText(selectedItem?selectedItem.transcribed_text : "")}
                                >
                                    <Ionicons name="share-outline" size={20} color="#fff" style={{marginRight: 5}}/>
                                    <Text style={styles.modalButtonText}>Chia sẻ text</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    // container: {
    //     flex: 1,
    //     backgroundColor: '#f0f0f0',
    // },
    // listContentContainer: {
    //     paddingVertical: 5,
    //     flexGrow: 1,
    // },
    // itemContainer: {
    //     backgroundColor: '#fff',
    //     padding: 12,
    //     marginVertical: 4,
    //     marginHorizontal: 8,
    //     borderRadius: 8,
    //     flexDirection: 'row',
    //     alignItems: 'center',
    //     elevation: 1,
    //     shadowColor: '#000',
    //     shadowOffset: { width: 0, height: 1 },
    //     shadowOpacity: 0.1,
    //     shadowRadius: 1,
    // },
    // itemContent: {
    //     flex: 1,
    //     marginRight: 8,
    // },
    // itemHeader: {
    //     flexDirection: 'row',
    //     alignItems: 'center',
    //     marginBottom: 5,
    // },
    // itemIcon: {
    //     marginRight: 10,
    //     width: 30, // Đảm bảo icon có kích thước cố định như thumbnail
    //     textAlign: 'center', // Căn giữa icon nếu cần
    // },
    // itemThumbnail: {
    //     width: 30,
    //     height: 30,
    //     borderRadius: 4,
    //     marginRight: 10,
    //     backgroundColor: '#e0e0e0'
    // },
    // itemText: {
    //     fontSize: 15,
    //     color: '#333',
    //     flexShrink: 1,
    // },
    // itemDate: {
    //     fontSize: 12,
    //     color: 'grey',
    //     marginTop: 4,
    // },
    // itemActions: {
    //     flexDirection: 'row',
    //     justifyContent: 'flex-end',
    //     borderTopWidth: 1,
    //     borderTopColor: '#f0f0f0',
    //     paddingTop: 10,
    // },
    // actionButton: {
    //     padding: 5,
    //     marginLeft: 20,
    // },
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
    // guestContainer: {
    //     flex: 1,
    //     justifyContent: 'center',
    //     alignItems: 'center',
    //     padding: 30,
    //     backgroundColor: '#f9f9f9',
    // },
    guestIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#E6F2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    // guestTitle: {
    //     fontSize: 22,
    //     fontWeight: 'bold',
    //     marginBottom: 10,
    //     color: '#333',
    // },
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

    // // --- Profile Header Styles ---
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
    // emptyContainer: {
    //     alignItems: 'center', 
    //     marginTop: 50
    // },
    // modalOverlay: {
    //     flex: 1,
    //     backgroundColor: 'rgba(0,0,0,0.5)',
    //     justifyContent: 'center',
    //     alignItems: 'center',
    // },
    // modalView: {
    //     width: '90%',
    //     height: '70%',
    //     backgroundColor: 'white',
    //     borderRadius: 20,
    //     padding: 20,
    //     elevation: 5,
    // },
    // modalHeader: {
    //     flexDirection: 'row',
    //     justifyContent: 'space-between',
    //     alignItems: 'center',
    //     marginBottom: 15,
    //     borderBottomWidth: 1,
    //     borderBottomColor: '#eee',
    //     paddingBottom: 10,
    // },
    // modalTitle: { fontSize: 18, fontWeight: 'bold' },
    // modalBody: { flex: 1 },
    // modalLabel: { fontWeight: 'bold', marginTop: 10, marginBottom: 5, color: '#555' },
    // modalText: { fontSize: 16, lineHeight: 24, color: '#333' },
    // modalFooter: {
    //     borderTopWidth: 1,
    //     borderTopColor: '#eee',
    //     paddingTop: 15,
    //     alignItems: 'flex-end',
    // },
    // modalButton: {
    //     paddingVertical: 10,
    //     paddingHorizontal: 20,
    //     borderRadius: 10,
    // },
    // modalButtonText: { color: 'white', fontWeight: 'bold' }
    container: { flex: 1, backgroundColor: '#f0f0f0' },
    guestContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    guestTitle: { fontSize: 20, marginBottom: 20 },
    
    // Item Styles
    itemContainer: {
        backgroundColor: '#fff',
        marginHorizontal: 15,
        marginVertical: 6,
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
    },
    itemContent: { flex: 1 },
    itemHeader: { flexDirection: 'row', alignItems: 'center' },
    iconContainer: {
        width: 50, height: 50, borderRadius: 8, backgroundColor: '#1E90FF',
        justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden'
    },
    thumbnail: { width: '100%', height: '100%' },
    itemText: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
    itemDate: { fontSize: 12, color: '#999' },
    itemActions: { paddingLeft: 10 },
    actionButton: { padding: 8 },

    // Modal Styles
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end', // Bottom sheet style or center
    },
    modalView: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        height: '90%', // Takes up 90% of screen
        padding: 20,
        shadowColor: "#000", shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalBody: { flex: 1 },
    
    // Media Section
    mediaContainer: {
        alignItems: 'center', marginBottom: 20, 
        backgroundColor: '#f9f9f9', borderRadius: 10, padding: 10
    },
    fullImage: { width: '100%', height: 200, borderRadius: 10 },
    audioPlayer: { flexDirection: 'row', alignItems: 'center', padding: 10 },
    playButton: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E90FF',
        paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginLeft: 15
    },
    stopButton: { backgroundColor: '#FF3B30' },
    playText: { color: '#fff', fontWeight: 'bold', marginLeft: 5 },

    // Text Section
    textHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    modalLabel: { fontWeight: 'bold', color: '#555' },
    editLink: { color: '#1E90FF', fontWeight: 'bold', padding: 5 },
    modalText: { fontSize: 16, lineHeight: 24, color: '#333' },
    textEditor: {
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#1E90FF', borderRadius: 8,
        padding: 10, fontSize: 16, minHeight: 150, textAlignVertical: 'top'
    },

    // Footer
    modalFooter: {
        borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15, marginTop: 10,
        flexDirection: 'row', justifyContent: 'flex-end'
    },
    modalButton: {
        paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10,
        flexDirection: 'row', alignItems: 'center'
    },
    saveButton: { backgroundColor: '#34C759' },
    shareButton: { backgroundColor: '#1E90FF' },
    modalButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
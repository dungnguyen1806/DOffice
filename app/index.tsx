// app/index.tsx

import React from 'react';
import { View, Text, StyleSheet, Button, SafeAreaView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // Import icon nếu muốn

export default function IndexScreen(): React.JSX.Element {
    const router = useRouter();

    // Hàm để điều hướng người dùng vào giao diện tab chính
    const navigateToTabs = () => {
        // Sử dụng `replace` thay vì `push` để màn hình giới thiệu này
        // không nằm trong lịch sử điều hướng (người dùng không thể back lại đây từ tabs)
        // Điều hướng đến tab mặc định bạn muốn người dùng thấy đầu tiên
        // (có thể là 'ocr', 'speech', hoặc 'history' tùy theo cài đặt của bạn)
        router.replace('/new_ocr'); // Hoặc '/history' nếu bạn đặt nó làm initialRouteName trong tabs layout
    };

    return (
        // Sử dụng SafeAreaView để đảm bảo nội dung không bị che khuất
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Icon hoặc Logo (Tùy chọn) */}
                <Ionicons
                    name={Platform.OS === 'ios' ? 'scan-circle-outline' : 'scan-circle-outline'} // Chọn icon phù hợp
                    size={70}
                    color="#1E90FF" // Màu chủ đạo
                    style={styles.icon}
                />

                {/* Tiêu đề ứng dụng */}
                <Text style={styles.title}>Trình Chuyển Đổi Thông Minh</Text>

                {/* Mô tả ngắn gọn */}
                <Text style={styles.description}>
                    Biến hình ảnh và giọng nói thành văn bản một cách nhanh chóng và tiện lợi.
                    Lưu trữ và quản lý dễ dàng.
                </Text>

                {/* Liệt kê tính năng chính */}
                <View style={styles.featuresContainer}>
                    <Text style={styles.featureTitle}>Tính năng chính:</Text>
                    <View style={styles.featureItem}>
                        <Ionicons name="camera-outline" size={20} color="#4CAF50" />
                        <Text style={styles.featureText}>Nhận diện văn bản từ Ảnh (OCR)</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <Ionicons name="mic-outline" size={20} color="#FF9800" />
                        <Text style={styles.featureText}>Chuyển đổi Giọng nói thành Văn bản</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <Ionicons name="save-outline" size={20} color="#2196F3" />
                        <Text style={styles.featureText}>Lưu trữ và Xem lại Lịch sử</Text>
                    </View>
                </View>

                {/* Nút bắt đầu */}
                <View style={styles.buttonContainer}>
                    <Button
                        title="Bắt đầu sử dụng"
                        onPress={navigateToTabs}
                        color={Platform.OS === 'ios' ? '#FFFFFF' : '#1E90FF'} // Màu chữ trắng cho iOS nếu nền xanh
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#ffffff', // Nền trắng cho toàn màn hình
    },
    container: {
        flex: 1,
        justifyContent: 'center', // Căn giữa nội dung theo chiều dọc
        alignItems: 'center', // Căn giữa nội dung theo chiều ngang
        paddingHorizontal: 25, // Padding hai bên
        paddingBottom: 40, // Padding dưới cùng
    },
    icon: {
        marginBottom: 25,
    },
    title: {
        fontSize: 26, // Cỡ chữ lớn hơn
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 15,
        color: '#2c3e50', // Màu tối hơn
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
        color: '#555', // Màu xám đậm
        lineHeight: 24, // Giãn dòng
    },
    featuresContainer: {
        width: '100%', // Chiếm hết chiều ngang
        padding: 20,
        backgroundColor: '#f8f9fa', // Nền xám rất nhẹ
        borderRadius: 10,
        marginBottom: 35,
        borderWidth: 1,
        borderColor: '#e9ecef', // Viền nhẹ
    },
    featureTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 15,
        color: '#343a40',
        textAlign: 'center'
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    featureText: {
        fontSize: 15,
        marginLeft: 10,
        color: '#495057',
    },
    buttonContainer: {
        width: '80%', // Độ rộng của nút
        backgroundColor: '#1E90FF', // Màu nền nút (cho iOS để thấy chữ trắng)
        borderRadius: 25, // Bo tròn nút
        overflow: 'hidden', // Đảm bảo màu nền không tràn viền bo tròn
        elevation: 3, // Đổ bóng cho Android
        shadowColor: '#000', // Đổ bóng cho iOS
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    }
});
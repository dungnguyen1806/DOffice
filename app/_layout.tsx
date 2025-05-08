import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout(): React.JSX.Element | null {
  // Sử dụng SafeAreaProvider để xử lý notch, status bar,...
  // Có thể thêm các Provider khác (Theme, State Management) ở đây
  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}
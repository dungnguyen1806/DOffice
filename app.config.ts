import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config, // Preserves any existing configuration from app.json
    name: "DOffice",
    slug: "DOffice",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    
    assetBundlePatterns: [
      "**/*"
    ],
    
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.dungnguyen1806.DOffice", // CHANGE THIS to your unique ID
      infoPlist: {
        // Optional: specific permission text overrides for iOS
        NSCameraUsageDescription: "This app needs camera access to capture documents for OCR processing.",
        NSMicrophoneUsageDescription: "This app needs microphone access to record audio for transcription.",
        NSPhotoLibraryUsageDescription: "This app needs access to your photos to select images for OCR."
      }
    },
    
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.dungnguyen1806.DOffice", // CHANGE THIS to your unique ID
      permissions: [
        "CAMERA",
        "RECORD_AUDIO",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    
    // --- PLUGINS (CRITICAL FOR PERMISSIONS) ---
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-image-picker",
        {
          "photosPermission": "The app accesses your photos to let you select images for OCR processing.",
          "cameraPermission": "The app accesses your camera to let you capture documents for OCR processing."
        }
      ],
      [
        "expo-av",
        {
          "microphonePermission": "The app accesses your microphone to record audio for text transcription."
        }
      ],
      [
        "expo-document-picker",
        {
           "iCloudContainerEnvironment": "Production"
        }
      ]
    ],
    
    experiments: {
      typedRoutes: true
    },

    // --- DYNAMIC ENVIRONMENT VARIABLES ---
    // This allows Constants.expoConfig.extra to read from your .env files
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      wsUrl: process.env.EXPO_PUBLIC_WS_URL,
      "eas": {
        "projectId": "cc12e2ca-5403-4ca7-bf8c-5ee760f7374a"
      }
    },
    
    "owner": "dungnguyen1806"
  };
};
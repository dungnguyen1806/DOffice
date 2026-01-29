# DOffice - Mobile App

A cross-platform mobile application (iOS & Android) built with React Native and Expo. It allows users to scan documents and transcribe audio using AI, with support for Guest Mode and User History.

## Tech Stack

*   **Framework:** React Native / Expo (SDK 50+)
*   **Routing:** Expo Router (File-based routing)
*   **Language:** TypeScript
*   **State Management:** React Context API
*   **Storage:** Expo Secure Store
*   **Networking:** Axios & WebSocket

## Prerequisites

*   Node.js (LTS version)
*   npm or yarn
*   **Expo Go** app installed on your physical iOS/Android device.

## Configuration

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Setup:**
    Create a `.env.development` file in the root:

    ```ini
    # IF USING NGROK (Recommended for physical devices):
    EXPO_PUBLIC_API_URL=https://your-ngrok-domain.ngrok-free.app/api/v1
    EXPO_PUBLIC_WS_URL=wss://your-ngrok-domain.ngrok-free.app/api/v1

    # IF USING ANDROID EMULATOR ONLY:
    # EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api/v1
    # EXPO_PUBLIC_WS_URL=ws://10.0.2.2:8000/api/v1
    ```

3.  **Google Sign-In Config:**
    *   Ensure your `app.config.ts` has the correct `scheme` and `bundleIdentifier`.
    *   Update `app/(auth)/login.tsx` with your Google Cloud Console Client IDs (iOS/Android/Web).

## Running the App

1.  **Start the Expo Server:**
    ```bash
    npx expo start
    ```
    *   *Note: If you changed `.env` variables, run `npx expo start --clear`.*

2.  **Run on Device:**
    *   Scan the QR code displayed in the terminal using the **Expo Go** app on your phone.
    *   Ensure your phone and computer are on the same Wi-Fi (unless using Ngrok).

## Connecting to Local Backend

Since the mobile phone cannot access `localhost` on your computer directly:

1.  **Recommended Method (Ngrok):**
    *   Install Ngrok.
    *   Run `ngrok http 8000`.
    *   Copy the HTTPS URL into your `.env.development` file.

2.  **Alternative (Local IP):**
    *   Find your computer's LAN IP (e.g., `192.168.1.5`).
    *   Set `EXPO_PUBLIC_API_URL=http://192.168.1.5:8000/api/v1`.
    *   *Note: This might fail if your router isolates clients.*

## Key Directory Structure

```
├── app/
│   ├── (auth)/       # Login & Welcome screens
│   ├── (tabs)/       # Main App Tabs (OCR, Speech, History)
│   ├── _layout.tsx   # Root navigation & Auth Provider wrapper
│   └── index.tsx     # Landing page
├── api/              # Axios client & Centralized API methods
├── context/          # AuthContext (User state & Logic)
├── services/         # Helper logic (if separated from API)
└── types/            # TypeScript interfaces (JobStatus, etc.)
```
# S3Ed Final Prototype - AR Bus Navigation App (React + Ionic/Capacitor)

This is a prototype AR navigation app designed for Dunedin's bus route (Route 1).
Developed using React, Vite, Three.js (@react-three/fiber), and Capacitor.

[日本語版ドキュメントはこちら](README_JP.md)

## Key Features

*   **AR Navigation**: Displays 3D arrows over the camera feed to intuitively guide the user's direction.
*   **Route Guidance**: Navigates based on a pre-defined route (JSON) using GPS location.
*   **Mini Map**: Displays a Google Maps-style mini-map at the bottom of the screen, visualizing the entire route, current location, and bus stops.
*   **Voice Announcements**: Automatically plays audio announcements (currently dummy files) when approaching a bus stop.
*   **UI/UX**: Modern dark-themed design. Supports both portrait and landscape orientations.

## Tech Stack

*   **Frontend**: React (TypeScript), Vite
*   **3D/AR**: Three.js, @react-three/fiber
*   **Mobile**: Ionic Capacitor (Android)
*   **Styling**: Vanilla CSS (CSS Modules approach)
*   **Location**: Geolocation API, DeviceOrientation API

## Installation & Running

### Requirements
*   Node.js (v18+)
*   Android Studio (for Android builds)

### Steps

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Start dev server (browser):
    ```bash
    npm run dev
    ```

3.  Build for Android:
    ```bash
    npm run build
    npx cap sync android
    npx cap open android
    ```

---

## Changelog

History of major changes and additions during development.

### General
*   Initialized project with React + Vite + TypeScript.
*   Integrated Capacitor to enable the web app to run as a native Android app.
*   Configured for Windows environment (handled non-ASCII path issues, etc.).

### 1. AR Navigation (ARView)
*   **Initial Implementation**: Setup of basic camera and 3D scene using Three.js.
*   **Arrow Model**: Changed from a simple cylinder to a highly visible "Chevron" design.
*   **Animation**: Added bobbing (floating) animation to the arrow.
*   **Direction Control**:
    *   Calculates target direction using GPS coordinates and compass heading.
    *   Refined logic to point towards the target only at "turns", otherwise points forward (straight).
    *   Fixed angle calculation bugs when crossing the 360-degree boundary (shortest path rotation).

### 2. Mini Map (MiniMap)
*   **Initial Implementation**: Simple map showing route line and user position.
*   **Redesign**:
    *   Updated to a Google Maps-style look.
    *   Displays full route trajectory with bus stops highlighted as icons.
    *   Added pulse animation to the user marker for better visibility.
    *   Added dotted line guide from current position to the next waypoint.

### 3. UI/UX (App, NavigationCard)
*   **Responsive Design**: implemented automatic layout switching between Portrait and Landscape modes.
*   **Design System**: Adoped a Dark Theme with Lime Green accent colors.
*   **Navigation Cards**: Created card components to display distance to the next turn or bus stop.
*   **Landmark Labels**: Added feature to display labels for major buildings (e.g., Robertson Library) on the screen (currently temporarily disabled).

### 4. Logic & Features
*   **Route Data**: Defined route using `route.json` (lat/lon, action types, bus stop info).
*   **GPS Correction**: Implemented distance and bearing calculations using Haversine/Hubeny formulas in `geoUtils.ts`.
*   **Audio Playback**: Implemented logic to automatically play announcements 50m before a bus stop. Enhanced with anti-repetition logic and error handling.

### Future Improvements
*   Replace dummy audio files with actual voiceovers.
*   Implement Pitch control for AR arrows (hill/slope adjustments).
*   Re-enable dynamical control of landmark labels.

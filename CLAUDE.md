# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Magic Bean - 智能植物监控 React Native App，配合智能花盆设备（MimiClaw），通过 MQTT 实时监测植物生长环境（温度、湿度、土壤湿度），支持远程浇水和拍照控制。

## Commands

```bash
# Development
npm install                    # Install dependencies
npx expo start                 # Start Expo Go dev server
npx expo start --dev-client    # Start with Development Build

# Build (EAS)
eas build --profile development --platform android   # Dev build
eas build --profile preview --platform android       # Preview APK
eas build --profile production --platform all        # Production

# Lint
npx expo lint
```

## Architecture

### Tech Stack
- **Expo SDK 54** + **React Native 0.81** + **Expo Router** (file-based routing)
- **Zustand** for state, **Expo SQLite** for local persistence, **MQTT** (mqtt.js via WebSocket) for IoT communication
- **React Native Paper** (Material Design 3) for UI

### Data Flow
```
UI (React) ↔ Zustand Store ↔ SQLite (local-first)
                  ↕
         MQTT Broker (real-time sensor data + commands)
                  ↕
         Backend API (history, diary, AI diagnosis)
```

### Key Directories
- `app/` - Expo Router pages. `_layout.tsx` bootstraps MQTT callbacks and state hydration.
- `lib/store.ts` - Single Zustand store holding devices, liveStats, devicePresence, mqttConnectionStatus.
- `lib/database.ts` - SQLite operations. Schema migrations run via `ensureDevice*Column()` functions on startup.
- `lib/mqtt-data.ts` - MQTT client management: connects per broker URL, subscribes to `plant/{MAC}/data` and `plant/{MAC}/status`, publishes commands to `plant/{MAC}/cmd`.
- `lib/mqtt-presence.ts` - Separate MQTT connection pool solely for online/offline status detection.
- `lib/api.ts` - Axios HTTP client. Interceptor dynamically sets baseURL from Zustand config. Each device can override backend URL.

### MQTT Topic Convention
- `plant/{MAC}/data` - Sensor payload: `{ temperature, air_humidity, dirt_humidity }`
- `plant/{MAC}/status` - Presence payload: `{ status: "online" | "offline" }`
- `plant/{MAC}/cmd` - Command payload: `{ msg_id, action: "water"|"capture", param, timestamp }`

### State Management Pattern
Store hydrates from SQLite on app launch (`hydrate()`). MQTT callbacks update store reactively:
- `setSensorDataFromMqtt(macAddress, data)` - looks up device by MAC, updates liveStats
- `setDevicePresence(macAddress, isOnline)` - updates online status
- `setMqttConnectionStatus(brokerUrl, status)` - tracks connection state per broker

### Build Profile System
`app.config.js` uses `EAS_BUILD_PROFILE` env var to dynamically set package name:
- `development` → `com.xink2594.magicbean.develop`
- `preview` → `com.xink2594.magicbean.preview`
- `production` → `com.xink2594.magicbean`

### Theme
Custom Material Design 3 theme in `app/_layout.tsx` with plant-inspired green palette. Primary: `#2C6E49`, background: `#F5F1E8`.

## Code Conventions
- TypeScript throughout. Types defined in `lib/types.ts`.
- Chinese comments and UI strings.
- No test framework configured.
- Expo Router typed routes enabled (`experiments.typedRoutes`).
- React Compiler enabled (`experiments.reactCompiler`).

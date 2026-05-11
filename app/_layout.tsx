import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { setSensorDataCallback, setConnectionStatusCallback, setPresenceCallback, disconnectAllClients } from '@/lib/mqtt-data';
import { useAppStore } from '@/lib/store';

const plantTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2C6E49',
    onPrimary: '#F7F3E9',
    secondary: '#B7D3A8',
    onSecondary: '#163020',
    tertiary: '#E89B5C',
    background: '#F5F1E8',
    surface: '#FFFDF8',
    surfaceVariant: '#E5E1D8',
    outline: '#9AA48F',
    error: '#B3261E',
  },
};

function AppBootstrap() {
  const hydrate = useAppStore((state) => state.hydrate);
  const ready = useAppStore((state) => state.ready);
  const setDevicePresence = useAppStore((state) => state.setDevicePresence);
  const setSensorDataFromMqtt = useAppStore((state) => state.setSensorDataFromMqtt);
  const setMqttConnectionStatus = useAppStore((state) => state.setMqttConnectionStatus);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 设置 MQTT 回调函数
  useEffect(() => {
    setSensorDataCallback((macAddress, data) => {
      setSensorDataFromMqtt(macAddress, data);
    });

    setConnectionStatusCallback((brokerUrl, status) => {
      setMqttConnectionStatus(brokerUrl, status);
    });

    setPresenceCallback((macAddress, isOnline) => {
      setDevicePresence(macAddress, isOnline);
    });
  }, [setSensorDataFromMqtt, setMqttConnectionStatus, setDevicePresence]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: plantTheme.colors.background,
        }}>
        <ActivityIndicator size="large" color={plantTheme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="provision" options={{ presentation: 'modal' }} />
      <Stack.Screen name="provision-portal" options={{ presentation: 'card' }} />
      <Stack.Screen name="device/[deviceId]/config" options={{ presentation: 'modal' }} />
      <Stack.Screen name="device/[deviceId]" />
      <Stack.Screen name="device/[deviceId]/diary" />
      <Stack.Screen name="photo/[recordId]" options={{ presentation: 'card' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={plantTheme}>
        <AppBootstrap />
        <StatusBar style="dark" />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

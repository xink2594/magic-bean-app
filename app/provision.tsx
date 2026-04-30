import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { Button, Card, Chip, HelperText, Snackbar, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import WifiManager, { WifiEntry } from 'react-native-wifi-reborn';

import { useAppStore } from '@/lib/store';

type NearbyAp = {
  id: string;
  ssid: string;
  level?: number;
};

const MIMICLAW_PREFIX = 'MimiClaw-';
const AP_PORTAL_URL = 'http://192.168.4.1';

const injectedBridge = `
  (function() {
    var sendToReactNative = function(payload) {
      if (!window.ReactNativeWebView) return;
      var text = typeof payload === 'string' ? payload : JSON.stringify(payload);
      window.ReactNativeWebView.postMessage(text);
    };

    window.addEventListener('message', function(event) {
      if (event && event.data) {
        sendToReactNative(event.data);
      }
    });

    document.addEventListener('message', function(event) {
      if (event && event.data) {
        sendToReactNative(event.data);
      }
    });

    var originalPostMessage = window.postMessage;
    window.postMessage = function(data) {
      sendToReactNative(data);
      if (originalPostMessage) {
        return originalPostMessage.apply(window, arguments);
      }
    };
  })();
  true;
`;

export default function WLANProvisionScreen() {
  const addProvisionedDevice = useAppStore((state) => state.addProvisionedDevice);

  const [nearbyAps, setNearbyAps] = useState<NearbyAp[]>([]);
  const [deviceName, setDeviceName] = useState('');
  const [scanning, setScanning] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentSsid, setCurrentSsid] = useState('');
  const [portalReady, setPortalReady] = useState(false);
  const [message, setMessage] = useState('');
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const connectedMimiClaw = useMemo(
    () => (currentSsid.startsWith(MIMICLAW_PREFIX) ? currentSsid : ''),
    [currentSsid],
  );

  useEffect(() => {
    NetInfo.configure({ shouldFetchWiFiSSID: true });
  }, []);

  const requestWifiPermissions = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      setMessage('需要定位权限，才能扫描附近 WLAN 并检测当前连接的 Wi‑Fi。');
      return false;
    }

    return true;
  }, []);

  const openSystemWifi = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        const wifiUrl = 'App-Prefs:root=WIFI';
        const supported = await Linking.canOpenURL(wifiUrl);

        if (supported) {
          await Linking.openURL(wifiUrl);
          return;
        }
      }

      await Linking.openSettings();
    } catch {
      await Linking.openSettings();
    }
  }, []);

  const readCurrentWifiSsid = useCallback(async () => {
    try {
      const ssid = await WifiManager.getCurrentWifiSSID();
      if (ssid) {
        return sanitizeSsid(ssid);
      }
    } catch {
      // ignore and fall through
    }

    try {
      const state = await NetInfo.fetch();
      const ssid = state.type === 'wifi' ? state.details?.ssid : null;
      return ssid ? sanitizeSsid(ssid) : '';
    } catch {
      return '';
    }
  }, []);

  const checkCurrentConnection = useCallback(async () => {
    setCheckingConnection(true);
    const ssid = await readCurrentWifiSsid();
    setCurrentSsid(ssid);
    setPortalReady(ssid.startsWith(MIMICLAW_PREFIX));
    setCheckingConnection(false);
  }, [readCurrentWifiSsid]);

  const scanNearbyAps = useCallback(async () => {
    const granted = await requestWifiPermissions();
    if (!granted) {
      return;
    }

    setScanning(true);

    try {
      if (Platform.OS === 'android') {
        const scanResult = await WifiManager.reScanAndLoadWifiList();
        const mimiClawDevices = uniqBySsid(
          scanResult.filter((item) => sanitizeSsid(item.SSID).startsWith(MIMICLAW_PREFIX)),
        ).map((item) => ({
          id: sanitizeSsid(item.SSID),
          ssid: sanitizeSsid(item.SSID),
          level: item.level,
        }));

        setNearbyAps(mimiClawDevices);
      } else {
        const ssid = await readCurrentWifiSsid();
        setNearbyAps(ssid.startsWith(MIMICLAW_PREFIX) ? [{ id: ssid, ssid }] : []);
      }
    } catch {
      setMessage('搜索附近设备失败，请确认 WLAN 与定位权限已开启。');
    } finally {
      setScanning(false);
    }
  }, [readCurrentWifiSsid, requestWifiPermissions]);

  useEffect(() => {
    scanNearbyAps();
    checkCurrentConnection();
  }, [checkCurrentConnection, scanNearbyAps]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', async (nextState) => {
      const wasInBackground = /inactive|background/.test(appState.current);
      appState.current = nextState;

      if (wasInBackground && nextState === 'active') {
        await scanNearbyAps();
        await checkCurrentConnection();
      }
    });

    const intervalId = setInterval(() => {
      checkCurrentConnection();
    }, 2500);

    return () => {
      appStateSubscription.remove();
      clearInterval(intervalId);
    };
  }, [checkCurrentConnection, scanNearbyAps]);

  const saveProvisionedDevice = useCallback(async () => {
    if (!connectedMimiClaw) {
      return;
    }

    setSaving(true);
    await addProvisionedDevice({
      macAddress: connectedMimiClaw,
      name: deviceName.trim() || connectedMimiClaw,
    });
    setSaving(false);
  }, [addProvisionedDevice, connectedMimiClaw, deviceName]);

  const handlePortalMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      const data = event.nativeEvent.data;

      if (!isConfigSuccessMessage(data)) {
        return;
      }

      await saveProvisionedDevice();
      setMessage('配网成功，正在返回首页。');
      router.replace('/' as never);
    },
    [saveProvisionedDevice],
  );

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            AP 配网
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            先连接 `MimiClaw-xxxx` 热点，连接成功后会自动打开 `192.168.4.1`。
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">配网提醒</Text>
            <View style={styles.warningBox}>
              <Text variant="bodyMedium" style={styles.warningText}>
                配网期间，请临时关闭手机的移动数据（蜂窝网络）。
              </Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium">附近设备</Text>
              <Button mode="text" onPress={scanNearbyAps} loading={scanning} disabled={scanning}>
                刷新
              </Button>
            </View>

            {nearbyAps.length ? (
              nearbyAps.map((device) => {
                const connected = device.ssid === connectedMimiClaw;

                return (
                  <View key={device.id} style={styles.radioRow}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={styles.deviceHeader}>
                        <Text variant="bodyLarge">{device.ssid}</Text>
                        {connected ? <Chip compact icon="check">已连接</Chip> : null}
                      </View>
                      <Text variant="bodyMedium" style={styles.subtle}>
                        {device.level !== undefined ? `信号强度：${device.level}` : '等待连接此热点'}
                      </Text>
                    </View>
                    <Button mode="outlined" onPress={openSystemWifi}>
                      跳转到设置连接 Wi-Fi
                    </Button>
                  </View>
                );
              })
            ) : (
              <HelperText type="info">
                暂未搜索到包含 `MimiClaw-` 的热点，请确认设备已进入 AP 配网模式后重试。
              </HelperText>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">连接状态</Text>
            <View style={styles.statusRow}>
              <Chip icon={connectedMimiClaw ? 'wifi' : 'wifi-off'} compact>
                {checkingConnection ? '检测中...' : currentSsid || '当前未连接到设备热点'}
              </Chip>
              <Button
                mode="outlined"
                onPress={checkCurrentConnection}
                loading={checkingConnection}
                disabled={checkingConnection}>
                检查连接
              </Button>
            </View>

            <TextInput
              label="设备昵称"
              value={deviceName}
              onChangeText={setDeviceName}
              mode="outlined"
              placeholder={connectedMimiClaw || '我的智能花盆'}
            />

            <HelperText type="info">
              当检测到你已连接 `MimiClaw-xxxx` 后，下方会自动展示设备自带的配网页。
            </HelperText>
          </Card.Content>
        </Card>

        {portalReady ? (
          <Card style={styles.portalCard}>
            <Card.Content style={styles.portalSection}>
              <View style={styles.sectionHeader}>
                <Text variant="titleMedium">设备配网页</Text>
                <Chip compact icon="lan-connect">
                  {connectedMimiClaw}
                </Chip>
              </View>
              <View style={styles.webviewWrap}>
                <WebView
                  source={{ uri: AP_PORTAL_URL }}
                  onMessage={handlePortalMessage}
                  javaScriptEnabled
                  domStorageEnabled
                  injectedJavaScriptBeforeContentLoaded={injectedBridge}
                  originWhitelist={['*']}
                  startInLoadingState
                />
              </View>
            </Card.Content>
          </Card>
        ) : null}
      </ScrollView>

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={2800}>
        {message}
      </Snackbar>
    </SafeAreaView>
  );
}

function uniqBySsid(items: WifiEntry[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const ssid = sanitizeSsid(item.SSID);
    if (!ssid || seen.has(ssid)) {
      return false;
    }
    seen.add(ssid);
    return true;
  });
}

function sanitizeSsid(value?: string | null) {
  return (value ?? '').replace(/^"|"$/g, '').trim();
}

function isConfigSuccessMessage(message: string) {
  if (message === 'CONFIG_SUCCESS') {
    return true;
  }

  try {
    const payload = JSON.parse(message) as { type?: string; event?: string; status?: string };
    return (
      payload.type === 'CONFIG_SUCCESS' ||
      payload.event === 'CONFIG_SUCCESS' ||
      payload.status === 'CONFIG_SUCCESS'
    );
  } catch {
    return message.includes('CONFIG_SUCCESS');
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F5F1E8',
  },
  content: {
    padding: 20,
    gap: 18,
    paddingBottom: 36,
  },
  header: {
    gap: 10,
    marginTop: 8,
  },
  title: {
    color: '#163020',
    fontWeight: '700',
  },
  subtitle: {
    color: '#5E6859',
  },
  card: {
    backgroundColor: '#FFFDF8',
  },
  portalCard: {
    backgroundColor: '#FFFDF8',
    overflow: 'hidden',
  },
  section: {
    gap: 14,
  },
  portalSection: {
    gap: 14,
    paddingBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  radioRow: {
    gap: 12,
    backgroundColor: '#EEF3E7',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  subtle: {
    color: '#617062',
  },
  warningBox: {
    backgroundColor: '#FFF4E8',
    borderRadius: 16,
    padding: 14,
  },
  warningText: {
    color: '#9A4D00',
    lineHeight: 22,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  webviewWrap: {
    minHeight: 460,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
});

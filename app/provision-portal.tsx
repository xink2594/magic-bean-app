import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Chip, Snackbar, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { useAppStore } from '@/lib/store';

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

export default function ProvisionPortalScreen() {
  const { ssid, deviceName } = useLocalSearchParams<{ ssid?: string; deviceName?: string }>();
  const addProvisionedDevice = useAppStore((state) => state.addProvisionedDevice);
  const webviewRef = useRef<WebView>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const refreshPortal = () => {
    webviewRef.current?.reload();
  };

  const handlePortalMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      const data = event.nativeEvent.data;

      if (!isConfigSuccessMessage(data) || !ssid) {
        return;
      }

      setSaving(true);
      await addProvisionedDevice({
        macAddress: ssid,
        name: (deviceName || ssid).trim(),
      });
      setSaving(false);
      setMessage('配网成功，正在返回首页。');
      router.replace('/' as never);
    },
    [addProvisionedDevice, deviceName, ssid],
  );

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <View style={styles.header}>
              <Text variant="headlineSmall" style={styles.title}>
                设备配网页
              </Text>
              {ssid ? <Chip compact icon="wifi">{ssid}</Chip> : null}
            </View>
            <Text variant="bodyMedium" style={styles.subtle}>
              如果网页因为设备刚启动还不可访问，可以点击下方“刷新网页”再次尝试。
            </Text>
            <View style={styles.actions}>
              <Button mode="outlined" onPress={refreshPortal}>
                刷新网页
              </Button>
              <Button mode="text" onPress={() => router.back()}>
                返回上一步
              </Button>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.webviewWrap}>
          <WebView
            ref={webviewRef}
            source={{ uri: AP_PORTAL_URL }}
            onMessage={handlePortalMessage}
            javaScriptEnabled
            domStorageEnabled
            injectedJavaScriptBeforeContentLoaded={injectedBridge}
            originWhitelist={['*']}
            startInLoadingState
          />
        </View>
      </View>

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={2800}>
        {saving ? '正在保存设备...' : message}
      </Snackbar>
    </SafeAreaView>
  );
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
    flex: 1,
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFDF8',
  },
  section: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  title: {
    color: '#163020',
    fontWeight: '700',
  },
  subtle: {
    color: '#617062',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  webviewWrap: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    minHeight: 480,
  },
});

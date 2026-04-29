import { useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, HelperText, RadioButton, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/lib/store';

const mockWifiDevices = [
  { id: 'ap-1', ssid: 'MimiClaw-7C11', macAddress: 'MimiClaw-7C11' },
  { id: 'ap-2', ssid: 'MimiClaw-7C15', macAddress: 'MimiClaw-7C15' },
  { id: 'ap-3', ssid: 'MimiClaw-7C18', macAddress: 'MimiClaw-7C18' },
];

export default function WLANProvisionScreen() {
  const addProvisionedDevice = useAppStore((state) => state.addProvisionedDevice);

  const [selectedId, setSelectedId] = useState(mockWifiDevices[0]?.id ?? '');
  const [ssid, setSsid] = useState('温室 Wi-Fi');
  const [password, setPassword] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedDevice = useMemo(
    () => mockWifiDevices.find((device) => device.id === selectedId),
    [selectedId],
  );

  const openSystemWifi = async () => {
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
  };

  const onProvision = async () => {
    if (!selectedDevice) {
      return;
    }

    setSaving(true);
    await addProvisionedDevice({
      macAddress: selectedDevice.macAddress,
      name: deviceName.trim() || selectedDevice.ssid,
    });
    setSaving(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            WLAN 配网
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            连接 `MimiClaw-xxxx` 热点后，再继续完成家庭网络配置。
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">附近设备</Text>
            {Platform.OS === 'android' ? (
              <>
                <RadioButton.Group onValueChange={setSelectedId} value={selectedId}>
                  {mockWifiDevices.map((device) => (
                    <View key={device.id} style={styles.radioRow}>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyLarge">{device.ssid}</Text>
                        <Text variant="bodyMedium" style={styles.subtle}>
                          热点名称：{device.ssid}
                        </Text>
                      </View>
                      <RadioButton value={device.id} />
                    </View>
                  ))}
                </RadioButton.Group>
                <HelperText type="info">
                  Android 端这里展示搜索到的 `MimiClaw-xxxx` 热点，当前为演示数据。
                </HelperText>
              </>
            ) : (
              <>
                <View style={styles.iosHint}>
                  <Text variant="bodyLarge">iPhone 需要先到系统 WLAN 页面连接 `MimiClaw-xxxx`。</Text>
                  <Text variant="bodyMedium" style={styles.subtle}>
                    连接成功后，再回到 App 继续后续配网流程。
                  </Text>
                </View>
                <Button mode="contained" onPress={openSystemWifi}>
                  打开系统 WLAN
                </Button>
              </>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">Wi-Fi 信息</Text>
            <TextInput label="SSID" value={ssid} onChangeText={setSsid} mode="outlined" />
            <TextInput
              label="密码"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry
            />
            <TextInput
              label="设备昵称"
              value={deviceName}
              onChangeText={setDeviceName}
              mode="outlined"
              placeholder={selectedDevice?.ssid ?? '我的智能花盆'}
            />
            <Button mode="contained" onPress={onProvision} loading={saving} disabled={saving || !ssid}>
              发送凭据并保存
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F5F1E8',
  },
  content: {
    padding: 20,
    gap: 18,
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
  section: {
    gap: 14,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EEF3E7',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  subtle: {
    color: '#617062',
  },
  iosHint: {
    gap: 8,
    backgroundColor: '#EEF3E7',
    borderRadius: 16,
    padding: 14,
  },
});

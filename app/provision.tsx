import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, HelperText, RadioButton, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/lib/store';

const mockBleDevices = [
  { id: 'ble-1', name: 'PLANT_A1', macAddress: 'A8:61:0A:22:7C:11' },
  { id: 'ble-2', name: 'PLANT_B2', macAddress: 'A8:61:0A:22:7C:15' },
  { id: 'ble-3', name: 'PLANT_C3', macAddress: 'A8:61:0A:22:7C:18' },
];

export default function BLEProvisionScreen() {
  const addProvisionedDevice = useAppStore((state) => state.addProvisionedDevice);

  const [selectedId, setSelectedId] = useState(mockBleDevices[0]?.id ?? '');
  const [ssid, setSsid] = useState('温室 Wi-Fi');
  const [password, setPassword] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedDevice = useMemo(
    () => mockBleDevices.find((device) => device.id === selectedId),
    [selectedId],
  );

  const onProvision = async () => {
    if (!selectedDevice) {
      return;
    }

    setSaving(true);
    await addProvisionedDevice({
      macAddress: selectedDevice.macAddress,
      name: deviceName.trim() || selectedDevice.name,
    });
    setSaving(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            BLE 配网
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            扫描 `PLANT_` 设备，发送 Wi-Fi 凭据，并将花盆信息保存到本地。
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">附近设备</Text>
            <RadioButton.Group onValueChange={setSelectedId} value={selectedId}>
              {mockBleDevices.map((device) => (
                <View key={device.id} style={styles.radioRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyLarge">{device.name}</Text>
                    <Text variant="bodyMedium" style={styles.subtle}>
                      {device.macAddress}
                    </Text>
                  </View>
                  <RadioButton value={device.id} />
                </View>
              ))}
            </RadioButton.Group>
            <HelperText type="info">
              这里目前是模拟数据，后续可替换为 `react-native-ble-plx` 扫描 ESP32 前缀设备。
            </HelperText>
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
              placeholder={selectedDevice?.name ?? '我的智能花盆'}
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
});

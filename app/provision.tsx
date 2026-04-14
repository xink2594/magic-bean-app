import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, HelperText, RadioButton, Text, TextInput } from 'react-native-paper';

import { useAppStore } from '@/lib/store';

const mockBleDevices = [
  { id: 'ble-1', name: 'PLANT_A1', macAddress: 'A8:61:0A:22:7C:11' },
  { id: 'ble-2', name: 'PLANT_B2', macAddress: 'A8:61:0A:22:7C:15' },
  { id: 'ble-3', name: 'PLANT_C3', macAddress: 'A8:61:0A:22:7C:18' },
];

export default function BLEProvisionScreen() {
  const addProvisionedDevice = useAppStore((state) => state.addProvisionedDevice);

  const [selectedId, setSelectedId] = useState(mockBleDevices[0]?.id ?? '');
  const [ssid, setSsid] = useState('Greenhouse WiFi');
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
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          BLE Provision
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Scan for `PLANT_` devices, send Wi-Fi credentials, and save the planter locally.
        </Text>
      </View>

      <Card style={styles.card}>
        <Card.Content style={styles.section}>
          <Text variant="titleMedium">Nearby Devices</Text>
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
            Replace this mock list with `react-native-ble-plx` scanning for your ESP32 prefix.
          </HelperText>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content style={styles.section}>
          <Text variant="titleMedium">Wi-Fi Credentials</Text>
          <TextInput label="SSID" value={ssid} onChangeText={setSsid} mode="outlined" />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
          />
          <TextInput
            label="Friendly Device Name"
            value={deviceName}
            onChangeText={setDeviceName}
            mode="outlined"
            placeholder={selectedDevice?.name ?? 'My Smart Pot'}
          />
          <Button mode="contained" onPress={onProvision} loading={saving} disabled={saving || !ssid}>
            Send Credentials & Save
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
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

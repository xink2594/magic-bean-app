import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Snackbar, Text } from 'react-native-paper';

import { issueDeviceCommand } from '@/lib/device-commands';
import { useAppStore } from '@/lib/store';

export default function DeviceDetailScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const devices = useAppStore((state) => state.devices);
  const getLiveStats = useAppStore((state) => state.getLiveStats);
  const updateLiveStats = useAppStore((state) => state.updateLiveStats);

  const [message, setMessage] = useState('');

  const device = useMemo(
    () => devices.find((entry) => entry.id === deviceId),
    [deviceId, devices],
  );
  const stats = getLiveStats(deviceId ?? '');

  useEffect(() => {
    if (!deviceId) {
      return;
    }

    const timer = setInterval(() => {
      updateLiveStats(deviceId, {
        airTemp: Math.max(15, Math.min(35, stats.airTemp + (Math.random() - 0.5) * 0.8)),
        humidity: Math.max(35, Math.min(90, stats.humidity + (Math.random() - 0.5) * 2)),
        soilMoisture: Math.max(20, Math.min(95, stats.soilMoisture + (Math.random() - 0.5) * 1.4)),
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [deviceId, stats.airTemp, stats.humidity, stats.soilMoisture, updateLiveStats]);

  if (!device) {
    return null;
  }

  const runCommand = async (command: 'water' | 'light' | 'capture') => {
    const result = await issueDeviceCommand(command, device.id, stats);
    updateLiveStats(device.id, result.stats);
    setMessage(result.message);
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            {device.name}
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            MQTT-ready live panel for {device.macAddress}
          </Text>
        </View>

        <Card style={styles.heroCard}>
          <Card.Content style={styles.heroContent}>
            <Metric label="Air Temp" value={`${stats.airTemp.toFixed(1)}°C`} accent="#E89B5C" />
            <Metric label="Humidity" value={`${stats.humidity.toFixed(0)}%`} accent="#5FA8D3" />
            <Metric label="Soil Moisture" value={`${stats.soilMoisture.toFixed(0)}%`} accent="#6A994E" />
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">Quick Control</Text>
            <View style={styles.buttonGrid}>
              <Button mode="contained" onPress={() => runCommand('water')}>
                Water
              </Button>
              <Button mode="contained-tonal" onPress={() => runCommand('light')}>
                Light
              </Button>
              <Button mode="outlined" onPress={() => runCommand('capture')}>
                Force Capture
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">History</Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Diary reads stay local in SQLite and only leave the device when you ask for diagnosis or sync.
            </Text>
            <Button
              mode="contained"
              onPress={() =>
                router.push({
                  pathname: '/device/[deviceId]/diary',
                  params: { deviceId: device.id },
                } as never)
              }>
              Open Diary Gallery
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={2400}>
        {message}
      </Snackbar>
    </View>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={[styles.metric, { borderLeftColor: accent }]}>
      <Text variant="labelLarge" style={styles.metricLabel}>
        {label}
      </Text>
      <Text variant="displaySmall" style={styles.metricValue}>
        {value}
      </Text>
    </View>
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
    gap: 8,
    marginTop: 8,
  },
  title: {
    color: '#163020',
    fontWeight: '700',
  },
  subtitle: {
    color: '#5E6859',
  },
  heroCard: {
    backgroundColor: '#163020',
  },
  heroContent: {
    gap: 14,
  },
  metric: {
    backgroundColor: '#FCFBF7',
    borderRadius: 22,
    borderLeftWidth: 6,
    padding: 16,
  },
  metricLabel: {
    color: '#617062',
    marginBottom: 6,
  },
  metricValue: {
    color: '#163020',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFDF8',
  },
  section: {
    gap: 14,
  },
  buttonGrid: {
    gap: 12,
  },
});

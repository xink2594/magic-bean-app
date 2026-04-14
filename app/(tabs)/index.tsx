import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Chip, FAB, Text } from 'react-native-paper';

import { useAppStore } from '@/lib/store';

export default function DashboardScreen() {
  const devices = useAppStore((state) => state.devices);
  const getLiveStats = useAppStore((state) => state.getLiveStats);

  const heroText = useMemo(() => {
    if (!devices.length) {
      return 'Add your first smart planter to start tracking local readings offline.';
    }

    return `${devices.length} planter${devices.length === 1 ? '' : 's'} linked and ready for local sync.`;
  }, [devices.length]);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text variant="headlineMedium" style={styles.heroTitle}>
            Smart Plant Console
          </Text>
          <Text variant="bodyLarge" style={styles.heroCopy}>
            {heroText}
          </Text>
          <View style={styles.heroChips}>
            <Chip icon="database" compact>
              SQLite local-first
            </Chip>
            <Chip icon="wifi-off" compact>
              Offline capable
            </Chip>
          </View>
        </View>

        {devices.map((device) => {
          const stats = getLiveStats(device.id);

          return (
            <Card key={device.id} style={styles.card} mode="elevated">
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleLarge">{device.name}</Text>
                    <Text variant="bodyMedium" style={styles.subtle}>
                      {device.macAddress}
                    </Text>
                  </View>
                  <Chip icon="leaf" compact>
                    Active
                  </Chip>
                </View>

                <View style={styles.metricRow}>
                  <Metric label="Air Temp" value={`${stats.airTemp.toFixed(1)}°C`} />
                  <Metric label="Humidity" value={`${stats.humidity.toFixed(0)}%`} />
                  <Metric label="Soil" value={`${stats.soilMoisture.toFixed(0)}%`} />
                </View>

                <View style={styles.actionRow}>
                  <Button
                    mode="contained"
                    onPress={() =>
                      router.push({
                        pathname: '/device/[deviceId]',
                        params: { deviceId: device.id },
                      } as never)
                    }>
                    Open Device
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() =>
                      router.push({
                        pathname: '/device/[deviceId]/diary',
                        params: { deviceId: device.id },
                      } as never)
                    }>
                    Diary
                  </Button>
                </View>
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push({ pathname: '/provision' } as never)}
      />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text variant="labelMedium" style={styles.subtle}>
        {label}
      </Text>
      <Text variant="titleMedium" style={styles.metricValue}>
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
    gap: 16,
    paddingBottom: 120,
  },
  hero: {
    backgroundColor: '#254D32',
    borderRadius: 28,
    padding: 20,
    gap: 12,
  },
  heroTitle: {
    color: '#F7F3E9',
    fontWeight: '700',
  },
  heroCopy: {
    color: '#DCE8D1',
    lineHeight: 22,
  },
  heroChips: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: '#FFFDF8',
  },
  cardContent: {
    gap: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subtle: {
    color: '#617062',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#EEF3E7',
    borderRadius: 18,
    padding: 12,
    gap: 6,
  },
  metricValue: {
    color: '#163020',
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 26,
    backgroundColor: '#E89B5C',
  },
});

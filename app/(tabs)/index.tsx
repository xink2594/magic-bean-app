import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Chip, FAB, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/lib/store';

export default function DashboardScreen() {
  const devices = useAppStore((state) => state.devices);
  const getLiveStats = useAppStore((state) => state.getLiveStats);

  const heroText = useMemo(() => {
    if (!devices.length) {
      return '添加你的第一台智能花盆，开始离线记录植物环境数据。';
    }

    return `已连接 ${devices.length} 台花盆设备，随时可以进行本地同步。`;
  }, [devices.length]);

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text variant="headlineMedium" style={styles.heroTitle}>
            智能植物控制台
          </Text>
          <Text variant="bodyLarge" style={styles.heroCopy}>
            {heroText}
          </Text>
          <View style={styles.heroChips}>
            <Chip icon="database" compact>
              SQLite 本地优先
            </Chip>
            <Chip icon="wifi-off" compact>
              支持离线使用
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
                    在线
                  </Chip>
                </View>

                <View style={styles.metricRow}>
                  <Metric label="空气温度" value={`${stats.airTemp.toFixed(1)}°C`} />
                  <Metric label="空气湿度" value={`${stats.humidity.toFixed(0)}%`} />
                  <Metric label="土壤湿度" value={`${stats.soilMoisture.toFixed(0)}%`} />
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
                    查看设备
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() =>
                      router.push({
                        pathname: '/device/[deviceId]/diary',
                        params: { deviceId: device.id },
                      } as never)
                    }>
                    成长日记
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
    </SafeAreaView>
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

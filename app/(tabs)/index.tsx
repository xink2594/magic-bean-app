import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Chip, FAB, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchDeviceLatestData } from '@/lib/api';
import { DeviceLatestData } from '@/lib/types';
import { useAppStore } from '@/lib/store';

export default function DashboardScreen() {
  const devices = useAppStore((state) => state.devices);
  const getLiveStats = useAppStore((state) => state.getLiveStats);
  const isDeviceOnline = useAppStore((state) => state.isDeviceOnline);
  const updateLiveStats = useAppStore((state) => state.updateLiveStats);

  const [refreshing, setRefreshing] = useState(false);
  const [apiData, setApiData] = useState<Record<string, DeviceLatestData>>({});

  const heroText = useMemo(() => {
    if (!devices.length) {
      return '添加你的第一台智能花盆，开始离线记录植物环境数据。';
    }

    return `已连接 ${devices.length} 台花盆设备，随时可以进行本地同步。`;
  }, [devices.length]);

  const fetchData = useCallback(async () => {
    if (!devices.length) return;

    const results = await Promise.all(
      devices.map(async (device) => {
        const data = await fetchDeviceLatestData(device.macAddress, device.backendUrl);
        return { deviceId: device.id, data };
      }),
    );

    const newApiData: Record<string, DeviceLatestData> = {};
    for (const { deviceId, data } of results) {
      if (data?.latestData) {
        newApiData[deviceId] = data;
        updateLiveStats(deviceId, {
          airTemp: data.latestData.temperature ?? 0,
          humidity: data.latestData.airHumidity ?? 0,
          soilMoisture: data.latestData.dirtHumidity ?? 0,
        });
      }
    }

    setApiData(newApiData);
  }, [devices, updateLiveStats]);

  // 进入页面时自动加载
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#254D32" />
        }>
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
          const online = isDeviceOnline(device.macAddress);
          const latestData = apiData[device.id];
          const hasApiData = Boolean(latestData);

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
                  <View style={styles.chipGroup}>
                    {hasApiData && (
                      <Chip icon="cloud-check" compact style={styles.apiChip}>
                        API
                      </Chip>
                    )}
                    <Chip
                      icon="leaf"
                      compact
                      style={[styles.statusChip, { backgroundColor: online ? '#D9F4DE' : '#ECE7DD' }]}>
                      {online ? 'Online' : 'Offline'}
                    </Chip>
                  </View>
                </View>

                <View style={styles.metricRow}>
                  <Metric
                    label="空气温度"
                    value={stats.airTemp !== null ? `${stats.airTemp.toFixed(1)}°C` : '--'}
                  />
                  <Metric
                    label="空气湿度"
                    value={stats.humidity !== null ? `${stats.humidity.toFixed(0)}%` : '--'}
                  />
                  <Metric
                    label="土壤湿度"
                    value={stats.soilMoisture !== null ? `${stats.soilMoisture.toFixed(0)}%` : '--'}
                  />
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
  chipGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  apiChip: {
    borderRadius: 999,
    backgroundColor: '#E3F2FD',
  },
  statusChip: {
    borderRadius: 999,
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

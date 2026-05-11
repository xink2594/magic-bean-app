import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Chip, IconButton, Snackbar, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { connectToDevice, publishDeviceCommand } from '@/lib/mqtt-data';
import { useAppStore } from '@/lib/store';
import { toMqttWebSocketUrl } from '@/lib/mqtt-data';

export default function DeviceDetailScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const devices = useAppStore((state) => state.devices);
  const getLiveStats = useAppStore((state) => state.getLiveStats);
  const removeDevice = useAppStore((state) => state.removeDevice);
  const isDeviceOnline = useAppStore((state) => state.isDeviceOnline);
  const getMqttConnectionStatus = useAppStore((state) => state.getMqttConnectionStatus);

  const [message, setMessage] = useState('');

  const device = useMemo(
    () => devices.find((entry) => entry.id === deviceId),
    [deviceId, devices],
  );
  const stats = getLiveStats(deviceId ?? '');

  // 获取 MQTT 连接状态
  const mqttStatus = device ? getMqttConnectionStatus(device.mqttUrl) : 'disconnected';

  // 页面加载时自动连接 MQTT
  useEffect(() => {
    if (device && device.mqttUrl) {
      connectToDevice(device);
    }
  }, [device?.id, device?.mqttUrl]);

  if (!device) {
    return null;
  }

  const online = isDeviceOnline(device.macAddress);

  const runCommand = async (action: 'water' | 'capture') => {
    const success = publishDeviceCommand(device, action);
    if (success) {
      setMessage(action === 'water' ? '浇水指令已发送' : '拍照指令已发送');
    } else {
      setMessage('指令发送失败，请检查 MQTT 连接');
    }
  };

  const handleReconnect = () => {
    if (device.mqttUrl) {
      connectToDevice(device);
      setMessage('正在重新连接...');
    } else {
      setMessage('请先配置 MQTT 地址');
    }
  };

  // 获取连接状态显示信息
  const getMqttStatusInfo = () => {
    switch (mqttStatus) {
      case 'connected':
        return { label: 'MQTT 已连接', color: '#1F7A37', bgColor: '#D9F4DE' };
      case 'connecting':
        return { label: 'MQTT 连接中...', color: '#9A4D00', bgColor: '#FFF4E8' };
      case 'error':
        return { label: 'MQTT 连接失败', color: '#B3261E', bgColor: '#FFF4F2' };
      default:
        return { label: 'MQTT 未连接', color: '#7A7268', bgColor: '#ECE7DD' };
    }
  };

  const mqttStatusInfo = getMqttStatusInfo();

  const confirmDeleteDevice = () => {
    Alert.alert('删除设备', '删除后会同时移除该设备的本地手记记录，确认继续吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await removeDevice(device.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <Text variant="headlineMedium" style={styles.title}>
                {device.name}
              </Text>
              <IconButton
                icon="cog"
                size={20}
                mode="contained-tonal"
                onPress={() =>
                  router.push({
                    pathname: '/device/[deviceId]/config',
                    params: { deviceId: device.id },
                  } as never)
                }
              />
            </View>
            <View
              style={[styles.statusPill, { backgroundColor: online ? '#D9F4DE' : '#ECE7DD' }]}>
              <Text variant="labelLarge" style={{ color: online ? '#1F7A37' : '#7A7268' }}>
                {online ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
          <Text variant="bodyLarge" style={styles.subtitle}>
            设备地址：{device.macAddress}
          </Text>
          <View style={styles.mqttStatusRow}>
            <Chip
              icon="connection"
              compact
              style={[styles.mqttStatusChip, { backgroundColor: mqttStatusInfo.bgColor }]}>
              <Text style={{ color: mqttStatusInfo.color, fontSize: 12 }}>
                {mqttStatusInfo.label}
              </Text>
            </Chip>
            {mqttStatus !== 'connected' && mqttStatus !== 'connecting' && (
              <Button mode="text" compact onPress={handleReconnect}>
                重新连接
              </Button>
            )}
          </View>
        </View>

        <Card style={styles.heroCard}>
          <Card.Content style={styles.heroContent}>
            <Metric label="空气温度" value={`${stats.airTemp.toFixed(1)}°C`} accent="#E89B5C" />
            <Metric label="空气湿度" value={`${stats.humidity.toFixed(0)}%`} accent="#5FA8D3" />
            <Metric label="土壤湿度" value={`${stats.soilMoisture.toFixed(0)}%`} accent="#6A994E" />
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">快捷控制</Text>
            <View style={styles.buttonGrid}>
              <Button mode="contained" onPress={() => runCommand('water')}>
                浇水
              </Button>
              <Button mode="outlined" onPress={() => runCommand('capture')}>
                立即拍照
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">历史记录</Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              成长日记默认保存在本地 SQLite，只有在你主动诊断或同步时才会访问网络。
            </Text>
            <Button
              mode="contained"
              onPress={() =>
                router.push({
                  pathname: '/device/[deviceId]/diary',
                  params: { deviceId: device.id },
                } as never)
              }>
              打开成长相册
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">设备管理</Text>
            <Button
              mode="outlined"
              buttonColor="#FFF4F2"
              textColor="#B3261E"
              onPress={confirmDeleteDevice}>
              删除设备
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={2400}>
        {message}
      </Snackbar>
    </SafeAreaView>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: '#163020',
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  mqttStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mqttStatusChip: {
    borderRadius: 8,
  },
});

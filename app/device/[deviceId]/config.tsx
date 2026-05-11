import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Chip, Snackbar, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { connectToDevice } from '@/lib/mqtt-data';
import { useAppStore } from '@/lib/store';

export default function DeviceConfigScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const devices = useAppStore((state) => state.devices);
  const saveDeviceMqttConfig = useAppStore((state) => state.saveDeviceMqttConfig);
  const getMqttConnectionStatus = useAppStore((state) => state.getMqttConnectionStatus);

  const device = useMemo(
    () => devices.find((entry) => entry.id === deviceId),
    [deviceId, devices],
  );

  const [mqttUrl, setMqttUrl] = useState(device?.mqttUrl ?? '');
  const [mqttTopic, setMqttTopic] = useState(device?.mqttTopic ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 获取 MQTT 连接状态
  const mqttStatus = device ? getMqttConnectionStatus(device.mqttUrl) : 'disconnected';

  useEffect(() => {
    setMqttUrl(device?.mqttUrl ?? '');
    setMqttTopic(device?.mqttTopic ?? '');
  }, [device?.mqttTopic, device?.mqttUrl]);

  if (!device) {
    return null;
  }

  const onSave = async () => {
    setSaving(true);
    await saveDeviceMqttConfig(device.id, mqttUrl.trim(), mqttTopic.trim());
    setSaving(false);
    setMessage('设备 MQTT 配置已保存。');
  };

  const onConnect = () => {
    if (!mqttUrl.trim()) {
      setMessage('请先填写 MQTT 地址');
      return;
    }

    // 先保存配置，然后连接
    saveDeviceMqttConfig(device.id, mqttUrl.trim(), mqttTopic.trim()).then(() => {
      const updatedDevice = { ...device, mqttUrl: mqttUrl.trim(), mqttTopic: mqttTopic.trim() };
      connectToDevice(updatedDevice);
      setMessage('正在连接...');
    });
  };

  // 获取连接状态显示信息
  const getMqttStatusInfo = () => {
    switch (mqttStatus) {
      case 'connected':
        return { label: '已连接', color: '#1F7A37', bgColor: '#D9F4DE' };
      case 'connecting':
        return { label: '连接中...', color: '#9A4D00', bgColor: '#FFF4E8' };
      case 'error':
        return { label: '连接失败', color: '#B3261E', bgColor: '#FFF4F2' };
      default:
        return { label: '未连接', color: '#7A7268', bgColor: '#ECE7DD' };
    }
  };

  const mqttStatusInfo = getMqttStatusInfo();

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            设备配置
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            {device.name} · {device.macAddress}
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">MQTT 地址</Text>
            <TextInput
              label="MQTT 地址"
              value={mqttUrl}
              onChangeText={setMqttUrl}
              mode="outlined"
              placeholder="mqtt://broker.example.com:1883"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text variant="bodyMedium" style={styles.helper}>
              支持 `mqtt://`、`mqtts://`、`ws://`、`wss://`。在线状态订阅会按这个地址建立连接。
            </Text>
            <Text variant="titleMedium">订阅主题</Text>
            <TextInput
              label="订阅主题"
              value={mqttTopic}
              onChangeText={setMqttTopic}
              mode="outlined"
              placeholder={`plant/${device.macAddress}/status`}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text variant="bodyMedium" style={styles.helper}>
              例如 `plant/AABBCCDDEEFF/status`。收到 `{"{"}"status":"online"{"}"}` 时会显示在线状态。
            </Text>

            <View style={styles.connectionSection}>
              <Text variant="titleMedium">连接状态</Text>
              <View style={styles.connectionRow}>
                <Chip
                  icon="connection"
                  compact
                  style={[styles.statusChip, { backgroundColor: mqttStatusInfo.bgColor }]}>
                  <Text style={{ color: mqttStatusInfo.color, fontSize: 12 }}>
                    {mqttStatusInfo.label}
                  </Text>
                </Chip>
                <Button
                  mode="outlined"
                  compact
                  onPress={onConnect}
                  disabled={mqttStatus === 'connecting'}>
                  {mqttStatus === 'connected' ? '重新连接' : '连接'}
                </Button>
              </View>
            </View>

            <View style={styles.actions}>
              <Button mode="contained" onPress={onSave} loading={saving} disabled={saving}>
                保存配置
              </Button>
              <Button mode="text" onPress={() => router.back()}>
                返回
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={2400}>
        {message}
      </Snackbar>
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
  card: {
    backgroundColor: '#FFFDF8',
  },
  section: {
    gap: 14,
  },
  helper: {
    color: '#617062',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  connectionSection: {
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E1D8',
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusChip: {
    borderRadius: 8,
  },
});

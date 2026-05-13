import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, HelperText, Snackbar, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { testBackendConnection } from '@/lib/api';
import { useAppStore } from '@/lib/store';

export default function DeviceConfigScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const devices = useAppStore((state) => state.devices);
  const saveDeviceMqttConfig = useAppStore((state) => state.saveDeviceMqttConfig);

  const device = useMemo(
    () => devices.find((entry) => entry.id === deviceId),
    [deviceId, devices],
  );

  const [mqttUrl, setMqttUrl] = useState(device?.mqttUrl ?? '');
  const [mqttTopic, setMqttTopic] = useState(device?.mqttTopic ?? '');
  const [backendUrl, setBackendUrl] = useState(device?.backendUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMqttUrl(device?.mqttUrl ?? '');
    setMqttTopic(device?.mqttTopic ?? '');
    setBackendUrl(device?.backendUrl ?? '');
    setConnectionStatus(null);
  }, [device?.mqttTopic, device?.mqttUrl, device?.backendUrl]);

  if (!device) {
    return null;
  }

  const onSave = async () => {
    setSaving(true);
    await saveDeviceMqttConfig(device.id, mqttUrl.trim(), mqttTopic.trim(), backendUrl.trim());
    setSaving(false);
    setMessage('设备配置已保存。');
  };

  const onTestConnection = async () => {
    if (!backendUrl.trim()) {
      setMessage('请先填写后端地址');
      return;
    }

    setTesting(true);
    setConnectionStatus(null);
    const success = await testBackendConnection(backendUrl);
    setConnectionStatus(success);
    setTesting(false);
    setMessage(success ? '连接成功！' : '连接失败，请检查地址是否正确');
  };

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
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
              <Text variant="titleMedium">在线状态订阅主题</Text>
              <View style={styles.topicRow}>
                <TextInput
                  label="在线状态订阅主题"
                  value={mqttTopic}
                  onChangeText={setMqttTopic}
                  mode="outlined"
                  placeholder={`plant/${device.macAddress}/status`}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.topicInput}
                />
                <Button
                  mode="outlined"
                  compact
                  onPress={() => setMqttTopic(`plant/${device.macAddress}/status`)}>
                  默认
                </Button>
              </View>
              <Text variant="bodyMedium" style={styles.helper}>
                例如 `plant/AABBCCDDEEFF/status`。收到 `{"{"}"status":"online"{"}"}` 时会显示在线状态。
              </Text>

              <Text variant="titleMedium">自定义后端地址</Text>
              <TextInput
                label="后端地址"
                value={backendUrl}
                onChangeText={setBackendUrl}
                mode="outlined"
                placeholder="http://192.168.1.100:8080"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.testRow}>
                <Button
                  mode="outlined"
                  compact
                  onPress={onTestConnection}
                  loading={testing}
                  disabled={testing || !backendUrl.trim()}>
                  测试连接
                </Button>
                {connectionStatus !== null && (
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: connectionStatus ? '#4CAF50' : '#F44336' }
                  ]} />
                )}
              </View>
              <HelperText type="info">
                请填写完整的 URL，包含 http:// 或 https:// 前缀。例如 http://192.168.1.100:8080
              </HelperText>

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
      </KeyboardAvoidingView>

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
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 18,
    paddingBottom: 40,
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
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topicInput: {
    flex: 1,
  },
});

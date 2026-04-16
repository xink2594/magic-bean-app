import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Switch, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/lib/store';

export default function SettingsScreen() {
  const config = useAppStore((state) => state.config);
  const saveSettings = useAppStore((state) => state.saveSettings);

  const [backendUrl, setBackendUrl] = useState(config.backendUrl);
  const [llmStatus, setLlmStatus] = useState(config.llmStatus);
  const [webdavUrl, setWebdavUrl] = useState(config.webdavUrl);
  const [syncEnabled, setSyncEnabled] = useState(config.syncEnabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBackendUrl(config.backendUrl);
    setLlmStatus(config.llmStatus);
    setWebdavUrl(config.webdavUrl);
    setSyncEnabled(config.syncEnabled);
  }, [config]);

  const onSave = async () => {
    setSaving(true);
    await saveSettings({
      backendUrl,
      llmStatus,
      webdavUrl,
      syncEnabled,
    });
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            设置
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            在这里配置你的自托管服务地址，整个应用都会读取本地配置。
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content style={styles.form}>
            <TextInput
              label="自定义后端地址"
              value={backendUrl}
              onChangeText={setBackendUrl}
              mode="outlined"
              placeholder="https://plant-gateway.local"
            />
            <HelperText type="info">供共享的 Axios 客户端读取，用于 AI 诊断与同步请求。</HelperText>

            <TextInput
              label="LLM API 状态"
              value={llmStatus}
              onChangeText={setLlmStatus}
              mode="outlined"
              placeholder="已连接 / 降级 / 离线"
            />

            <TextInput
              label="WebDAV / 同步地址"
              value={webdavUrl}
              onChangeText={setWebdavUrl}
              mode="outlined"
              placeholder="https://storage.example.com/plants/"
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium">启用同步</Text>
                <Text variant="bodyMedium" style={styles.switchCopy}>
                  日记和相册优先从本地读取，只有在你主动获取或同步时才会访问网络。
                </Text>
              </View>
              <Switch value={syncEnabled} onValueChange={setSyncEnabled} />
            </View>

            <Button mode="contained" onPress={onSave} loading={saving} disabled={saving}>
              保存本地设置
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
  form: {
    gap: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 6,
  },
  switchCopy: {
    color: '#617062',
    marginTop: 4,
  },
});

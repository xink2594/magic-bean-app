import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Switch, Text, TextInput } from 'react-native-paper';

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
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Settings
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Configure your self-hosted endpoints once and the whole app reads from local config.
        </Text>
      </View>

      <Card style={styles.card}>
        <Card.Content style={styles.form}>
          <TextInput
            label="Custom Backend URL"
            value={backendUrl}
            onChangeText={setBackendUrl}
            mode="outlined"
            placeholder="https://plant-gateway.local"
          />
          <HelperText type="info">Used by the shared Axios client for AI and sync requests.</HelperText>

          <TextInput
            label="LLM API Status"
            value={llmStatus}
            onChangeText={setLlmStatus}
            mode="outlined"
            placeholder="Connected / Degraded / Offline"
          />

          <TextInput
            label="WebDAV / Sync URL"
            value={webdavUrl}
            onChangeText={setWebdavUrl}
            mode="outlined"
            placeholder="https://storage.example.com/plants/"
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium">Enable Sync</Text>
              <Text variant="bodyMedium" style={styles.switchCopy}>
                Keep offline reads local and only use network when you explicitly fetch or sync.
              </Text>
            </View>
            <Switch value={syncEnabled} onValueChange={setSyncEnabled} />
          </View>

          <Button mode="contained" onPress={onSave} loading={saving} disabled={saving}>
            Save Local Settings
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

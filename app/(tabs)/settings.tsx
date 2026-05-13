import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Snackbar, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/lib/store';

export default function SettingsScreen() {
  const clearAppData = useAppStore((state) => state.clearAppData);

  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState('');

  const onClearLocalData = async () => {
    setClearing(true);
    await clearAppData();
    setMessage('本地设备和手记数据已清除。');
    setClearing(false);
  };

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            设置
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content style={styles.form}>
            <Text variant="titleMedium">本地数据</Text>
            <Text variant="bodyMedium" style={styles.switchCopy}>
              清除当前设备列表和成长日记记录，配置项会保留。
            </Text>
            <Button
              mode="outlined"
              buttonColor="#FFF4F2"
              textColor="#B3261E"
              onPress={onClearLocalData}
              loading={clearing}
              disabled={clearing}>
              清除本地数据
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={2600}>
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
    gap: 10,
    marginTop: 8,
  },
  title: {
    color: '#163020',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFDF8',
  },
  form: {
    gap: 14,
  },
  switchCopy: {
    color: '#617062',
    marginTop: 4,
  },
});

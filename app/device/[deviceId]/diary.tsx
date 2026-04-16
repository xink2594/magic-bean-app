import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LATEST_RECORD_ID } from '@/lib/demo-content';
import { getRecordsByDeviceId } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { PlantRecord } from '@/lib/types';

export default function DiaryGalleryScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const devices = useAppStore((state) => state.devices);
  const [records, setRecords] = useState<PlantRecord[]>([]);

  const device = useMemo(
    () => devices.find((entry) => entry.id === deviceId),
    [deviceId, devices],
  );

  useEffect(() => {
    if (!deviceId) {
      return;
    }

    getRecordsByDeviceId(deviceId).then(setRecords);
  }, [deviceId]);

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            {device?.name ?? '成长日记'}
          </Text>
        </View>

        {records.map((record) => (
          <Card key={record.id} style={styles.card}>
            <Image source={{ uri: record.imageUrl }} style={styles.image} contentFit="cover" />
            <Card.Content style={styles.cardContent}>
              <Text variant="titleMedium">📅 {new Date(record.timestamp).toLocaleString()}</Text>
              <Text variant="bodyMedium" style={styles.subtle}>
                {record.note || '📝 暂时还没有备注。'}
              </Text>
              <Text variant="bodySmall" style={styles.subtle}>
                🌡️ {record.temp.toFixed(1)}°C · 💧 湿度 {record.humidity.toFixed(0)}%
              </Text>
              {record.id === LATEST_RECORD_ID ? (
                <View style={styles.aiPreview}>
                  <Text variant="labelLarge" style={styles.aiTitle}>
                    🤖 AI 速览
                  </Text>
                  <Text variant="bodySmall" style={styles.aiCopy}>
                    健康，长势良好。保持适度浇水、充足散射光，并注意通风。
                  </Text>
                </View>
              ) : null}
              <Button
                mode="outlined"
                onPress={() =>
                  router.push({
                    pathname: '/photo/[recordId]',
                    params: { recordId: record.id },
                  } as never)
                }>
                查看照片与 AI 诊断
              </Button>
            </Card.Content>
          </Card>
        ))}
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
    overflow: 'hidden',
    backgroundColor: '#FFFDF8',
  },
  image: {
    width: '100%',
    height: 220,
  },
  cardContent: {
    gap: 12,
  },
  subtle: {
    color: '#617062',
  },
  aiPreview: {
    borderRadius: 14,
    backgroundColor: '#EEF3E7',
    padding: 12,
    gap: 6,
  },
  aiTitle: {
    color: '#23412D',
    fontWeight: '700',
  },
  aiCopy: {
    color: '#4B5B4D',
    lineHeight: 18,
  },
});

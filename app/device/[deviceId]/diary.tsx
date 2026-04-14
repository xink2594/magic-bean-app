import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Text } from 'react-native-paper';
import { Image } from 'expo-image';

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
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          {device?.name ?? 'Diary'}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Photo timeline sourced from SQLite for fast offline browsing.
        </Text>
      </View>

      {records.map((record) => (
        <Card key={record.id} style={styles.card}>
          <Image source={{ uri: record.imageUrl }} style={styles.image} contentFit="cover" />
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">{new Date(record.timestamp).toLocaleString()}</Text>
            <Text variant="bodyMedium" style={styles.subtle}>
              {record.note || 'No note yet.'}
            </Text>
            <Text variant="bodySmall" style={styles.subtle}>
              {record.temp.toFixed(1)}°C · {record.humidity.toFixed(0)}% humidity
            </Text>
            <Button
              mode="outlined"
              onPress={() =>
                router.push({
                  pathname: '/photo/[recordId]',
                  params: { recordId: record.id },
                } as never)
              }>
              Open Photo & AI
            </Button>
          </Card.Content>
        </Card>
      ))}
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
});

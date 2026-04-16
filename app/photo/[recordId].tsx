import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { diagnosePlantImage } from '@/lib/api';
import { getDemoDiagnosis } from '@/lib/demo-content';
import { getRecordById, updateRecordNote } from '@/lib/database';
import { PlantRecord } from '@/lib/types';

export default function PhotoDetailAndAIScreen() {
  const { recordId } = useLocalSearchParams<{ recordId: string }>();
  const [record, setRecord] = useState<PlantRecord | null>(null);
  const [note, setNote] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!recordId) {
      return;
    }

    getRecordById(recordId).then((value) => {
      setRecord(value);
      setNote(value?.note ?? '');
      setDiagnosis(getDemoDiagnosis(value?.id));
    });
  }, [recordId]);

  if (!record) {
    return null;
  }

  const saveNote = async () => {
    setSaving(true);
    await updateRecordNote(record.id, note);
    setRecord({ ...record, note });
    setSaving(false);
  };

  const runDiagnosis = async () => {
    setLoading(true);
    const result = await diagnosePlantImage(record.imageUrl);
    setDiagnosis(result);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={{ uri: record.imageUrl }} style={styles.image} contentFit="cover" />

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleLarge">照片备注</Text>
            <TextInput
              mode="outlined"
              multiline
              value={note}
              onChangeText={setNote}
              placeholder="记录叶片颜色、生长情况、浇水状态，或其他观察到的变化。"
            />
            <Button mode="contained-tonal" onPress={saveNote} loading={saving} disabled={saving}>
              保存备注
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleLarge">AI 诊断</Text>
            <Button mode="contained" onPress={runDiagnosis} loading={loading} disabled={loading}>
              分析图片
            </Button>
            <View style={styles.diagnosis}>
              <Text variant="bodyMedium" style={styles.diagnosisText}>
                {diagnosis || '暂时还没有诊断结果，点击上方按钮后会调用你配置的后端 AI 代理。'}
              </Text>
            </View>
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
  image: {
    width: '100%',
    height: 320,
    borderRadius: 28,
  },
  card: {
    backgroundColor: '#FFFDF8',
  },
  section: {
    gap: 14,
  },
  diagnosis: {
    minHeight: 140,
    borderRadius: 18,
    backgroundColor: '#EEF3E7',
    padding: 14,
  },
  diagnosisText: {
    color: '#23412D',
    lineHeight: 22,
  },
});

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { Image } from 'expo-image';

import { diagnosePlantImage } from '@/lib/api';
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
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Image source={{ uri: record.imageUrl }} style={styles.image} contentFit="cover" />

      <Card style={styles.card}>
        <Card.Content style={styles.section}>
          <Text variant="titleLarge">Photo Notes</Text>
          <TextInput
            mode="outlined"
            multiline
            value={note}
            onChangeText={setNote}
            placeholder="Describe leaf color, growth, watering, or anything you notice."
          />
          <Button mode="contained-tonal" onPress={saveNote} loading={saving} disabled={saving}>
            Save Note
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content style={styles.section}>
          <Text variant="titleLarge">AI Diagnosis</Text>
          <Button mode="contained" onPress={runDiagnosis} loading={loading} disabled={loading}>
            Analyze Image
          </Button>
          <View style={styles.diagnosis}>
            <Text variant="bodyMedium" style={styles.diagnosisText}>
              {diagnosis || 'No diagnosis yet. Tap the button to call your configured backend AI proxy.'}
            </Text>
          </View>
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

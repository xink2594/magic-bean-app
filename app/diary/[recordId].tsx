import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Dialog, Divider, IconButton, Portal, Snackbar, Switch, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { AiAnalysisResult, analyzePlantImage, deleteDiary, fetchDiaryDetail, saveDiaryNote } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { DiaryDetail } from '@/lib/types';

export default function DiaryDetailScreen() {
  const { recordId, deviceId } = useLocalSearchParams<{ recordId: string; deviceId: string }>();
  const devices = useAppStore((state) => state.devices);
  const saveWaterConfig = useAppStore((state) => state.saveWaterConfig);
  const saveLightConfig = useAppStore((state) => state.saveLightConfig);

  const [detail, setDetail] = useState<DiaryDetail | null>(null);
  const [note, setNote] = useState('');
  const [temperature, setTemperature] = useState('');
  const [airHumidity, setAirHumidity] = useState('');
  const [dirtHumidity, setDirtHumidity] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(null);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [message, setMessage] = useState('');

  const device = useMemo(
    () => devices.find((entry) => entry.id === deviceId),
    [deviceId, devices],
  );

  const loadDetail = useCallback(async () => {
    if (!device?.macAddress || !recordId) {
      setLoading(false);
      return;
    }

    const result = await fetchDiaryDetail(device.macAddress, Number(recordId), device.backendUrl);
    if (result) {
      setDetail(result);
      setNote(result.note || '');
      setTemperature(String(result.temperature));
      setAirHumidity(String(result.airHumidity));
      setDirtHumidity(String(result.dirtHumidity));
    }
    setLoading(false);
  }, [device?.macAddress, device?.backendUrl, recordId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleSave = async () => {
    if (!detail) return;

    setSaving(true);
    const success = await saveDiaryNote(
      detail.id,
      note,
      Number(temperature) || detail.temperature,
      Number(airHumidity) || detail.airHumidity,
      Number(dirtHumidity) || detail.dirtHumidity,
      device?.backendUrl,
    );
    setSaving(false);

    if (success) {
      setDetail({
        ...detail,
        note,
        temperature: Number(temperature) || detail.temperature,
        airHumidity: Number(airHumidity) || detail.airHumidity,
        dirtHumidity: Number(dirtHumidity) || detail.dirtHumidity,
      });
      setMessage('已保存');
    } else {
      setMessage('保存失败，请重试');
    }
  };

  const handleAnalyze = async () => {
    if (!detail) return;

    setAnalyzing(true);
    setAiResult(null);

    const result = await analyzePlantImage(
      detail.imageUrl,
      detail.temperature,
      detail.airHumidity,
      detail.dirtHumidity,
      device?.backendUrl,
      customPrompt ? promptText : undefined,
    );

    setAnalyzing(false);

    if (result) {
      setAiResult(result);
      setShowAiDialog(true);
    } else {
      setMessage('AI 分析失败，请重试');
    }
  };

  const handleDelete = () => {
    if (!detail) return;

    Alert.alert('删除手记', '确定要删除这条手记吗？删除后无法恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const success = await deleteDiary(detail.id, device?.backendUrl);
          if (success) {
            setMessage('手记已删除');
            setTimeout(() => router.back(), 500);
          } else {
            setMessage('删除失败，请重试');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.page} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text variant="bodyLarge">加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.page} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text variant="bodyLarge">未找到手记</Text>
          <Button mode="text" onPress={() => router.back()}>
            返回
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const date = new Date(detail.timestamp * 1000);
  const dateStr = date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {/* 头部 */}
          <View style={styles.header}>
            <IconButton
              icon="close"
              size={24}
              onPress={() => router.back()}
            />
            <Text variant="titleLarge" style={styles.headerTitle}>
              手记详情
            </Text>
            <IconButton
              icon="check"
              size={24}
              mode="contained-tonal"
              iconColor="#2C6E49"
              onPress={handleSave}
              loading={saving}
              disabled={saving}
            />
          </View>

          {/* 图片 */}
          <Card style={styles.imageCard}>
            <Image
              source={{ uri: detail.imageUrl }}
              style={styles.image}
              contentFit="cover"
            />
          </Card>

          {/* 时间信息 */}
          <View style={styles.timeInfo}>
            <Text variant="titleMedium" style={styles.dateText}>
              {dateStr}
            </Text>
            <Text variant="bodyMedium" style={styles.timeText}>
              {timeStr}
            </Text>
          </View>

          {/* 环境数据 */}
          <Card style={styles.card}>
            <Card.Content style={styles.statsContent}>
              <View style={styles.statItem}>
                <TextInput
                  label="温度"
                  value={temperature}
                  onChangeText={setTemperature}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  right={<TextInput.Affix text="°C" />}
                  dense
                  style={styles.statInput}
                />
              </View>
              <View style={styles.statItem}>
                <TextInput
                  label="空气湿度"
                  value={airHumidity}
                  onChangeText={setAirHumidity}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  right={<TextInput.Affix text="%" />}
                  dense
                  style={styles.statInput}
                />
              </View>
              <View style={styles.statItem}>
                <TextInput
                  label="土壤湿度"
                  value={dirtHumidity}
                  onChangeText={setDirtHumidity}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  right={<TextInput.Affix text="%" />}
                  dense
                  style={styles.statInput}
                />
              </View>
            </Card.Content>
          </Card>

          {/* Note */}
          <Card style={styles.card}>
            <Card.Content style={styles.noteContent}>
              <Text variant="titleMedium">Note</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                mode="outlined"
                multiline
                numberOfLines={4}
                placeholder="记录一下植物的状态吧..."
                style={styles.noteInput}
              />
            </Card.Content>
          </Card>

          {/* AI 分析 */}
          <Card style={styles.card}>
            <Card.Content style={styles.aiContent}>
              <Text variant="titleMedium">AI 植物诊断</Text>
              <View style={styles.promptToggle}>
                <Text variant="bodyMedium">自定义提示词</Text>
                <Switch value={customPrompt} onValueChange={setCustomPrompt} />
              </View>
              {customPrompt && (
                <TextInput
                  value={promptText}
                  onChangeText={setPromptText}
                  mode="outlined"
                  multiline
                  numberOfLines={4}
                  placeholder="输入自定义 AI 提示词..."
                  style={styles.promptInput}
                />
              )}
              <Button
                mode="contained"
                icon="robot"
                onPress={handleAnalyze}
                loading={analyzing}
                disabled={analyzing}
                style={styles.aiButton}>
                AI 分析
              </Button>
            </Card.Content>
          </Card>

          {/* 删除按钮 */}
          <Button
            mode="outlined"
            buttonColor="#FFF4F2"
            textColor="#B3261E"
            onPress={handleDelete}
            style={styles.deleteButton}>
            删除手记
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* AI 分析结果对话框 */}
      <Portal>
        <Dialog visible={showAiDialog} onDismiss={() => setShowAiDialog(false)} style={styles.dialog}>
          <Dialog.Title>🤖 AI 诊断结果</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.dialogBody}>
              {aiResult && (
                <>
                  <View style={styles.resultSection}>
                    <Text variant="titleMedium" style={styles.resultLabel}>🌿 植物品种</Text>
                    <Text variant="bodyLarge" style={styles.resultValue}>{aiResult.species}</Text>
                  </View>

                  <Divider style={styles.divider} />

                  <View style={styles.resultSection}>
                    <Text variant="titleMedium" style={styles.resultLabel}>📊 长势分析</Text>
                    <Text variant="bodyMedium" style={styles.resultText}>{aiResult.analysis}</Text>
                  </View>

                  <Divider style={styles.divider} />

                  <View style={styles.resultSection}>
                    <Text variant="titleMedium" style={styles.resultLabel}>💡 培养建议</Text>
                    {aiResult.suggestions.map((suggestion, index) => (
                      <View key={index} style={styles.suggestionItem}>
                        <Text variant="bodyMedium" style={styles.suggestionNumber}>{index + 1}.</Text>
                        <Text variant="bodyMedium" style={styles.suggestionText}>{suggestion}</Text>
                      </View>
                    ))}
                  </View>

                  {aiResult.lightAdvice && (
                    <>
                      <Divider style={styles.divider} />
                      <View style={styles.resultSection}>
                        <Text variant="titleMedium" style={styles.resultLabel}>💡 补光建议</Text>
                        <Text variant="bodyMedium" style={styles.resultText}>
                          R:{aiResult.lightAdvice.r} G:{aiResult.lightAdvice.g} B:{aiResult.lightAdvice.b}
                        </Text>
                        <Button
                          mode="outlined"
                          icon="lightbulb"
                          compact
                          onPress={() => {
                            saveLightConfig({
                              rgbMode: 'custom',
                              r: String(aiResult.lightAdvice!.r),
                              g: String(aiResult.lightAdvice!.g),
                              b: String(aiResult.lightAdvice!.b),
                            });
                            setMessage('已应用补光配置');
                            setShowAiDialog(false);
                          }}
                          style={styles.applyButton}>
                          应用到补光灯
                        </Button>
                      </View>
                    </>
                  )}

                  {aiResult.waterAdvice && (
                    <>
                      <Divider style={styles.divider} />
                      <View style={styles.resultSection}>
                        <Text variant="titleMedium" style={styles.resultLabel}>💧 浇水建议</Text>
                        <Text variant="bodyMedium" style={styles.resultText}>
                          持续 {aiResult.waterAdvice.setTime} 秒
                        </Text>
                        <Button
                          mode="outlined"
                          icon="water"
                          compact
                          onPress={() => {
                            saveWaterConfig({
                              actionMode: 'default',
                              actionType: 'water',
                              durationMode: 'custom',
                              duration: String(aiResult.waterAdvice!.setTime),
                            });
                            setMessage('已应用浇水配置');
                            setShowAiDialog(false);
                          }}
                          style={styles.applyButton}>
                          应用到浇水
                        </Button>
                      </View>
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowAiDialog(false)}>关闭</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#163020',
    fontWeight: '700',
  },
  imageCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFDF8',
  },
  image: {
    width: '100%',
    height: 300,
    backgroundColor: '#E5E1D8',
  },
  timeInfo: {
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    color: '#163020',
    fontWeight: '600',
  },
  timeText: {
    color: '#617062',
  },
  card: {
    backgroundColor: '#FFFDF8',
  },
  statsContent: {
    flexDirection: 'row',
    gap: 10,
  },
  statItem: {
    flex: 1,
  },
  statInput: {
    backgroundColor: '#FFFDF8',
  },
  noteContent: {
    gap: 12,
  },
  noteInput: {
    backgroundColor: '#FFFDF8',
  },
  aiContent: {
    gap: 12,
  },
  promptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promptInput: {
    backgroundColor: '#FFFDF8',
    textAlignVertical: 'top',
  },
  aiButton: {
    backgroundColor: '#254D32',
  },
  divider: {
    backgroundColor: '#E5E1D8',
    marginVertical: 12,
  },
  deleteButton: {
    marginTop: 8,
  },
  // 对话框样式
  dialog: {
    backgroundColor: '#FFFDF8',
    maxHeight: '70%',
  },
  dialogBody: {
    paddingHorizontal: 24,
  },
  resultSection: {
    gap: 8,
  },
  resultLabel: {
    color: '#617062',
    fontWeight: '600',
  },
  resultValue: {
    color: '#163020',
    fontWeight: '700',
  },
  resultText: {
    color: '#163020',
    lineHeight: 22,
  },
  suggestionItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  suggestionNumber: {
    color: '#254D32',
    fontWeight: '700',
  },
  suggestionText: {
    color: '#163020',
    flex: 1,
    lineHeight: 22,
  },
  applyButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
});

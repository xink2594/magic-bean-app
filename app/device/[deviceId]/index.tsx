import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Chip, Dialog, IconButton, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';

import { fetchHistoryData } from '@/lib/api';
import { connectToDevice, publishDeviceCommand } from '@/lib/mqtt-data';
import { useAppStore } from '@/lib/store';
import { HistoryDataItem } from '@/lib/types';

export default function DeviceDetailScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const devices = useAppStore((state) => state.devices);
  const getLiveStats = useAppStore((state) => state.getLiveStats);
  const removeDevice = useAppStore((state) => state.removeDevice);
  const isDeviceOnline = useAppStore((state) => state.isDeviceOnline);
  const getMqttConnectionStatus = useAppStore((state) => state.getMqttConnectionStatus);

  const [message, setMessage] = useState('');
  const [historyData, setHistoryData] = useState<HistoryDataItem[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<'temp' | 'airHumidity' | 'soilHumidity'>('temp');
  const [showWaterDialog, setShowWaterDialog] = useState(false);
  const [showLightDialog, setShowLightDialog] = useState(false);
  const [waterActionMode, setWaterActionMode] = useState<'default' | 'custom'>('default');
  const [waterActionType, setWaterActionType] = useState<'water' | 'led_water'>('water');
  const [waterDurationMode, setWaterDurationMode] = useState<'default' | 'custom'>('default');
  const [waterDuration, setWaterDuration] = useState('5');
  const [lightRgbMode, setLightRgbMode] = useState<'default' | 'custom'>('default');
  const [lightR, setLightR] = useState('255');
  const [lightG, setLightG] = useState('0');
  const [lightB, setLightB] = useState('128');

  const lightState = useAppStore((state) => state.getLightState(device?.macAddress ?? ''));
  const lightIsOn = lightState?.state === 'on';

  const device = useMemo(
    () => devices.find((entry) => entry.id === deviceId),
    [deviceId, devices],
  );
  const stats = getLiveStats(deviceId ?? '');

  // 获取 MQTT 连接状态
  const mqttStatus = device ? getMqttConnectionStatus(device.mqttUrl) : 'disconnected';

  // 获取历史数据
  const loadHistoryData = useCallback(async () => {
    if (!device?.macAddress) return;
    const result = await fetchHistoryData(device.macAddress, device.backendUrl);
    if (result?.records) {
      setHistoryData(result.records);
    }
  }, [device?.macAddress, device?.backendUrl]);

  // 页面加载时自动连接 MQTT 并获取历史数据
  useEffect(() => {
    if (device && device.mqttUrl) {
      connectToDevice(device);
    }
    loadHistoryData();
  }, [device?.id, device?.mqttUrl, loadHistoryData]);

  if (!device) {
    return null;
  }

  const online = isDeviceOnline(device.macAddress);

  const sendWaterCommand = () => {
    const seconds = Math.max(5, Math.min(60, parseInt(waterDuration, 10) || 5));
    const action = waterActionMode === 'default' ? 'water' : waterActionType;
    const payload: Record<string, unknown> = { set_time: seconds };
    if (action === 'led_water') {
      payload.r = 0;
      payload.g = 100;
      payload.b = 255;
    }
    const success = publishDeviceCommand(device, action, payload);
    if (success) {
      setMessage(`浇水指令已发送，持续 ${seconds} 秒`);
    } else {
      setMessage('指令发送失败，请检查 MQTT 连接');
    }
  };

  const sendLightCommand = () => {
    let payload: Record<string, unknown>;
    if (lightIsOn) {
      payload = { r: 0, g: 0, b: 0 };
    } else {
      payload = lightRgbMode === 'default'
        ? { r: 255, g: 0, b: 128 }
        : { r: parseInt(lightR, 10) || 0, g: parseInt(lightG, 10) || 0, b: parseInt(lightB, 10) || 0 };
    }
    const success = publishDeviceCommand(device, 'light', payload);
    if (success) {
      setMessage(lightIsOn ? '补光已关闭' : '补光指令已发送');
    } else {
      setMessage('指令发送失败，请检查 MQTT 连接');
    }
  };

  const handleReconnect = () => {
    if (device.mqttUrl) {
      connectToDevice(device);
      setMessage('正在重新连接...');
    } else {
      setMessage('请先配置 MQTT 地址');
    }
  };

  // 获取连接状态显示信息
  const getMqttStatusInfo = () => {
    switch (mqttStatus) {
      case 'connected':
        return { label: 'MQTT 已连接', color: '#1F7A37', bgColor: '#D9F4DE' };
      case 'connecting':
        return { label: 'MQTT 连接中...', color: '#9A4D00', bgColor: '#FFF4E8' };
      case 'error':
        return { label: 'MQTT 连接失败', color: '#B3261E', bgColor: '#FFF4F2' };
      default:
        return { label: 'MQTT 未连接', color: '#7A7268', bgColor: '#ECE7DD' };
    }
  };

  const mqttStatusInfo = getMqttStatusInfo();

  const confirmDeleteDevice = () => {
    Alert.alert('删除设备', '删除后会同时移除该设备的本地手记记录，确认继续吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await removeDevice(device.id);
          router.back();
        },
      },
    ]);
  };

  // 准备图表数据
  const chartData = useMemo(() => {
    if (historyData.length === 0) return null;

    // 取最近的 12 条数据
    const recentData = historyData.slice(-12);

    const formatLabel = (timestamp: number) => {
      const date = new Date(timestamp * 1000);
      return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    // 温度数据（左轴）- 使用普通对象避免冻结问题
    const tempData = recentData.map((item) => {
      const obj: { value: number; label: string; labelTextStyle?: any } = {
        value: Number(item.temperature),
        label: formatLabel(item.timestamp),
      };
      return obj;
    });

    // 空气湿度数据（右轴）
    const airHumidityData = recentData.map((item) => ({
      value: Number(item.airHumidity),
    }));

    // 土壤湿度数据（右轴）
    const soilHumidityData = recentData.map((item) => ({
      value: Number(item.dirtHumidity),
    }));

    // 计算所有数据的最大值和最小值
    const allValues = [
      ...tempData.map(d => d.value),
      ...airHumidityData.map(d => d.value),
      ...soilHumidityData.map(d => d.value),
    ];
    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);

    // 动态计算 Y 轴范围（上下各留 10% 余量，最小不小于 0）
    const padding = Math.max((dataMax - dataMin) * 0.1, 5);
    const yAxisMin = Math.max(0, Math.floor((dataMin - padding) / 5) * 5);
    const yAxisMax = Math.ceil((dataMax + padding) / 5) * 5;

    // 深拷贝避免冻结问题
    const result = {
      tempData: JSON.parse(JSON.stringify(tempData)),
      airHumidityData: JSON.parse(JSON.stringify(airHumidityData)),
      soilHumidityData: JSON.parse(JSON.stringify(soilHumidityData)),
      yAxisMin,
      yAxisMax,
    };

    return result;
  }, [historyData]);

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <Text variant="headlineMedium" style={styles.title}>
                {device.name}
              </Text>
              <IconButton
                icon="cog"
                size={20}
                mode="contained-tonal"
                onPress={() =>
                  router.push({
                    pathname: '/device/[deviceId]/config',
                    params: { deviceId: device.id },
                  } as never)
                }
              />
            </View>
            <View
              style={[styles.statusPill, { backgroundColor: online ? '#D9F4DE' : '#FFEBEE' }]}>
              <Text variant="labelLarge" style={{ color: online ? '#1F7A37' : '#C62828' }}>
                {online ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
          <Text variant="bodyLarge" style={styles.subtitle}>
            设备地址：{device.macAddress}
          </Text>
          <View style={styles.mqttStatusRow}>
            <Chip
              icon="connection"
              compact
              style={[styles.mqttStatusChip, { backgroundColor: mqttStatusInfo.bgColor }]}>
              <Text style={{ color: mqttStatusInfo.color, fontSize: 12 }}>
                {mqttStatusInfo.label}
              </Text>
            </Chip>
            {mqttStatus !== 'connected' && mqttStatus !== 'connecting' && (
              <Button mode="text" compact onPress={handleReconnect}>
                重新连接
              </Button>
            )}
          </View>
        </View>

        <Card style={styles.heroCard}>
          <Card.Content style={styles.heroContent}>
            <View style={styles.currentStats}>
              <Metric
                label="空气温度"
                value={stats.airTemp !== null ? `${stats.airTemp.toFixed(1)}°C` : '--'}
                accent="#E89B5C"
              />
              <Metric
                label="空气湿度"
                value={stats.humidity !== null ? `${stats.humidity.toFixed(0)}%` : '--'}
                accent="#5FA8D3"
              />
              <Metric
                label="土壤湿度"
                value={stats.soilMoisture !== null ? `${stats.soilMoisture.toFixed(0)}%` : '--'}
                accent="#6A994E"
              />
            </View>
          </Card.Content>
        </Card>

        {/* 历史趋势 - 始终显示 */}
        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">历史趋势</Text>

            {/* 指标选择按钮 */}
            <View style={styles.metricButtons}>
              <Chip
                selected={selectedMetric === 'temp'}
                onPress={() => setSelectedMetric('temp')}
                style={[styles.metricChip, selectedMetric === 'temp' && { backgroundColor: '#D9F4DE' }]}
                textStyle={selectedMetric === 'temp' ? { color: '#1F7A37' } : undefined}>
                🌡️ 温度
              </Chip>
              <Chip
                selected={selectedMetric === 'airHumidity'}
                onPress={() => setSelectedMetric('airHumidity')}
                style={[styles.metricChip, selectedMetric === 'airHumidity' && { backgroundColor: '#E3F2FD' }]}
                textStyle={selectedMetric === 'airHumidity' ? { color: '#1565C0' } : undefined}>
                💧 空气湿度
              </Chip>
              <Chip
                selected={selectedMetric === 'soilHumidity'}
                onPress={() => setSelectedMetric('soilHumidity')}
                style={[styles.metricChip, selectedMetric === 'soilHumidity' && { backgroundColor: '#FFF3E0' }]}
                textStyle={selectedMetric === 'soilHumidity' ? { color: '#E65100' } : undefined}>
                🌱 土壤湿度
              </Chip>
            </View>

            {/* 图表区域 */}
            {chartData ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chartContainer}>
                  <LineChart
                    data={selectedMetric === 'temp' ? chartData.tempData : selectedMetric === 'airHumidity' ? chartData.airHumidityData : chartData.soilHumidityData}
                    height={180}
                    width={Math.max(320, chartData.tempData.length * 50)}
                    color={selectedMetric === 'temp' ? '#6A994E' : selectedMetric === 'airHumidity' ? '#5FA8D3' : '#E89B5C'}
                    thickness={2}
                    dataPointsColor={selectedMetric === 'temp' ? '#6A994E' : selectedMetric === 'airHumidity' ? '#5FA8D3' : '#E89B5C'}
                    dataPointsRadius={4}
                    yAxisColor="#617062"
                    yAxisThickness={1}
                    xAxisColor="#617062"
                    xAxisThickness={1}
                    yAxisTextStyle={styles.axisLabel}
                    xAxisLabelTextStyle={styles.axisLabel}
                    noOfSections={5}
                    maxValue={chartData.yAxisMax}
                    spacing={40}
                    backgroundColor="transparent"
                    curved
                    isAnimated
                    hideRules={false}
                    rulesColor="#E5E1D8"
                    rulesThickness={1}
                    showValuesAsDataPointsText={false}
                  />
                </View>
              </ScrollView>
            ) : (
              <View style={styles.emptyChart}>
                <Text variant="bodyMedium" style={styles.emptyChartText}>
                  暂无历史数据
                </Text>
                <Text variant="bodySmall" style={styles.emptyChartHint}>
                  等待设备上传数据
                </Text>
              </View>
            )}

            <Text variant="bodySmall" style={styles.chartHint}>
              {historyData.length > 0
                ? `显示最近 ${Math.min(historyData.length, 12)} 条记录`
                : '当前无数据'}
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">快捷控制</Text>
            <View style={styles.controlRow}>
              <Button
                mode="outlined"
                onPress={sendWaterCommand}
                style={styles.controlButton}
                icon="water">
                浇水
              </Button>
              <IconButton
                icon="cog-outline"
                size={20}
                mode="contained-tonal"
                onPress={() => setShowWaterDialog(true)}
              />
            </View>
            <View style={styles.controlRow}>
              <Button
                mode={lightIsOn ? 'contained' : 'outlined'}
                onPress={sendLightCommand}
                style={[styles.controlButton, lightIsOn && { backgroundColor: '#1B5E20' }]}
                icon="lightbulb">
                补光
              </Button>
              <IconButton
                icon="cog-outline"
                size={20}
                mode="contained-tonal"
                onPress={() => setShowLightDialog(true)}
              />
            </View>
            <Button mode="outlined" onPress={() => publishDeviceCommand(device, 'capture', {})}>
              立即拍照
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">历史记录</Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              成长日记默认保存在本地 SQLite，只有在你主动诊断或同步时才会访问网络。
            </Text>
            <Button
              mode="contained"
              onPress={() =>
                router.push({
                  pathname: '/device/[deviceId]/diary',
                  params: { deviceId: device.id },
                } as never)
              }>
              打开成长相册
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium">设备管理</Text>
            <Button
              mode="outlined"
              buttonColor="#FFF4F2"
              textColor="#B3261E"
              onPress={confirmDeleteDevice}>
              删除设备
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      <Portal>
        {/* 浇水配置 */}
        <Dialog visible={showWaterDialog} onDismiss={() => setShowWaterDialog(false)} style={styles.dialogStyle}>
          <Dialog.Title>浇水配置</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.dialogBody}>
              <Text variant="titleSmall" style={styles.configLabel}>动作类型</Text>
              <View style={styles.configOptions}>
                <Chip
                  selected={waterActionMode === 'default'}
                  onPress={() => setWaterActionMode('default')}
                  style={styles.configChip}>
                  默认 (water)
                </Chip>
                <Chip
                  selected={waterActionMode === 'custom'}
                  onPress={() => setWaterActionMode('custom')}
                  style={styles.configChip}>
                  自定义
                </Chip>
              </View>
              {waterActionMode === 'custom' && (
                <View style={styles.configOptions}>
                  <Chip
                    selected={waterActionType === 'water'}
                    onPress={() => setWaterActionType('water')}
                    style={styles.configChip}>
                    water
                  </Chip>
                  <Chip
                    selected={waterActionType === 'led_water'}
                    onPress={() => setWaterActionType('led_water')}
                    style={styles.configChip}>
                    led_water
                  </Chip>
                </View>
              )}

              <Text variant="titleSmall" style={styles.configLabel}>持续时间</Text>
              <View style={styles.configOptions}>
                <Chip
                  selected={waterDurationMode === 'default'}
                  onPress={() => setWaterDurationMode('default')}
                  style={styles.configChip}>
                  默认 (5 秒)
                </Chip>
                <Chip
                  selected={waterDurationMode === 'custom'}
                  onPress={() => setWaterDurationMode('custom')}
                  style={styles.configChip}>
                  自定义
                </Chip>
              </View>
              {waterDurationMode === 'custom' && (
                <TextInput
                  mode="outlined"
                  keyboardType="number-pad"
                  value={waterDuration}
                  onChangeText={(text) => setWaterDuration(text.replace(/[^0-9]/g, ''))}
                  right={<TextInput.Affix text="秒" />}
                  dense
                  style={styles.configInput}
                />
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowWaterDialog(false)}>取消</Button>
            <Button onPress={() => setShowWaterDialog(false)}>保存</Button>
          </Dialog.Actions>
        </Dialog>

        {/* 补光配置 */}
        <Dialog visible={showLightDialog} onDismiss={() => setShowLightDialog(false)} style={styles.dialogStyle}>
          <Dialog.Title>补光配置</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.dialogBody}>
              <Text variant="titleSmall" style={styles.configLabel}>RGB</Text>
              <View style={styles.configOptions}>
                <Chip
                  selected={lightRgbMode === 'default'}
                  onPress={() => setLightRgbMode('default')}
                  style={styles.configChip}>
                  默认 (255, 0, 128)
                </Chip>
                <Chip
                  selected={lightRgbMode === 'custom'}
                  onPress={() => setLightRgbMode('custom')}
                  style={styles.configChip}>
                  自定义
                </Chip>
              </View>
              {lightRgbMode === 'custom' && (
                <>
                  <View style={styles.rgbRow}>
                    <Text variant="bodyMedium" style={styles.rgbLabel}>R</Text>
                    <TextInput
                      mode="outlined"
                      keyboardType="number-pad"
                      value={lightR}
                      onChangeText={(text) => setLightR(text.replace(/[^0-9]/g, ''))}
                      dense
                      style={styles.rgbInput}
                    />
                  </View>
                  <View style={styles.rgbRow}>
                    <Text variant="bodyMedium" style={styles.rgbLabel}>G</Text>
                    <TextInput
                      mode="outlined"
                      keyboardType="number-pad"
                      value={lightG}
                      onChangeText={(text) => setLightG(text.replace(/[^0-9]/g, ''))}
                      dense
                      style={styles.rgbInput}
                    />
                  </View>
                  <View style={styles.rgbRow}>
                    <Text variant="bodyMedium" style={styles.rgbLabel}>B</Text>
                    <TextInput
                      mode="outlined"
                      keyboardType="number-pad"
                      value={lightB}
                      onChangeText={(text) => setLightB(text.replace(/[^0-9]/g, ''))}
                      dense
                      style={styles.rgbInput}
                    />
                  </View>
                </>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowLightDialog(false)}>取消</Button>
            <Button onPress={() => setShowLightDialog(false)}>保存</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={2400}>
        {message}
      </Snackbar>
    </SafeAreaView>
  );
}

// 生成 Y 轴标签
function generateYAxisLabels(data: { value: number }[], min: number, max: number): string[] {
  const sections = 4;
  const labels: string[] = [];
  for (let i = sections; i >= 0; i--) {
    const value = min + ((max - min) * i) / sections;
    labels.push(Math.round(value).toString());
  }
  return labels;
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={[styles.metric, { borderLeftColor: accent }]}>
      <Text variant="labelLarge" style={styles.metricLabel}>
        {label}
      </Text>
      <Text variant="displaySmall" style={styles.metricValue}>
        {value}
      </Text>
    </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: '#163020',
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  subtitle: {
    color: '#5E6859',
  },
  heroCard: {
    backgroundColor: '#163020',
  },
  heroContent: {
    gap: 14,
  },
  currentStats: {
    gap: 10,
  },
  metric: {
    backgroundColor: '#FCFBF7',
    borderRadius: 22,
    borderLeftWidth: 6,
    padding: 16,
  },
  metricLabel: {
    color: '#617062',
    marginBottom: 6,
  },
  metricValue: {
    color: '#163020',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFDF8',
  },
  section: {
    gap: 14,
  },
  buttonGrid: {
    gap: 12,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    flex: 1,
  },
  dialogStyle: {
    backgroundColor: '#FFFDF8',
    maxHeight: '70%',
  },
  dialogBody: {
    paddingHorizontal: 24,
  },
  configLabel: {
    color: '#617062',
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  configOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  configChip: {
    backgroundColor: '#F5F1E8',
  },
  configInput: {
    backgroundColor: '#FFFDF8',
    marginBottom: 8,
  },
  rgbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  rgbLabel: {
    width: 20,
    color: '#617062',
    fontWeight: '600',
  },
  rgbInput: {
    flex: 1,
    backgroundColor: '#FFFDF8',
  },
  mqttStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mqttStatusChip: {
    borderRadius: 8,
  },
  metricButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricChip: {
    backgroundColor: '#F5F1E8',
  },
  chartContainer: {
    paddingVertical: 10,
  },
  emptyChart: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F1E8',
    borderRadius: 12,
    gap: 8,
  },
  emptyChartText: {
    color: '#617062',
  },
  emptyChartHint: {
    color: '#999',
  },
  chartHint: {
    color: '#617062',
    textAlign: 'center',
  },
  axisLabel: {
    color: '#617062',
    fontSize: 10,
  },
});

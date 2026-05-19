import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Chip, Dialog, FAB, IconButton, Portal, Snackbar, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { fetchDeviceLatestData } from '@/lib/api';
import { decodeDeviceShare } from '@/lib/share';
import { DeviceLatestData } from '@/lib/types';
import { useAppStore } from '@/lib/store';

export default function DashboardScreen() {
  const devices = useAppStore((state) => state.devices);
  const getLiveStats = useAppStore((state) => state.getLiveStats);
  const isDeviceOnline = useAppStore((state) => state.isDeviceOnline);
  const updateLiveStats = useAppStore((state) => state.updateLiveStats);
  const addProvisionedDevice = useAppStore((state) => state.addProvisionedDevice);

  const [refreshing, setRefreshing] = useState(false);
  const [apiData, setApiData] = useState<Record<string, DeviceLatestData>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [message, setMessage] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const menuAnim = useRef(new Animated.Value(0)).current;

  const toggleMenu = () => {
    const toValue = menuOpen ? 0 : 1;
    Animated.spring(menuAnim, {
      toValue,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
    setMenuOpen(!menuOpen);
  };

  const closeMenu = () => {
    if (!menuOpen) return;
    Animated.spring(menuAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    setMenuOpen(false);
  };

  const handleClipboardImport = async () => {
    closeMenu();
    const text = await Clipboard.getStringAsync();
    const decoded = decodeDeviceShare(text);
    if (!decoded) {
      setMessage('剪贴板内容无效，请先复制分享码');
      return;
    }
    await addProvisionedDevice(decoded);
    setMessage(`已导入设备：${decoded.name}`);
  };

  const handleScanImport = async () => {
    closeMenu();
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        setMessage('需要相机权限才能扫码');
        return;
      }
    }
    setScanned(false);
    setShowScanner(true);
  };

  const handleBarcodeScanned = useCallback(async (result: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setShowScanner(false);

    const decoded = decodeDeviceShare(result.data);
    if (!decoded) {
      setMessage('二维码内容无效');
      return;
    }
    await addProvisionedDevice(decoded);
    setMessage(`已导入设备：${decoded.name}`);
  }, [scanned, addProvisionedDevice]);

  const heroText = useMemo(() => {
    if (!devices.length) {
      return '添加你的第一台智能花盆，开始记录植物环境数据。';
    }

    return `已连接 ${devices.length} 台花盆设备`;
  }, [devices.length]);

  const fetchData = useCallback(async () => {
    if (!devices.length) return;

    const results = await Promise.all(
      devices.map(async (device) => {
        const data = await fetchDeviceLatestData(device.macAddress, device.backendUrl);
        return { deviceId: device.id, data };
      }),
    );

    const newApiData: Record<string, DeviceLatestData> = {};
    for (const { deviceId, data } of results) {
      if (data?.latestData) {
        newApiData[deviceId] = data;
        updateLiveStats(deviceId, {
          airTemp: data.latestData.temperature ?? 0,
          humidity: data.latestData.airHumidity ?? 0,
          soilMoisture: data.latestData.dirtHumidity ?? 0,
        });
      }
    }

    setApiData(newApiData);
  }, [devices, updateLiveStats]);

  // 进入页面时自动加载
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const menuItemTranslateY = (index: number) =>
    menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -(56 + 8) * (index + 1)] });

  const menuItemOpacity = menuAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0, 1] });

  const menuItems = [
    { label: 'AP 配网', icon: 'wifi', onPress: () => { closeMenu(); router.push({ pathname: '/provision' } as never); } },
    { label: '剪贴板导入', icon: 'clipboard-outline', onPress: handleClipboardImport },
    { label: '扫码导入', icon: 'qrcode-scan', onPress: handleScanImport },
  ];

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#254D32" />
        }>
        <View style={styles.hero}>
          <Text variant="headlineMedium" style={styles.heroTitle}>
            智能植物控制台
          </Text>
          <Text variant="bodyLarge" style={styles.heroCopy}>
            {heroText}
          </Text>
        </View>

        {devices.map((device) => {
          const stats = getLiveStats(device.id);
          const online = isDeviceOnline(device.macAddress);
          const latestData = apiData[device.id];
          const hasApiData = Boolean(latestData);

          return (
            <Card key={device.id} style={styles.card} mode="elevated">
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleLarge">{device.name}</Text>
                    <Text variant="bodyMedium" style={styles.subtle}>
                      {device.macAddress}
                    </Text>
                  </View>
                  <View style={styles.chipGroup}>
                    {hasApiData && (
                      <Chip icon="cloud-check" compact style={styles.apiChip}>
                        API
                      </Chip>
                    )}
                    <Chip
                      icon={online ? 'leaf' : 'leaf-off'}
                      compact
                      style={[
                        styles.statusChip,
                        { backgroundColor: online ? '#D9F4DE' : '#FFEBEE' }
                      ]}
                      textStyle={{ color: online ? '#1F7A37' : '#C62828' }}>
                      {online ? 'Online' : 'Offline'}
                    </Chip>
                  </View>
                </View>

                <View style={styles.metricRow}>
                  <Metric
                    label="空气温度"
                    value={stats.airTemp !== null ? `${stats.airTemp.toFixed(1)}°C` : '--'}
                  />
                  <Metric
                    label="空气湿度"
                    value={stats.humidity !== null ? `${stats.humidity.toFixed(0)}%` : '--'}
                  />
                  <Metric
                    label="土壤湿度"
                    value={stats.soilMoisture !== null ? `${stats.soilMoisture.toFixed(0)}%` : '--'}
                  />
                </View>

                <View style={styles.actionRow}>
                  <Button
                    mode="contained"
                    onPress={() =>
                      router.push({
                        pathname: '/device/[deviceId]',
                        params: { deviceId: device.id },
                      } as never)
                    }>
                    查看设备
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() =>
                      router.push({
                        pathname: '/device/[deviceId]/diary',
                        params: { deviceId: device.id },
                      } as never)
                    }>
                    成长日记
                  </Button>
                </View>
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>

      {menuOpen && (
        <View style={styles.menuOverlay} onTouchStart={closeMenu} />
      )}

      {menuItems.map((item, index) => (
        <Animated.View
          key={item.label}
          style={[
            styles.menuItem,
            {
              opacity: menuItemOpacity,
              transform: [{ translateY: menuItemTranslateY(index) }],
            },
          ]}>
          <View style={styles.menuItemInner}>
            <Text variant="labelLarge" style={styles.menuLabel}>{item.label}</Text>
            <IconButton
              icon={item.icon}
              size={24}
              mode="contained-tonal"
              onPress={item.onPress}
              style={styles.menuIcon}
            />
          </View>
        </Animated.View>
      ))}

      <FAB
        icon={menuOpen ? 'close' : 'plus'}
        style={styles.fab}
        onPress={toggleMenu}
      />

      <Portal>
        <Dialog visible={showScanner} onDismiss={() => setShowScanner(false)} style={styles.scannerDialog}>
          <Dialog.Title>扫码导入设备</Dialog.Title>
          <Dialog.Content style={styles.scannerContent}>
            <View style={styles.cameraWrap}>
              <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
            </View>
            <Text variant="bodySmall" style={styles.scannerHint}>
              将二维码对准扫描框
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowScanner(false)}>取消</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={2400}>
        {message}
      </Snackbar>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text variant="labelMedium" style={styles.subtle}>
        {label}
      </Text>
      <Text variant="titleMedium" style={styles.metricValue}>
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
    gap: 16,
    paddingBottom: 120,
  },
  hero: {
    backgroundColor: '#254D32',
    borderRadius: 28,
    padding: 20,
    gap: 12,
  },
  heroTitle: {
    color: '#F7F3E9',
    fontWeight: '700',
  },
  heroCopy: {
    color: '#DCE8D1',
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#FFFDF8',
  },
  cardContent: {
    gap: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chipGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  apiChip: {
    borderRadius: 999,
    backgroundColor: '#E3F2FD',
  },
  statusChip: {
    borderRadius: 999,
  },
  subtle: {
    color: '#617062',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#EEF3E7',
    borderRadius: 18,
    padding: 12,
    gap: 6,
  },
  metricValue: {
    color: '#163020',
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 26,
    backgroundColor: '#E89B5C',
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  menuItem: {
    position: 'absolute',
    right: 20,
    bottom: 26,
  },
  menuItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuLabel: {
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    color: '#163020',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  menuIcon: {
    backgroundColor: '#FFFDF8',
  },
  scannerDialog: {
    backgroundColor: '#FFFDF8',
    maxHeight: '80%',
  },
  scannerContent: {
    alignItems: 'center',
    gap: 12,
  },
  cameraWrap: {
    width: 260,
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  scannerHint: {
    color: '#617062',
  },
});

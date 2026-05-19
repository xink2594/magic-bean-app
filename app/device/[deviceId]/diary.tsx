import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Pressable, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconButton, Snackbar, Text } from 'react-native-paper';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchDiaryList } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { DiaryListItem } from '@/lib/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_GAP = 12;
const ITEM_WIDTH = (SCREEN_WIDTH - 40 - COLUMN_GAP) / 2;

export default function DiaryGalleryScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const devices = useAppStore((state) => state.devices);

  const [records, setRecords] = useState<DiaryListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const expandAnim = useRef(new Animated.Value(0)).current;

  const device = useMemo(
    () => devices.find((entry) => entry.id === deviceId),
    [deviceId, devices],
  );

  // 获取设备的 MAC 地址作为 API 的 deviceId 参数
  const macAddress = device?.macAddress ?? '';

  const fetchData = useCallback(async () => {
    if (!macAddress) {
      setLoading(false);
      return;
    }

    const result = await fetchDiaryList(macAddress, 1, 50, device?.backendUrl);
    if (result?.records) {
      setRecords(result.records);
    }
    setLoading(false);
  }, [macAddress, device?.backendUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const toggleExpand = useCallback(() => {
    const toValue = expanded ? 0 : 1;
    Animated.spring(expandAnim, {
      toValue,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
    setExpanded(!expanded);
  }, [expanded, expandAnim]);

  const handleImagePicked = useCallback(async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.[0]?.uri) return;
    // TODO: 上传图片到后端并刷新列表
    setMessage('图片已选择，上传功能待实现');
    setExpanded(false);
    Animated.spring(expandAnim, { toValue: 0, friction: 6, useNativeDriver: true }).start();
  }, [expandAnim]);

  const handleCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setMessage('需要相机权限才能拍照');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    await handleImagePicked(result);
  }, [handleImagePicked]);

  const handleAlbum = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setMessage('需要相册权限才能选择图片');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    await handleImagePicked(result);
  }, [handleImagePicked]);

  const renderItem = useCallback(({ item, index }: { item: DiaryListItem; index: number }) => {
    const isLeft = index % 2 === 0;

    return (
      <TouchableOpacity
        style={[styles.item, isLeft ? styles.itemLeft : styles.itemRight]}
        activeOpacity={0.8}
        onPress={() => {
          router.push({
            pathname: '/diary/[recordId]',
            params: { recordId: String(item.id), deviceId: deviceId ?? '' },
          } as never);
        }}>
        <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
        <View style={styles.itemFooter}>
          <Text variant="labelSmall" style={styles.itemId}>
            #{item.id}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [deviceId]);

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            加载中...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text variant="bodyLarge" style={styles.emptyText}>
          暂无成长记录
        </Text>
        <Text variant="bodyMedium" style={styles.emptySubtext}>
          设备拍照后会自动同步到这里
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          {device?.name ?? '成长日记'}
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {records.length > 0 ? `共 ${records.length} 张照片` : ''}
        </Text>
      </View>

      <FlatList
        data={records}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#254D32" />
        }
        showsVerticalScrollIndicator={false}
      />

      {expanded && <Pressable style={styles.overlay} onPress={toggleExpand} />}

      <Animated.View
        style={[
          styles.subFab,
          styles.subFabCamera,
          {
            opacity: expandAnim,
            transform: [{ translateY: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -76] }) }],
          },
        ]}>
        <TouchableOpacity style={styles.subFabButton} onPress={handleCamera} activeOpacity={0.8}>
          <IconButton icon="camera" size={24} iconColor="#163020" style={styles.subFabIconBtn} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[
          styles.subFab,
          styles.subFabAlbum,
          {
            opacity: expandAnim,
            transform: [{ translateY: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -140] }) }],
          },
        ]}>
        <TouchableOpacity style={styles.subFabButton} onPress={handleAlbum} activeOpacity={0.8}>
          <IconButton icon="image-multiple" size={24} iconColor="#163020" style={styles.subFabIconBtn} />
        </TouchableOpacity>
      </Animated.View>

      <TouchableOpacity
        style={styles.mainFab}
        onPress={toggleExpand}
        activeOpacity={0.8}>
        <Animated.Text
          style={[
            styles.mainFabIcon,
            { transform: [{ rotate: expandAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] },
          ]}>
          +
        </Animated.Text>
      </TouchableOpacity>

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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 4,
  },
  title: {
    color: '#163020',
    fontWeight: '700',
  },
  subtitle: {
    color: '#5E6859',
  },
  listContent: {
    padding: 20,
    paddingTop: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  item: {
    width: ITEM_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFDF8',
    marginBottom: COLUMN_GAP,
  },
  itemLeft: {
    marginRight: COLUMN_GAP / 2,
  },
  itemRight: {
    marginLeft: COLUMN_GAP / 2,
  },
  image: {
    width: '100%',
    height: ITEM_WIDTH * 1.2,
    backgroundColor: '#E5E1D8',
  },
  itemFooter: {
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemId: {
    color: '#617062',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#163020',
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#617062',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  mainFab: {
    position: 'absolute',
    right: 20,
    bottom: 26,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2C6E49',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 3,
  },
  mainFabIcon: {
    fontSize: 28,
    color: '#F7F3E9',
    fontWeight: '300',
    lineHeight: 30,
  },
  subFab: {
    position: 'absolute',
    right: 20,
    bottom: 26,
    zIndex: 2,
  },
  subFabCamera: {},
  subFabAlbum: {},
  subFabButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  subFabIconBtn: {
    margin: 0,
  },
});

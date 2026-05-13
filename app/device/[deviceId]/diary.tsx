import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
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
});

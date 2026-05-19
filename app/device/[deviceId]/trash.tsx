import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Dialog, IconButton, Portal, Snackbar, Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchDiaryTrash, restoreDiary } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { DiaryListItem } from '@/lib/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_GAP = 12;
const ITEM_WIDTH = (SCREEN_WIDTH - 40 - COLUMN_GAP) / 2;

export default function TrashScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const devices = useAppStore((state) => state.devices);

  const [records, setRecords] = useState<DiaryListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<DiaryListItem | null>(null);

  const device = useMemo(
    () => devices.find((entry) => entry.id === deviceId),
    [deviceId, devices],
  );

  const macAddress = device?.macAddress ?? '';

  const fetchData = useCallback(async () => {
    if (!macAddress) {
      setLoading(false);
      return;
    }

    const result = await fetchDiaryTrash(macAddress, 1, 50, device?.backendUrl);
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

  const handleRestore = useCallback((item: DiaryListItem) => {
    setRestoreTarget(item);
    setShowRestoreDialog(true);
  }, []);

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    setShowRestoreDialog(false);
    const success = await restoreDiary(restoreTarget.id, device?.backendUrl);
    if (success) {
      setRecords((prev) => prev.filter((r) => r.id !== restoreTarget.id));
      setMessage('已恢复');
    } else {
      setMessage('恢复失败，请重试');
    }
    setRestoreTarget(null);
  };

  const renderItem = useCallback(({ item, index }: { item: DiaryListItem; index: number }) => {
    const isLeft = index % 2 === 0;

    return (
      <TouchableOpacity
        style={[styles.item, isLeft ? styles.itemLeft : styles.itemRight]}
        activeOpacity={0.8}
        onLongPress={() => handleRestore(item)}>
        <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
        <View style={styles.itemFooter}>
          <Text variant="labelSmall" style={styles.itemId}>
            #{item.id}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleRestore]);

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
          回收站为空
        </Text>
        <Text variant="bodyMedium" style={styles.emptySubtext}>
          已删除的手记会暂时保留在这里
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor="#163020"
          onPress={() => router.back()}
        />
        <View style={{ flex: 1 }}>
          <Text variant="headlineMedium" style={styles.title}>
            回收站
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {records.length > 0 ? `共 ${records.length} 张照片` : ''}
          </Text>
        </View>
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

      <Portal>
        <Dialog visible={showRestoreDialog} onDismiss={() => setShowRestoreDialog(false)} style={styles.dialog}>
          <Dialog.Title>撤回手记</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              确定要恢复手记 #{restoreTarget?.id} 吗？
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowRestoreDialog(false)}>取消</Button>
            <Button onPress={confirmRestore}>恢复</Button>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
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
  dialog: {
    backgroundColor: '#FFFDF8',
  },
});

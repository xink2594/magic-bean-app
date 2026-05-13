import axios from 'axios';

import { DEMO_AI_DIAGNOSIS } from '@/lib/demo-content';
import { DeviceLatestData, DiaryListResponse, HistoryDataResponse, PlantRecord } from '@/lib/types';
import { useAppStore } from '@/lib/store';

// 获取全局后端地址
function getGlobalBackendUrl(): string {
  return useAppStore.getState().config.backendUrl || 'http://192.168.123.160:8080';
}

export const api = axios.create({
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const backendUrl = getGlobalBackendUrl();
  config.baseURL = backendUrl;
  return config;
});

// 创建独立的设备 API 客户端（使用设备自己的后端地址）
function createDeviceApi(backendUrl: string) {
  return axios.create({
    baseURL: backendUrl,
    timeout: 10000,
  });
}

// 获取 API 客户端（优先使用设备的后端地址）
function getClient(deviceBackendUrl?: string) {
  if (deviceBackendUrl?.trim()) {
    return createDeviceApi(deviceBackendUrl);
  }
  return api;
}

export async function diagnosePlantImage(imageUrl: string) {
  if (
    imageUrl ===
    'https://pub-fea7f2de962241af9278c0306e23517e.r2.dev/plant_20260416_162259_d094699f.jpg'
  ) {
    return DEMO_AI_DIAGNOSIS;
  }

  try {
    const response = await api.post('/ai/diagnose', { image_url: imageUrl });
    const payload = response.data as { diagnosis?: string; markdown?: string; text?: string };

    return payload.diagnosis ?? payload.markdown ?? payload.text ?? '诊断已完成。';
  } catch {
    return [
      'AI 代理暂时无法连接，以下是本地生成的兜底说明。',
      '',
      `- 已加入诊断队列的图片：${imageUrl}`,
      '- 建议下一步检查叶片颜色、是否卷曲，并对比最近的湿度变化趋势。',
      '- 后端地址读取自 SQLite 持久化的 Zustand 配置。',
    ].join('\n');
  }
}

export async function pushDiaryRecord(input: {
  deviceIdentifier: string;
  record: PlantRecord;
  note: string;
}) {
  const payload = {
    deviceId: input.deviceIdentifier,
    records: [
      {
        timestamp: new Date(input.record.timestamp).getTime(),
        temperature: input.record.temp,
        airHumidity: input.record.humidity,
        dirtHumidity: getDemoDirtHumidity(input.record.id),
        imageUrl: input.record.imageUrl,
        note: input.note,
      },
    ],
  };

  const response = await api.post('/api/sync/diary/push', payload);
  return response.data;
}

function getDemoDirtHumidity(recordId: string) {
  if (recordId === 'record-2') {
    return 32.5;
  }

  return 36.0;
}

// API 响应格式
type ApiResponse<T> = {
  code: number;
  msg: string;
  data: T | null;
};

// 获取设备最新数据
export async function fetchDeviceLatestData(
  macAddress: string,
  deviceBackendUrl?: string,
): Promise<DeviceLatestData | null> {
  try {
    const client = getClient(deviceBackendUrl);
    const url = `/api/data/latest/${macAddress}`;
    console.log('[API] Fetching:', (client.defaults.baseURL || '') + url);
    const response = await client.get<ApiResponse<DeviceLatestData>>(url);

    if (response.data.code === 200 && response.data.data) {
      return response.data.data;
    }

    return null;
  } catch (error) {
    console.error('[API] fetchDeviceLatestData error:', error);
    return null;
  }
}

// 获取设备日记列表
export async function fetchDiaryList(
  deviceId: string,
  page: number = 1,
  pageSize: number = 20,
  deviceBackendUrl?: string,
): Promise<DiaryListResponse | null> {
  try {
    const client = getClient(deviceBackendUrl);
    const url = `/api/diary/list?deviceId=${deviceId}&page=${page}&pageSize=${pageSize}`;
    const response = await client.get<ApiResponse<DiaryListResponse>>(url);

    if (response.data.code === 200 && response.data.data) {
      return response.data.data;
    }

    return null;
  } catch (error) {
    console.error('[API] fetchDiaryList error:', error);
    return null;
  }
}

// 获取设备历史数据
export async function fetchHistoryData(
  deviceId: string,
  deviceBackendUrl?: string,
): Promise<HistoryDataResponse | null> {
  try {
    const client = getClient(deviceBackendUrl);
    const url = `/api/data/history?deviceId=${deviceId}`;
    const response = await client.get<ApiResponse<HistoryDataResponse>>(url);

    if (response.data.code === 200 && response.data.data) {
      return response.data.data;
    }

    return null;
  } catch (error) {
    console.error('[API] fetchHistoryData error:', error);
    return null;
  }
}

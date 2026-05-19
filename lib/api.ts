import axios from 'axios';

import { DEMO_AI_DIAGNOSIS } from '@/lib/demo-content';
import { DeviceLatestData, DiaryDetail, DiaryListResponse, HistoryDataResponse, PlantRecord } from '@/lib/types';
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

// 获取回收站日记列表
export async function fetchDiaryTrash(
  deviceId: string,
  page: number = 1,
  pageSize: number = 20,
  deviceBackendUrl?: string,
): Promise<DiaryListResponse | null> {
  try {
    const client = getClient(deviceBackendUrl);
    const url = `/api/diary/trash?deviceId=${deviceId}&page=${page}&pageSize=${pageSize}`;
    const response = await client.get<ApiResponse<DiaryListResponse>>(url);

    if (response.data.code === 200 && response.data.data) {
      return response.data.data;
    }

    return null;
  } catch (error) {
    console.error('[API] fetchDiaryTrash error:', error);
    return null;
  }
}

// 上传图片，返回图片 URL
export async function uploadImage(
  uri: string,
  deviceBackendUrl?: string,
): Promise<string | null> {
  try {
    const client = getClient(deviceBackendUrl);
    const formData = new FormData();

    const filename = uri.split('/').pop() ?? `photo_${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', { uri, name: filename, type } as unknown as Blob);

    const response = await client.post<ApiResponse<{ url?: string; imageUrl?: string }>>(
      '/api/image/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );

    if (response.data.code === 200 && response.data.data) {
      return response.data.data.url ?? response.data.data.imageUrl ?? null;
    }

    return null;
  } catch (error) {
    console.error('[API] uploadImage error:', error);
    return null;
  }
}

// 创建手记
export async function createDiary(
  deviceId: string,
  imageUrl: string,
  note: string = '',
  deviceBackendUrl?: string,
): Promise<boolean> {
  try {
    const client = getClient(deviceBackendUrl);
    const response = await client.post<ApiResponse<unknown>>('/api/diary/create', {
      deviceId,
      imageUrl,
      note,
    });

    return response.data.code === 200;
  } catch (error) {
    console.error('[API] createDiary error:', error);
    return false;
  }
}

// 获取设备历史数据
export async function fetchHistoryData(
  deviceId: string,
  deviceBackendUrl?: string,
  startTime?: number,
  endTime?: number,
): Promise<HistoryDataResponse | null> {
  try {
    const client = getClient(deviceBackendUrl);
    let url = `/api/data/history?deviceId=${deviceId}`;
    if (startTime) {
      url += `&startTime=${startTime}`;
    }
    if (endTime) {
      url += `&endTime=${endTime}`;
    }
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

// 测试后端连接
export async function testBackendConnection(backendUrl: string): Promise<boolean> {
  if (!backendUrl?.trim()) {
    return false;
  }

  try {
    const client = axios.create({
      baseURL: backendUrl.trim(),
      timeout: 5000,
    });

    const response = await client.get('/');
    return response.status === 200;
  } catch {
    return false;
  }
}

// AI 分析结果类型
export type AiAnalysisResult = {
  species: string;
  analysis: string;
  suggestions: string[];
};

// AI 分析植物图片
export async function analyzePlantImage(
  imageUrl: string,
  temperature?: number | null,
  airHumidity?: number | null,
  dirtHumidity?: number | null,
  deviceBackendUrl?: string,
): Promise<AiAnalysisResult | null> {
  // const prompt = '你是一位资深的植物病理学家和高级园艺师。你的任务是根据植物照片和传感器数据，诊断植物健康状况。输入的环境数据参考（可能为空）：当前温度：' + (temperature ?? '无') + '℃，空气湿度：' + (airHumidity ?? '无') + '%，土壤湿度：' + (dirtHumidity ?? '无') + '%。请严格以合法的 JSON 格式输出你的诊断结果，只输出 JSON 字符串，不要包含任何 Markdown 标记（如 ```json）和其他解释性文字。JSON 结构如下：{"species":"植物的俗名或学名","analysis":"结合图片和环境数据，详细描述植物当前长势、病害或异常原因的分析过程。","suggestions":["具体的浇水/土壤管理建议","具体的光照/温度调整建议","施肥或病虫害处理建议"]}';
  const prompt = ''
  
  try {
    // AI 分析可能需要更长时间，使用更长的超时
    const client = axios.create({
      baseURL: deviceBackendUrl?.trim() || getGlobalBackendUrl(),
      timeout: 60000, // 60秒超时
    });

    console.log('[API] analyzePlantImage baseURL:', client.defaults.baseURL);

    const requestBody = { imageUrl, prompt };
    console.log('[API] analyzePlantImage request body length:', JSON.stringify(requestBody).length);

    const response = await client.post('/api/ai/analyze', requestBody);

    const responseData = response.data;

    // 后端返回格式：
    // { code: 200, data: { plantVariety, growthAnalysis, cultivationAdvice } }
    if (responseData?.code === 200 && responseData?.data) {
      const data = responseData.data;

      // 将 cultivationAdvice 按分号分割成建议数组
      const adviceText = data.cultivationAdvice ?? '';
      const suggestions = adviceText
        .split(/[；]/)
        .map((s: string) => s.replace(/^\d+[.、]/, '').trim())  // 移除开头的数字和标点
        .filter((s: string) => s.length > 0);

      return {
        species: data.plantVariety ?? '未知',
        analysis: data.growthAnalysis ?? '',
        suggestions,
      } as AiAnalysisResult;
    }

    return null;
  } catch (error: any) {
    console.error('[API] analyzePlantImage error:', error?.message);
    console.error('[API] analyzePlantImage error code:', error?.code);
    console.error('[API] analyzePlantImage error config:', error?.config?.baseURL, error?.config?.url);
    return null;
  }
}

// 获取日记详情
export async function fetchDiaryDetail(
  deviceId: string,
  id: number,
  deviceBackendUrl?: string,
): Promise<DiaryDetail | null> {
  try {
    const client = getClient(deviceBackendUrl);
    const url = `/api/diary/detail?deviceId=${deviceId}&id=${id}`;
    const response = await client.get<ApiResponse<DiaryDetail>>(url);

    if (response.data.code === 200 && response.data.data) {
      return response.data.data;
    }

    return null;
  } catch (error) {
    console.error('[API] fetchDiaryDetail error:', error);
    return null;
  }
}

// 保存日记备注
export async function saveDiaryNote(
  id: number,
  note: string,
  deviceBackendUrl?: string,
): Promise<boolean> {
  try {
    const client = getClient(deviceBackendUrl);
    const response = await client.post('/api/diary/save', { id, note });
    return response.data.code === 200;
  } catch (error) {
    console.error('[API] saveDiaryNote error:', error);
    return false;
  }
}

// 删除日记（逻辑删除）
export async function deleteDiary(
  id: number,
  deviceBackendUrl?: string,
): Promise<boolean> {
  try {
    const client = getClient(deviceBackendUrl);
    const response = await client.post('/api/diary/delete', { id });
    return response.data.code === 200;
  } catch (error) {
    console.error('[API] deleteDiary error:', error);
    return false;
  }
}

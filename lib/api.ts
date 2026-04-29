import axios from 'axios';

import { DEMO_AI_DIAGNOSIS } from '@/lib/demo-content';
import { PlantRecord } from '@/lib/types';
import { useAppStore } from '@/lib/store';

export const api = axios.create({
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const { backendUrl } = useAppStore.getState().config;

  return {
    ...config,
    baseURL: backendUrl,
  };
});

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

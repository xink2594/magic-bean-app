import axios from 'axios';

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
  try {
    const response = await api.post('/ai/diagnose', { image_url: imageUrl });
    const payload = response.data as { diagnosis?: string; markdown?: string; text?: string };

    return payload.diagnosis ?? payload.markdown ?? payload.text ?? 'Diagnosis completed.';
  } catch {
    return [
      'AI proxy unreachable, so this is a local fallback summary.',
      '',
      `- Image queued for diagnosis: ${imageUrl}`,
      '- Likely next step: inspect leaf color, check for curling, and compare the latest humidity trend.',
      '- Backend URL comes from the SQLite-backed Zustand config store.',
    ].join('\n');
  }
}

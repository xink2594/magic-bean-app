import { Device } from '@/lib/types';

// 编码设备信息为分享字符串
// 格式: macAddress|mqttUrl|mqttTopic|backendUrl|name → Base64
export function encodeDeviceShare(device: Pick<Device, 'macAddress' | 'mqttUrl' | 'mqttTopic' | 'backendUrl' | 'name'>): string {
  const raw = [device.macAddress, device.mqttUrl, device.mqttTopic, device.backendUrl, device.name].join('|');
  return btoa(unescape(encodeURIComponent(raw)));
}

// 解码分享字符串为设备信息
export function decodeDeviceShare(code: string): {
  macAddress: string;
  mqttUrl: string;
  mqttTopic: string;
  backendUrl: string;
  name: string;
} | null {
  try {
    const raw = decodeURIComponent(escape(atob(code.trim())));
    const parts = raw.split('|');
    if (parts.length < 5) return null;

    return {
      macAddress: parts[0],
      mqttUrl: parts[1],
      mqttTopic: parts[2],
      backendUrl: parts[3],
      name: parts[4],
    };
  } catch {
    return null;
  }
}

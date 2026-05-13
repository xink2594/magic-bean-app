import { LiveStats } from '@/lib/types';

export async function issueDeviceCommand(
  command: 'water' | 'light' | 'capture',
  deviceId: string,
  stats: LiveStats,
) {
  const nextStats = { ...stats };
  let message = `已向设备 ${deviceId} 发送控制指令。`;

  if (command === 'water') {
    const currentSoil = stats.soilMoisture ?? 0;
    nextStats.soilMoisture = Math.min(100, currentSoil + 10);
    message = '浇水指令已通过 MQTT 入队。';
  }

  if (command === 'light') {
    const currentTemp = stats.airTemp ?? 0;
    nextStats.airTemp = Math.min(40, currentTemp + 0.6);
    message = '补光指令已通过 MQTT 入队。';
  }

  if (command === 'capture') {
    message = '拍照指令已通过 MQTT 入队。';
  }

  return { stats: nextStats, message };
}

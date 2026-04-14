import { LiveStats } from '@/lib/types';

export async function issueDeviceCommand(
  command: 'water' | 'light' | 'capture',
  deviceId: string,
  stats: LiveStats,
) {
  const nextStats = { ...stats };
  let message = `Command sent to ${deviceId}.`;

  if (command === 'water') {
    nextStats.soilMoisture = Math.min(100, stats.soilMoisture + 10);
    message = 'Water command queued over MQTT.';
  }

  if (command === 'light') {
    nextStats.airTemp = Math.min(40, stats.airTemp + 0.6);
    message = 'Grow light command queued over MQTT.';
  }

  if (command === 'capture') {
    message = 'Force capture command queued over MQTT.';
  }

  return { stats: nextStats, message };
}

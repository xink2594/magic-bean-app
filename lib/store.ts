import { create } from 'zustand';

import { addDevice, clearLocalData, getConfig, getDevices, initDatabase, saveConfig } from '@/lib/database';
import { AppConfig, Device, LiveStats } from '@/lib/types';

type AppState = {
  ready: boolean;
  config: AppConfig;
  devices: Device[];
  liveStats: Record<string, LiveStats>;
  hydrate: () => Promise<void>;
  saveSettings: (config: AppConfig) => Promise<void>;
  clearAppData: () => Promise<void>;
  addProvisionedDevice: (input: Pick<Device, 'macAddress' | 'name'>) => Promise<void>;
  updateLiveStats: (deviceId: string, stats: Partial<LiveStats>) => void;
  getLiveStats: (deviceId: string) => LiveStats;
};

const defaultStats: LiveStats = {
  airTemp: 24.6,
  humidity: 67,
  soilMoisture: 58,
};

const defaultConfig: AppConfig = {
  backendUrl: 'https://plant-proxy.local',
  llmStatus: '离线',
  webdavUrl: 'https://storage.local/webdav/plants/',
  syncEnabled: false,
};

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  config: defaultConfig,
  devices: [],
  liveStats: {},
  hydrate: async () => {
    await initDatabase();
    const [config, devices] = await Promise.all([getConfig(), getDevices()]);

    set({
      ready: true,
      config,
      devices,
      liveStats: buildLiveStats(devices, get().liveStats),
    });
  },
  saveSettings: async (config) => {
    await saveConfig(config);
    set({ config });
  },
  clearAppData: async () => {
    await clearLocalData();
    set({
      devices: [],
      liveStats: {},
    });
  },
  addProvisionedDevice: async (input) => {
    const device = await addDevice(input);
    set((state) => ({
      devices: [device, ...state.devices],
      liveStats: {
        ...state.liveStats,
        [device.id]: defaultStats,
      },
    }));
  },
  updateLiveStats: (deviceId, stats) => {
    set((state) => ({
      liveStats: {
        ...state.liveStats,
        [deviceId]: {
          ...(state.liveStats[deviceId] ?? defaultStats),
          ...stats,
        },
      },
    }));
  },
  getLiveStats: (deviceId) => get().liveStats[deviceId] ?? defaultStats,
}));

function buildLiveStats(devices: Device[], existing: Record<string, LiveStats>) {
  return devices.reduce<Record<string, LiveStats>>((accumulator, device, index) => {
    accumulator[device.id] = existing[device.id] ?? {
      airTemp: defaultStats.airTemp + index * 0.4,
      humidity: defaultStats.humidity - index * 2,
      soilMoisture: defaultStats.soilMoisture + index * 3,
    };
    return accumulator;
  }, {});
}

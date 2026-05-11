import { create } from 'zustand';

import {
  addDevice,
  clearLocalData,
  deleteDevice,
  getConfig,
  getDevices,
  initDatabase,
  saveConfig,
  updateDeviceMqttConfig,
} from '@/lib/database';
import { AppConfig, Device, LiveStats } from '@/lib/types';

type AppState = {
  ready: boolean;
  config: AppConfig;
  devices: Device[];
  liveStats: Record<string, LiveStats>;
  devicePresence: Record<string, boolean>;
  hydrate: () => Promise<void>;
  saveSettings: (config: AppConfig) => Promise<void>;
  clearAppData: () => Promise<void>;
  addProvisionedDevice: (input: Pick<Device, 'macAddress' | 'name' | 'mqttUrl' | 'mqttTopic'>) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  saveDeviceMqttConfig: (deviceId: string, mqttUrl: string, mqttTopic: string) => Promise<void>;
  setDevicePresence: (macAddress: string, isOnline: boolean) => void;
  isDeviceOnline: (macAddress: string) => boolean;
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
  devicePresence: {},
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
      devicePresence: {},
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
  saveDeviceMqttConfig: async (deviceId, mqttUrl, mqttTopic) => {
    await updateDeviceMqttConfig(deviceId, mqttUrl, mqttTopic);
    set((state) => ({
      devices: state.devices.map((device) =>
        device.id === deviceId ? { ...device, mqttUrl, mqttTopic } : device,
      ),
    }));
  },
  removeDevice: async (deviceId) => {
    await deleteDevice(deviceId);
    set((state) => {
      const nextLiveStats = { ...state.liveStats };
      const nextPresence = { ...state.devicePresence };
      const target = state.devices.find((device) => device.id === deviceId);

      delete nextLiveStats[deviceId];
      if (target) {
        delete nextPresence[target.macAddress];
      }

      return {
        devices: state.devices.filter((device) => device.id !== deviceId),
        liveStats: nextLiveStats,
        devicePresence: nextPresence,
      };
    });
  },
  setDevicePresence: (macAddress, isOnline) => {
    set((state) => ({
      devicePresence: {
        ...state.devicePresence,
        [macAddress]: isOnline,
      },
    }));
  },
  isDeviceOnline: (macAddress) => get().devicePresence[macAddress] ?? false,
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

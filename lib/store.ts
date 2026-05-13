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
import { AppConfig, Device, LiveStats, MqttSensorData, MqttConnectionStatus } from '@/lib/types';

type AppState = {
  ready: boolean;
  config: AppConfig;
  devices: Device[];
  liveStats: Record<string, LiveStats>;
  devicePresence: Record<string, boolean>;
  mqttConnectionStatus: Record<string, MqttConnectionStatus>;
  hydrate: () => Promise<void>;
  saveSettings: (config: AppConfig) => Promise<void>;
  clearAppData: () => Promise<void>;
  addProvisionedDevice: (input: Pick<Device, 'macAddress' | 'name' | 'mqttUrl' | 'mqttTopic' | 'backendUrl'>) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  saveDeviceMqttConfig: (deviceId: string, mqttUrl: string, mqttTopic: string, backendUrl: string) => Promise<void>;
  setDevicePresence: (macAddress: string, isOnline: boolean) => void;
  isDeviceOnline: (macAddress: string) => boolean;
  updateLiveStats: (deviceId: string, stats: Partial<LiveStats>) => void;
  getLiveStats: (deviceId: string) => LiveStats;
  setSensorDataFromMqtt: (macAddress: string, data: MqttSensorData) => void;
  setMqttConnectionStatus: (brokerUrl: string, status: MqttConnectionStatus) => void;
  getMqttConnectionStatus: (brokerUrl: string) => MqttConnectionStatus;
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
  mqttConnectionStatus: {},
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
      mqttConnectionStatus: {},
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
  saveDeviceMqttConfig: async (deviceId, mqttUrl, mqttTopic, backendUrl) => {
    await updateDeviceMqttConfig(deviceId, mqttUrl, mqttTopic, backendUrl);
    set((state) => ({
      devices: state.devices.map((device) =>
        device.id === deviceId ? { ...device, mqttUrl, mqttTopic, backendUrl } : device,
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
  setSensorDataFromMqtt: (macAddress, data) => {
    // 通过 MAC 地址查找设备 ID
    const device = get().devices.find(
      (d) => d.macAddress.toUpperCase() === macAddress.toUpperCase(),
    );
    if (!device) {
      return;
    }

    set((state) => ({
      liveStats: {
        ...state.liveStats,
        [device.id]: {
          airTemp: data.temperature,
          humidity: data.air_humidity,
          soilMoisture: data.dirt_humidity,
        },
      },
    }));
  },
  setMqttConnectionStatus: (brokerUrl, status) => {
    set((state) => ({
      mqttConnectionStatus: {
        ...state.mqttConnectionStatus,
        [brokerUrl]: status,
      },
    }));
  },
  getMqttConnectionStatus: (brokerUrl) => {
    return get().mqttConnectionStatus[brokerUrl] ?? 'disconnected';
  },
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

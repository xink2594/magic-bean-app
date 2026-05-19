import mqtt, { MqttClient } from 'mqtt';

import { Device, MqttSensorData, MqttConnectionStatus, LightData } from '@/lib/types';

type ConnectionStatusCallback = (brokerUrl: string, status: MqttConnectionStatus) => void;
type SensorDataCallback = (macAddress: string, data: MqttSensorData) => void;
type PresenceCallback = (macAddress: string, isOnline: boolean) => void;
type LightDataCallback = (macAddress: string, data: LightData) => void;

type DataBrokerRuntime = {
  client: MqttClient;
  topics: Set<string>;
  status: MqttConnectionStatus;
};

const dataRuntimes = new Map<string, DataBrokerRuntime>();
let onSensorDataCallback: SensorDataCallback | null = null;
let onConnectionStatusCallback: ConnectionStatusCallback | null = null;
let onPresenceCallback: PresenceCallback | null = null;
let onLightDataCallback: LightDataCallback | null = null;

/**
 * 设置传感器数据回调
 */
export function setSensorDataCallback(callback: SensorDataCallback) {
  onSensorDataCallback = callback;
}

/**
 * 设置连接状态回调
 */
export function setConnectionStatusCallback(callback: ConnectionStatusCallback) {
  onConnectionStatusCallback = callback;
}

/**
 * 设置在线状态回调
 */
export function setPresenceCallback(callback: PresenceCallback) {
  onPresenceCallback = callback;
}

/**
 * 设置灯光状态回调
 */
export function setLightDataCallback(callback: LightDataCallback) {
  onLightDataCallback = callback;
}

/**
 * 解析 MQTT 主题，提取 MAC 地址和类型
 * 主题格式: plant/{MAC}/data 或 plant/{MAC}/status
 */
function parseTopic(topic: string): { macAddress: string; type: 'data' | 'status' | null } {
  const segments = topic.split('/');
  if (segments.length >= 3 && segments[0] === 'plant') {
    const macAddress = segments[1];
    const type = segments[2];
    if (type === 'data' || type === 'status') {
      return { macAddress, type };
    }
  }
  return { macAddress: '', type: null };
}

/**
 * 更新连接状态
 */
function updateConnectionStatus(brokerUrl: string, status: MqttConnectionStatus) {
  const runtime = dataRuntimes.get(brokerUrl);
  if (runtime) {
    runtime.status = status;
  }
  if (onConnectionStatusCallback) {
    onConnectionStatusCallback(brokerUrl, status);
  }
}

/**
 * 连接到指定的 MQTT broker
 * @param device 设备信息
 * @returns 是否成功启动连接
 */
export function connectToDevice(device: Device): boolean {
  const brokerUrl = toMqttWebSocketUrl(device.mqttUrl);
  if (!brokerUrl) {
    console.warn('[MQTT Data] Invalid broker URL for device:', device.macAddress);
    return false;
  }

  // 如果已经连接或正在连接，确保订阅该设备的主题
  const existingRuntime = dataRuntimes.get(brokerUrl);
  if (existingRuntime) {
    if (existingRuntime.status === 'connected') {
      // 已连接，直接订阅
      subscribeDeviceTopics(brokerUrl, device);
      return true;
    } else if (existingRuntime.status === 'connecting') {
      // 正在连接，添加到待订阅列表
      existingRuntime.topics.add(`plant/${device.macAddress.toUpperCase()}/data`);
      if (device.mqttTopic) {
        existingRuntime.topics.add(device.mqttTopic);
      }
      existingRuntime.topics.add(`plant/${device.macAddress.toUpperCase()}/light`);
      return true;
    }
    // error 或 disconnected 状态，继续创建新连接
  }

  // 创建新连接
  updateConnectionStatus(brokerUrl, 'connecting');

  const client = mqtt.connect(brokerUrl, {
    reconnectPeriod: 3000,
    connectTimeout: 10000,
  });

  client.on('connect', () => {
    console.log('[MQTT Data] Connected to broker:', brokerUrl);
    updateConnectionStatus(brokerUrl, 'connected');

    // 连接成功后订阅所有待订阅的主题
    const runtime = dataRuntimes.get(brokerUrl);
    if (runtime) {
      runtime.topics.forEach((topic) => {
        runtime.client.subscribe(topic);
      });
    }
  });

  client.on('message', (topic: string, payload: Buffer | Uint8Array) => {
    const { macAddress, type } = parseTopic(topic);

    if (!type) {
      // 尝试从 status 主题格式解析
      const statusMac = extractMacAddressFromStatusTopic(topic);
      if (statusMac && onPresenceCallback) {
        try {
          const parsed = JSON.parse(payload.toString()) as { status?: string };
          onPresenceCallback(statusMac, parsed.status === 'online');
        } catch {
          onPresenceCallback(statusMac, false);
        }
        return;
      }

      // 尝试从 light 主题格式解析
      const lightMac = extractMacAddressFromLightTopic(topic);
      if (lightMac) {
        console.log('[MQTT Data] Light topic message:', topic, payload.toString());
        if (onLightDataCallback) {
          try {
            const parsed = JSON.parse(payload.toString()) as LightData;
            onLightDataCallback(lightMac, parsed);
          } catch (error) {
            console.warn('[MQTT Data] Failed to parse light data:', topic, error);
          }
        } else {
          console.warn('[MQTT Data] Light message received but no callback registered');
        }
        return;
      }

      return;
    }

    if (type === 'data' && onSensorDataCallback) {
      try {
        const data = JSON.parse(payload.toString());
        const sensorData = data as MqttSensorData;

        if (
          typeof sensorData.temperature === 'number' &&
          typeof sensorData.air_humidity === 'number' &&
          typeof sensorData.dirt_humidity === 'number'
        ) {
          onSensorDataCallback(macAddress, sensorData);
        }
      } catch (error) {
        console.warn('[MQTT Data] Failed to parse sensor data:', topic, error);
      }
    } else if (type === 'status' && onPresenceCallback) {
      try {
        const parsed = JSON.parse(payload.toString()) as { status?: string };
        onPresenceCallback(macAddress, parsed.status === 'online');
      } catch {
        onPresenceCallback(macAddress, false);
      }
    }
  });

  client.on('error', (error) => {
    console.error('[MQTT Data] Connection error:', brokerUrl, error);
    updateConnectionStatus(brokerUrl, 'error');
  });

  client.on('close', () => {
    console.log('[MQTT Data] Connection closed:', brokerUrl);
    updateConnectionStatus(brokerUrl, 'disconnected');
  });

  client.on('offline', () => {
    console.log('[MQTT Data] Client offline:', brokerUrl);
    updateConnectionStatus(brokerUrl, 'disconnected');
  });

  // 初始化 runtime，添加待订阅的主题
  const topics = new Set<string>();
  topics.add(`plant/${device.macAddress.toUpperCase()}/data`);
  if (device.mqttTopic) {
    topics.add(device.mqttTopic);
  }
  topics.add(`plant/${device.macAddress.toUpperCase()}/light`);

  const runtime: DataBrokerRuntime = {
    client,
    topics,
    status: 'connecting',
  };
  dataRuntimes.set(brokerUrl, runtime);

  return true;
}

/**
 * 从 status 主题格式提取 MAC 地址
 * 支持 plant/{MAC}/status 格式
 */
function extractMacAddressFromStatusTopic(topic: string): string {
  const segments = topic.split('/');
  if (segments.length >= 3 && segments[0] === 'plant' && segments[2] === 'status') {
    return segments[1];
  }
  return '';
}

function extractMacAddressFromLightTopic(topic: string): string {
  const segments = topic.split('/');
  if (segments.length >= 3 && segments[0] === 'plant' && segments[2] === 'light') {
    return segments[1];
  }
  return '';
}

/**
 * 订阅设备的所有主题
 */
function subscribeDeviceTopics(brokerUrl: string, device: Device) {
  const runtime = dataRuntimes.get(brokerUrl);
  if (!runtime) {
    return;
  }

  const mac = device.macAddress.toUpperCase();
  const dataTopic = `plant/${mac}/data`;

  // 订阅 data 主题
  if (!runtime.topics.has(dataTopic)) {
    if (runtime.status === 'connected') {
      runtime.client.subscribe(dataTopic);
    }
    runtime.topics.add(dataTopic);
  }

  // 订阅 status 主题（如果有配置）
  if (device.mqttTopic && !runtime.topics.has(device.mqttTopic)) {
    if (runtime.status === 'connected') {
      runtime.client.subscribe(device.mqttTopic);
    }
    runtime.topics.add(device.mqttTopic);
  }

  // 订阅 light 主题
  const lightTopic = `plant/${mac}/light`;
  if (!runtime.topics.has(lightTopic)) {
    if (runtime.status === 'connected') {
      runtime.client.subscribe(lightTopic);
    }
    runtime.topics.add(lightTopic);
  }
}

/**
 * 同步所有设备的主题订阅（用于批量更新）
 */
export function syncDeviceSubscriptions(devices: Device[]) {
  const groups = groupDevicesByBroker(devices);

  for (const [brokerUrl, brokerDevices] of groups.entries()) {
    const runtime = dataRuntimes.get(brokerUrl);
    if (!runtime || runtime.status !== 'connected') {
      // 如果没有连接，为每个设备创建连接
      brokerDevices.forEach((device) => connectToDevice(device));
      continue;
    }

    // 收集所有需要订阅的主题
    const nextTopics = new Set<string>();
    for (const device of brokerDevices) {
      const mac = device.macAddress.toUpperCase();
      nextTopics.add(`plant/${mac}/data`);
      if (device.mqttTopic) {
        nextTopics.add(device.mqttTopic);
      }
    }

    // 取消订阅不再需要的主题
    runtime.topics.forEach((topic) => {
      if (!nextTopics.has(topic)) {
        runtime.client.unsubscribe(topic);
        runtime.topics.delete(topic);
      }
    });

    // 订阅新主题
    nextTopics.forEach((topic) => {
      if (!runtime.topics.has(topic)) {
        runtime.client.subscribe(topic);
        runtime.topics.add(topic);
      }
    });
  }
}

/**
 * 断开指定 broker 的连接
 */
export function disconnectFromBroker(brokerUrl: string) {
  const runtime = dataRuntimes.get(brokerUrl);
  if (runtime) {
    runtime.client.end(true);
    dataRuntimes.delete(brokerUrl);
    updateConnectionStatus(brokerUrl, 'disconnected');
  }
}

/**
 * 断开所有连接
 */
export function disconnectAllClients() {
  for (const [brokerUrl, runtime] of dataRuntimes.entries()) {
    runtime.client.end(true);
    updateConnectionStatus(brokerUrl, 'disconnected');
  }
  dataRuntimes.clear();
}

/**
 * 获取 broker 连接状态
 */
export function getBrokerConnectionStatus(brokerUrl: string): MqttConnectionStatus {
  const wsUrl = toMqttWebSocketUrl(brokerUrl);
  if (!wsUrl) {
    return 'disconnected';
  }
  const runtime = dataRuntimes.get(wsUrl);
  return runtime?.status ?? 'disconnected';
}

/**
 * 发布命令到设备
 * @param device 设备信息
 * @param action 命令类型: 'water' | 'capture'
 * @param params 命令参数
 */
export function publishDeviceCommand(
  device: Device,
  action: string,
  params: Record<string, unknown> = {},
): boolean {
  const brokerUrl = toMqttWebSocketUrl(device.mqttUrl);
  if (!brokerUrl) {
    console.warn('[MQTT Data] Invalid broker URL for device:', device.macAddress);
    return false;
  }

  const runtime = dataRuntimes.get(brokerUrl);
  if (!runtime) {
    console.warn('[MQTT Data] No runtime found for broker:', brokerUrl);
    return false;
  }

  if (runtime.status !== 'connected') {
    console.warn('[MQTT Data] Broker not connected:', brokerUrl, 'Status:', runtime.status);
    return false;
  }

  const mac = device.macAddress.toUpperCase();
  const timestamp = Math.floor(Date.now() / 1000);
  const topic = `plant/${mac}/cmd`;

  const payload = {
    msg_id: `${mac}_${timestamp}`,
    action,
    param: action === 'water' ? { set_time: 5, ...params } : params,
    timestamp,
  };

  try {
    runtime.client.publish(topic, JSON.stringify(payload));
    console.log('[MQTT Data] Published command:', topic, payload);
    return true;
  } catch (error) {
    console.error('[MQTT Data] Failed to publish command:', error);
    return false;
  }
}

/**
 * 按 broker URL 分组设备
 */
function groupDevicesByBroker(devices: Device[]) {
  const groups = new Map<string, Device[]>();

  devices.forEach((device) => {
    const brokerUrl = toMqttWebSocketUrl(device.mqttUrl);
    if (!brokerUrl) {
      return;
    }

    const current = groups.get(brokerUrl) ?? [];
    current.push(device);
    groups.set(brokerUrl, current);
  });

  return groups;
}

/**
 * 将 MQTT URL 转换为 WebSocket URL
 */
export function toMqttWebSocketUrl(value: string): string {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);

    if (url.protocol === 'ws:' || url.protocol === 'wss:') {
      return url.toString();
    }

    if (url.protocol === 'mqtt:') {
      url.protocol = 'ws:';
      return url.toString();
    }

    if (url.protocol === 'mqtts:') {
      url.protocol = 'wss:';
      return url.toString();
    }

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return url.toString();
    }

    return '';
  } catch {
    return '';
  }
}

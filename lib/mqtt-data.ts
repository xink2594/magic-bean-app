import mqtt, { MqttClient } from 'mqtt';

import { Device, MqttSensorData, MqttConnectionStatus } from '@/lib/types';

type ConnectionStatusCallback = (brokerUrl: string, status: MqttConnectionStatus) => void;
type SensorDataCallback = (macAddress: string, data: MqttSensorData) => void;

type DataBrokerRuntime = {
  client: MqttClient;
  topics: Set<string>;
  status: MqttConnectionStatus;
};

const dataRuntimes = new Map<string, DataBrokerRuntime>();
let onSensorDataCallback: SensorDataCallback | null = null;
let onConnectionStatusCallback: ConnectionStatusCallback | null = null;

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
 * 解析 MQTT 主题，提取 MAC 地址
 * 主题格式: plant/{MAC}/data
 */
function parseTopic(topic: string): { macAddress: string; isValid: boolean } {
  const segments = topic.split('/');
  if (segments.length >= 3 && segments[0] === 'plant' && segments[2] === 'data') {
    return { macAddress: segments[1], isValid: true };
  }
  return { macAddress: '', isValid: false };
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

  // 如果已经连接或正在连接，直接返回
  const existingRuntime = dataRuntimes.get(brokerUrl);
  if (existingRuntime && existingRuntime.status !== 'error' && existingRuntime.status !== 'disconnected') {
    // 确保订阅了该设备的主题
    subscribeDeviceTopic(brokerUrl, device);
    return true;
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

    // 连接成功后订阅所有该 broker 上的设备主题
    const runtime = dataRuntimes.get(brokerUrl);
    if (runtime) {
      // 订阅当前设备
      subscribeDeviceTopic(brokerUrl, device);
    }
  });

  client.on('message', (topic: string, payload: Buffer | Uint8Array) => {
    const { macAddress, isValid } = parseTopic(topic);
    if (!isValid || !onSensorDataCallback) {
      return;
    }

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
      console.warn('[MQTT Data] Failed to parse message:', topic, error);
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

  const runtime: DataBrokerRuntime = {
    client,
    topics: new Set<string>(),
    status: 'connecting',
  };
  dataRuntimes.set(brokerUrl, runtime);

  // 订阅设备主题
  subscribeDeviceTopic(brokerUrl, device);

  return true;
}

/**
 * 订阅设备主题
 */
function subscribeDeviceTopic(brokerUrl: string, device: Device) {
  const runtime = dataRuntimes.get(brokerUrl);
  if (!runtime) {
    return;
  }

  const mac = device.macAddress.toUpperCase();
  const topic = `plant/${mac}/data`;

  if (!runtime.topics.has(topic)) {
    // 如果已连接，立即订阅
    if (runtime.status === 'connected') {
      runtime.client.subscribe(topic);
    }
    runtime.topics.add(topic);
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
  action: 'water' | 'capture',
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

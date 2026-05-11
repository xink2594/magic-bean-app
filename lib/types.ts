export type Device = {
  id: string;
  macAddress: string;
  name: string;
  createdAt: string;
  mqttUrl: string;
  mqttTopic: string;
};

export type PlantRecord = {
  id: string;
  deviceId: string;
  temp: number;
  humidity: number;
  imageUrl: string;
  note: string;
  timestamp: string;
};

export type AppConfig = {
  backendUrl: string;
  llmStatus: string;
  webdavUrl: string;
  syncEnabled: boolean;
};

export type LiveStats = {
  airTemp: number;
  humidity: number;
  soilMoisture: number;
};

// MQTT 传感器数据 payload 格式
export type MqttSensorData = {
  temperature: number;
  air_humidity: number;
  dirt_humidity: number;
};

// MQTT 连接状态
export type MqttConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// MQTT 命令响应 payload 格式
export type MqttCommandResponse = {
  msg_id: string;
  action: 'water' | 'capture' | string;
  param: {
    set_time?: number;
    [key: string]: unknown;
  };
  timestamp: number;
};

// 设备最后收到的命令记录
export type DeviceLastCommand = {
  action: string;
  timestamp: number;
  msgId: string;
};

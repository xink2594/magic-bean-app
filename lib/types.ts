export type Device = {
  id: string;
  macAddress: string;
  name: string;
  createdAt: string;
  mqttUrl: string;
  mqttTopic: string;
  backendUrl: string;
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

export type WaterConfig = {
  actionMode: 'default' | 'custom';
  actionType: 'water' | 'led_water';
  durationMode: 'default' | 'custom';
  duration: string;
};

export type LightConfig = {
  rgbMode: 'default' | 'custom';
  r: string;
  g: string;
  b: string;
};

export type AppConfig = {
  backendUrl: string;
  llmStatus: string;
  webdavUrl: string;
  syncEnabled: boolean;
  waterConfig: string;
  lightConfig: string;
};

export type LiveStats = {
  airTemp: number | null;
  humidity: number | null;
  soilMoisture: number | null;
};

// MQTT 传感器数据 payload 格式
export type MqttSensorData = {
  temperature: number;
  air_humidity: number;
  dirt_humidity: number;
};

// MQTT 灯光状态数据
export type LightData = {
  state: 'on' | 'off';
  r: number;
  g: number;
  b: number;
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

// 设备最新数据（从 API 获取）
export type DeviceLatestData = {
  deviceId?: string;
  status?: string;
  latestData?: {
    timestamp?: number;
    temperature?: number;
    airHumidity?: number;
    dirtHumidity?: number;
  };
};

// 日记列表项（从 API 获取）
export type DiaryListItem = {
  id: number;
  imageUrl: string;
};

// 日记列表响应
export type DiaryListResponse = {
  records: DiaryListItem[];
  page?: number;
  pageSize?: number;
  total?: number;
};

// 历史数据项
export type HistoryDataItem = {
  id: number;
  timestamp: number;
  temperature: number;
  airHumidity: number;
  dirtHumidity: number;
};

// 历史数据响应
export type HistoryDataResponse = {
  records: HistoryDataItem[];
};

// 日记详情
export type DiaryDetail = {
  id: number;
  timestamp: number;
  imageUrl: string;
  temperature: number;
  airHumidity: number;
  dirtHumidity: number;
  note: string;
};

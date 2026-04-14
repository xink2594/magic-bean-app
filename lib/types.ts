export type Device = {
  id: string;
  macAddress: string;
  name: string;
  createdAt: string;
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

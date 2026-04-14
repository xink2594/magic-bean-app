import * as SQLite from 'expo-sqlite';

import { AppConfig, Device, PlantRecord } from '@/lib/types';

const databasePromise = SQLite.openDatabaseAsync('magic-bean.db');

const defaultConfig: AppConfig = {
  backendUrl: 'https://plant-proxy.local',
  llmStatus: 'Offline',
  webdavUrl: 'https://storage.local/webdav/plants/',
  syncEnabled: false,
};

export async function initDatabase() {
  const db = await databasePromise;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY NOT NULL,
      mac_address TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY NOT NULL,
      device_id TEXT NOT NULL,
      temp REAL NOT NULL,
      humidity REAL NOT NULL,
      image_url TEXT NOT NULL,
      note TEXT DEFAULT '',
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  for (const [key, value] of Object.entries(defaultConfig)) {
    await db.runAsync(
      'INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)',
      key,
      String(value),
    );
  }

  const existing = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM devices');
  if ((existing?.count ?? 0) > 0) {
    return;
  }

  const now = new Date();
  const deviceId = 'device-demo-1';

  await db.runAsync(
    'INSERT INTO devices (id, mac_address, name, created_at) VALUES (?, ?, ?, ?)',
    deviceId,
    'A8:61:0A:10:2C:9F',
    'Monstera Corner Pot',
    now.toISOString(),
  );

  const seedRows = [
    {
      id: 'record-1',
      deviceId,
      temp: 24.8,
      humidity: 68,
      imageUrl: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=80',
      note: 'New split leaf opened after misting.',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
    {
      id: 'record-2',
      deviceId,
      temp: 25.2,
      humidity: 66,
      imageUrl: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=1200&q=80',
      note: 'Soil still damp. No watering today.',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ];

  for (const record of seedRows) {
    await db.runAsync(
      `INSERT INTO records (id, device_id, temp, humidity, image_url, note, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.deviceId,
      record.temp,
      record.humidity,
      record.imageUrl,
      record.note,
      record.timestamp,
    );
  }
}

export async function getDevices(): Promise<Device[]> {
  const db = await databasePromise;
  const rows = await db.getAllAsync<{
    id: string;
    mac_address: string;
    name: string;
    created_at: string;
  }>('SELECT id, mac_address, name, created_at FROM devices ORDER BY created_at DESC');

  return rows.map((row) => ({
    id: row.id,
    macAddress: row.mac_address,
    name: row.name,
    createdAt: row.created_at,
  }));
}

export async function addDevice(input: Pick<Device, 'macAddress' | 'name'>): Promise<Device> {
  const db = await databasePromise;
  const device: Device = {
    id: `device-${Date.now()}`,
    macAddress: input.macAddress,
    name: input.name,
    createdAt: new Date().toISOString(),
  };

  await db.runAsync(
    'INSERT INTO devices (id, mac_address, name, created_at) VALUES (?, ?, ?, ?)',
    device.id,
    device.macAddress,
    device.name,
    device.createdAt,
  );

  return device;
}

export async function getConfig(): Promise<AppConfig> {
  const db = await databasePromise;
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM config');
  const config = rows.reduce<Record<string, string>>((accumulator, row) => {
    accumulator[row.key] = row.value;
    return accumulator;
  }, {});

  return {
    backendUrl: config.backendUrl ?? defaultConfig.backendUrl,
    llmStatus: config.llmStatus ?? defaultConfig.llmStatus,
    webdavUrl: config.webdavUrl ?? defaultConfig.webdavUrl,
    syncEnabled: config.syncEnabled === 'true',
  };
}

export async function saveConfig(config: AppConfig) {
  const db = await databasePromise;

  for (const [key, value] of Object.entries(config)) {
    await db.runAsync(
      `INSERT INTO config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      String(value),
    );
  }
}

export async function getRecordsByDeviceId(deviceId: string): Promise<PlantRecord[]> {
  const db = await databasePromise;
  const rows = await db.getAllAsync<{
    id: string;
    device_id: string;
    temp: number;
    humidity: number;
    image_url: string;
    note: string;
    timestamp: string;
  }>(
    `SELECT id, device_id, temp, humidity, image_url, note, timestamp
     FROM records
     WHERE device_id = ?
     ORDER BY timestamp DESC`,
    deviceId,
  );

  return rows.map(mapRecord);
}

export async function getRecordById(recordId: string): Promise<PlantRecord | null> {
  const db = await databasePromise;
  const row = await db.getFirstAsync<{
    id: string;
    device_id: string;
    temp: number;
    humidity: number;
    image_url: string;
    note: string;
    timestamp: string;
  }>(
    `SELECT id, device_id, temp, humidity, image_url, note, timestamp
     FROM records
     WHERE id = ?`,
    recordId,
  );

  return row ? mapRecord(row) : null;
}

export async function updateRecordNote(recordId: string, note: string) {
  const db = await databasePromise;
  await db.runAsync('UPDATE records SET note = ? WHERE id = ?', note, recordId);
}

function mapRecord(row: {
  id: string;
  device_id: string;
  temp: number;
  humidity: number;
  image_url: string;
  note: string;
  timestamp: string;
}): PlantRecord {
  return {
    id: row.id,
    deviceId: row.device_id,
    temp: row.temp,
    humidity: row.humidity,
    imageUrl: row.image_url,
    note: row.note,
    timestamp: row.timestamp,
  };
}

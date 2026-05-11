import * as SQLite from "expo-sqlite";

import { AppConfig, Device, PlantRecord } from "@/lib/types";

const databasePromise = SQLite.openDatabaseAsync("magic-bean.db");

const defaultConfig: AppConfig = {
  backendUrl: "https://plant-proxy.local",
  llmStatus: "离线",
  webdavUrl: "https://storage.local/webdav/plants/",
  syncEnabled: false,
};

export async function initDatabase() {
  const db = await databasePromise;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY NOT NULL,
      mac_address TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      mqtt_url TEXT NOT NULL DEFAULT '',
      mqtt_topic TEXT NOT NULL DEFAULT ''
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
      "INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)",
      key,
      String(value),
    );
  }

  await db.runAsync(
    "UPDATE config SET value = ? WHERE key = ? AND value = ?",
    "离线",
    "llmStatus",
    "Offline",
  );

  await ensureDeviceMqttColumn(db);
  await ensureDeviceTopicColumn(db);
}

export async function getDevices(): Promise<Device[]> {
  const db = await databasePromise;
  const rows = await db.getAllAsync<{
    id: string;
    mac_address: string;
    name: string;
    created_at: string;
    mqtt_url: string;
    mqtt_topic: string;
  }>(
    "SELECT id, mac_address, name, created_at, mqtt_url, mqtt_topic FROM devices ORDER BY created_at DESC",
  );

  return rows.map((row) => ({
    id: row.id,
    macAddress: row.mac_address,
    name: row.name,
    createdAt: row.created_at,
    mqttUrl: row.mqtt_url,
    mqttTopic: row.mqtt_topic,
  }));
}

export async function getDeviceById(deviceId: string): Promise<Device | null> {
  const db = await databasePromise;
  const row = await db.getFirstAsync<{
    id: string;
    mac_address: string;
    name: string;
    created_at: string;
    mqtt_url: string;
    mqtt_topic: string;
  }>(
    "SELECT id, mac_address, name, created_at, mqtt_url, mqtt_topic FROM devices WHERE id = ?",
    deviceId,
  );

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    macAddress: row.mac_address,
    name: row.name,
    createdAt: row.created_at,
    mqttUrl: row.mqtt_url,
    mqttTopic: row.mqtt_topic,
  };
}

export async function addDevice(
  input: Pick<Device, "macAddress" | "name"> & { mqttUrl?: string; mqttTopic?: string },
): Promise<Device> {
  const db = await databasePromise;
  const device: Device = {
    id: `device-${Date.now()}`,
    macAddress: input.macAddress,
    name: input.name,
    createdAt: new Date().toISOString(),
    mqttUrl: input.mqttUrl ?? "",
    mqttTopic: input.mqttTopic ?? `plant/${input.macAddress}/status`,
  };

  await db.runAsync(
    "INSERT INTO devices (id, mac_address, name, created_at, mqtt_url, mqtt_topic) VALUES (?, ?, ?, ?, ?, ?)",
    device.id,
    device.macAddress,
    device.name,
    device.createdAt,
    device.mqttUrl,
    device.mqttTopic,
  );

  return device;
}

export async function updateDeviceMqttUrl(deviceId: string, mqttUrl: string) {
  const db = await databasePromise;
  await db.runAsync("UPDATE devices SET mqtt_url = ? WHERE id = ?", mqttUrl, deviceId);
}

export async function updateDeviceMqttConfig(
  deviceId: string,
  mqttUrl: string,
  mqttTopic: string,
) {
  const db = await databasePromise;
  await db.runAsync(
    "UPDATE devices SET mqtt_url = ?, mqtt_topic = ? WHERE id = ?",
    mqttUrl,
    mqttTopic,
    deviceId,
  );
}

export async function deleteDevice(deviceId: string) {
  const db = await databasePromise;

  await db.runAsync("DELETE FROM records WHERE device_id = ?", deviceId);
  await db.runAsync("DELETE FROM devices WHERE id = ?", deviceId);
}

export async function getConfig(): Promise<AppConfig> {
  const db = await databasePromise;
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM config",
  );
  const config = rows.reduce<Record<string, string>>((accumulator, row) => {
    accumulator[row.key] = row.value;
    return accumulator;
  }, {});

  return {
    backendUrl: config.backendUrl ?? defaultConfig.backendUrl,
    llmStatus: config.llmStatus ?? defaultConfig.llmStatus,
    webdavUrl: config.webdavUrl ?? defaultConfig.webdavUrl,
    syncEnabled: config.syncEnabled === "true",
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

export async function clearLocalData() {
  const db = await databasePromise;

  await db.execAsync(`
    DELETE FROM records;
    DELETE FROM devices;
  `);
}

export async function getRecordsByDeviceId(
  deviceId: string,
): Promise<PlantRecord[]> {
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

export async function getRecordById(
  recordId: string,
): Promise<PlantRecord | null> {
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
  await db.runAsync("UPDATE records SET note = ? WHERE id = ?", note, recordId);
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

async function ensureDeviceMqttColumn(
  db: Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>,
) {
  const columns = await db.getAllAsync<{
    name: string;
  }>("PRAGMA table_info(devices)");

  const hasMqttUrl = columns.some((column) => column.name === "mqtt_url");

  if (!hasMqttUrl) {
    await db.execAsync(
      "ALTER TABLE devices ADD COLUMN mqtt_url TEXT NOT NULL DEFAULT '';",
    );
  }
}

async function ensureDeviceTopicColumn(
  db: Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>,
) {
  const columns = await db.getAllAsync<{
    name: string;
  }>("PRAGMA table_info(devices)");

  const hasMqttTopic = columns.some((column) => column.name === "mqtt_topic");

  if (!hasMqttTopic) {
    await db.execAsync(
      "ALTER TABLE devices ADD COLUMN mqtt_topic TEXT NOT NULL DEFAULT '';",
    );
  }
}

import mqtt, { MqttClient } from 'mqtt';

import { Device } from '@/lib/types';

type PresenceOptions = {
  devices: Device[];
  onPresence: (macAddress: string, isOnline: boolean) => void;
};

type BrokerRuntime = {
  client: MqttClient;
  topics: Set<string>;
  handler: (topic: string, payload: Buffer | Uint8Array) => void;
};

const runtimes = new Map<string, BrokerRuntime>();

export function syncDevicePresence(options: PresenceOptions) {
  const groups = groupDevicesByBroker(options.devices);

  for (const [brokerUrl, runtime] of runtimes.entries()) {
    if (!groups.has(brokerUrl)) {
      runtime.client.end(true);
      runtimes.delete(brokerUrl);
    }
  }

  for (const [brokerUrl, devices] of groups.entries()) {
    let runtime = runtimes.get(brokerUrl);

    if (!runtime) {
      const client = mqtt.connect(brokerUrl, {
        reconnectPeriod: 3000,
        connectTimeout: 10000,
      });

      const handler = (topic: string, payload: Buffer | Uint8Array) => {
        const macAddress = extractMacAddressFromTopic(topic);
        if (!macAddress) {
          return;
        }

        try {
          const parsed = JSON.parse(payload.toString()) as { status?: string };
          options.onPresence(macAddress, parsed.status === 'online');
        } catch {
          options.onPresence(macAddress, false);
        }
      };

      client.on('message', handler);
      runtime = {
        client,
        topics: new Set<string>(),
        handler,
      };
      runtimes.set(brokerUrl, runtime);
    }

    const nextTopics = new Set(
      devices
        .map((device) => device.mqttTopic.trim())
        .filter(Boolean),
    );

    runtime.topics.forEach((topic) => {
      if (!nextTopics.has(topic)) {
        runtime.client.unsubscribe(topic);
        runtime.topics.delete(topic);
      }
    });

    nextTopics.forEach((topic) => {
      if (!runtime?.topics.has(topic)) {
        runtime?.client.subscribe(topic);
        runtime?.topics.add(topic);
      }
    });
  }

  return () => undefined;
}

export function disconnectPresenceClient() {
  for (const runtime of runtimes.values()) {
    runtime.client.end(true);
  }
  runtimes.clear();
}

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

function extractMacAddressFromTopic(topic: string) {
  const segments = topic.split('/');
  if (segments.length >= 2) {
    return segments[1] ?? '';
  }
  return '';
}

function toMqttWebSocketUrl(value: string) {
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

# Magic Bean App 架构文档

## 1. 项目整体技术栈

### 核心框架
- **React Native**: 0.81.5 - 跨平台移动应用开发框架
- **Expo**: ~54.0.34 - React Native 开发工具链
- **Expo Router**: ~6.0.23 - 基于文件的路由系统
- **TypeScript**: ~5.9.2 - 类型安全的 JavaScript 超集

### UI 框架
- **React Native Paper**: ^5.15.1 - Material Design 3 组件库
- **Expo Image**: ~3.0.11 - 高性能图片加载组件
- **React Native Reanimated**: ~4.1.1 - 动画库

### 状态管理
- **Zustand**: ^5.0.12 - 轻量级状态管理库

### 数据存储
- **Expo SQLite**: ~16.0.10 - 本地 SQLite 数据库

### 网络通信
- **Axios**: ^1.15.0 - HTTP 客户端
- **MQTT**: ^5.15.1 - 物联网消息协议客户端
- **React Native WebView**: 13.15.0 - WebView 组件

### 硬件交互
- **React Native WiFi Reborn**: ^4.13.6 - Wi-Fi 网络管理
- **Expo Location**: ~19.0.8 - 定位服务
- **Expo Camera**: ~17.0.10 - 相机功能
- **Expo Image Picker**: ~17.0.11 - 图片选择器

### 开发工具
- **ESLint**: ^9.25.0 - 代码检查工具
- **Expo Dev Client**: ~6.0.21 - 开发调试工具

## 2. 目录结构说明

```
magic-bean-app/
├── app/                          # Expo Router 路由目录
│   ├── _layout.tsx              # 根布局：主题配置、MQTT 初始化
│   ├── (tabs)/                  # 底部标签页
│   │   ├── _layout.tsx         # 标签页布局
│   │   ├── index.tsx           # 主仪表板：设备列表和实时数据
│   │   └── settings.tsx        # 设置页面：后端地址、同步配置
│   ├── device/                  # 设备相关页面
│   │   ├── [deviceId].tsx      # 设备详情：实时数据、控制按钮
│   │   └── [deviceId]/         # 设备子页面
│   │       ├── config.tsx      # 设备配置：MQTT 地址和主题
│   │       └── diary.tsx       # 成长日记：植物记录列表
│   ├── photo/
│   │   └── [recordId].tsx      # 照片详情：AI 诊断、备注编辑
│   ├── provision.tsx           # AP 配网：搜索设备热点
│   └── provision-portal.tsx    # 配网门户：设备 Wi-Fi 配置
├── lib/                         # 核心业务逻辑
│   ├── api.ts                  # API 客户端：AI 诊断、日记同步
│   ├── database.ts             # SQLite 数据库操作
│   ├── device-commands.ts      # 设备控制命令
│   ├── mqtt-presence.ts        # MQTT 在线状态检测
│   ├── store.ts                # Zustand 状态管理
│   ├── types.ts                # TypeScript 类型定义
│   └── demo-content.ts         # 演示内容
├── components/                  # 可复用组件
│   ├── external-link.tsx       # 外部链接组件
│   ├── haptic-tab.tsx          # 触觉反馈标签
│   ├── hello-wave.tsx          # 欢迎动画
│   ├── parallax-scroll-view.tsx # 视差滚动视图
│   ├── themed-text.tsx         # 主题文本
│   ├── themed-view.tsx         # 主题视图
│   └── ui/                     # UI 基础组件
├── hooks/                       # 自定义 Hooks
│   ├── use-color-scheme.ts     # 颜色方案 Hook
│   └── use-theme-color.ts      # 主题颜色 Hook
├── constants/                   # 常量定义
├── assets/                      # 静态资源
├── scripts/                     # 构建脚本
└── package.json                 # 项目依赖配置
```

## 3. 已完成的核心功能

### 3.1 设备管理
- **设备添加**: 通过 AP 配网流程添加新设备
- **设备列表**: 显示所有已添加设备及其在线状态
- **设备详情**: 查看设备实时数据（温度、湿度、土壤湿度）
- **设备配置**: 配置设备的 MQTT 地址和订阅主题
- **设备删除**: 删除设备及其相关记录

### 3.2 实时监控
- **在线状态**: 通过 MQTT 订阅设备状态主题，实时显示设备在线/离线状态
- **环境数据**: 显示空气温度、空气湿度、土壤湿度等实时数据
- **数据刷新**: 定时更新模拟数据（每 4.5 秒）

### 3.3 设备控制
- **浇水指令**: 发送浇水控制命令
- **补光指令**: 发送补光控制命令
- **拍照指令**: 发送立即拍照命令

### 3.4 成长日记
- **记录查看**: 按设备查看植物成长记录
- **照片展示**: 显示植物照片和环境数据
- **备注编辑**: 为每条记录添加备注信息
- **AI 诊断**: 调用后端 AI 代理分析植物图片

### 3.5 数据同步
- **本地优先**: 数据默认存储在本地 SQLite 数据库
- **手动同步**: 支持将日记记录上传到后端
- **WebDAV 同步**: 支持配置 WebDAV 同步地址

### 3.6 AP 配网
- **热点搜索**: 扫描附近的 MimiClaw-xxxx 热点
- **连接检测**: 实时检测当前 Wi-Fi 连接状态
- **配网门户**: 通过 WebView 打开设备配网页

## 4. 数据流向与硬件通信逻辑

### 4.1 整体数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Magic Bean App                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   UI Layer  │    │  State Mgmt │    │  Database   │      │
│  │  (React)    │◄──►│  (Zustand)  │◄──►│  (SQLite)   │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Business Logic                    │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │    │
│  │  │   API    │  │   MQTT   │  │ Device Commands  │   │    │
│  │  │ Client   │  │ Presence │  │                  │   │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
    ┌─────────┐      ┌─────────────┐    ┌─────────────┐
    │ Backend │      │ MQTT Broker │    │ IoT Device  │
    │ Server  │      │             │    │ (MimiClaw)  │
    └─────────┘      └─────────────┘    └─────────────┘
```

### 4.2 MQTT 通信流程

```
┌──────────────────────────────────────────────────────────────┐
│                    MQTT Presence Detection                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. App Startup                                              │
│     ├─► hydrate() 从 SQLite 加载设备列表                      │
│     └─► syncDevicePresence() 初始化 MQTT 连接                 │
│                                                              │
│  2. Connection Management                                    │
│     ├─► groupDevicesByBroker() 按 broker URL 分组设备         │
│     ├─► mqtt.connect() 建立 WebSocket 连接                   │
│     └─► subscribe() 订阅设备状态主题                          │
│                                                              │
│  3. Message Handling                                         │
│     ├─► 接收消息: {"status": "online"/"offline"}             │
│     ├─► extractMacAddressFromTopic() 提取 MAC 地址           │
│     └─► onPresence() 回调更新设备在线状态                     │
│                                                              │
│  4. State Update                                             │
│     └─► setDevicePresence() 更新 Zustand store               │
│         └─► UI 自动重新渲染显示在线状态                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 设备配网流程

```
┌──────────────────────────────────────────────────────────────┐
│                    AP Provisioning Flow                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 扫描附近热点                                             │
│     └─► WifiManager.reScanAndLoadWifiList()                  │
│         └─► 过滤 MimiClaw-* 前缀的热点                       │
│                                                              │
│  2. 用户连接设备热点                                         │
│     └─► 检测当前 Wi-Fi SSID                                 │
│         └─► NetInfo.fetch() / WifiManager.getCurrentWifiSSID()│
│                                                              │
│  3. 打开配网门户                                             │
│     └─► WebView 加载设备配网页                               │
│         └─► 用户输入目标 Wi-Fi 凭证                          │
│                                                              │
│  4. 设备重启并连接目标网络                                   │
│     └─► App 重新扫描发现已配网设备                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 API 通信流程

```
┌──────────────────────────────────────────────────────────────┐
│                      API Communication                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Axios Client Configuration                                  │
│  ├─► baseURL 从 SQLite config 表读取                         │
│  └─► timeout: 10000ms                                        │
│                                                              │
│  AI Diagnosis (POST /ai/diagnose)                            │
│  ├─► 输入: { image_url: string }                             │
│  ├─► 输出: { diagnosis/markdown/text: string }               │
│  └─► 降级策略: 返回本地生成的兜底说明                         │
│                                                              │
│  Diary Sync (POST /api/sync/diary/push)                      │
│  ├─► 输入: { deviceId, records: [...] }                      │
│  │   ├─► timestamp: number                                   │
│  │   ├─► temperature: number                                 │
│  │   ├─► airHumidity: number                                 │
│  │   ├─► dirtHumidity: number                                │
│  │   ├─► imageUrl: string                                    │
│  │   └─► note: string                                        │
│  └─► 输出: 后端响应数据                                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.5 数据库结构

```sql
-- 设备表
CREATE TABLE devices (
  id TEXT PRIMARY KEY NOT NULL,           -- 设备唯一标识
  mac_address TEXT NOT NULL,              -- MAC 地址
  name TEXT NOT NULL,                     -- 设备名称
  created_at TEXT NOT NULL,               -- 创建时间
  mqtt_url TEXT NOT NULL DEFAULT '',      -- MQTT broker 地址
  mqtt_topic TEXT NOT NULL DEFAULT ''     -- MQTT 订阅主题
);

-- 植物记录表
CREATE TABLE records (
  id TEXT PRIMARY KEY NOT NULL,           -- 记录唯一标识
  device_id TEXT NOT NULL,                -- 关联设备 ID
  temp REAL NOT NULL,                     -- 温度
  humidity REAL NOT NULL,                 -- 湿度
  image_url TEXT NOT NULL,                -- 图片 URL
  note TEXT DEFAULT '',                   -- 备注
  timestamp TEXT NOT NULL                 -- 时间戳
);

-- 配置表
CREATE TABLE config (
  key TEXT PRIMARY KEY NOT NULL,          -- 配置键
  value TEXT NOT NULL                     -- 配置值
);
```

### 4.6 状态管理流程

```
┌──────────────────────────────────────────────────────────────┐
│                    Zustand State Management                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  AppState Structure:                                         │
│  ├─► ready: boolean              # 应用就绪状态              │
│  ├─► config: AppConfig           # 应用配置                  │
│  ├─► devices: Device[]           # 设备列表                  │
│  ├─► liveStats: Record<string, LiveStats>  # 实时数据        │
│  └─► devicePresence: Record<string, boolean>  # 在线状态     │
│                                                              │
│  Key Actions:                                                │
│  ├─► hydrate()                   # 从数据库初始化状态         │
│  ├─► addProvisionedDevice()      # 添加新设备                │
│  ├─► removeDevice()              # 删除设备                  │
│  ├─► saveDeviceMqttConfig()      # 保存 MQTT 配置            │
│  ├─► setDevicePresence()         # 更新在线状态              │
│  └─► updateLiveStats()           # 更新实时数据              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 5. 技术亮点

### 5.1 本地优先架构
- 使用 SQLite 作为主要数据存储
- 网络请求仅在用户主动操作时触发
- 支持完全离线使用

### 5.2 MQTT 实时通信
- 按 broker URL 分组管理连接
- 自动重连机制（reconnectPeriod: 3000ms）
- 支持多种协议转换（mqtt:// → ws://, mqtts:// → wss://）

### 5.3 类型安全
- 完整的 TypeScript 类型定义
- Zustand store 类型约束
- API 响应类型推断

### 5.4 主题系统
- 自定义 Material Design 3 主题
- 统一的色彩方案（绿色植物风格）
- 支持深色模式扩展

## 6. 待优化方向

1. **MQTT 消息发布**: 当前仅实现订阅功能，设备控制命令尚未通过 MQTT 发布
2. **离线队列**: 缺少离线命令队列和自动重试机制
3. **数据持久化**: 实时数据仅存储在内存中，重启后丢失
4. **错误处理**: API 调用的错误处理可以更细化
5. **测试覆盖**: 缺少单元测试和集成测试

# Magic Bean 🌱

智能植物监控 App，配合智能花盆设备，实时监测植物生长环境。

## 功能特性

### 设备管理
- 📡 AP 配网：通过设备热点完成 Wi-Fi 配置
- 🔌 MQTT 连接：实时获取传感器数据
- 📊 环境监测：温度、空气湿度、土壤湿度
- 🟢 在线状态：实时显示设备连接状态

### 智能控制
- 💧 远程浇水：通过 MQTT 发送浇水指令
- 📸 即时拍照：触发设备拍摄植物照片

### 成长记录
- 📷 照片墙：双列瀑布流展示成长照片
- 📝 备注编辑：为每张照片添加文字记录
- 🤖 AI 诊断：智能分析植物健康状况

### 数据可视化
- 📈 历史趋势：折线图展示温湿度变化
- 🔄 下拉刷新：实时获取最新数据

## 技术栈

| 技术 | 用途 |
|------|------|
| React Native | 跨平台移动应用框架 |
| Expo SDK 54 | 开发工具链 |
| TypeScript | 类型安全 |
| Expo Router | 文件系统路由 |
| React Native Paper | Material Design UI |
| Zustand | 状态管理 |
| SQLite | 本地数据存储 |
| MQTT | 实时通信 |
| Axios | HTTP 请求 |
| react-native-gifted-charts | 图表组件 |

## 项目结构

```
magic-bean-app/
├── app/                    # 页面路由
│   ├── (tabs)/            # 底部标签页
│   │   ├── index.tsx      # 首页（设备仪表板）
│   │   └── settings.tsx   # 设置页
│   ├── device/            # 设备相关页面
│   │   └── [deviceId]/
│   │       ├── index.tsx  # 设备详情
│   │       ├── config.tsx # 设备配置
│   │       └── diary.tsx  # 成长日记
│   ├── diary/             # 手记详情
│   ├── photo/             # 照片详情
│   └── provision*         # 配网流程
├── lib/                   # 核心库
│   ├── api.ts            # API 接口
│   ├── database.ts       # SQLite 操作
│   ├── mqtt-data.ts      # MQTT 通信
│   ├── store.ts          # Zustand 状态
│   └── types.ts          # 类型定义
├── assets/               # 静态资源
└── app.config.js         # Expo 配置
```

## 开发环境

### 环境要求
- Node.js 18+
- Expo CLI
- Android Studio / Xcode（可选）

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
# 使用 Expo Go
npx expo start

# 使用 Development Build
npx expo start --dev-client
```

## 打包构建

### Development 版本
用于开发调试，需要配合 Expo Dev Client 使用。

```bash
# Android
eas build --profile development --platform android

# iOS
eas build --profile development --platform ios
```

**包名：** `com.xink2594.magicbean.develop`
**显示名称：** Magic Bean Dev

### Preview 版本
测试版本，可直接安装，无需 Dev Client。

```bash
# Android
eas build --profile preview --platform android

# iOS
eas build --profile preview --platform ios
```

**包名：** `com.xink2594.magicbean.preview`
**显示名称：** Magic Bean Preview

### 同时打包两个平台
```bash
eas build --profile preview --platform all
```

### 版本说明

| Profile | 包名后缀 | 显示名称 | 需要 Dev Client |
|---------|---------|---------|----------------|
| development | `.develop` | Magic Bean Dev | ✅ |
| preview | `.preview` | Magic Bean Preview | ❌ |
| production | 无 | Magic Bean | ❌ |

> 💡 Development 和 Preview 可以同时安装在同一设备上。

## API 接口

### 获取设备最新数据
```
GET /api/data/latest/{MAC}
```

### 获取历史数据
```
GET /api/data/history?deviceId={MAC}&startTime={timestamp}&endTime={timestamp}
```

### 获取日记列表
```
GET /api/diary/list?deviceId={MAC}&page=1&pageSize=20
```

### 获取日记详情
```
GET /api/diary/detail?deviceId={MAC}&id={id}
```

### 保存日记备注
```
POST /api/diary/save
Body: { "id": 1, "note": "备注内容" }
```

### 删除日记
```
POST /api/diary/delete
Body: { "id": 1 }
```

### AI 植物诊断
```
POST /api/ai/analyze
Body: { "imageUrl": "https://...", "prompt": "..." }
```

## 配置说明

### 设备配置
每个设备可以独立配置：
- MQTT 地址（支持 mqtt://、mqtts://、ws://、wss://）
- 在线状态订阅主题
- 自定义后端地址

### 后端地址格式
请填写完整的 URL，包含协议前缀：
- ✅ `http://192.168.1.100:8080`
- ✅ `https://api.example.com`
- ❌ `192.168.1.100:8080`（缺少 http://）

## 许可证

Private - All Rights Reserved

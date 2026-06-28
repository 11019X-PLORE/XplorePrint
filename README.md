# XplorePrint

> **FRC Team 11019 Xplore** — 3D Printer Management Software

XplorePrint 是专为 FRC 队伍设计的 3D 打印机管理软件，支持 Bambu Lab 全系列打印机（X1C / X1 / P1S / P1P / A1 / A1 Mini），通过局域网 MQTT 协议进行实时监控和控制。

---

## 功能特性

### 核心功能
- **实时监控** — 喷头/热床/腔体温度、打印进度、剩余时间、层数追踪
- **远程控制** — 暂停/恢复/停止打印、LED 控制、温度设置
- **多打印机管理** — 同时管理多台 Bambu Lab 打印机
- **AMS 监控** — 自动检测 AMS 耗材颜色和剩余量
- **打印历史** — 自动记录打印完成状态，支持 CSV 导出
- **耗材库存** — 追踪耗材使用情况和剩余量，可视化进度条
- **打印队列** — 任务排队、优先级排序（普通/高/紧急）

### FRC 专属功能（Bambu Studio 不具备）
- **FRC 零件库** — 预置 20 个常用 FRC 零件模板，一键加入打印队列
- **零件状态看板** — Kanban 四列流程：待打印 → 打印中 → 已完成 → 已装机
- **机器人管理** — 多机器人追踪（比赛机/练习机/原型机），11 个 FRC 子系统分类
- **队员分配** — 打印任务指派给队员，明确责任分工
- **比赛倒计时** — 下场比赛截止日期提醒，紧急状态红色闪烁

---

## 技术架构

```
XplorePrint/
├── app.py                          # Flask 应用入口
├── config.json                     # 打印机配置
├── requirements.txt                # Python 依赖
├── printermanager/
│   ├── __init__.py
│   ├── models.py                   # 数据模型（dataclass）
│   ├── printermanager.py           # 核心业务逻辑
│   └── bambu_client.py             # 官方协议通信客户端
├── web/
│   ├── templates/
│   │   └── index.html              # 前端页面
│   └── static/
│       ├── css/
│       │   └── style.css           # 样式表
│       └── js/
│           └── app.js              # 前端交互逻辑
└── data/                           # 持久化数据
    ├── queue.json
    ├── history.json
    ├── filaments.json
    ├── robots.json
    ├── competitions.json
    └── parts_library.json
```

| 技术栈 | 说明 |
|--------|------|
| **后端** | Python 3.10+ / Flask / Flask-SocketIO |
| **实时通信** | Socket.IO（WebSocket） |
| **打印机协议** | [bambulabs_api](https://github.com/Bambu-Research-Group/bambulabs_api) v2.6 — 社区维护的官方协议封装库 |
| **状态/控制** | MQTT over TLS（端口 8883）— 与 Bambu Studio/Bambu Handy 相同 |
| **文件传输** | FTPS（端口 990）— 3MF/gcode 文件传输 |
| **摄像头** | RTSP（端口 322）— 实时视频流 |
| **前端** | 原生 HTML/CSS/JavaScript，深色主题 |
| **数据持久化** | JSON 文件存储 |

### 打印机通信协议

XplorePrint 使用 **[bambulabs_api](https://github.com/Bambu-Research-Group/bambulabs_api)** 库，该库封装了 Bambu Lab 完整 LAN 模式协议，与 Bambu Studio、Bambu Handy 等官方软件完全一致：

| 通道 | 端口 | 协议 | 用途 |
|------|------|------|------|
| 状态/控制 | `8883` | MQTT over TLS | 实时状态推送、打印控制指令 |
| 文件传输 | `990` | FTPS (FTP over TLS) | 3MF/gcode 文件上传/删除 |
| 视频流 | `322` | RTSP | 摄像头实时画面 |

---

## 快速开始

### 环境要求
- Python 3.10 或更高版本
- 打印机需与服务器在同一局域网
- 打印机需开启 **LAN 模式**（在打印机设置中启用）

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd XplorePrint

# 安装依赖
pip install -r requirements.txt
```

### 启动

```bash
python app.py
```

启动后访问 **http://127.0.0.1:5000**

### 添加打印机

1. 在 Bambu Lab 打印机屏幕上进入 **设置 → 网络 → LAN 模式**，获取：
   - **IP 地址**（如 `192.168.1.100`）
   - **访问码 / Access Code**（8 位数字）
   - **序列号 / Serial Number**

2. 在 XplorePrint 界面点击 **"添加打印机"**，填写上述信息

3. 添加后点击 **"连接"** 即可开始监控

---

## API 接口

### 打印机管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/printers` | 获取所有打印机状态 |
| POST | `/api/printers` | 添加打印机 |
| DELETE | `/api/printers/<id>` | 删除打印机 |
| POST | `/api/printers/<id>/connect` | 连接打印机 |
| POST | `/api/printers/<id>/disconnect` | 断开打印机 |
| POST | `/api/printers/<id>/command` | 发送控制指令 |
| POST | `/api/printers/<id>/upload` | 上传文件到打印机 (FTPS) |
| GET | `/api/printers/<id>/files` | 列出打印机存储的文件 |
| DELETE | `/api/printers/<id>/files/<name>` | 删除打印机上的文件 |
| GET | `/api/printers/<id>/camera` | 获取摄像头 RTSP 地址 |
| GET | `/api/printers/<id>/temperature` | 获取温度历史 |
| POST | `/api/connect_all` | 连接所有打印机 |
| GET | `/api/stats` | 获取统计信息 |

### 打印队列
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/queue` | 获取队列（支持 `?printer_id=` 筛选） |
| POST | `/api/queue` | 添加任务（支持 robot_id / subsystem / assigned_to） |
| DELETE | `/api/queue/<id>` | 移除任务 |
| PUT | `/api/queue/<id>` | 更新任务 |
| POST | `/api/queue/clear` | 清空队列 |

### 打印历史
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/history` | 获取历史（支持 `?limit=` 参数） |
| GET | `/api/history/stats` | 获取统计（成功率等） |
| GET | `/api/history/export` | 导出 CSV |
| POST | `/api/history/clear` | 清空历史 |

### 耗材库存
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/filaments` | 获取耗材列表 |
| POST | `/api/filaments` | 添加耗材 |
| DELETE | `/api/filaments/<id>` | 删除耗材 |
| PUT | `/api/filaments/<id>` | 更新耗材 |
| POST | `/api/filaments/<id>/use` | 记录耗材使用 |

### FRC 机器人
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/robots` | 获取机器人列表 |
| POST | `/api/robots` | 添加机器人 |
| DELETE | `/api/robots/<id>` | 删除机器人 |

### FRC 零件库
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/parts/library` | 获取零件库（支持 `?category=` 筛选） |
| GET | `/api/parts/categories` | 获取所有类别 |
| GET | `/api/parts/board` | 获取零件看板（支持 `?robot_id=` 筛选） |
| PUT | `/api/parts/<id>/status` | 更新零件状态 |

### 比赛管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/competitions` | 获取比赛列表 |
| POST | `/api/competitions` | 添加比赛 |
| DELETE | `/api/competitions/<id>` | 删除比赛 |

---

## 数据模型

### 打印机状态
- `online` 在线 · `offline` 离线 · `printing` 打印中 · `paused` 已暂停
- `error` 错误 · `idle` 空闲 · `finishing` 完成中

### 队列状态
- `waiting` 等待中 · `printing` 打印中 · `completed` 已完成 · `cancelled` 已取消

### 零件状态
- `needed` 待打印 · `printing` 打印中 · `done` 已完成 · `installed` 已装机

### FRC 子系统
`Drivetrain` · `Intake` · `Shooter` · `Climber` · `Elevator` · `Arm` · `Bumper` · `Electronics` · `Pneumatics` · `Structure` · `Other`

---

## 支持的打印机

通过 Bambu Lab LAN 模式 MQTT 协议支持以下型号：

- **X1 Carbon** / **X1** — 全功能支持
- **P1S** / **P1P** — 全功能支持
- **A1** / **A1 Mini** — 全功能支持

---

## 队伍信息

| 项目 | 详情 |
|------|------|
| 队伍编号 | 11019 |
| 队伍名称 | Xplore |
| 软件版本 | 1.2.0 |

---

## License

MIT License — 为 FRC 社区开源贡献
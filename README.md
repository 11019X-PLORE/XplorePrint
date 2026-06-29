# XplorePrint

**FRC Team 11019 Xplore — 3D 打印机管理软件**

专为 FRC 队伍设计的 Bambu Lab 拓竹 3D 打印机集中管理平台，基于官方 `bambulabs_api` 库，提供实时监控、打印队列、耗材库存、FRC 零件管理、比赛倒计时等功能。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3 + Flask + Flask-SocketIO |
| 打印机通信 | `bambulabs_api`（MQTT over TLS 端口 8883 / FTPS 端口 990 / RTSP 端口 322） |
| 前端 | 原生 HTML/CSS/JavaScript，深色主题 UI |
| 实时推送 | WebSocket（SocketIO） |
| 数据持久化 | JSON 文件 |

---

## 支持的机型

`X1 Carbon` / `X1` / `P1S` / `P1S Combo` / `P1P` / `P2S` / `A1` / `A1 Mini` / `H2D` / `H2S` / `H2C` / `X2D` / `A2L`

---

## 功能概览

### 仪表盘
- 打印机在线/离线/打印中/暂停/错误状态一览
- 喷嘴/热床/腔体实时温度显示
- 打印进度百分比、当前层数 / 总层数、剩余时间
- 全局统计：在线打印机数、队列任务数、历史打印数、耗材种类

### 打印机管理
- 添加 / 删除打印机（IP 地址 + 访问码 + 序列号）
- 一键连接 / 断开所有打印机
- 实时状态卡片（进度条、温度、文件信息、WiFi 信号）

### 打印操作台
- 暂停 / 恢复 / 停止打印
- 喷嘴 / 热床温度调节
- **部件散热风扇** / **辅助风扇** / **机箱风扇** 三风扇独立控制（滑块 + 预设 + 应用按钮）
- 打印速度切换：**50%** / **100%** / **124%** / **166%**
- LED 开关
- 自定义 G-code 发送
- **操纵杆式 XYZ 轴移动**（±1mm / ±10mm 步长切换，十字键布局 + 归位按钮）
- 摄像头实时流预览
- **HMS 错误处理**：自动捕获打印机 HMS 错误码，一键跳转 Bambu Lab Wiki 查询解决方案

### AMS 预览
- 显示所有 AMS 单元插槽
- 耗材颜色、材料类型、剩余百分比
- **内存缓存 + 文件持久化**：AMS 数据缓存到 `data/ams_cache.json`，断连或重启后自动恢复，避免显示闪烁

### 文件管理
- 拖拽上传 `.gcode` / `.3mf` / `.gcode.3mf` 文件到打印机
- 通过 FTPS 协议传输，最大 200MB
- 文件列表浏览、远程打印启动、文件删除

### 打印队列
- 添加打印任务到指定打印机
- 优先级排序、预估时间
- 关联 FRC 机器人、子系统、队员分配
- 零件状态标记（待打印 → 打印中 → 已完成 → 已装机）
- **手动拖拽排序**（拖拽手柄调整队列顺序）
- **智能排序**（按子系统分组 + 优先级 + 时间）
- 默认排序（优先级 + 时间）
- **智能调度（奖惩机制）**：根据优先级(40%)、打印时长(25%)、打印机状态(20%)、子系统连续性(15%) 自动计算排分，一键排序并确认开打

### 打印历史
- 打印记录列表（文件名、耗时、材料、层数、成败）
- 统计数据（成功率、总打印时长、材料用量）
- CSV 导出

### 耗材库存
- 耗材出入库管理
- 品牌、颜色、重量、价格记录
- 低库存预警

### FRC 零件库
- 预置 FRC 常用零件模板（齿轮、轴承座、支架等）
- 推荐材料、填充率、壁厚、预估时间
- 按类别筛选

### 零件状态看板
- 按机器人查看所有零件状态
- 看板列：待打印 → 打印中 → 已完成 → 已装机
- 拖拽更新状态

### 机器人管理
- 多机器人追踪（比赛机器人 / 练习机器人）
- 支持按年份、类型分类

### 比赛管理
- 添加比赛信息（名称、日期、地点）
- 比赛倒计时显示

### 温度历史图表
- 每个打印机的喷嘴 / 热床 / 腔体温度曲线
- 最近 200 条记录

---

## 快速开始

### 环境要求

- Python 3.10+
- 网络需能访问打印机（局域网）

### 安装

```bash
git clone <repo-url>
cd XplorePrint
pip install -r requirements.txt
```

### 配置

编辑 `config.json`（首次运行自动生成模板）：

```json
{
  "printers": [
    {
      "id": "printer_1",
      "name": "车间-打印机01",
      "model": "P1S Combo",
      "ip_address": "10.0.0.100",
      "access_code": "12345678",
      "serial_number": "01S00C3A1500442"
    }
  ]
}
```

> 访问码可在打印机屏幕「设置 → 网络 → 局域网模式」中获取。

### 启动

```bash
python app.py
```

访问 `http://localhost:5000`

> **Windows 用户**：也可双击 `server_control.bat` 使用图形化菜单管理服务器（启动/停止/重启/打开浏览器）。

---

## 项目结构

```
XplorePrint/
├── app.py                          # Flask 主应用 + API 路由
├── server_control.bat              # Windows 服务器管理小工具（启动/停止/重启）
├── config.json                     # 打印机配置
├── requirements.txt                # Python 依赖
├── data/                           # 持久化数据目录
│   ├── history.json                # 打印历史
│   ├── queue.json                  # 打印队列
│   ├── filaments.json              # 耗材库存
│   ├── robots.json                 # 机器人列表
│   ├── competitions.json           # 比赛信息
│   └── parts_library.json          # FRC 零件库
├── printermanager/
│   ├── __init__.py
│   ├── models.py                   # 数据模型（Printer, QueueItem, FilamentStock 等）
│   ├── bambu_client.py             # bambulabs_api 封装（MQTT/FTPS/RTSP）
│   └── printermanager.py           # 核心管理器（连接、队列、历史、库存、FRC）
└── web/
    ├── templates/
    │   └── index.html              # 主页面模板
    └── static/
        ├── css/
        │   └── style.css           # 样式表
        └── js/
            └── app.js              # 前端应用逻辑
```

---

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/printers` | 获取所有打印机状态 |
| POST | `/api/printers` | 添加打印机 |
| DELETE | `/api/printers/<id>` | 移除打印机 |
| POST | `/api/printers/<id>/connect` | 连接打印机 |
| POST | `/api/printers/<id>/disconnect` | 断开打印机 |
| POST | `/api/printers/<id>/command` | 发送控制指令 |
| GET | `/api/printers/<id>/temperature` | 温度历史 |
| GET | `/api/printers/<id>/ams` | AMS 状态 |
| GET | `/api/printers/<id>/files` | 文件列表 |
| POST | `/api/printers/<id>/upload` | 上传文件 |
| POST | `/api/printers/<id>/print` | 启动打印 |
| DELETE | `/api/printers/<id>/files/<name>` | 删除文件 |
| GET | `/api/queue` | 打印队列 |
| POST | `/api/queue` | 添加队列任务 |
| POST | `/api/queue/sort` | 队列排序（default / smart） |
| POST | `/api/queue/reorder` | 手动拖拽重排队列 |
| GET | `/api/schedule/preview` | 智能调度排分预览 |
| POST | `/api/schedule/apply` | 应用智能调度排序 |
| POST | `/api/schedule/start` | 确认开打 |
| GET | `/api/history` | 打印历史 |
| GET | `/api/printer/<id>/hms` | 获取打印机 HMS 错误码及 Wiki 链接 |
| GET | `/api/filaments` | 耗材库存 |
| GET | `/api/robots` | 机器人列表 |
| GET | `/api/parts/library` | FRC 零件库 |
| GET | `/api/competitions` | 比赛列表 |

---

## 依赖

```
flask==3.1.0
flask-socketio==5.4.1
bambulabs_api>=2.6.0
python-dotenv==1.0.1
```

---

## 队伍信息

**FRC Team 11019 — Xplore**

"Xplore never stops exploring."
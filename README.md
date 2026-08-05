# EmotionSense - 情绪感知插件

[![Visitors](https://visitor-badge.laobi.icu/badge?page_id=YuxiaANight/astrbot_plugin_emotionsense)](https://visitor-badge.laobi.icu/badge?page_id=YuxiaANight/astrbot_plugin_emotionsense)

![Latest Version](https://img.shields.io/badge/LATEST%20VERSION-v1.1.0-7ec8e3?style=for-the-badge&labelColor=EDFFEC)

![AstrBot Plugin](https://img.shields.io/badge/ASTRBOT-PLUGIN-ff69b4?style=for-the-badge&labelColor=EDFFEC)

基于 AstrBot 的情绪感知插件，实时分析用户消息情绪，并在检测到负面情绪时主动给予关心；同时机器人也有自己的情绪，会随对话动态变化并影响回复语气、速度与是否回复，同时提供 WebUI 数据看板。

## 功能特性

- **实时情绪分析**：监听用户消息，调用 LLM 识别情绪类别与强度（喜悦 / 悲伤 / 愤怒 / 焦虑 / 平静 / 困惑）。
- **主动关心**：当负面情绪强度超过阈值时，按设定的冷却间隔主动发送一句温暖的关心话语。
- **LLM 自身情绪**：机器人也有自己的情绪（开心 / 平静 / 懒惰 / 生气 / 伤心 / 烦躁），会随用户情绪动态变化。
- **情绪影响回复**：
  - 处于「懒惰 / 生气」时，有 5% 概率不回复。
  - 处于「伤心 / 烦躁」时，回复速度会慢 4-5 秒。
  - 回复内容会根据机器人当前的情绪状态来生成（语气、态度、节奏均符合当前状态）。
- **情绪状态查询**：发送 `情绪状态` 查看自己当前的情绪；发送 `机器人情绪` 查看机器人当前的情绪。
- **数据持久化**：情绪历史通过 AstrBot 插件 KV 存储保存，重启不丢失；每用户最多保留 100 条近期记录。
- **自动清理**：后台每 6 小时清理一次超过 7 天的历史数据。
- **WebUI 数据看板**：在 AstrBot 插件详情页打开「dashboard」面板，查看总用户数、当前负面情绪人数及明细表格，支持刷新与一键清除。面板自适应手机与电脑端。

## 安装

1. 将 `astrbot_plugin_emotionsense` 目录放入 AstrBot 的 `data/plugins/` 目录。
2. 在 AstrBot WebUI 的插件管理页面点击「重载插件」，或在 WebUI 中启用本插件。
3. 确保已在 AstrBot 中配置好一个 Chat Completion 类型的对话模型（提供商），插件会通过 `context.get_using_provider()` 调用它进行情绪分析。

## 配置

在 WebUI 插件配置页面可调整以下项（对应 `_conf_schema.json`）：

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `emotion_prompt` | text | `分析以下文本的情绪，只返回JSON格式：{"emotion": "喜悦/悲伤/愤怒/焦虑/平静/困惑", "score": 0.0-1.0}` | 情绪分析的系统提示词，要求模型仅返回 JSON。 |
| `negative_threshold` | float | `0.6` | 触发主动关心的负面情绪强度阈值，分数大于等于该值即视为需要关心。 |
| `care_interval` | int | `3600` | 同一用户两次主动关心之间的最小间隔（秒）。 |
| `enable_care` | bool | `true` | 是否启用主动关心功能。 |
| `enable_llm_emotion` | bool | `true` | 是否启用 LLM 自身情绪（机器人也会有自己的情绪并影响回复）。 |
| `no_reply_probability` | float | `0.05` | LLM 处于懒惰/生气时不回复的概率（0-1）。 |
| `slow_reply_delay` | float | `4.5` | LLM 处于伤心/烦躁时回复延迟的秒数（实际会在 ±0.5s 范围内随机，即默认 4-5 秒）。 |

> 提示：若模型经常不返回纯 JSON，可适当调整 `emotion_prompt`，例如追加「不要输出任何多余文字」。解析失败时插件会回退为「平静 / 0.5」，不会中断运行。

## 使用

### 指令

- **`情绪状态`**：查询自己当前的情绪类别。插件以正则匹配触发，无需加斜杠。
- **`机器人情绪`**：查询机器人当前的情绪状态与强度。

### 自动行为

- 普通消息（非 @ 机器人、非指令）会被静默分析并记录情绪，同时据此更新机器人自身的情绪。
- 当 `enable_care` 开启且情绪分数 ≥ `negative_threshold`，且距上次关心已超过 `care_interval` 时，机器人会主动在当前会话发送一条关心话语。
- 当 `enable_llm_emotion` 开启时，机器人在生成回复前会根据自身当前情绪：
  - 处于「懒惰 / 生气」有 `no_reply_probability`（默认 5%）概率不回复；
  - 处于「伤心 / 烦躁」会延迟 `slow_reply_delay`（默认 4-5 秒）再回复；
  - 将当前情绪状态注入系统提示词，使回复的语气、态度与节奏符合该状态。

### WebUI 面板

在插件详情页打开 **dashboard** 面板：

- 顶部统计卡片展示「总用户数」与「当前负面情绪」人数。
- 「机器人情绪」卡片展示机器人当前的情绪、强度与最近更新时间，卡片左侧色条随情绪类型变化。
- 「情绪变化状态」时间线展示机器人最近的情绪变化记录（情绪、强度、时间，最新在上，最多 20 条）。
- 「刷新数据」按钮重新拉取最新情绪数据；「清除所有数据」按钮会在二次确认后清空全部记录（含机器人情绪历史）。
- 用户情绪明细表格列出每个用户的 ID（截断显示）、当前情绪、情绪强度百分比与历史记录数。
- 窄屏（手机）下统计卡片与按钮自动两列排列，表格可横向滚动，历史时间线可纵向滚动。

## 数据结构

`GET /data` 返回 `{ "users": {...}, "llm": {...} }`：

用户情绪数据：

```json
{
  "current": "平静",
  "score": 0.4,
  "history": [
    {"emotion": "喜悦", "score": 0.8, "time": "2026-08-04T12:00:00"}
  ]
}
```

机器人情绪数据（`llm`）：

```json
{
  "emotion": "平静",
  "score": 0.3,
  "updated_at": "2026-08-04T12:00:00",
  "history": [
    {"emotion": "开心", "score": 0.6, "time": "2026-08-04T11:50:00"}
  ]
}
```

## Web API

插件注册了两个内部 Web API（由 WebUI 面板调用，一般无需手动访问）：

- `GET /astrbot_plugin_emotionsense/data`：返回 `{users, llm}`，分别对应用户情绪与机器人情绪（含变化历史）。
- `POST /astrbot_plugin_emotionsense/clear`：清空全部用户情绪数据与机器人情绪历史。

## 依赖

- AstrBot v4.26.0 及以上（需支持 `astrbot.api.web`、`on_llm_request` 钩子、插件 KV 存储与 Pages）。
- 一个可用的 Chat Completion 对话模型提供商。

## 反馈

如遇问题可先在 WebUI 插件管理查看加载日志；情绪分析失败多为对话模型未返回标准 JSON，可在配置中调整 `emotion_prompt`。

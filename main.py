import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict

from astrbot.api.star import Star, Context
from astrbot.api.event import filter, AstrMessageEvent, MessageChain
from astrbot.api.message_components import Plain
from astrbot.api.web import json_response

PLUGIN_NAME = "astrbot_plugin_emotionsense"


class EmotionSensePlugin(Star):
    def __init__(self, context: Context, config=None):
        super().__init__(context, config)
        self.config = config or {}
        self.emotion_data: Dict[str, Dict] = {}
        self.last_care: Dict[str, float] = {}
        self._cleanup_task = None
        self.context.register_web_api(
            f"/{PLUGIN_NAME}/data",
            self.get_emotion_data,
            ["GET"],
            "获取情绪数据"
        )
        self.context.register_web_api(
            f"/{PLUGIN_NAME}/clear",
            self.clear_emotion_data,
            ["POST"],
            "清除情绪数据"
        )

    async def initialize(self):
        self.emotion_data = await self.get_kv_data("emotion_data", {})
        self.last_care = await self.get_kv_data("last_care", {})
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def _cleanup_loop(self):
        while True:
            await asyncio.sleep(6 * 3600)
            await self.cleanup_old_data()

    @filter.event_message_type(filter.EventMessageType.ALL)
    async def on_analyze(self, event: AstrMessageEvent):
        if event.is_at_or_wake_command:
            return
        text = event.message_str
        if not text or len(text) < 2:
            return
        try:
            provider = self.context.get_using_provider()
            resp = await provider.text_chat(
                prompt=text,
                system_prompt=self.config.get("emotion_prompt"),
            )
            data = json.loads(resp.completion_text)
            emotion = data.get("emotion", "平静")
            score = float(data.get("score", 0.5))
        except Exception:
            emotion = "平静"
            score = 0.5
        user_id = event.get_sender_id()
        self.emotion_data.setdefault(user_id, {"history": [], "current": emotion, "score": score})
        self.emotion_data[user_id]["history"].append({"emotion": emotion, "score": score, "time": datetime.now().isoformat()})
        if len(self.emotion_data[user_id]["history"]) > 100:
            self.emotion_data[user_id]["history"] = self.emotion_data[user_id]["history"][-100:]
        self.emotion_data[user_id]["current"] = emotion
        self.emotion_data[user_id]["score"] = score
        await self.put_kv_data("emotion_data", self.emotion_data)
        if self.config.get("enable_care") and score >= self.config.get("negative_threshold", 0.6):
            last = self.last_care.get(user_id, 0)
            if datetime.now().timestamp() - last > self.config.get("care_interval", 3600):
                self.last_care[user_id] = datetime.now().timestamp()
                await self.put_kv_data("last_care", self.last_care)
                await self.send_care_message(event, emotion, score)

    async def send_care_message(self, event: AstrMessageEvent, emotion: str, score: float):
        try:
            provider = self.context.get_using_provider()
            resp = await provider.text_chat(
                prompt="请关心我一下",
                system_prompt=f"用户当前情绪为{emotion}，强度{score}。请生成一句简短温暖的关心话语，不要提及情绪评分。",
            )
            care_text = (resp.completion_text or "")[:50]
        except Exception:
            care_text = "今天也要好好照顾自己哦"
        await event.send(MessageChain([Plain(care_text)]))

    @filter.regex(r"情绪状态")
    async def show_emotion(self, event: AstrMessageEvent):
        user_id = event.get_sender_id()
        data = self.emotion_data.get(user_id, {})
        if not data:
            yield event.plain_result("还没有你的情绪数据哦")
            return
        current = data.get("current", "未知")
        yield event.plain_result(f"你当前的情绪状态是：{current}")

    async def cleanup_old_data(self):
        now = datetime.now()
        for uid in list(self.emotion_data.keys()):
            history = self.emotion_data[uid].get("history", [])
            cutoff = now - timedelta(days=7)
            history = [h for h in history if datetime.fromisoformat(h["time"]) > cutoff]
            if not history:
                del self.emotion_data[uid]
            else:
                self.emotion_data[uid]["history"] = history
        await self.put_kv_data("emotion_data", self.emotion_data)

    async def terminate(self):
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

    async def get_emotion_data(self):
        return json_response(self.emotion_data)

    async def clear_emotion_data(self):
        self.emotion_data = {}
        await self.put_kv_data("emotion_data", {})
        return json_response({"status": "cleared"})

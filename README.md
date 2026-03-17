# CoCo AI 记账

一个聊天窗口 = 所有记账入口。语音、拍照、文字输入统一融合在 AI 对话界面中。

<p align="center">
  <img src="ui/0310/design-final.png" width="280" alt="首页截图" />
</p>

## 功能亮点

- 🎙️ **语音记账** — 长按说话，AI 自动解析生成账单
- 📷 **拍照识票** — 拍小票/发票，OCR + AI 自动录入
- ⌨️ **文字记账** — 输入"午饭 35"，AI 智能识别
- 💬 **自然语言查询** — "上周花了多少钱吃饭"直接查账
- 📊 **收支统计** — 月报/周报、分类饼图、趋势折线图
- 🎯 **预算管理** — 分类预算 + 超支提醒
- 📤 **数据导出** — 按时间范围导出 CSV

## 技术栈

| 层级 | 技术 |
|------|------|
| 客户端 | React Native (Expo) |
| BFF | Next.js API Routes · Vercel |
| 数据库 | Supabase (PostgreSQL + Auth + RLS) |
| AI | 智谱 GLM · 腾讯云 OCR / ASR |
| 状态管理 | Zustand · React Query |
| 工程化 | Turborepo · pnpm |

## 快速启动

```bash
# 克隆并安装依赖
git clone <repo-url>
cd coco
pnpm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入 Supabase、智谱 AI、腾讯云的密钥

# 启动开发
pnpm dev
```

详细的环境变量说明见 [.env.example](.env.example)。

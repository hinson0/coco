## 个人简历

<table>
  <tr>
    <td>
      <b>姓名：</b> 杨志兵 <b>性别：</b> 男<br>
      <b>学历：</b> 本科 <b>出生年月：</b> 1987年1月 
      <b>民族：</b> 汉 <b>籍贯：</b> 江西抚州 <br>
      <b>Phone：</b> 13907941239 <b>E-mail：</b> 356745844@qq.com
    </td>
    <td width="120">
      <img src="yzb.jpeg" width="100" />
    </td>
  </tr>
</table>

---

## 个人评价

- 15 年软件开发经验，历经 PHP 后端、全栈开发到 AI 应用的技术演进，先后在完美世界、小米、天猫等公司参与大型项目开发。具备独立从 0 到 1 构建产品的能力，擅长将 AI 能力融入产品设计。有创业经历，对产品运营和商业闭环有实际认知。
- 具有产品思维的开发工程师，深度使用 AI Coding 工具作为核心生产力，擅长编排 Agent 驱动高效开发。

---

## 专业技能

**AI Agent 驱动开发（Claude Code 深度使用者）**

从 IDE 补全到 Agent 驱动开发，经历四阶段演进：VSCode Copilot → Trae → Cursor → **Claude Code（Max订阅，当前主力）**

- **Claude Code 深度使用者**，熟悉 claude-code-official 官方大部分 skill，熟练运用 **Superpowers**、**Everything Claude Code (ECC)**、**GSD** 等主流社区工作流插件
- 掌握 Agent 模式完整开发流程：CLAUDE.md 迭代、skill/hook/command 编写、brainstorming → writing-plans → executing-plans 全链路、TDD 驱动、code-review 质量闭环、git worktree + parallel-agents 并行开发
- **自研 smart-claude-code-plugins 插件**，实现自动化 commit/push/PR、版本管理、statusline 部署、会话日志跟踪；集成 Context7 MCP 获取最新框架文档

**后端开发**

- 熟练掌握 Python FastAPI，熟悉 RESTful API 设计、SQLAlchemy ORM、Alembic 迁移；熟悉 PostgreSQL 索引优化与数据建模
- 有 PHP 后端经验（小米、天猫、完美世界），熟悉 MVC 架构与大规模服务设计；有 Node.js 后端经验

**DevOps & 工程化**

- 熟练使用 Docker / Docker Compose 容器化部署，熟悉 GitHub Actions CI/CD，有阿里云 ECS、AWS EC2 运维经验
- 熟练使用 Linux 与 Shell 编程，掌握 pnpm Monorepo、justfile 等工程化工具

**前端开发**

- 了解 React Native (Expo)、TypeScript、React 19，具备从零构建跨平台移动应用的能力
- 熟悉 Web 前端开发，有 Next.js 项目开发经验

---

## 工作经历

**StoryverseAI(美国) | 2025/09 - 至今**

- StoryverseAI — AI 视频剧本创作平台（从 0 到 1 构建 MVP，历时 19 天）
- CoCo AI 记账 — 多模态智能记账 App（从 0 到 1 构建 MVP，历时 15 天）

**自主创业 | 2017/03 - 2025/08**

- 对接江西省监狱管理局 ERP 开发，于 14 个监狱部署（Python+PostgreSQL）；创办 PHP/Web 技术培训班

**阿里巴巴杭州天猫技术有限公司 | 2014/10 - 2016/12**

- 参与天猫活动平台「斑马」功能开发与活动联调（Node.js）

**小米科技（北京）有限公司 | 2012/04 - 2014/09**

- 负责仓储物流模块开发（PHP+MySQL）

**完美世界 | 2011/02 - 2012/04 · 抚州市公安局 | 2008/07 - 2010/09**

- PHP 后端开发：纵横微博、178 微博、政务网站等产品（PHP+MySQL）

---

## 项目经历（近期）

### StoryverseAI — AI 视频剧本创作平台

**技术栈：** Next.js · FastAPI · PostgreSQL · Redis · GPT · Sora · FFmpeg · Docker · GitHub Actions

- 独立开发 8 个核心页面（首页、Chatbot 剧本创作、角色人设、剧集文本、资产管理、关键帧、分镜视频、最终合成），覆盖从创作到成片完整链路
- 设计 AI 视频生成流水线：LLM 剧本创作 → 角色/场景图像生成 → 关键帧 → 分镜视频（Sora）→ FFmpeg 合成终片（含音频、字幕）
- 基于 FastAPI 实现 OAuth 2.1 鉴权、项目管理、多 AI 模型 API 对接与异步任务编排
- Docker + GitHub Actions CI/CD 自动化部署至阿里云 ECS 与 AWS EC2

### CoCo AI 记账 — 多模态智能记账 App（全程 Claude Code Vibe Coding）

**技术栈：** React Native (Expo 55) · TypeScript · FastAPI · PostgreSQL · Qwen LLM · 腾讯云 ASR/OCR · pnpm Monorepo

- 聊天式记账界面，集成语音录制、相机拍照、文字输入三种交互，统一通过对话流完成记账
- expo-sqlite（WAL 模式）离线存储 + React Query 数据层 + Zustand 全局状态；实现收支统计、饼图/折线图、分类预算与超支提醒
- FastAPI 统一 /chat 接口，Qwen 大模型三级意图分类（记账/查询/闲聊），集成腾讯云 ASR/OCR 实现语音与票据识别
- Qwen text-to-SQL 自然语言查账，含 SQL 注入安全校验；SQLAlchemy + Alembic + JWT + Docker Compose 全栈部署

**教育：** 桂林电子科技大学 · 电子信息工程 · 本科 · 2004-2008 <br>
**证书：** Zend PHP (PCTI) · CET-4 &emsp;
**爱好：** 王者荣耀 · Dota · 长跑 · 象棋 · 魔方

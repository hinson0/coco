## 个人简历

<table>
  <tr>
    <td>
      <b>姓名：</b> 杨志兵 <b>性别：</b> 男<br>
      <b>学历：</b> 本科 <b>出生年月：</b> 1987年1月<br>
      <b>民族：</b> 汉 <b>籍贯：</b> 江西抚州 
      <b>Phone：</b> 13907941239 <b>E-mail：</b> 356745844@qq.com
    </td>
    <td width="120">
      <img src="yzb.jpeg" width="100" />
    </td>
  </tr>
</table>

---

## 个人评价

- 15 年软件开发经验，历经 PHP 后端、全栈开发到 AI 应用的技术演进，先后在完美世界、小米、天猫等公司参与大型项目开发。具备独立从 0 到 1构建产品的能力，擅长将 AI 能力融入产品设计，熟练运用 AI 辅助开发工具提升工程效率。有创业经历，对产品运营和商业闭环有实际认知。
- 是一名具有产品思维的开发工程师，深刻理解"技术是为了业务服务的"这句话的意义。
- 如今AI Coding的时代，手写代码已经不是主要核心，如何编排agent以及对齐agent跟着项目走，才是核心。
  "AI时代，技术的广度已经变得容易，技术的深度更加具备价值。使用好AI Coding，并把它当成核心生产力，将会取代仍在手写代码，或者不拥抱AI Coding的Programmer"

---

## 专业技能

**AI Agent 驱动开发（Claude Code CLI）**

从 IDE 补全到 Agent 驱动开发，经历四个阶段演进：VSCode Copilot → Trae → Cursor → **Claude Code（Max订阅，当前主力）**

- **Claude Code 深度使用者**，熟悉 claude-code-official 官方大部分 skill，熟练运用 **Superpowers**、**Everything Claude Code (ECC)**、**GSD** 等主流社区工作流插件
- 熟练掌握 Agent 模式完整开发流程：
  - 持续迭代 **CLAUDE.md**（AGENTS.md），熟练编写 skill / subagent / hook / command 及插件开发与分发
  - **全链路工作流：** brainstorming → writing-plans → executing-plans，编码前完成需求澄清、方案设计与 spec 评审
  - **TDD 驱动：** 每个 Task 先写测试再写实现
  - **质量闭环：** requesting-code-review 代码审查 + verification-before-completion 验证后提交
  - **并行开发：** git worktree 隔离分支 + dispatching-parallel-agents 并行推进独立任务
- **自研 smart-claude-code-plugins 插件**，实现自动化 commit/push/PR 与版本管理、statusline 部署、会话日志跟踪、特殊文件保护；集成 Context7 MCP 获取最新框架文档

**后端开发**

- 熟练掌握 Python FastAPI 框架，熟悉 RESTful API 设计、SQLAlchemy ORM、Alembic 数据库迁移
- 熟悉 PostgreSQL 数据库，掌握索引优化、数据建模；熟练编写 SQL
- 有 PHP 后端开发经验（小米、天猫、完美世界），熟悉 MVC 架构与大规模服务设计
- 有 Nodejs 后端开发经验

**DevOps & 工程化**

- 熟练使用 Docker / Docker Compose 进行服务容器化部署
- 熟悉 GitHub Actions CI/CD 自动化部署流程，有阿里云 ECS、AWS EC2 实际运维经验
- 熟练使用 Linux 环境与 Shell 编程，掌握vim、pnpm Monorepo、justfile 等工程化工具

**前端开发**

- 了解 React Native (Expo)、TypeScript、React 19，具备从零构建跨平台移动应用的能力
- 了解 expo-router、Zustand、React Query、expo-sqlite 等 Expo 生态技术栈
- 熟悉 Web 前端开发（HTML / CSS / JavaScript），有 Next.js 项目开发经验

---

## 工作经历

**StoryverseAI(美国) | 2025/09 - 至今**

- StoryverseAI — AI 视频剧本创作平台（从 0 到 1 构建 MVP，历时 19 天）
- CoCo AI 记账 — 多模态智能记账 App（从 0 到 1 构建 MVP，历时 15 天）

**自主创业 | 2017/03 - 2025/08**

- 和赣州市赣玛公司对接江西省监狱管理局的ERP开发，于江西14个监狱部署ERP。（Python+PostgreSQL）
- 创办 PHP/Web 技术培训班，独立完成课程体系设计与教学
- 创办线下果吧，独立完成选址、装修、进货、运营全流程；运用微信公众号、社群等渠道进行线上推广运营

**阿里巴巴杭州天猫技术有限公司 | 2014/10 - 2016/12**

- 参与天猫活动平台「斑马」功能开发与活动联调（Nodejs）

**小米科技（北京）有限公司 | 2012/04 - 2014/09**

- 负责仓储物流模块开发（PHP+MySQL）

**完美世界（北京）网络技术有限公司 | 2011/02 - 2012/04**

- 参与纵横微博、178 微博、173-Webmail 玩家口袋等产品开发（PHP+MySQL）

**抚州市公安局信息通信处 | 2008/07 - 2010/09**

- 基于 PHPCMS 进行政务网站二次开发与建设（PHP+MySQL）

---

## 项目经历（近期）

### StoryverseAI — AI 视频剧本创作平台

**阶段：** 从 0 到 1 构建 MVP，历时 19 天 | 主要负责前端页面 + 后端 API + DevOps

**技术栈：** Next.js · FastAPI · PostgreSQL · Redis · GPT · Google Nano-Banana · Sora · FFmpeg · Docker · GitHub Actions

**前端（Web）：**

- 开发 8 个核心页面，覆盖从剧本创作到视频成片的完整链路：首页、Chatbot
  剧本创作页、角色人设页、剧集文本页、资产管理页、关键帧页、分镜视频页、最终合成视频页
- 各页面支持完整 CRUD 操作，Chatbot 页面支持基于对话或现有剧本进行交互式创作

**后端（FastAPI）：**

- 基于 FastAPI 搭建 RESTful API 服务，实现用户鉴权（OAuth 2.1）、项目管理、文件上传、图片存储等基础模块
- 设计并实现 AI 视频生成核心流水线：剧本创作（Chatbot）→ LLM 提炼角色人设与分集内容（GPT）→ 角色图像生成（Nano-Banana）→ 场景/道具/背景资产生成 →
  关键帧九宫格生成 → 分镜视频生成（Sora）→ FFmpeg 合成最终视频（含音频、字幕）
- 对接多个 AI 模型 API，协调异步任务流转，处理多阶段依赖关系

**DevOps：**

- 通过 Docker 容器化 PostgreSQL、Redis 等服务，使用 systemctl 管理生产环境进程，配置日志追踪与自动重启
- 搭建 GitHub Actions CI/CD 流水线实现自动化部署，先后部署于阿里云 ECS 与 AWS EC2

---

### CoCo AI 记账 — 多模态智能记账 App（个人项目，全程基于Claude Code进行Vibe Coding）

**阶段：** 从 0 到 1 构建，历时 15 天开发 MVP 版本

**技术栈：** React Native (Expo 55) · TypeScript · FastAPI · PostgreSQL · Qwen LLM · 腾讯云 ASR/OCR · pnpm Monorepo

**项目描述：** 以 AI 对话为核心交互的移动端记账应用，将语音、拍照、文字三种输入方式统一在聊天界面中，用户无需手动填写表单即可完成记账。

**前端（React Native / Expo 55）：**

- 基于 expo-router 构建聊天式记账界面，集成语音录制（expo-audio）、相机拍照（expo-camera）和文字输入三种交互方式，统一通过对话流完成记账
- 使用 expo-sqlite（WAL 模式）构建本地离线存储层，持久化交易、分类、预算、聊天记录等数据，离线时支持数据查看与编辑
- 采用 React Query 作为数据访问层封装本地 CRUD 操作，实现即时 UI 响应；使用 Zustand 管理全局状态
- 实现收支统计模块，包含月报/周报、分类饼图（react-native-gifted-charts）、趋势折线图，支持按时间范围导出 CSV
- 实现分类预算管理功能，支持按类别设置预算上限与超支提醒

**后端（FastAPI / Python）：**

- 基于 FastAPI 设计统一的 /chat 接口，接收文字/语音输入，通过 Qwen 大模型实现三级意图分类（记账 / 查询 / 闲聊），根据意图路由到不同处理链
- 集成腾讯云 ASR 实现语音转文字、腾讯云 OCR 实现票据识别，识别结果经 Qwen 提取结构化账单字段（金额、分类、备注、时间）
- 实现自然语言查账功能，通过 Qwen text-to-SQL 将用户问题转换为 SQL 查询，添加安全校验防止 SQL 注入，并将查询结果以自然语言摘要返回
- 使用 SQLAlchemy ORM + Alembic 管理数据模型与数据库迁移，实现 JWT 认证体系；通过 Docker Compose 编排 PostgreSQL 与后端服务

---

## 教育背景

- 北京康盛创想培训中心 | PHP 开发培训 | 2010/09 - 2010/12
- 桂林电子科技大学 | 信息与通信学院 · 电子信息工程 · 本科 · 学士 | 2004/09 - 2008/07
- 抚州一中 | 高中 | 2001/09 - 2004/07

---

## 证书

- Zend PHP 认证（PCTI）
- 大学英语四级（CET-4）

---

## 兴趣爱好

- 王者荣耀，Dota，长跑，中国象棋，三阶魔方。

# todo-list

- TODO 刷面试题
  - 刷2-3个这样的面试题,主要涵盖: python+fastapi+redis+postgres等
- TODO 体验下`知识图谱`
- TODO (要企业资质) 取消广告功能.就用21天免费.然后之后可以手动记账,语音/OCR/自然语言等功能需购买VIP
  - 月10元
  - 年88元
  - 永久138元

- TODO 加一个main代码merge的时候,docker 可以同步代码
- TODO just mv 在日期文件夹下面在创建 文件夹放置的功能.避免我后来整理的知识点就全放在一起了.
- TODO 修复动画的bug
- TODO 第一次进来AI页 看不到旧的chat message.
- TODO 这个header的alias是什么意思
  - def get_current_user_id(authorization: Annotated[str, Header(alias="Authorization")]):
    pass
- TODO 当用户通过语音/OCR的时候,先输出一段话,类似与流式的对话,然后在变成一个卡片,让用户没有等待的感觉
- TODO 可以修改手机号
- TODO 6.4+6.5继续
- TODO 第8章节
  - TODO sqlite3原生操作
  - TODO View视图
  - TODO sqlalchemy的demo
    - “alchemy”常见读音：
    - **英式读音**：[ˈælkəmi]
    - **美式读音**：[ˈælkəmi]
      它的基本含义为“炼金术”，在计算机领域，SQLAlchemy 借用这个词，寓意其能像炼金术一样，把数据库操作变得更具魔力、更高效，它是一个强大的数据库抽象层库，方便 Python 开发者操作各种数据库。

    - sql [ˈsiːkwəl]

- TODO just start-fe 8080 + 8000 就连后端
  just start-be 8081 + 8001

## 0418

- ~TODO 微信收款,有加有减
- ~TODO 拍照支持`相册`
- feature-dev -> /review -> /security-review -> /simplify
- Fastapi的注入实践
  - 全局/路由组/路径函数/参数
  - 类/函数的实现
  - 多个注入/带参数的注入
  - 多层的注入

## 0417

- 本地模拟线上的命令:
  本地用 `pnpm --filter mobile exec expo start --no-dev --minify` 启动，
  真机/模拟器连上确认走生产 URL（119.45.41.158）
- ~TODO 如 Context Engineering、
- ~TODO Prompt 工程
- ~TODO AI 代码审核标准

- ~TODO
  - 现在 ai-native/ 目录已经有两篇互相呼应的笔记：
    ~/coco/docs/knowledges/ai-native/
    ├── what-is-ai-native.md # 概念 + 核心能力
    └── context-engineering.md # 上下文工程实践

  下次想扩展这个知识簇时，可以考虑补充：
  - ~TODO prompt-patterns.md — 常用 prompt 模板（Chain of Thought、Few-Shot 等）
  - ~TODO ai-code-review-standards.md — AI 生成代码的审核标准
  - ~TODO agentic-workflow-design.md — 让 AI 自主工作的架构范式

- ~TODO 为什么code review我没有这个command
  - 没有找到!!!我估计是cc自带的内部command.
  - 确定了 是在 vim /Users/a114514/.local/share/claude/versions/2.1.112 内置的skill
    而且是二进制文件编译在里面的
- ~TODO pr-review-toolkit Plugin · claude-plugins-official · ✔ enabled这个插件和
  - 我现在明白了这个插件.这个插件说白了就是在pr之前给进行全面doctor
  - ~TODO "code-review@claude-plugins-official": true,有什么区别.
    - 我感觉没什么好大的作用这个.完全没上面的功能强大啊.

- ~TODO "playwright@claude-plugins-official": true, 是什么鬼
- ~TODO "frontend-design@claude-plugins-official": 和 "playground@claude-plugins-official": true,
- ~TODO 修复声音叠声的bug

- ~TODO 发现就有的声音播放不了声音了.

- ~TODO 开发的时候 我老是要去改这个"EXPO_PUBLIC_API_URL=http://119.45.41.158:8000
  - 怎么可以做到兼容

### justfile

- 应该是直接按照天,来创建文件夹,然后把源文件+.printed
- 然后我去天的文件夹,转换为pdf
- 然后打印
- 一个show + 一个mv(提示,请手动转pdf) +

## 0416 周四

- ~TODO 为什么没有 app.json的version的变更.

- 查看后端服务
  backend 1 root 126268 126243 0 15:35 ? 00:00:00 uv run gunicorn main:app -k uvicorn.workers.UvicornWorker --workers 4 --bind 0.0.0.0:8000 --timeout 120 --graceful-timeout 30 --access-logfile - --error-logfile -
  backend 1 root 126411 126268 0 15:35 ? 00:00:01 /app/.venv/bin/python /app/.venv/bin/gunicorn main:app -k uvicorn.workers.UvicornWorker --workers 4 --bind 0.0.0.0:8000 --timeout 120 --graceful-timeout 30 --access-logfile - --error-logfile -
  backend 1 root 126414 126411 0 15:35 ? 00:00:12 /app/.venv/bin/python /app/.venv/bin/gunicorn main:app -k uvicorn.workers.UvicornWorker --workers 4 --bind 0.0.0.0:8000 --timeout 120 --graceful-timeout 30 --access-logfile - --error-logfile -
  backend 1 root 126415 126411 0 15:35 ? 00:00:13 /app/.venv/bin/python /app/.venv/bin/gunicorn main:app -k uvicorn.workers.UvicornWorker --workers 4 --bind 0.0.0.0:8000 --timeout 120 --graceful-timeout 30 --access-logfile - --error-logfile -
  backend 1 root 126416 126411 0 15:35 ? 00:00:13 /app/.venv/bin/python /app/.venv/bin/gunicorn main:app -k uvicorn.workers.UvicornWorker --workers 4 --bind 0.0.0.0:8000 --timeout 120 --graceful-timeout 30 --access-logfile - --error-logfile -
  backend 1 root 126417 126411 0 15:35 ? 00:00:12 /app/.venv/bin/python /app/.venv/bin/gunicorn main:app -k uvicorn.workers.UvicornWorker --workers 4 --bind 0.0.0.0:8000 --timeout 120 --graceful-timeout 30 --access-logfile - --error-logfile -
  backend 1 root 229695 126243 0 19:11 pts/0 00:00:00 bash

是 1 master + 4 worker = 5 个 gunicorn 进程，这是正常的：

PID 126268 → uv run（只是启动器，不算）
PID 126411 → gunicorn master（管理进程，不处理请求）
PID 126414 → worker 1 ←┐
PID 126415 → worker 2 │ 这 4 个才是真正处理请求的
PID 126416 → worker 3 │
PID 126417 → worker 4 ←┘
看父子关系（PPID）就能区分：

126411 的父进程是 126268（uv）→ 它是 master
126414-126417 的父进程都是 126411 → 它们是 worker
--workers 4 配置的是处理请求的 worker 数，master 是额外的管理进程，负责监控 worker、处理信号（reload/graceful restart）等。

- 打包
  cd apps/mobile
  npx expo prebuild --platform android --clean
  cd android
  ./gradlew clean (http要加: android:usesCleartextTraffic="true")
  ./gradlew assembleRelease
  adb install -r app/build/outputs/apk/release/app-release.apk

- docker compose logs backend
  ubuntu@VM-0-2-ubuntu:~/coco$ docker compose logs backend
  backend-1 | 运行数据库迁移...
  backend-1 | Downloading ruff (10.7MiB)
  backend-1 | Downloading pygments (1.2MiB)
  backend-1 | Downloading pyright (6.1MiB)
  backend-1 | Downloaded pygments
  backend-1 | Downloaded ruff
  backend-1 | Downloaded pyright
  backend-1 | Installed 8 packages in 160ms
  backend-1 | INFO [alembic.runtime.migration] Context impl PostgresqlImpl.
  backend-1 | INFO [alembic.runtime.migration] Will assume transactional DDL.
  backend-1 | INFO [alembic.runtime.migration] Running upgrade -> 88e885d59ac9, initial schema
  backend-1 | INFO [alembic.runtime.migration] Running upgrade 88e885d59ac9 -> 494dc00061d3, 新增同步支持
  backend-1 | INFO [alembic.runtime.migration] Running upgrade 494dc00061d3 -> 19cc71dd8594, 新增deleted_at字段
  backend-1 | INFO [alembic.runtime.migration] Running upgrade 19cc71dd8594 -> 1372fba00625, budgets_add_deleted_at
  backend-1 | INFO [alembic.runtime.migration] Running upgrade 1372fba00625 -> 02aba126b7f3, categories_add_deleted_at
  backend-1 | INFO [alembic.runtime.migration] Running upgrade 02aba126b7f3 -> 70cf418e1cad, transactions_add_account_id
  backend-1 | INFO [alembic.runtime.migration] Running upgrade 70cf418e1cad -> fd484f85b8db, chat_messages_add_audio_fields
  backend-1 | INFO [alembic.runtime.migration] Running upgrade fd484f85b8db -> f90273a4d519, record_source_add_llm
  backend-1 | INFO [alembic.runtime.migration] Running upgrade f90273a4d519 -> f39e00b5e1e0, record_source_add_notification
  backend-1 | 启动 FastAPI 服务...
  backend-1 | [2026-04-16 07:35:09 +0000] [38] [INFO] Starting gunicorn 25.3.0
  backend-1 | [2026-04-16 07:35:09 +0000] [38] [INFO] Listening at: http://0.0.0.0:8000 (38)
  backend-1 | [2026-04-16 07:35:09 +0000] [38] [INFO] Using worker: uvicorn.workers.UvicornWorker
  backend-1 | [2026-04-16 07:35:09 +0000] [39] [INFO] Booting worker with pid: 39
  backend-1 | [2026-04-16 07:35:09 +0000] [40] [INFO] Booting worker with pid: 40
  backend-1 | [2026-04-16 07:35:09 +0000] [41] [INFO] Booting worker with pid: 41
  backend-1 | [2026-04-16 07:35:09 +0000] [42] [INFO] Booting worker with pid: 42
  backend-1 | [2026-04-16 07:35:09 +0000] [38] [INFO] Control socket listening at /root/.gunicorn/gunicorn.ctl
  backend-1 | [2026-04-16 07:35:14 +0000] [42] [INFO] Started server process [42]
  backend-1 | [2026-04-16 07:35:14 +0000] [39] [INFO] Started server process [39]
  backend-1 | [2026-04-16 07:35:14 +0000] [39] [INFO] Waiting for application startup.
  backend-1 | [2026-04-16 07:35:14 +0000] [41] [INFO] Started server process [41]
  backend-1 | [2026-04-16 07:35:14 +0000] [39] [INFO] Application startup complete.
  backend-1 | [2026-04-16 07:35:14 +0000] [41] [INFO] Waiting for application startup.
  backend-1 | [2026-04-16 07:35:14 +0000] [42] [INFO] Waiting for application startup.
  backend-1 | [2026-04-16 07:35:14 +0000] [40] [INFO] Started server process [40]
  backend-1 | [2026-04-16 07:35:14 +0000] [42] [INFO] Application startup complete.
  backend-1 | [2026-04-16 07:35:14 +0000] [40] [INFO] Waiting for application startup.
  backend-1 | [2026-04-16 07:35:14 +0000] [40] [INFO] Application startup complete.
  backend-1 | [2026-04-16 07:35:14 +0000] [41] [INFO] Application startup complete.

- ~TODO 接下来给coco-ai的功能做个收尾,主要涉及:
  - ~TODO 上云
  - ~TODO 发布
    - ICP 备案（正规途径，需要 2-4 周）
- expo 注册:
  - 通过google注册
  - 点右边 "Migrate your existing app"（你已有项目），
  - npm install -g eas-cli
  - eas login

- ECC的4个步骤:
  /ecc:plan -> /ecc:tdd -> /ecc:code-review -> /ecc:verify

## 0415 周三

- ~TODO 晚5s在弹出自动记账,省的和微信/支付宝冲突,现在基本同一时刻
- ~TODO 字体
- ~TODO 现在没有自动同步了吗?
- ~TODO AItag 应该和自动记同在.
- ~TODO 52 个 warning：都是之前遗留的 @typescript-eslint/no-explicit-any 和 no-unused-vars — 遍布各个旧文件
- ~TODO 如果用户未登录,强制切换到登录页面.
  - 要在测试下
- ~TODO 删除ecc 试试gsd[不实践了.垃圾一般的存在GSD]
  - 删除了市场后 现在还有这些.
    - ~TODO ~/.claude/ecc/ ← ECC 状态文件本体
    - ~TODO ~/.claude/.agents/ ← ECC agent skills（openai.yaml 格式）
    - ~TODO ~/.claude/agents/ ← 所有 reviewer/planner/tdd-guide 等 agent
    - ~TODO ~/.claude/commands/ ← 70+ 个命令文件
    - ~TODO ~/.claude/hooks/hooks.json ← hooks 配置
    - ~TODO ~/.claude/scripts/hooks/ ← 30+ 个 hook 脚本
    - ~TODO ~/.claude/scripts/lib/ ← ECC 运行时库
    - ~TODO ~/.claude/rules/ ← 全套规则文件（common/web/python/ts 等）
    - ~TODO ~/.claude/skills/ ← framework + workflow skills
    - ~TODO ~/.claude/AGENTS.md ← ECC 装的
    - ~TODO ~/.claude/PLUGIN_SCHEMA_NOTES.md ← ECC 装的
    - ~TODO ~/.claude/plugin.json ← ECC 装的
    - ~TODO ~/.claude/marketplace.json ← ECC 装的

## 0413 & 0414

- ~TODO 体验下omega-memory ecc的记忆系统
  - 不体验了,我不打算用ecc了
- ~TODO 同步好像有点问题
- ~TODO 电量详情.

- ~TODO 把`月度报告`改成`使用帮助`
- ~TODO 自动记账
- ~TODO 继续第7章节<中间件>
- 知识点:
  - NLS:
    NLS = NotificationListenerService，Android 系统提供的一个服务，允许 App 监听其他 App
    发出的通知栏消息。就是我们自动记账功能的核心——它负责"偷听"微信/支付宝的支付通知。

  - install.sh的流程
    最终安装的 7 个模块

┌────────────────────┬──────────────────────────┐
│ 模块 │ 说明 │
├────────────────────┼──────────────────────────┤
│ rules-core │ 通用 + 各语言规则 │
├────────────────────┼──────────────────────────┤
│ agents-core │ agent 定义 │
├────────────────────┼──────────────────────────┤
│ commands-core │ 斜杠命令 │
├────────────────────┼──────────────────────────┤
│ hooks-runtime │ Hook 运行时 │
├────────────────────┼──────────────────────────┤
│ platform-configs │ MCP 配置等 │
├────────────────────┼──────────────────────────┤
│ workflow-quality │ TDD、验证、eval 等 skill │
├────────────────────┼──────────────────────────┤
│ framework-language │ 35+ 个框架/语言 skill

## 0412

- ~TODO 对接`微信`/`小红书`/`抖音`/`支付宝`/`快手`
  - ~做不了!!!现在正在开发中...
    市场调研 — 有重要发现
    资质门槛比预想的高：

    ┌────────┬──────────────────┬────────────────────┬────────────────┐
    │ 平台 │ 企业资质 │ 个人开发者 │ Expo SDK │
    ├────────┼──────────────────┼────────────────────┼────────────────┤
    │ 微信 │ 必须（300元/年） │ 不可接入 │ 有社区包 │
    ├────────┼──────────────────┼────────────────────┼────────────────┤
    │ 支付宝 │ 可选 │ 可接入（能力受限） │ 无，需 WebView │
    ├────────┼──────────────────┼────────────────────┼────────────────┤
    │ 抖音 │ 必须 │ 仅"小玩法" │ 无 │
    ├────────┼──────────────────┼────────────────────┼────────────────┤
    │ 快手 │ 必须 │ 不支持 │ 无 │
    ├────────┼──────────────────┼────────────────────┼────────────────┤
    │ 小红书 │ 必须 │ 不支持 │ 无 │
    └────────┴──────────────────┴────────────────────┴────────────────┘

  - 在执行/ecc:agent-sort

- ~TODO 布置CI/CD
- ~TODO 预算设置有bug.先添加分类预算,总预算就跟着第一个分类预算走了.

## 0411

- ~TODO sync
- ad
  - ~BUG 为什么加载广告这么久?要显示一个"加载中..."
  - ~BUG 为什么看了广告没有增加权益.
  - ~BUG 页面显示`观看广告,免费解锁高级功能` 然后就要等一段时间...
  - ~BUG ![alt text](image.png) 这个广告是什么意思,点了也没有奖励.

## 0410

- ruff 担任了2个角色,一个是formatter,一个是linter
  - 所谓formatter,讲究的是代码的样子.缩进/行宽
  - linter是指,你的代码有没有多余的,比如import 了 未使用,变量未使用
- pylance是lsp.负责类型检查,跳转定义,自动补全
  - ~TODO sync
  - ad
    - ~BUG 为什么加载广告这么久?要显示一个"加载中..."
    - ~BUG 为什么看了广告没有增加权益.
    - ~BUG 页面显示`观看广告,免费解锁高级功能` 然后就要等一段时间...
    - ~BUG ![alt text](image.png) 这个广告是什么意思,点了也没有奖励.

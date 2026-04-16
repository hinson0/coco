# todo-list

- TODO 刷面试题
  - 刷2-3个这样的面试题,主要涵盖: python+fastapi+redis+postgres等
- TODO 体验下`知识图谱`
- TODO (要企业资质) 取消广告功能.就用21天免费.然后之后可以手动记账,语音/OCR/自然语言等功能需购买VIP
  - 月10元
  - 年88元
  - 永久138元
- TODO 为什么没有 app.json的version的变更.

## 0416 周四

- TODO 接下来给coco-ai的功能做个收尾,主要涉及:
  - TODO 上云
  - TODO 发布

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
- TODO 删除ecc 试试gsd
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
    - TODO ~/.claude/marketplace.json ← ECC 装的

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

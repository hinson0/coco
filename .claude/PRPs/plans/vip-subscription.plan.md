# Plan: VIP 订阅系统

## Summary

将 CoCo 记账 App 从「看广告获取权益」变现模式切换为「21 天免费试用 + VIP 订阅」模式。后端增加 Pro 状态字段和试用期判断 API，前端实现 `useIsPro` hook 替换现有权益检查逻辑，接入 iOS IAP 和 Android 微信/支付宝支付，并修复现有权益门控遗漏。

## User Story

As a 有记账习惯的懒人用户,
I want 在 21 天免费体验后购买 VIP 解锁 AI 记账功能,
So that 我可以用最少操作完成记账，同时 App 有可持续的盈利模式。

## Problem → Solution

当前：看广告获取权益（无广告资质无法变现）→ 目标：21 天试用 + VIP 订阅（iOS IAP / Android 微信支付宝）

## Metadata

- **Complexity**: Large
- **Source PRD**: 对话中生成（未落盘）
- **PRD Phase**: Phase 1（后端 Pro 状态）+ Phase 2（前端 useIsPro）+ Phase 5（试用到期引导）
- **Estimated Files**: 12-15 files

---

## UX Design

### Before

```
┌─────────────────────────────────┐
│  用户使用 AI 功能（语音/OCR）     │
│        ↓                         │
│  检查权益余额 → 余额 > 0 → 使用  │
│                → 余额 = 0 → 弹窗 │
│        ↓                         │
│  "去看广告" / "升级 Pro(开发中)"  │
│        ↓                         │
│  看激励视频 → 获得 1 次权益       │
└─────────────────────────────────┘
```

### After

```
┌─────────────────────────────────┐
│  新用户注册 → 自动获得 21 天试用  │
│        ↓                         │
│  试用期内：所有 AI 功能无限使用   │
│        ↓                         │
│  第 21 天到期 → 硬切断 AI 功能   │
│        ↓                         │
│  手动记账正常 / AI 功能 → 升级页  │
│        ↓                         │
│  选择套餐 → IAP/微信/支付宝支付  │
│        ↓                         │
│  VIP 激活 → 所有功能无限使用     │
└─────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| AI 功能入口（语音/OCR） | 检查权益余额 | 检查 isPro（试用中或已购买） | 2 处 TODO 已标记 |
| 权益不足弹窗 | "去看广告" + "升级 Pro" | 仅 "升级 Pro"（广告按钮隐藏） | EntitlementGate.tsx |
| bills tab（广告页） | 看激励视频获取权益 | Pro 用户显示"已是 Pro" / 非 Pro 显示升级引导 | 整个 tab 内容替换 |
| 开屏广告 | 每次冷启动/恢复都展示 | Pro 用户跳过 | _layout.tsx 行 92 |
| 升级页 CTA | Alert("开发中") | 触发 IAP 购买流程 | upgrade-pro.tsx |
| 升级页定价 | 年138/月15 | 月10/年88/永久138 | 定价需修正 |
| ad-rewards 页 | 显示广告观看次数和权益余额 | 替换为 Pro 状态展示 | 或直接隐藏/重定向 |
| profile 菜单 | "广告收益" 入口 | 非 Pro 显示 "升级 Pro" / Pro 隐藏广告入口 | profile.tsx |

---

## Mandatory Reading

Files that MUST be read before implementing:

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `apps/mobile/hooks/useEntitlement.ts` | 108-127 | `useCheckAndConsume` 核心 + TODO: Pro check |
| P0 | `apps/mobile/app/_layout.tsx` | 89-123 | 开屏广告 + TODO: Pro 用户检查 |
| P0 | `apps/mobile/app/upgrade-pro.tsx` | all | 升级页 UI，需修改定价和接入支付 |
| P0 | `apps/backend/infra/security.py` | all | JWT 生成逻辑，需扩展 payload |
| P0 | `apps/backend/routers/auth.py` | all | 登录/注册，需返回 Pro 状态 |
| P1 | `apps/mobile/lib/entitlements/rewards.ts` | all | 权益定义和类型 |
| P1 | `apps/mobile/components/shared/EntitlementGate.tsx` | all | 权益不足弹窗 |
| P1 | `apps/mobile/app/(tabs)/bills.tsx` | all | 广告播放页，需替换内容 |
| P1 | `apps/mobile/app/(tabs)/profile.tsx` | 220-240 | Pro 和广告菜单入口 |
| P1 | `apps/backend/schemas/auth.py` | all | Pydantic schemas |
| P2 | `apps/backend/alembic/versions/f90273a4d519_record_source_add_llm.py` | all | 最新迁移，了解 down_revision |
| P2 | `apps/mobile/app/ad-rewards.tsx` | all | 广告收益详情页 |
| P2 | `apps/mobile/app/index.tsx` | 390-410 | ASR/OCR 调用处（缺少权益检查） |

---

## Patterns to Mirror

### NAMING_CONVENTION

```ts
// SOURCE: apps/mobile/hooks/useEntitlement.ts:1
// Hook 文件：use + PascalCase，如 useEntitlement.ts, useAuth.ts
// Hook 函数：export function useCamelCase()
// Query key：const UPPER_SNAKE_KEY = ["kebab-case"];
export const ENTITLEMENT_KEY = ["entitlements"];
```

### ERROR_HANDLING

```python
# SOURCE: apps/backend/routers/auth.py:30-32
# 后端错误：直接 raise HTTPException，不自定义异常类
if existing:
    raise HTTPException(status_code=400, detail="Email already registered")
```

### MIGRATION_PATTERN

```python
# SOURCE: apps/backend/alembic/versions/f90273a4d519_record_source_add_llm.py
# 迁移：全部使用 op.execute() 裸 SQL，始终 IF NOT EXISTS / IF EXISTS
def upgrade() -> None:
    op.execute("ALTER TYPE record_source ADD VALUE IF NOT EXISTS 'llm'")

def downgrade() -> None:
    # PostgreSQL 不支持 DROP VALUE from ENUM
    pass
```

### ROUTER_PATTERN

```python
# SOURCE: apps/backend/routers/auth.py:16-17
# Router 声明：模块内定义 prefix 和 tags
router = APIRouter(prefix="/auth", tags=["auth"])
```

### DYNAMIC_REQUIRE_PATTERN

```ts
// SOURCE: apps/mobile/app/_layout.tsx:13-22
// 可选原生模块用 try/catch require，Expo Go 兼容
let GoogleAds: typeof import("react-native-google-mobile-ads") | null = null;
try {
  GoogleAds = require("react-native-google-mobile-ads");
} catch {
  // Expo Go: google-mobile-ads unavailable
}
```

### REACT_QUERY_PATTERN

```ts
// SOURCE: apps/mobile/hooks/useEntitlement.ts:19-26
// useQuery + queryKey 常量，useMutation + invalidateQueries
export function useEntitlements() {
  const { db } = useOfflineContext();
  return useQuery({
    queryKey: ENTITLEMENT_KEY,
    queryFn: () => getAllEntitlements(db!),
    enabled: !!db,
  });
}
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/backend/alembic/versions/xxx_add_pro_fields.py` | CREATE | 新增迁移：users 表加 pro_expires_at, trial_started_at 字段 |
| `apps/backend/schemas/auth.py` | UPDATE | TokenResponse 增加 pro_status 字段 |
| `apps/backend/routers/auth.py` | UPDATE | 登录/注册/refresh 返回 Pro 状态 |
| `apps/backend/infra/security.py` | UPDATE | JWT payload 增加 created_at 用于试用期计算 |
| `apps/mobile/hooks/usePro.ts` | CREATE | 新建 useIsPro hook，统一 Pro 状态判断 |
| `apps/mobile/hooks/useEntitlement.ts` | UPDATE | useCheckAndConsume 接入 Pro 判断 |
| `apps/mobile/app/_layout.tsx` | UPDATE | 开屏广告跳过 Pro 用户 |
| `apps/mobile/app/upgrade-pro.tsx` | UPDATE | 修正定价（月10/年88/永久138）+ 接入支付 |
| `apps/mobile/components/shared/EntitlementGate.tsx` | UPDATE | 非 Pro 隐藏"去看广告"按钮 |
| `apps/mobile/app/(tabs)/bills.tsx` | UPDATE | Pro 用户替换广告页内容 |
| `apps/mobile/app/(tabs)/profile.tsx` | UPDATE | Pro 用户隐藏"广告收益"入口 |
| `apps/mobile/app/ad-rewards.tsx` | UPDATE | Pro 用户替换内容展示 |
| `apps/mobile/app/index.tsx` | UPDATE | ASR/OCR 调用前增加权益检查（修复遗漏） |
| `apps/mobile/components/profile/ExportSheet.tsx` | UPDATE | CSV 导出前增加权益检查（修复遗漏） |

## NOT Building

- Apple IAP 和 Android 微信/支付宝的支付 SDK 接入（Phase 3、4，本计划不含）
- 自动记账功能（另一分支开发）
- 删除广告模块代码（保留 expo-pangle 和 google-mobile-ads）
- 优惠券 / 促销系统
- 到期前推送提醒（Could，后续做）
- 老用户迁移策略（Open Question，暂不处理）

---

## Step-by-Step Tasks

### Task 1: 后端 Alembic 迁移 — users 表增加 Pro 字段

- **ACTION**: 创建新迁移文件，给 `users` 表增加 `pro_expires_at` 和 `trial_started_at` 字段
- **IMPLEMENT**:
  ```python
  # upgrade
  op.execute("""
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS trial_started_at timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS pro_expires_at   timestamptz DEFAULT NULL;
  """)
  # trial_started_at: 注册时自动设为 now()，用于计算 21 天试用期
  # pro_expires_at: NULL = 非 Pro / 永久会员用特殊值如 '9999-12-31'
  # 对已有用户，trial_started_at DEFAULT now() 会让他们也获得 21 天（待定）
  
  # downgrade
  op.execute("""
    ALTER TABLE users
      DROP COLUMN IF EXISTS trial_started_at,
      DROP COLUMN IF EXISTS pro_expires_at;
  """)
  ```
- **MIRROR**: MIGRATION_PATTERN — 裸 SQL + IF NOT EXISTS
- **IMPORTS**: `from alembic import op`
- **GOTCHA**: `down_revision` 必须指向当前 HEAD `f90273a4d519`
- **VALIDATE**: `cd apps/backend && alembic upgrade head` 无报错

### Task 2: 后端 schemas — 扩展 TokenResponse

- **ACTION**: 在 `schemas/auth.py` 的 `TokenResponse` 中增加 Pro 状态字段
- **IMPLEMENT**:
  ```python
  class ProStatus(BaseModel):
      is_pro: bool                    # 当前是否有 Pro 权限（试用中或已购买）
      is_trial: bool                  # 是否在试用期
      trial_days_left: int            # 试用剩余天数（非试用为 0）
      pro_expires_at: str | None      # VIP 到期时间 ISO 格式（None = 非 Pro）

  class TokenResponse(BaseModel):
      access_token: str
      refresh_token: str
      token_type: str = "bearer"
      pro_status: ProStatus           # 新增
  ```
- **MIRROR**: 现有 `TokenResponse` 风格（flat Pydantic model）
- **IMPORTS**: 无新增
- **GOTCHA**: `pro_expires_at` 用 `str | None` 而非 `datetime`，保持 JSON 序列化简单
- **VALIDATE**: Python import 不报错

### Task 3: 后端 auth router — 登录/注册返回 Pro 状态

- **ACTION**: 修改 `routers/auth.py` 的 login/register/refresh 端点，查询并返回 Pro 状态
- **IMPLEMENT**:
  ```python
  # 新增辅助函数
  async def get_pro_status(session: AsyncSession, user_id: str) -> ProStatus:
      result = await session.execute(
          text("SELECT created_at, trial_started_at, pro_expires_at FROM users WHERE id = :id"),
          {"id": user_id},
      )
      row = result.mappings().one()
      trial_start = row["trial_started_at"] or row["created_at"]
      now = datetime.now(UTC)
      trial_end = trial_start + timedelta(days=21)
      is_trial = now < trial_end
      trial_days_left = max(0, (trial_end - now).days) if is_trial else 0
      
      pro_exp = row["pro_expires_at"]
      is_paid_pro = pro_exp is not None and (pro_exp.year == 9999 or now < pro_exp)
      
      return ProStatus(
          is_pro=is_trial or is_paid_pro,
          is_trial=is_trial and not is_paid_pro,
          trial_days_left=trial_days_left,
          pro_expires_at=pro_exp.isoformat() if pro_exp else None,
      )
  ```
  - 在 login 和 refresh 端点中调用 `get_pro_status()`，填入 `TokenResponse.pro_status`
  - register 端点返回 201 不变（注册后需登录获取 token）
- **MIRROR**: ROUTER_PATTERN + ERROR_HANDLING
- **IMPORTS**: `from datetime import datetime, timedelta, UTC`
- **GOTCHA**: 永久会员用 `pro_expires_at = '9999-12-31'` 表示，判断时 `year == 9999` 即永久
- **VALIDATE**: `POST /auth/login` 返回 `pro_status` 字段

### Task 4: 后端新增 /auth/pro-status 端点

- **ACTION**: 新增独立端点供前端随时查询最新 Pro 状态（不只在登录时获取）
- **IMPLEMENT**:
  ```python
  @router.get("/pro-status", response_model=ProStatus)
  async def pro_status(
      user_id: str = Depends(get_current_user),
      session: AsyncSession = Depends(get_db),
  ):
      return await get_pro_status(session, user_id)
  ```
- **MIRROR**: ROUTER_PATTERN
- **IMPORTS**: 复用 Task 3 的 `get_pro_status`
- **GOTCHA**: 需要 access_token 认证
- **VALIDATE**: `GET /auth/pro-status` 带 Bearer token 返回正确状态

### Task 5: 前端 usePro hook — 统一 Pro 状态判断

- **ACTION**: 创建 `apps/mobile/hooks/usePro.ts`，提供统一的 Pro 状态查询
- **IMPLEMENT**:
  ```ts
  // 核心逻辑：
  // 1. 从 useAuth 获取登录时返回的 pro_status
  // 2. 本地基于 created_at 计算试用期（离线可用）
  // 3. 提供 useIsPro() → boolean 和 useProStatus() → ProStatus
  //
  // 离线优先策略：
  // - 已登录用户：以服务端返回为准，定期刷新
  // - 未登录/离线：以本地 user_profiles.created_at 计算试用期
  // - Pro 状态缓存到 AsyncStorage，避免每次请求
  ```
- **MIRROR**: REACT_QUERY_PATTERN
- **IMPORTS**: `useAuth`, `useQuery`, `AsyncStorage`
- **GOTCHA**: 必须支持离线场景（SQLite 本地判断）；试用期计算用 UTC
- **VALIDATE**: hook 在试用期内返回 `isPro=true`，过期后返回 `false`

### Task 6: 前端 useCheckAndConsume — 接入 Pro 判断

- **ACTION**: 修改 `hooks/useEntitlement.ts` 行 115 的 TODO
- **IMPLEMENT**:
  ```ts
  // 行 115 替换：
  // 原: // TODO: Pro check — Pro 用户直接返回 true
  // 新:
  const isPro = await getIsProFromCache(); // 同步读取缓存的 Pro 状态
  if (isPro) return true;
  ```
- **MIRROR**: 现有 `useCheckAndConsume` 风格
- **IMPORTS**: 从 `usePro` 导入 Pro 状态检查函数
- **GOTCHA**: `useCheckAndConsume` 返回的是 `useCallback`，内部不能用 hook，需要用纯函数读取 Pro 状态
- **VALIDATE**: Pro 用户调用 `checkAndConsume("asr")` 返回 true 且不扣减余额

### Task 7: 前端 _layout.tsx — 开屏广告跳过 Pro 用户

- **ACTION**: 修改 `app/_layout.tsx` 行 92 的 TODO
- **IMPLEMENT**:
  ```ts
  // 行 92 替换：
  // 原: // TODO: Pro 用户检查
  // 新:
  if (await getIsProFromCache()) return; // Pro 用户跳过开屏广告
  ```
- **MIRROR**: 现有 `tryShowSplash` 函数风格
- **IMPORTS**: 从 `usePro` 导入
- **GOTCHA**: `tryShowSplash` 是 `useCallback`，同样不能用 hook
- **VALIDATE**: Pro 用户冷启动不弹开屏广告

### Task 8: 前端 upgrade-pro.tsx — 修正定价

- **ACTION**: 更新 `upgrade-pro.tsx` 的定价为 月10/年88/永久138，增加永久选项
- **IMPLEMENT**:
  ```ts
  // 原：年138/月15，两档
  // 新：月10/年88/永久138，三档
  const [plan, setPlan] = useState<"monthly" | "yearly" | "lifetime">("yearly");
  // 月: ¥10/月（≈¥0.33/天）
  // 年: ¥88/年（≈¥0.24/天）— 推荐
  // 永久: ¥138 一次性
  ```
- **MIRROR**: 现有卡片 UI 风格（选中态左侧绿色竖条 + sage 边框）
- **IMPORTS**: 无新增
- **GOTCHA**: CTA 按钮文案需根据选择变化（"立即开通 月会员" / "立即开通 年会员" / "一次性买断"）
- **VALIDATE**: 页面展示三档定价，默认选中年会员

### Task 9: 前端 EntitlementGate — 隐藏广告按钮

- **ACTION**: 修改 `components/shared/EntitlementGate.tsx`，移除"去看广告"按钮
- **IMPLEMENT**:
  ```ts
  // 非 Pro 用户权益不足时，只显示 "升级 Pro" 按钮
  // 移除或隐藏 "🎬 去看广告" 按钮
  // 因为试用期内不会触发此弹窗（isPro=true），
  // 试用期后广告不再是获取权益的途径
  ```
- **MIRROR**: 现有弹窗 UI 风格
- **IMPORTS**: 无新增
- **GOTCHA**: 广告模块代码保留但不再作为获取权益的入口
- **VALIDATE**: 权益不足弹窗只显示"升级 Pro"按钮

### Task 10: 前端 bills tab — Pro 用户内容替换

- **ACTION**: 修改 `app/(tabs)/bills.tsx`，Pro 用户显示 Pro 状态页而非广告播放器
- **IMPLEMENT**:
  ```ts
  // if (isPro) return <ProStatusView />
  // ProStatusView: 显示当前 Pro 状态（试用中/VIP有效期），
  // 显示已解锁的功能列表，不显示广告播放器
  //
  // if (!isPro) return <UpgradePromptView />
  // 试用过期后引导升级，不再显示广告播放器
  ```
- **MIRROR**: 现有 bills.tsx 的页面结构（ScrollView + SafeAreaView）
- **IMPORTS**: `usePro`
- **GOTCHA**: tab 图标和标题可能需要改（从"收益"改为"会员"或类似）
- **VALIDATE**: Pro 用户看到状态页，非 Pro 用户看到升级引导

### Task 11: 前端 profile — 调整菜单入口

- **ACTION**: 修改 `app/(tabs)/profile.tsx`，Pro 用户隐藏"广告收益"，调整"升级Pro"显示
- **IMPLEMENT**:
  ```ts
  // Pro 用户：显示 "Pro 会员" + 到期时间（或"永久"）
  // 非 Pro 用户：显示 "升级 Pro" + badge
  // 所有用户：隐藏 "广告收益" 入口（因为广告模式不再使用）
  ```
- **MIRROR**: 现有 MenuItem 组件风格
- **IMPORTS**: `usePro`
- **GOTCHA**: 保持 Badge 组件的 `"pro"` 变体样式
- **VALIDATE**: Pro 用户看到会员状态，非 Pro 看到升级入口

### Task 12: 修复遗漏 — ASR/OCR 权益检查

- **ACTION**: 在 `app/index.tsx` 的 `sendAsr`/`sendOcr` 调用前增加 `checkAndConsume` 检查
- **IMPLEMENT**:
  ```ts
  // sendOcr 前：
  const canUse = await checkAndConsume("ocr");
  if (!canUse) { showEntitlementGate("ocr"); return; }
  
  // sendAsr 前：
  const canUse = await checkAndConsume("asr");
  if (!canUse) { showEntitlementGate("asr"); return; }
  ```
- **MIRROR**: `accounts.tsx` 行 128-136 的权益检查模式
- **IMPORTS**: `useCheckAndConsume` from `useEntitlement`
- **GOTCHA**: Pro 用户因 Task 6 已在 `checkAndConsume` 中返回 true，这里无需额外判断
- **VALIDATE**: 非 Pro 用户权益为 0 时，点语音/OCR 弹出 EntitlementGate

### Task 13: 修复遗漏 — CSV 导出权益检查

- **ACTION**: 在 `ExportSheet.tsx` 或 `profile.tsx` 的导出按钮点击时检查 `csv_export` 权益
- **IMPLEMENT**:
  ```ts
  // profile.tsx 中 setExportVisible(true) 之前：
  const canExport = await checkAndConsume("csv_export");
  if (!canExport) { showEntitlementGate("csv_export"); return; }
  setExportVisible(true);
  ```
- **MIRROR**: `accounts.tsx` 行 128-136 的权益检查模式
- **IMPORTS**: `useCheckAndConsume`
- **GOTCHA**: Pro 用户自动通过检查
- **VALIDATE**: 非 Pro 用户权益为 0 时，点导出弹出 EntitlementGate

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `get_pro_status` — 新用户试用中 | user created 5 天前 | `is_pro=true, is_trial=true, trial_days_left=16` | No |
| `get_pro_status` — 试用过期 | user created 25 天前 | `is_pro=false, is_trial=false, trial_days_left=0` | No |
| `get_pro_status` — 月会员有效 | pro_expires_at 15 天后 | `is_pro=true, is_trial=false` | No |
| `get_pro_status` — 永久会员 | pro_expires_at = 9999-12-31 | `is_pro=true, is_trial=false` | Yes |
| `get_pro_status` — 会员过期 | pro_expires_at 5 天前 | `is_pro=false` | No |
| `get_pro_status` — 试用过期但有会员 | created 30 天前, pro_expires_at 10 天后 | `is_pro=true, is_trial=false` | Yes |
| `useCheckAndConsume` — Pro 跳过 | isPro=true, feature="asr" | return true, balance 不变 | No |
| `useCheckAndConsume` — 非 Pro 余额 0 | isPro=false, balance=0 | return false | No |

### Edge Cases Checklist

- [ ] 用户恰好在第 21 天（边界值）
- [ ] 用户设备时间被手动修改（时钟偏移）
- [ ] 用户离线状态下试用到期
- [ ] 永久会员的 pro_expires_at 格式一致性
- [ ] 用户从未登录（纯离线使用）— 试用期基于本地 created_at
- [ ] JWT 中的 Pro 状态与数据库不一致（以数据库为准）

---

## Validation Commands

### Database Migration

```bash
cd apps/backend && alembic upgrade head
```
EXPECT: Migration 成功，users 表新增 trial_started_at 和 pro_expires_at 列

### Backend API

```bash
cd apps/backend && uv run uvicorn main:app --reload
# 然后测试：
curl -X POST localhost:8000/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test"}'
```
EXPECT: 返回 JSON 包含 `pro_status` 字段

### Frontend Type Check

```bash
cd apps/mobile && npx tsc --noEmit
```
EXPECT: 无类型错误

### Dev Server

```bash
pnpm dev
```
EXPECT: App 正常启动，Pro 状态正确展示

### Manual Validation

- [ ] 新注册用户看到 21 天试用标识
- [ ] 试用期内所有 AI 功能正常使用（不扣余额）
- [ ] 试用期内开屏广告仍然跳过（Pro 状态）
- [ ] 试用过期后 AI 功能被锁定
- [ ] 试用过期后手动记账正常
- [ ] 权益不足弹窗只显示"升级 Pro"
- [ ] upgrade-pro 页面显示三档定价（月10/年88/永久138）
- [ ] profile 页面正确显示 Pro 状态或升级入口

---

## Acceptance Criteria

- [ ] 后端 users 表有 trial_started_at 和 pro_expires_at 字段
- [ ] 登录 API 返回 pro_status
- [ ] /auth/pro-status 端点可用
- [ ] useIsPro hook 正确判断试用期和 VIP 状态
- [ ] useCheckAndConsume Pro 用户直接返回 true
- [ ] 开屏广告跳过 Pro 用户
- [ ] upgrade-pro 定价修正为 月10/年88/永久138
- [ ] EntitlementGate 隐藏广告按钮
- [ ] bills tab 替换为 Pro 状态/升级引导
- [ ] ASR/OCR/CSV 导出权益检查遗漏已修复
- [ ] 所有验证命令通过

## Completion Checklist

- [ ] 代码遵循发现的模式（裸 SQL 迁移、React Query hooks、动态 require）
- [ ] 错误处理匹配代码库风格（HTTPException）
- [ ] 不可变数据模式（Pydantic model）
- [ ] 无硬编码值（试用天数用常量）
- [ ] 无不必要的作用域扩展
- [ ] 自包含 — 实现过程中无需额外搜索代码库

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 离线场景下 Pro 状态不准确 | M | M | 本地缓存 + 上线同步，以服务端为权威来源 |
| 用户改系统时间绕过试用期 | L | L | 服务端二次验证，离线场景下可容忍 |
| 已有用户 trial_started_at 默认 now() | M | M | 标记为 Open Question，暂按新用户处理 |
| bills tab 替换后 tab 命名混淆 | L | L | 重命名 tab 为"会员"或保持但改内容 |

## Notes

- **支付 SDK 不在本计划范围**：upgrade-pro.tsx 的 CTA 在本阶段改为引导用户联系开发者 / 显示"即将上线"，支付接入在 Phase 3/4 中实现
- **广告代码保留不删除**：仅在 UI 层隐藏/替换，底层 google-mobile-ads 模块和权益获取逻辑保持不动
- **定价不一致**：现有 UI 的年138/月15 需修正为用户指定的月10/年88/永久138
- **永久会员**：用 `pro_expires_at = '9999-12-31T23:59:59Z'` 表示，前端判断 year >= 9999 即永久

---

*Generated: 2026-04-13*
*Phases covered: 1 (后端 Pro 状态) + 2 (前端 useIsPro) + 5 (试用到期引导)*

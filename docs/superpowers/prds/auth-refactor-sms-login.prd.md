# 登录功能重构：注册即登录 + 短信验证码登录

> 日期：2026-04-16
> 状态：设计完成，待实现

## 概述

重构现有认证系统，解决两个问题：
1. 注册成功后需要重复登录 → 注册即登录
2. 只支持邮箱登录 → 增加手机号短信验证码登录（腾讯云 SMS）

两种登录方式并行共存，用户可在个人页绑定另一种登录方式。

## 数据模型变更

### users 表扩展

```sql
ALTER TABLE users
  ADD COLUMN phone text UNIQUE,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN password DROP NOT NULL,
  ADD CONSTRAINT users_email_or_phone_check
    CHECK (email IS NOT NULL OR phone IS NOT NULL);
```

- `phone`：手机号（nullable，unique），中国大陆 11 位
- `email` 变为 nullable（手机号注册用户可能没有邮箱）
- `password` 变为 nullable（手机号登录不需要密码）
- CHECK 约束：`email` 和 `phone` 至少有一个非空

### 新增 sms_codes 表

```sql
CREATE TABLE sms_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      text NOT NULL,
  code       text NOT NULL,
  expires_at timestamptz NOT NULL,
  used       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sms_codes_phone ON sms_codes(phone);
```

- 6 位数字验证码
- 有效期 5 分钟
- `used` 防止重复使用

## 后端 API 变更

### 修改：POST `/auth/register`

- 行为变更：注册成功后直接返回 token（不再只返回 `{message: "registered"}`）
- 响应：`TokenResponse { access_token, refresh_token, token_type }`

### 新增：GET `/auth/me`（需认证）

- 返回当前用户信息：`{ id, email, phone }`
- 用于前端获取完整用户资料（包括绑定状态）

### 新增：POST `/auth/sms/send`

- 请求：`{ "phone": "1381234xxxx" }`
- 流程：
  1. 校验手机号格式（11 位中国大陆号码）
  2. 频率限制：同一手机号 60 秒内不能重复发送
  3. 每日上限：同一手机号每天最多 10 条
  4. 生成 6 位随机数字验证码
  5. 写入 `sms_codes` 表（expires_at = now + 5 min）
  6. 调用腾讯云 SMS API 发送
- 响应：`{ "message": "验证码已发送" }`

### 新增：POST `/auth/sms/verify`

- 请求：`{ "phone": "1381234xxxx", "code": "123456" }`
- 流程：
  1. 查 `sms_codes` 表：匹配 phone + code + 未过期 + 未使用
  2. 验证失败次数检查：连续 5 次失败则锁定 15 分钟
  3. 标记验证码为已使用
  4. 查 `users` 表：
     - 手机号已存在 → 签发 token（登录）
     - 手机号不存在 → 创建用户（只有 phone，email/password 为 null）→ 签发 token（注册+登录）
- 响应：`TokenResponse { access_token, refresh_token, token_type }`

### 新增：POST `/auth/bind/phone`（需认证）

- 请求：`{ "phone": "1381234xxxx", "code": "123456" }`
- 前置：先调 `/auth/sms/send` 获取验证码
- 流程：验证验证码 → 检查手机号未被其他账户占用 → 更新当前用户的 phone 字段
- 错误：手机号已被占用返回 400

### 新增：POST `/auth/bind/email`（需认证）

- 请求：`{ "email": "xxx@xx.com", "password": "xxx" }`
- 流程：检查邮箱未被占用 → hash 密码 → 更新当前用户的 email + password 字段
- 错误：邮箱已被占用返回 400

## 腾讯云 SMS 集成

### 新增模块：`infra/sms.py`

- 使用 `tencentcloud-sdk-python` 的 SMS 模块
- 封装 `send_sms_code(phone: str, code: str) -> bool`

### 环境变量配置

```
TENCENT_SECRET_ID=xxx
TENCENT_SECRET_KEY=xxx
SMS_APP_ID=xxx
SMS_SIGN_NAME=xxx          # 短信签名，如"CoCo记账"
SMS_TEMPLATE_ID=xxx        # 验证码模板 ID
```

### 腾讯云控制台准备（需手动完成）

1. 开通短信服务
2. 创建短信签名
3. 创建验证码模板（如"您的验证码为{1}，{2}分钟内有效"）
4. 获取 SecretId、SecretKey、AppId

## 前端变更

### 登录页重构

Tab 切换布局，默认展示手机号 Tab：

- **手机号 Tab**：手机号输入 + 验证码输入 + 发送按钮（60s 倒计时）+ 登录按钮
- **邮箱 Tab**：保持现有邮箱+密码表单，底部"注册"链接

### 注册页修改

- 去掉虚假的"请检查邮箱验证" Alert
- 注册成功后直接跳转首页（后端已返回 token）

### useAuth Hook 扩展

新增方法：
- `sendSmsCode(phone: string): Promise<void>`
- `smsSignIn(phone: string, code: string): Promise<void>`

### auth.ts 新增函数

- `sendSmsCode(phone)` — POST `/auth/sms/send`
- `smsLogin(phone, code)` — POST `/auth/sms/verify`，存储 token

### user 信息扩展

- user 类型增加 `phone?: string` 字段
- 登录后调用 `GET /auth/me` 获取完整用户信息
- AsyncStorage 增加 `user_phone` 存储

### 个人页绑定入口

- 显示当前绑定状态
- "绑定手机号"按钮（邮箱用户）→ 输入手机号 + 验证码
- "绑定邮箱"按钮（手机号用户）→ 输入邮箱 + 密码

## 安全策略

| 策略 | 规则 |
|------|------|
| 发送频率 | 同一手机号 60 秒内只能发一次 |
| 每日上限 | 同一手机号每天最多 10 条 |
| 验证码有效期 | 5 分钟 |
| 单次使用 | 验证成功后标记 used = true |
| 错误锁定 | 连续验证失败 5 次，锁定 15 分钟 |
| 绑定冲突 | 手机号/邮箱已被其他账户占用时返回 400，不做自动合并 |
| 过期清理 | 定期清理 sms_codes 表中过期记录 |

## 不在本次范围内

- 运营商一键登录（SDK 集成复杂）
- 邮箱验证（发验证邮件）
- 账号合并（两个独立账号合为一个）
- 国际手机号支持（只支持中国大陆 +86）

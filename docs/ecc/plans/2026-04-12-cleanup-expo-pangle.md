# 清理废弃的 expo-pangle 模块

**日期：** 2026-04-12
**分支：** feat/mango-ad
**状态：** ✅ 已完成

## 背景

`modules/expo-pangle/` 是之前接入穿山甲广告 SDK 时创建的 Expo Native Module。后来广告方案改为 AdMob，再改为芒果聚合广告，穿山甲模块已完全废弃。

## 清理前验证

- 代码中零 import/require 引用
- `app.json` 无 pangle plugin 配置
- `package.json` 无 expo-pangle 依赖
- 仅在 `docs/ecc/plans/2026-04-12-mango-ad.md` 中作为"参考架构"被提及（无功能影响）

## 删除的文件（9 个）

```
modules/expo-pangle/
├── expo-module.config.json
├── src/
│   ├── ExpoPangle.ts
│   └── ExpoPangle.types.ts
├── ios/
│   ├── ExpoPangle.podspec
│   └── ExpoPangleModule.swift
├── android/
│   ├── build.gradle.kts
│   ├── src/main/AndroidManifest.xml
│   └── src/main/java/expo/modules/pangle/ExpoPangleModule.kt
└── plugin/
    └── withPangle.ts
```

## 影响范围

无。零引用，零依赖。

## 附：modules/ vs packages/ 目录说明

| | `packages/` | `modules/` |
|---|---|---|
| 用途 | 共享 TS/JS 包 | Expo Native Module（原生桥接） |
| 内容 | 纯 TypeScript | Swift + Kotlin + TS + Config Plugin |
| package.json | 有 | 没有 |
| pnpm workspace | 管理（`packages/*`） | 不管理 |
| 引用方式 | `"workspace:*"` | `app.json` 相对路径 / `expo-module.config.json` 自动发现 |
| 构建 | tsc | Expo prebuild → Xcode/Gradle |

**结论：** `modules/` 是 Expo 项目惯例，不应合并到 `packages/`。

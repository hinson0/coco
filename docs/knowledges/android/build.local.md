下面是一份本地打包速查（不走 EAS 云），全部在 apps/mobile/ 下执行。

0. 前置一次性

cd /Users/a114514/coco/apps/mobile
pnpm install # 装 JS 依赖
npx expo prebuild # 首次 / 原生配置变更时，生成 ios/ android/

## 还有一个同样的清除命令:

加上 --clean 参数（如 npx expo prebuild --clean）意味着完全删除现有的 ios/ 和 android/ 目录，
然后从零开始重新生成。这能确保获得一个与当前配置完全一致的、干净的原生项目，常用于解决一些棘手的构建问题。
但请注意，这会覆盖掉你手动在 ios/ 和 android/ 目录里做的任何修改。

1. Android 本地打 release 并装到真机

# 连一台真机（开启 USB 调试）后：

npx expo run:android --variant release --device

# 只产物、不自动装：

cd android && ./gradlew assembleRelease

# 产物: android/app/build/outputs/apk/release/app-release.apk

adb install -r android/app/build/outputs/apk/release/app-release.apk

生成 aab（上架用）：

cd android && ./gradlew bundleRelease

# 产物: android/app/build/outputs/bundle/release/app-release.aab

2. iOS 本地打 release（需要 Mac + Xcode）

npx expo run:ios --configuration Release --device # 真机
npx expo run:ios --configuration Release # 模拟器

# Xcode 手动归档（上架/ad-hoc）: 打开 ios/<project>.xcworkspace → Product → Archive

3. 只导出 JS Bundle（OTA、调试、校验环境变量内联结果）

npx expo export # 默认：web + 通用 JS
npx expo export -p android # 仅 Android bundle
npx expo export -p ios # 仅 iOS bundle

# 产物在 dist/

校验 .env 是否真被打进 bundle：

npx expo export -p android
grep -oE "api\.cocoai\.chat|119\.45\.41\.158" dist/\_expo/static/js/android/_.hbc 2>/dev/null \
 || grep -oE "api\.cocoai\.chat|119\.45\.41\.158" dist/\_expo/static/js/android/_.js

4. 常见清理（打包异常时）

# JS / Metro 缓存

pnpm start --clear # Metro
rm -rf node_modules .expo && pnpm install

# Android

cd android && ./gradlew clean && cd ..

# iOS

cd ios && rm -rf build Pods && pod install && cd ..

# 一步清掉 prebuild 产物重新生成

npx expo prebuild --clean

5. 体检

npx expo-doctor # 检查依赖版本、配置冲突

---

★ Insight ─────────────────────────────────────

- EXPO*PUBLIC*\* 是 构建时 内联的：Metro 在打 bundle 时把 process.env.EXPO_PUBLIC_API_URL 替换成字符串常量 —— 改 .env 必须重打
  bundle 才生效，热重载不行。校验内联结果的那条 grep 就是用来排查"改了 .env 却没生效"这类 bug 的。
- expo run:ios/android = prebuild + 原生编译 + 装机，一条命令搞定，但严格要求本机装 Xcode/Android SDK。云端 EAS build
  的价值就是让你跳过本地原生环境。
- --variant release (Android) 和 --configuration Release (iOS) 才让 **DEV**=false —— 这是你 lib/config.ts 分流 prod/dev URL
  的关键，调试时请务必用这俩 flag 验 prod 链路。
  ─────────────────────────────────────────────────

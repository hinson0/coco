// modules/expo-mango-ad/ios/ExpoMangoAdModule.swift
//
// 芒果聚合广告 iOS 原生模块
// TODO: 拿到芒果 SDK 后，替换 mock 实现为真实 SDK 调用
//
// 当前为 mock 实现：所有广告请求直接返回成功，用于在等待 SDK 期间跑通 JS 层逻辑。

import ExpoModulesCore

public class ExpoMangoAdModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoMangoAd")

    Events("onAdLoaded", "onAdClosed", "onAdError")

    AsyncFunction("init") { (appId: String, promise: Promise) in
      // TODO: 替换为芒果 SDK 初始化
      print("[MangoAd] init with appId: \(appId)")
      promise.resolve(nil)
    }

    AsyncFunction("showSplashAd") { (slotId: String, promise: Promise) in
      // TODO: 替换为芒果开屏���告
      print("[MangoAd] showSplashAd slotId: \(slotId)")
      promise.resolve(["success": true])
    }

    AsyncFunction("loadRewardedVideo") { (slotId: String, promise: Promise) in
      // TODO: 替换为芒果激励视频加载
      print("[MangoAd] loadRewardedVideo slotId: \(slotId)")
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
        self?.sendEvent("onAdLoaded", [:])
      }
      promise.resolve(nil)
    }

    AsyncFunction("showRewardedVideo") { (promise: Promise) in
      // TODO: 替换为芒果激励视频展示
      print("[MangoAd] showRewardedVideo")
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
        self?.sendEvent("onAdClosed", [:])
      }
      promise.resolve(["success": true, "rewardVerify": true])
    }
  }
}

// NOTE: 以下代码基于穿山甲 SDK v6.x 的估计 API 编写。
// 实际类名、代理协议名称可能与此不同，须在真实构建时对照最新 SDK 文档核实后调整。

import ExpoModulesCore
import BUAdSDK

public class ExpoPangleModule: Module {
  private var rewardedAd: BUNativeExpressRewardedVideoAd?
  private var rewardedPromise: Promise?
  private var splashPromise: Promise?

  public func definition() -> ModuleDefinition {
    Name("ExpoPangle")

    Events("onAdLoaded", "onAdClosed", "onAdError")

    AsyncFunction("init") { (appId: String, promise: Promise) in
      BUAdSDKManager.start(asyncInit: { config in
        config.appID = appId
      }, completionHandler: { success, error in
        if success {
          promise.resolve(nil)
        } else {
          promise.reject("INIT_FAILED", error?.localizedDescription ?? "Unknown error")
        }
      })
    }

    AsyncFunction("showSplashAd") { (slotId: String, promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self = self else { return }
        self.splashPromise = promise

        guard let rootVC = UIApplication.shared.connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .first?.windows.first?.rootViewController else {
          promise.resolve(["success": false])
          return
        }

        let splashAd = BUSplashAd(slotID: slotId, adSize: rootVC.view.bounds.size)
        splashAd.delegate = self
        splashAd.loadData()
      }
    }

    AsyncFunction("loadRewardedVideo") { (slotId: String, promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self = self else { return }
        let ad = BUNativeExpressRewardedVideoAd(slotID: slotId)
        ad.delegate = self
        self.rewardedAd = ad
        ad.loadData()
        promise.resolve(nil)
      }
    }

    AsyncFunction("showRewardedVideo") { (promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self = self, let ad = self.rewardedAd else {
          promise.resolve(["success": false, "rewardVerify": false])
          return
        }
        self.rewardedPromise = promise

        guard let rootVC = UIApplication.shared.connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .first?.windows.first?.rootViewController else {
          promise.resolve(["success": false, "rewardVerify": false])
          return
        }

        ad.show(fromRootViewController: rootVC)
      }
    }
  }
}

// MARK: - BUNativeExpressRewardedVideoAdDelegate
extension ExpoPangleModule: BUNativeExpressRewardedVideoAdDelegate {
  public func nativeExpressRewardedVideoAdDidLoad(_ rewardedVideoAd: BUNativeExpressRewardedVideoAd) {
    sendEvent("onAdLoaded", [:])
  }

  public func nativeExpressRewardedVideoAdDidClose(_ rewardedVideoAd: BUNativeExpressRewardedVideoAd) {
    sendEvent("onAdClosed", [:])
  }

  public func nativeExpressRewardedVideoAdServerRewardDidSucceed(_ rewardedVideoAd: BUNativeExpressRewardedVideoAd, verify: Bool) {
    rewardedPromise?.resolve(["success": true, "rewardVerify": verify])
    rewardedPromise = nil
  }

  public func nativeExpressRewardedVideoAd(_ rewardedVideoAd: BUNativeExpressRewardedVideoAd, didFailWithError error: Error?) {
    let msg = error?.localizedDescription ?? "Unknown error"
    sendEvent("onAdError", ["code": -1, "message": msg])
    rewardedPromise?.resolve(["success": false, "rewardVerify": false])
    rewardedPromise = nil
  }
}

// MARK: - BUSplashAdDelegate
extension ExpoPangleModule: BUSplashAdDelegate {
  public func splashAdLoadSuccess(_ splashAd: BUSplashAd) {
    guard let rootVC = UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .first?.windows.first?.rootViewController else {
      splashPromise?.resolve(["success": false])
      splashPromise = nil
      return
    }
    splashAd.show(in: rootVC.view)
  }

  public func splashAdDidClose(_ splashAd: BUSplashAd) {
    splashPromise?.resolve(["success": true])
    splashPromise = nil
  }

  public func splashAd(_ splashAd: BUSplashAd, didFailWithError error: Error?) {
    splashPromise?.resolve(["success": false])
    splashPromise = nil
  }
}

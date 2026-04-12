// modules/expo-mango-ad/android/.../ExpoMangoAdModule.kt
//
// 芒果聚合广告 Android 原生模块
// TODO: 拿到���果 SDK 后，替换 mock 实现为真实 SDK 调用
//
// 当前为 mock 实现：所有广告请求直接返回成功，用于在等待 SDK 期间跑通 JS 层逻辑。

package expo.modules.mangoad

import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoMangoAdModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("ExpoMangoAd")

    Events("onAdLoaded", "onAdClosed", "onAdError")

    AsyncFunction("init") { appId: String ->
      // TODO: 替换为芒果 SDK 初始化
      android.util.Log.d("MangoAd", "init with appId: $appId")
    }

    AsyncFunction("showSplashAd") { slotId: String ->
      // TODO: 替换为芒果开屏广告
      android.util.Log.d("MangoAd", "showSplashAd slotId: $slotId")
      mapOf("success" to true)
    }

    AsyncFunction("loadRewardedVideo") { slotId: String ->
      // TODO: 替换为芒果激励视频加载
      android.util.Log.d("MangoAd", "loadRewardedVideo slotId: $slotId")
      mainHandler.postDelayed({
        sendEvent("onAdLoaded", emptyMap<String, Any>())
      }, 500)
    }

    AsyncFunction("showRewardedVideo") {
      // TODO: 替换为芒果激励视频展示
      android.util.Log.d("MangoAd", "showRewardedVideo")
      mainHandler.postDelayed({
        sendEvent("onAdClosed", emptyMap<String, Any>())
      }, 1000)
      mapOf("success" to true, "rewardVerify" to true)
    }
  }
}

// modules/expo-pangle/android/src/main/java/expo/modules/pangle/ExpoPangleModule.kt
//
// NOTE: 以下穿山甲 SDK API（TTAdSdk、TTRewardVideoAd、CSJSplashAd 等类名和方法签名）
// 基于 SDK 6.x 估算，**正式接入前必须对照最新官方文档核实**。
// 官方文档：https://www.pangle.cn/support/doc/62c77f1c1d72e00001bff617
//
package expo.modules.pangle

import android.app.Activity
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.bytedance.sdk.openadsdk.*

class ExpoPangleModule : Module() {
  private var rewardedAd: TTRewardVideoAd? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoPangle")

    Events("onAdLoaded", "onAdClosed", "onAdError")

    AsyncFunction("init") { appId: String, promise: Promise ->
      val config = TTAdConfig.Builder()
        .appId(appId)
        .appName(appActivity?.applicationInfo?.loadLabel(appActivity!!.packageManager)?.toString() ?: "CoCo")
        .build()

      TTAdSdk.init(appContext.reactContext!!, config, object : TTAdSdk.InitCallback {
        override fun success() { promise.resolve(null) }
        override fun fail(code: Int, msg: String?) {
          promise.reject("INIT_FAILED", msg ?: "Init failed with code $code", null)
        }
      })
    }

    AsyncFunction("showSplashAd") { slotId: String, promise: Promise ->
      val activity = appActivity ?: run {
        promise.resolve(mapOf("success" to false))
        return@AsyncFunction
      }

      val adNative = TTAdSdk.getAdManager().createAdNative(activity)
      val adSlot = AdSlot.Builder()
        .setCodeId(slotId)
        .build()

      adNative.loadSplashAd(adSlot, object : TTAdNative.CSJSplashAdListener {
        override fun onSplashLoadSuccess(ad: CSJSplashAd?) {
          activity.runOnUiThread {
            ad?.showSplashView(activity.window.decorView as android.view.ViewGroup)
            ad?.setSplashAdListener(object : CSJSplashAd.SplashAdListener {
              override fun onSplashAdClose(type: Int) {
                promise.resolve(mapOf("success" to true))
              }
              override fun onSplashAdShow(ad: CSJSplashAd?) {}
            })
          }
        }
        override fun onSplashLoadFail(error: CSJAdError?) {
          promise.resolve(mapOf("success" to false))
        }
        override fun onSplashRenderSuccess(ad: CSJSplashAd?) {}
        override fun onSplashRenderFail(ad: CSJSplashAd?, error: CSJAdError?) {
          promise.resolve(mapOf("success" to false))
        }
      }, 3000) // 3 秒超时
    }

    AsyncFunction("loadRewardedVideo") { slotId: String, promise: Promise ->
      val activity = appActivity ?: run {
        promise.reject("NO_ACTIVITY", "Activity not available", null)
        return@AsyncFunction
      }

      val adNative = TTAdSdk.getAdManager().createAdNative(activity)
      val adSlot = AdSlot.Builder()
        .setCodeId(slotId)
        .setRewardVerify(true)
        .build()

      adNative.loadRewardVideoAd(adSlot, object : TTAdNative.RewardVideoAdListener {
        override fun onRewardVideoAdLoad(ad: TTRewardVideoAd?) {
          rewardedAd = ad
          sendEvent("onAdLoaded", emptyMap<String, Any>())
          promise.resolve(null)
        }
        override fun onError(code: Int, message: String?) {
          sendEvent("onAdError", mapOf("code" to code, "message" to (message ?: "")))
          promise.reject("LOAD_FAILED", message ?: "Load failed", null)
        }
        override fun onRewardVideoCached(ad: TTRewardVideoAd?) {}
      })
    }

    AsyncFunction("showRewardedVideo") { promise: Promise ->
      val activity = appActivity
      val ad = rewardedAd
      if (activity == null || ad == null) {
        promise.resolve(mapOf("success" to false, "rewardVerify" to false))
        return@AsyncFunction
      }

      ad.setRewardAdInteractionListener(object : TTRewardVideoAd.RewardAdInteractionListener {
        override fun onAdShow() {}
        override fun onAdVideoBarClick() {}
        override fun onAdClose() {
          sendEvent("onAdClosed", emptyMap<String, Any>())
        }
        override fun onVideoComplete() {}
        override fun onVideoError() {
          promise.resolve(mapOf("success" to false, "rewardVerify" to false))
        }
        override fun onRewardVerify(
          rewardVerify: Boolean, rewardAmount: Int,
          rewardName: String?, errorCode: Int, errorMsg: String?
        ) {
          promise.resolve(mapOf("success" to true, "rewardVerify" to rewardVerify))
        }
        override fun onSkippedVideo() {
          promise.resolve(mapOf("success" to false, "rewardVerify" to false))
        }
      })

      activity.runOnUiThread { ad.showRewardVideoAd(activity) }
    }
  }

  private val appActivity: Activity?
    get() = appContext.currentActivity
}

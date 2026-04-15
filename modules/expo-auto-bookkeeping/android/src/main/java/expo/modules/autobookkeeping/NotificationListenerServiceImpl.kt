package expo.modules.autobookkeeping

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.core.app.NotificationCompat
import java.lang.ref.WeakReference

class NotificationListenerServiceImpl : NotificationListenerService() {

  companion object {
    private const val TAG = "AutoBookkeeping"

    private val WATCHED_PACKAGES = setOf(
      "com.tencent.mm",              // 微信
      "com.eg.android.AlipayGphone"  // 支付宝
    )

    internal var moduleRef: WeakReference<ExpoAutoBookkeepingModule>? = null
    private val pendingBuffer = mutableListOf<NotificationData>()

    // 已处理通知 ID 去重（微信会更新同一条通知触发多次 onNotificationPosted）
    private val processedKeys = LinkedHashMap<String, Long>(32, 0.75f, true)
    private const val DEDUP_WINDOW_MS = 60_000L

    // 调试信息
    internal var totalNotificationCount = 0
    internal var watchedNotificationCount = 0
    internal var localNotificationSentCount = 0
    internal var localNotificationError = ""
    internal var lastNotificationPkg = ""
    internal var lastNotificationTitle = ""
    internal var lastNotificationText = ""
    internal var serviceConnected = false

    fun registerModule(module: ExpoAutoBookkeepingModule) {
      moduleRef = WeakReference(module)
    }

    fun getAndClearBuffer(): List<NotificationData> {
      synchronized(pendingBuffer) {
        val copy = pendingBuffer.toList()
        pendingBuffer.clear()
        return copy
      }
    }

    fun unregisterModule() {
      moduleRef = null
    }
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    serviceConnected = true
    Log.d(TAG, "NLS connected")
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    serviceConnected = false
    Log.d(TAG, "NLS disconnected")
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    sbn ?: return
    val pkg = sbn.packageName ?: return

    totalNotificationCount++
    Log.d(TAG, "Notification from: $pkg (total: $totalNotificationCount)")

    // 记录所有通知的包名（用于调试）
    lastNotificationPkg = pkg

    if (pkg !in WATCHED_PACKAGES) return

    watchedNotificationCount++

    // 先提取通知内容（去重需要内容哈希）
    val extras = sbn.notification?.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
    val text = (
      extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
        ?: extras.getCharSequence(Notification.EXTRA_TEXT)
        ?: extras.getCharSequence(Notification.EXTRA_SUB_TEXT)
    )?.toString() ?: ""

    lastNotificationTitle = title
    lastNotificationText = text

    Log.d(TAG, "WeChat/Alipay notification: title=$title, text=$text")

    if (text.isBlank()) {
      Log.d(TAG, "Skipped: text is blank")
      return
    }

    // 用 pkg:id:contentHash 去重
    // 同一通知重复推送（内容不变）→ 去重 ✓
    // 微信复用通知 ID 但内容更新为新交易 → 放行 ✓
    val contentHash = (title + text).hashCode()
    val dedupKey = "$pkg:${sbn.id}:$contentHash"
    val now = System.currentTimeMillis()
    synchronized(processedKeys) {
      processedKeys.entries.removeAll { now - it.value > DEDUP_WINDOW_MS }
      if (processedKeys.containsKey(dedupKey)) {
        Log.d(TAG, "Skipped duplicate notification: $dedupKey")
        return
      }
      processedKeys[dedupKey] = now
    }

    val data = NotificationData(
      packageName = pkg,
      title = title,
      text = text,
      timestamp = sbn.postTime
    )

    // 延迟 5 秒发送本地通知，避免和微信/支付宝的原始支付通知同时弹出
    Handler(Looper.getMainLooper()).postDelayed({
      showAutoBookkeepingNotification(pkg, text)
    }, 5_000L)

    // 尝试 EventEmitter（App 前台时 JS 可实时接收并入账）
    val module = moduleRef?.get()
    if (module != null) {
      Log.d(TAG, "Dispatching to module (foreground)")
      module.dispatchNotification(data)
    } else {
      // Module 不可用，写入缓冲区等 App 回前台时拉取入账
      synchronized(pendingBuffer) {
        if (pendingBuffer.size < 50) {
          pendingBuffer.add(data)
        }
      }
      Log.d(TAG, "Buffered notification (buffer size: ${pendingBuffer.size})")
    }
  }

  /** 发送"已自动记账"本地通知（仅在金额提取成功时） */
  private fun showAutoBookkeepingNotification(pkg: String, text: String) {
    try {
      val sourceLabel = if (pkg == "com.tencent.mm") "微信支付" else "支付宝"

      // 金额提取是前置条件：失败则静默忽略，不发通知
      // 这确保通知中总是包含真实的金额信息，避免误导用户
      val amountMatch = Regex("[¥￥]([\\d]+\\.?\\d{0,2})").find(text)
        ?: Regex("([\\d]+\\.?\\d{0,2})\\s*元").find(text)

      if (amountMatch == null) {
        Log.d(TAG, "No amount found in notification text: $text")
        return  // 没有金额，不发送"已自动记账"通知
      }

      val body = "$sourceLabel ¥${amountMatch.groupValues[1]}"

      val channelId = "auto-bookkeeping"
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        if (nm.getNotificationChannel(channelId) == null) {
          val channel = NotificationChannel(
            channelId, "自动记账", NotificationManager.IMPORTANCE_HIGH
          ).apply { description = "自动记账通知" }
          nm.createNotificationChannel(channel)
        }
      }

      val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
      val pendingIntent = if (launchIntent != null) {
        PendingIntent.getActivity(
          this, 0, launchIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
      } else null

      val notification = NotificationCompat.Builder(this, channelId)
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setContentTitle("已自动记账")
        .setContentText(body)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(NotificationCompat.CATEGORY_MESSAGE)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setDefaults(NotificationCompat.DEFAULT_ALL)
        .setAutoCancel(true)
        .setContentIntent(pendingIntent)
        .build()

      nm.notify(localNotificationSentCount, notification)
      localNotificationSentCount++
      Log.d(TAG, "Notification sent ($localNotificationSentCount): $body")
    } catch (e: Exception) {
      localNotificationError = e.toString()
      Log.e(TAG, "Failed to send notification", e)
    }
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification?) {
    // 不需要处理
  }
}

data class NotificationData(
  val packageName: String,
  val title: String,
  val text: String,
  val timestamp: Long
)

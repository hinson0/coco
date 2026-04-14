package expo.modules.autobookkeeping

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
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

    // 用 packageName:notificationId 去重（微信更新通知时 id 不变）
    val dedupKey = "$pkg:${sbn.id}"
    val now = System.currentTimeMillis()
    synchronized(processedKeys) {
      // 清理过期 key
      processedKeys.entries.removeAll { now - it.value > DEDUP_WINDOW_MS }
      if (processedKeys.containsKey(dedupKey)) {
        Log.d(TAG, "Skipped duplicate notification: $dedupKey")
        return
      }
      processedKeys[dedupKey] = now
    }

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

    val data = NotificationData(
      packageName = pkg,
      title = title,
      text = text,
      timestamp = sbn.postTime
    )

    // 先尝试 EventEmitter（App 前台时 JS 可实时接收）
    val module = moduleRef?.get()
    if (module != null) {
      Log.d(TAG, "Dispatching to module (foreground)")
      module.dispatchNotification(data)
    } else {
      // Module 不可用（App 在后台），写入缓冲区等 App 回前台时拉取
      synchronized(pendingBuffer) {
        if (pendingBuffer.size < 50) {
          pendingBuffer.add(data)
        }
      }
      Log.d(TAG, "Buffered notification (buffer size: ${pendingBuffer.size})")
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

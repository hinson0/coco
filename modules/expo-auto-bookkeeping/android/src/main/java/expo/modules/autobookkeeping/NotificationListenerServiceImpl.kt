package expo.modules.autobookkeeping

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.lang.ref.WeakReference

class NotificationListenerServiceImpl : NotificationListenerService() {

  companion object {
    private val WATCHED_PACKAGES = setOf(
      "com.tencent.mm",              // 微信
      "com.eg.android.AlipayGphone"  // 支付宝
    )

    internal var moduleRef: WeakReference<ExpoAutoBookkeepingModule>? = null
    private val pendingBuffer = mutableListOf<NotificationData>()

    fun registerModule(module: ExpoAutoBookkeepingModule) {
      moduleRef = WeakReference(module)
      if (pendingBuffer.isNotEmpty()) {
        val module = moduleRef?.get()
        if (module != null) {
          pendingBuffer.forEach { module.dispatchNotification(it) }
          pendingBuffer.clear()
        }
      }
    }

    fun unregisterModule() {
      moduleRef = null
    }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    sbn ?: return
    val pkg = sbn.packageName ?: return
    if (pkg !in WATCHED_PACKAGES) return

    val extras = sbn.notification?.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
    val text = (
      extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
        ?: extras.getCharSequence(Notification.EXTRA_TEXT)
        ?: extras.getCharSequence(Notification.EXTRA_SUB_TEXT)
    )?.toString() ?: ""

    if (text.isBlank()) return

    val data = NotificationData(
      packageName = pkg,
      title = title,
      text = text,
      timestamp = sbn.postTime
    )

    val module = moduleRef?.get()
    if (module != null) {
      module.dispatchNotification(data)
    } else {
      synchronized(pendingBuffer) {
        if (pendingBuffer.size < 50) {
          pendingBuffer.add(data)
        }
      }
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

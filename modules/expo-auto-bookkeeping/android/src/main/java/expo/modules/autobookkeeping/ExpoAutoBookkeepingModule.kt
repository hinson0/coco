package expo.modules.autobookkeeping

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoAutoBookkeepingModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("ExpoAutoBookkeeping")

    Events("onNotificationReceived")

    OnCreate {
      NotificationListenerServiceImpl.registerModule(this@ExpoAutoBookkeepingModule)
    }

    OnDestroy {
      NotificationListenerServiceImpl.unregisterModule()
    }

    Function("isPermissionGranted") {
      val context = appContext.reactContext ?: return@Function false
      val packageName = context.packageName
      val enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(context)
      enabledPackages.contains(packageName)
    }

    Function("openPermissionSettings") {
      val context = appContext.reactContext ?: return@Function null
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      null
    }

    Function("getServiceStatus") {
      val context = appContext.reactContext ?: return@Function mapOf(
        "permissionGranted" to false,
        "serviceConnected" to false
      )
      val packageName = context.packageName
      val enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(context)
      val granted = enabledPackages.contains(packageName)

      mapOf(
        "permissionGranted" to granted,
        "serviceConnected" to (NotificationListenerServiceImpl.moduleRef?.get() != null)
      )
    }

    Function("getAndClearBuffer") {
      val buffer = NotificationListenerServiceImpl.getAndClearBuffer()
      buffer.map { data ->
        mapOf(
          "packageName" to data.packageName,
          "title" to data.title,
          "text" to data.text,
          "timestamp" to data.timestamp
        )
      }
    }

    Function("getDebugInfo") {
      mapOf(
        "serviceConnected" to NotificationListenerServiceImpl.serviceConnected,
        "moduleRegistered" to (NotificationListenerServiceImpl.moduleRef?.get() != null),
        "totalNotifications" to NotificationListenerServiceImpl.totalNotificationCount,
        "watchedNotifications" to NotificationListenerServiceImpl.watchedNotificationCount,
        "lastPkg" to NotificationListenerServiceImpl.lastNotificationPkg,
        "lastTitle" to NotificationListenerServiceImpl.lastNotificationTitle,
        "lastText" to NotificationListenerServiceImpl.lastNotificationText
      )
    }
  }

  fun dispatchNotification(data: NotificationData) {
    sendEvent("onNotificationReceived", mapOf(
      "packageName" to data.packageName,
      "title" to data.title,
      "text" to data.text,
      "timestamp" to data.timestamp
    ))
  }
}

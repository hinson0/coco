package expo.modules.autobookkeeping

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
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

    Function("areNotificationsEnabled") {
      val context = appContext.reactContext ?: return@Function false
      NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    Function("isChannelEnabled") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function true
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val channel = nm.getNotificationChannel("auto-bookkeeping")
        ?: return@Function false
      channel.importance != NotificationManager.IMPORTANCE_NONE
    }

    Function("openNotificationSettings") {
      val context = appContext.reactContext ?: return@Function null
      val intent = Intent().apply {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          action = Settings.ACTION_APP_NOTIFICATION_SETTINGS
          putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        } else {
          action = "android.settings.APP_NOTIFICATION_SETTINGS"
          putExtra("app_package", context.packageName)
          putExtra("app_uid", context.applicationInfo.uid)
        }
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      null
    }

    Function("openAutoStartSettings") {
      val context = appContext.reactContext ?: return@Function null
      try {
        val intent = Intent().apply {
          action = Settings.ACTION_APPLICATION_DETAILS_SETTINGS
          data = android.net.Uri.parse("package:${context.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
      } catch (_: Exception) {}
      null
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
        "localNotifSent" to NotificationListenerServiceImpl.localNotificationSentCount,
        "localNotifError" to NotificationListenerServiceImpl.localNotificationError,
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

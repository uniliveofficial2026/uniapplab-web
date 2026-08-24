package com.uniapplab.unilive.call

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.uniapplab.unilive.MainActivity
import com.uniapplab.unilive.R

/**
 * Mic/camera call foreground service (Android 14+ FGS types).
 *
 * Start only when JS/native bridge flags enable production call FGS.
 * IncomingCallBridgeStub.FEATURE_ENABLED remains false until device QA.
 */
class CallForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!IncomingCallBridgeStub.FEATURE_ENABLED) {
      stopSelf()
      return START_NOT_STICKY
    }
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Call in progress"
    val notification = buildNotification(title)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    return START_STICKY
  }

  private fun buildNotification(title: String): Notification {
    ensureChannel()
    val launch = PendingIntent.getActivity(
      this,
      0,
      Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText("UniLive’s call")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentIntent(launch)
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .build()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(CHANNEL_ID, "Calls", NotificationManager.IMPORTANCE_LOW)
    mgr.createNotificationChannel(channel)
  }

  companion object {
    const val CHANNEL_ID = "unilives_calls"
    const val NOTIFICATION_ID = 71001
    const val EXTRA_TITLE = "title"

    fun start(context: Context, title: String) {
      if (!IncomingCallBridgeStub.FEATURE_ENABLED) return
      val intent = Intent(context, CallForegroundService::class.java).putExtra(EXTRA_TITLE, title)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, CallForegroundService::class.java))
    }
  }
}

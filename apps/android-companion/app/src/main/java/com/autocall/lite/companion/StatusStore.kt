package com.autocall.lite.companion

import android.os.Handler
import android.os.Looper
import android.content.Context
import android.telecom.Call
import android.util.Log
import java.util.concurrent.CopyOnWriteArrayList

object StatusStore {
    private const val TAG = "AutoCallCompanion"
    private const val IDLE_RESET_DELAY_MS = 3500L

    const val VERSION_NAME = "1.0.2"

    @Volatile
    var callState: String = CallStateMapper.IDLE
        private set

    @Volatile
    var sessionId: String = ""
        private set

    @Volatile
    var lastError: String = ""
        private set

    @Volatile
    var defaultDialer: Boolean = false
        private set

    private val calls = CopyOnWriteArrayList<Call>()
    private val handler = Handler(Looper.getMainLooper())
    @Volatile
    private var idleResetRunnable: Runnable? = null

    fun setSession(id: String?) {
        cancelIdleReset()
        sessionId = id.orEmpty()
        Log.d(TAG, "SESSION_SET empty=${id.isNullOrEmpty()}")
    }

    fun setError(message: String?) {
        lastError = message.orEmpty()
    }

    fun setDefaultDialer(value: Boolean) {
        defaultDialer = value
    }

    fun setCallState(state: String) {
        cancelIdleReset()
        callState = state
    }

    fun addCall(call: Call) {
        if (!calls.contains(call)) {
            calls.add(call)
        }
        updateFromCalls()
    }

    fun removeCall(call: Call) {
        calls.remove(call)
        updateFromCalls()
    }

    fun scheduleIdleResetAfterDisconnectedIfNeeded() {
        // If we're already in idle, do nothing. Otherwise delay resetting to IDLE so
        // Windows can observe DISCONNECTED at least once during polling.
        if (callState != CallStateMapper.DISCONNECTED) return
        if (idleResetRunnable != null) return

        idleResetRunnable = Runnable {
            Log.d(TAG, "IDLE_RESET_FROM_DISCONNECTED")
            callState = CallStateMapper.IDLE
            sessionId = ""
            idleResetRunnable = null
        }
        handler.postDelayed(idleResetRunnable!!, IDLE_RESET_DELAY_MS)
    }

    fun disconnectAll() {
        if (calls.isEmpty()) {
            setError("no active call")
            callState = CallStateMapper.IDLE
            sessionId = ""
            Log.d(TAG, "DISCONNECT_ALL: no active calls; forcing IDLE")
            return
        }
        calls.forEach { call ->
            try {
                call.disconnect()
            } catch (error: SecurityException) {
                setError("hangup not permitted")
            }
        }
    }

    fun refreshDefaultDialer(context: Context) {
        val telecom = context.getSystemService(android.telecom.TelecomManager::class.java)
        defaultDialer = telecom?.defaultDialerPackage == context.packageName
    }

    private fun updateFromCalls() {
        if (calls.isEmpty()) {
            if (callState == CallStateMapper.DISCONNECTED) {
                // DISCONNECTED was reached but Call reference is removed quickly.
                // Keep DISCONNECTED for a short window to avoid a race with polling.
                scheduleIdleResetAfterDisconnectedIfNeeded()
                return
            }
            callState = CallStateMapper.IDLE
            sessionId = ""
            Log.d(TAG, "UPDATE_FROM_CALLS: callsEmpty -> IDLE (session cleared)")
            return
        }
        cancelIdleReset()
        val mapped = CallStateMapper.fromTelecom(calls.last().state)
        callState = mapped
        if (mapped == CallStateMapper.ACTIVE) setError("")
    }

    private fun cancelIdleReset() {
        idleResetRunnable?.let { handler.removeCallbacks(it) }
        idleResetRunnable = null
    }
}

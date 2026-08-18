package com.autocall.lite.companion

import android.content.Context
import android.telecom.Call
import java.util.concurrent.CopyOnWriteArrayList

object StatusStore {
    const val VERSION_NAME = "1.0.0"

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

    fun setSession(id: String?) {
        sessionId = id.orEmpty()
    }

    fun setError(message: String?) {
        lastError = message.orEmpty()
    }

    fun setDefaultDialer(value: Boolean) {
        defaultDialer = value
    }

    fun setCallState(state: String) {
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

    fun disconnectAll() {
        if (calls.isEmpty()) {
            setError("no active call")
            callState = CallStateMapper.IDLE
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
            callState = CallStateMapper.IDLE
            return
        }
        callState = CallStateMapper.fromTelecom(calls.last().state)
        if (callState == CallStateMapper.ACTIVE) {
            lastError = ""
        }
    }
}

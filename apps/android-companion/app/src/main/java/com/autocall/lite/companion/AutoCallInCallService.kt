package com.autocall.lite.companion

import android.content.Intent
import android.telecom.Call
import android.telecom.InCallService
import android.util.Log

class AutoCallInCallService : InCallService() {
    private val logTag = "AutoCallCompanion"
    private val callback = object : Call.Callback() {
        override fun onStateChanged(call: Call, state: Int) {
            val mapped = CallStateMapper.fromTelecom(state)

            val cause =
                if (state == Call.STATE_DISCONNECTING || state == Call.STATE_DISCONNECTED) {
                    try {
                        call.details?.disconnectCause?.toString()
                    } catch (_: Throwable) {
                        "unknown"
                    }
                } else {
                    null
                }

            val nowMs = System.currentTimeMillis()
            val causePart = if (cause != null) " cause=${cause}" else ""
            Log.d(logTag, "CALL_STATE raw=$state mapped=$mapped t=$nowMs${causePart}")
            StatusStore.addCall(call)
        }
    }

    override fun onCallAdded(call: Call) {
        Log.d(logTag, "CALL_ADDED raw=${call.state} t=${System.currentTimeMillis()}")
        call.registerCallback(callback)
        StatusStore.addCall(call)
        StatusStore.setError("")
        val inCall = Intent(this, InCallActivity::class.java)
        inCall.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        startActivity(inCall)
    }

    override fun onCallRemoved(call: Call) {
        val mapped = CallStateMapper.fromTelecom(call.state)
        Log.d(logTag, "CALL_REMOVED raw=${call.state} mapped=$mapped t=${System.currentTimeMillis()}")

        // Fallback: if DISCONNECTED callback was missed, preserve terminal state.
        if (mapped == CallStateMapper.DISCONNECTED) {
            StatusStore.setCallState(CallStateMapper.DISCONNECTED)
        }

        call.unregisterCallback(callback)
        StatusStore.removeCall(call)
    }
}

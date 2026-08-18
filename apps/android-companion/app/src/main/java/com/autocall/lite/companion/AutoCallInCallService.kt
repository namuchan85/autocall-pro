package com.autocall.lite.companion

import android.telecom.Call
import android.telecom.InCallService

class AutoCallInCallService : InCallService() {
    private val callback = object : Call.Callback() {
        override fun onStateChanged(call: Call, state: Int) {
            StatusStore.addCall(call)
        }
    }

    override fun onCallAdded(call: Call) {
        call.registerCallback(callback)
        StatusStore.addCall(call)
        StatusStore.setError("")
    }

    override fun onCallRemoved(call: Call) {
        call.unregisterCallback(callback)
        StatusStore.removeCall(call)
    }
}

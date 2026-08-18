package com.autocall.lite.companion

import android.telecom.Call

object CallStateMapper {
    const val IDLE = "IDLE"
    const val DIALING = "DIALING"
    const val RINGING = "RINGING"
    const val ACTIVE = "ACTIVE"
    const val DISCONNECTED = "DISCONNECTED"
    const val UNKNOWN = "UNKNOWN"

    fun fromTelecom(state: Int): String {
        return when (state) {
            Call.STATE_NEW,
            Call.STATE_CONNECTING,
            Call.STATE_SELECT_PHONE_ACCOUNT,
            Call.STATE_DIALING,
            -> DIALING
            Call.STATE_RINGING -> RINGING
            Call.STATE_ACTIVE,
            Call.STATE_HOLDING,
            -> ACTIVE
            Call.STATE_DISCONNECTING,
            Call.STATE_DISCONNECTED,
            -> DISCONNECTED
            else -> UNKNOWN
        }
    }
}

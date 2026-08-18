package com.autocall.lite.companion

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.telecom.TelecomManager
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class CallCommandActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        StatusStore.refreshDefaultDialer(this)
        handleCommand(intent)
        finish()
    }

    private fun handleCommand(intent: Intent) {
        val command = intent.getStringExtra("cmd")
        if (!CompanionCommands.isAllowed(command)) {
            StatusStore.setError("invalid command")
            return
        }
        when (command) {
            CompanionCommands.PING -> StatusStore.setError("")
            CompanionCommands.HANGUP -> StatusStore.disconnectAll()
            CompanionCommands.DIAL -> dial(intent.getStringExtra("tel"), intent.getStringExtra("session"))
        }
    }

    private fun dial(phoneNumber: String?, sessionId: String?) {
        if (!PhoneNumber.isE164(phoneNumber)) {
            StatusStore.setError("invalid phone number")
            return
        }
        StatusStore.setSession(sessionId)
        StatusStore.setError("")
        val uri = Uri.fromParts("tel", phoneNumber, null)
        val telecom = getSystemService(TelecomManager::class.java)
        val canCall = ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) ==
            PackageManager.PERMISSION_GRANTED
        if (!canCall) {
            StatusStore.setError("CALL_PHONE permission required")
            return
        }
        try {
            if (telecom != null) {
                telecom.placeCall(uri, Bundle())
                StatusStore.setCallState(CallStateMapper.DIALING)
                return
            }
        } catch (_: SecurityException) {
            // ACTION_CALL still uses the public CALL_PHONE permission.
        }
        startActivity(Intent(Intent.ACTION_CALL, uri))
        StatusStore.setCallState(CallStateMapper.DIALING)
    }
}

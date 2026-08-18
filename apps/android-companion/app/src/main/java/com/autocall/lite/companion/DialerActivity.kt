package com.autocall.lite.companion

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.telecom.TelecomManager
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class DialerActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_dialer)
        val numberInput = findViewById<EditText>(R.id.numberInput)
        numberInput.setText(phoneNumberFrom(intent))
        findViewById<Button>(R.id.placeCallButton).setOnClickListener {
            placeCall(numberInput.text?.toString().orEmpty())
        }
        findViewById<TextView>(R.id.dialerHint).text = getString(R.string.dialer_hint)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        findViewById<EditText>(R.id.numberInput).setText(phoneNumberFrom(intent))
    }

    private fun placeCall(rawNumber: String) {
        val number = rawNumber.trim()
        if (number.isEmpty()) {
            StatusStore.setError("phone number is missing")
            return
        }
        val canCall =
            ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) ==
                PackageManager.PERMISSION_GRANTED
        if (!canCall) {
            StatusStore.setError("CALL_PHONE permission required")
            return
        }
        val uri = Uri.fromParts("tel", number, null)
        val telecom = getSystemService(TelecomManager::class.java)
        try {
            telecom?.placeCall(uri, Bundle())
            StatusStore.setCallState(CallStateMapper.DIALING)
            StatusStore.setError("")
        } catch (_: SecurityException) {
            startActivity(Intent(Intent.ACTION_CALL, uri))
            StatusStore.setCallState(CallStateMapper.DIALING)
        }
    }

    private fun phoneNumberFrom(intent: Intent): String {
        val data = intent.data ?: return ""
        if (data.scheme != DialerRoleRequirements.SCHEME_TEL) {
            return ""
        }
        return data.schemeSpecificPart.orEmpty()
    }
}

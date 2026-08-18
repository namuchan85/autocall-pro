package com.autocall.lite.companion

import android.app.role.RoleManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.telecom.TelecomManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        findViewById<Button>(R.id.defaultDialerButton).setOnClickListener {
            requestDefaultDialer()
        }
        refreshStatus()
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
    }

    private fun refreshStatus() {
        StatusStore.refreshDefaultDialer(this)
        findViewById<TextView>(R.id.statusText).text =
            "callState=${StatusStore.callState}\ndefaultDialer=${StatusStore.defaultDialer}\nversion=${StatusStore.VERSION_NAME}\nlastError=${StatusStore.lastError}"
    }

    private fun requestDefaultDialer() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = getSystemService(RoleManager::class.java)
            if (roleManager != null && !roleManager.isRoleHeld(RoleManager.ROLE_DIALER)) {
                startActivityForResult(roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER), 1001)
                return
            }
        }
        val intent = Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER)
        intent.putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, packageName)
        startActivity(intent)
    }
}

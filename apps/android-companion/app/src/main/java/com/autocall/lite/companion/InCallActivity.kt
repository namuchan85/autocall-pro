package com.autocall.lite.companion

import android.os.Handler
import android.os.Looper
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class InCallActivity : AppCompatActivity() {
    private val handler = Handler(Looper.getMainLooper())
    private var refreshRunnable: Runnable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_incall)
        findViewById<Button>(R.id.hangupButton).setOnClickListener {
            StatusStore.disconnectAll()
            finish()
        }
        refreshAndMaybeFinish()
    }

    override fun onResume() {
        super.onResume()
        startPolling()
    }

    override fun onPause() {
        super.onPause()
        stopPolling()
    }

    private fun startPolling() {
        if (refreshRunnable != null) return
        refreshRunnable = object : Runnable {
            override fun run() {
                refreshAndMaybeFinish()
                handler.postDelayed(this, 300)
            }
        }
        handler.postDelayed(refreshRunnable!!, 0)
    }

    private fun stopPolling() {
        refreshRunnable?.let { handler.removeCallbacks(it) }
        refreshRunnable = null
    }

    private fun refreshAndMaybeFinish() {
        val state = StatusStore.callState
        val hangupButton = findViewById<Button>(R.id.hangupButton)
        val stateText = findViewById<TextView>(R.id.inCallState)

        stateText.text = "callState=$state\nsession=${StatusStore.sessionId}"

        val inProgress = state == CallStateMapper.DIALING || state == CallStateMapper.RINGING ||
            state == CallStateMapper.ACTIVE
        hangupButton.isEnabled = inProgress
        hangupButton.visibility = if (inProgress) {
            Button.VISIBLE
        } else {
            Button.INVISIBLE
        }

        if (state == CallStateMapper.DISCONNECTED || state == CallStateMapper.IDLE) {
            finish()
        }
    }
}

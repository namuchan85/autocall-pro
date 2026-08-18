package com.autocall.lite.companion

import android.app.Application

class CompanionApp : Application() {
    override fun onCreate() {
        super.onCreate()
        StatusStore.refreshDefaultDialer(this)
    }
}

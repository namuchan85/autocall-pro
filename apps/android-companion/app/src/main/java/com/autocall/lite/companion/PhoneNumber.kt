package com.autocall.lite.companion

object PhoneNumber {
    private val E164 = Regex("^\\+[1-9]\\d{7,14}$")

    fun isE164(value: String?): Boolean {
        return value != null && E164.matches(value)
    }
}

package com.autocall.lite.companion

object CompanionCommands {
    const val DIAL = "dial"
    const val HANGUP = "hangup"
    const val PING = "ping"

    fun isAllowed(command: String?): Boolean {
        return command == DIAL || command == HANGUP || command == PING
    }
}

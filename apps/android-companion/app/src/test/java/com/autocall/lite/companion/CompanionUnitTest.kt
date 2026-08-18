package com.autocall.lite.companion

import android.telecom.Call
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CompanionUnitTest {
    @Test
    fun acceptsOnlyKnownCommands() {
        assertTrue(CompanionCommands.isAllowed("dial"))
        assertTrue(CompanionCommands.isAllowed("hangup"))
        assertTrue(CompanionCommands.isAllowed("ping"))
        assertFalse(CompanionCommands.isAllowed("rm"))
        assertFalse(CompanionCommands.isAllowed(null))
    }

    @Test
    fun validatesE164PhoneNumbers() {
        assertTrue(PhoneNumber.isE164("+821012345678"))
        assertFalse(PhoneNumber.isE164("01012345678"))
        assertFalse(PhoneNumber.isE164(null))
        assertFalse(PhoneNumber.isE164("tel:+821012345678"))
    }

    @Test
    fun mapsTelecomStatesWithoutInventingNoAnswer() {
        assertEquals(CallStateMapper.DIALING, CallStateMapper.fromTelecom(Call.STATE_DIALING))
        assertEquals(CallStateMapper.RINGING, CallStateMapper.fromTelecom(Call.STATE_RINGING))
        assertEquals(CallStateMapper.ACTIVE, CallStateMapper.fromTelecom(Call.STATE_ACTIVE))
        assertEquals(CallStateMapper.DISCONNECTED, CallStateMapper.fromTelecom(Call.STATE_DISCONNECTED))
        assertEquals(CallStateMapper.UNKNOWN, CallStateMapper.fromTelecom(999))
    }
}

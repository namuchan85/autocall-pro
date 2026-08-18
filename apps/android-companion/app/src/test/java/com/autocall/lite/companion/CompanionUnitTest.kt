package com.autocall.lite.companion

import android.telecom.Call
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.w3c.dom.Element
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

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
        assertEquals(
            CallStateMapper.DIALING,
            CallStateMapper.fromTelecom(Call.STATE_CONNECTING),
        )
        assertEquals(CallStateMapper.DIALING, CallStateMapper.fromTelecom(Call.STATE_DIALING))
        assertEquals(CallStateMapper.RINGING, CallStateMapper.fromTelecom(Call.STATE_RINGING))
        assertEquals(CallStateMapper.ACTIVE, CallStateMapper.fromTelecom(Call.STATE_ACTIVE))
        assertEquals(
            CallStateMapper.DISCONNECTED,
            CallStateMapper.fromTelecom(Call.STATE_DISCONNECTED),
        )
        assertEquals(CallStateMapper.UNKNOWN, CallStateMapper.fromTelecom(999))
    }

    @Test
    fun roleDialerRequiresSeparateDialFilters() {
        val filters = DialerRoleRequirements.requiredDialFilters()
        assertEquals(2, filters.size)
        assertEquals(null, filters[0].scheme)
        assertEquals(DialerRoleRequirements.SCHEME_TEL, filters[1].scheme)
        assertTrue(filters.all { it.action == DialerRoleRequirements.ACTION_DIAL })
        assertTrue(filters.all { it.category == DialerRoleRequirements.CATEGORY_DEFAULT })
    }

    @Test
    fun manifestQualifiesForRoleDialer() {
        val manifest = locateManifest()
        val document = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(manifest)
        val activities = document.getElementsByTagName("activity")
        var hasDialWithoutData = false
        var hasDialWithTel = false
        var mixedDialViewWithTelOnly = true

        for (index in 0 until activities.length) {
            val activity = activities.item(index) as Element
            val filters = activity.getElementsByTagName("intent-filter")
            for (filterIndex in 0 until filters.length) {
                val filter = filters.item(filterIndex) as Element
                val actions = childValues(filter, "action")
                val categories = childValues(filter, "category")
                val schemes = dataSchemes(filter)
                val hasDial = actions.contains(DialerRoleRequirements.ACTION_DIAL)
                val hasDefault = categories.contains(DialerRoleRequirements.CATEGORY_DEFAULT)
                if (hasDial && hasDefault && schemes.isEmpty() && actions.size == 1) {
                    hasDialWithoutData = true
                }
                if (hasDial && hasDefault && schemes.contains(DialerRoleRequirements.SCHEME_TEL) &&
                    actions.size == 1
                ) {
                    hasDialWithTel = true
                    mixedDialViewWithTelOnly = false
                }
            }
        }

        val services = document.getElementsByTagName("service")
        var hasInCallService = false
        for (index in 0 until services.length) {
            val service = services.item(index) as Element
            val permission = service.getAttribute("android:permission")
            val actions = service.getElementsByTagName("intent-filter").let { nodes ->
                if (nodes.length == 0) {
                    emptyList()
                } else {
                    childValues(nodes.item(0) as Element, "action")
                }
            }
            val meta = service.getElementsByTagName("meta-data")
            var hasUiMeta = false
            for (metaIndex in 0 until meta.length) {
                val item = meta.item(metaIndex) as Element
                if (item.getAttribute("android:name") == DialerRoleRequirements.METADATA_IN_CALL_SERVICE_UI &&
                    item.getAttribute("android:value") == "true"
                ) {
                    hasUiMeta = true
                }
            }
            if (permission == DialerRoleRequirements.BIND_INCALL_SERVICE &&
                actions.contains(DialerRoleRequirements.IN_CALL_SERVICE_ACTION) &&
                hasUiMeta
            ) {
                hasInCallService = true
            }
        }

        assertTrue("ACTION_DIAL without data is required for ROLE_DIALER", hasDialWithoutData)
        assertTrue("ACTION_DIAL with tel scheme is required for ROLE_DIALER", hasDialWithTel)
        assertFalse(
            "ACTION_DIAL must not be mixed with ACTION_VIEW in the only tel filter",
            mixedDialViewWithTelOnly,
        )
        assertTrue("InCallService UI metadata is required for ROLE_DIALER", hasInCallService)
    }

    private fun locateManifest(): File {
        val candidates = listOf(
            File("src/main/AndroidManifest.xml"),
            File("app/src/main/AndroidManifest.xml"),
            File("apps/android-companion/app/src/main/AndroidManifest.xml"),
        )
        return candidates.firstOrNull { it.isFile }
            ?: throw AssertionError("AndroidManifest.xml was not found")
    }

    private fun childValues(parent: Element, tag: String): List<String> {
        val nodes = parent.getElementsByTagName(tag)
        val values = mutableListOf<String>()
        for (index in 0 until nodes.length) {
            val name = (nodes.item(index) as Element).getAttribute("android:name")
            if (name.isNotEmpty()) {
                values.add(name)
            }
        }
        return values
    }

    private fun dataSchemes(filter: Element): List<String> {
        val nodes = filter.getElementsByTagName("data")
        val values = mutableListOf<String>()
        for (index in 0 until nodes.length) {
            val scheme = (nodes.item(index) as Element).getAttribute("android:scheme")
            if (scheme.isNotEmpty()) {
                values.add(scheme)
            }
        }
        return values
    }
}

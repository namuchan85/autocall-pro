package com.autocall.lite.companion

/**
 * Public ROLE_DIALER qualifying pieces documented by RoleManagerCompat / Telecom.
 * PackageManager matches these as separate intent-filters; mixing DIAL+VIEW with
 * a tel scheme in one filter does not satisfy the no-data ACTION_DIAL query.
 */
object DialerRoleRequirements {
    const val ACTION_DIAL = "android.intent.action.DIAL"
    const val ACTION_VIEW = "android.intent.action.VIEW"
    const val ACTION_CALL_BUTTON = "android.intent.action.CALL_BUTTON"
    const val CATEGORY_DEFAULT = "android.intent.category.DEFAULT"
    const val SCHEME_TEL = "tel"
    const val IN_CALL_SERVICE_ACTION = "android.telecom.InCallService"
    const val BIND_INCALL_SERVICE = "android.permission.BIND_INCALL_SERVICE"
    const val METADATA_IN_CALL_SERVICE_UI = "android.telecom.IN_CALL_SERVICE_UI"

    data class DialFilter(
        val action: String,
        val category: String,
        val scheme: String?,
    )

    fun requiredDialFilters(): List<DialFilter> {
        return listOf(
            DialFilter(ACTION_DIAL, CATEGORY_DEFAULT, null),
            DialFilter(ACTION_DIAL, CATEGORY_DEFAULT, SCHEME_TEL),
        )
    }
}

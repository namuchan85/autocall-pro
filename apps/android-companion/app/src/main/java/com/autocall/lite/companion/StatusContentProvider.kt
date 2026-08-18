package com.autocall.lite.companion

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri

class StatusContentProvider : ContentProvider() {
    override fun onCreate(): Boolean = true

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?,
    ): Cursor {
        context?.let { StatusStore.refreshDefaultDialer(it) }
        val cursor = MatrixCursor(
            arrayOf("versionName", "callState", "sessionId", "defaultDialer", "lastError"),
        )
        cursor.addRow(
            arrayOf(
                StatusStore.VERSION_NAME,
                StatusStore.callState,
                StatusStore.sessionId,
                if (StatusStore.defaultDialer) "true" else "false",
                StatusStore.lastError,
            ),
        )
        return cursor
    }

    override fun getType(uri: Uri): String = "vnd.android.cursor.item/vnd.com.autocall.lite.companion.status"

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?,
    ): Int = 0
}

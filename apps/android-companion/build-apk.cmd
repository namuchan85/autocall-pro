@echo off
REM Open this folder in Android Studio and use Build > Build APK(s).
REM If a local Gradle wrapper jar is present, assembleRelease can be used:
if exist "%~dp0gradle\wrapper\gradle-wrapper.jar" (
  call "%~dp0gradlew.bat" :app:assembleRelease
) else (
  echo gradle-wrapper.jar is missing. Open apps\android-companion in Android Studio to generate it and build AutoCall Companion.apk
)

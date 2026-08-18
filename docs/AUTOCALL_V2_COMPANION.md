# AutoCall Lite v2 — Galaxy Companion

## Architecture

```text
AutoCall Lite.exe (Electron + Nest + Next + SQLite)
        │  USB ADB  (execFile + argv, no shell concatenation)
        ▼
Galaxy
        │  am start / content query / pm path
        ▼
AutoCall Companion.apk
        │  TelecomManager.placeCall + InCallService
        ▼
Galaxy 셀룰러 010 회선
```

기존 Desktop v1 경로를 유지한다.

- Windows EXE, SQLite, Customer CRUD, Auth, Call history, ADB device detection
- `AdbProcessGateway.startCall`의 `ACTION_CALL` argv는 변경하지 않는다
- Companion이 없거나 실패하면 단건 발신은 기존 ADB fallback을 사용한다
- 자동발신은 실제 통화 상태/종료가 필요하므로 Companion이 기본 전화 앱일 때만 시작한다

## Windows ↔ Android communication

USB ADB만 사용한다. Galaxy에 네트워크 서버를 두지 않는다.

Windows Node는 `execFile(adbPath, argv)`만 사용한다.

| 목적           | argv                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 설치 확인      | `-s DEVICE shell pm path com.autocall.lite.companion`                                                                                        |
| 버전           | `-s DEVICE shell dumpsys package com.autocall.lite.companion`                                                                                |
| 기본 전화 앱   | `-s DEVICE shell cmd role get android.app.role.DIALER`                                                                                       |
| 발신/종료/ping | `-s DEVICE shell am start -n com.autocall.lite.companion/.CallCommandActivity --es cmd dial\|hangup\|ping --es tel +82... --es session UUID` |
| 상태 조회      | `-s DEVICE shell content query --uri content://com.autocall.lite.companion.status/current`                                                   |
| APK 설치       | `-s DEVICE install -r <apkPath>`                                                                                                             |

전화번호는 별도 argv 슬롯으로만 전달한다. shell 문자열에 이어 붙이지 않는다.

## Android permissions

Companion은 public API만 사용한다.

- `CALL_PHONE`
- `READ_PHONE_STATE`
- `InCallService` (`BIND_INCALL_SERVICE`는 시스템이 부여)
- `ROLE_DIALER` / 기본 전화 앱 (사용자가 Galaxy에서 명시 승인)

root, hidden API, accessibility, 화면 좌표 클릭, privileged permission 우회는 사용하지 않는다.

## Default dialer 설정

1. Companion APK를 Galaxy에 설치한다
2. Companion 앱을 연다
3. 「기본 전화 앱으로 설정」을 누르고 시스템 대화상자에서 승인한다
4. Windows Dashboard의 Phone Control이 Ready가 되어야 자동발신/통화종료가 가능하다

기본 전화 앱이 아니면 단건 발신은 Companion `placeCall`/`ACTION_CALL` 또는 ADB fallback으로 시도할 수 있다. 다만 실제 Telecom 상태와 정상 hangup은 기본 전화 앱일 때만 보장한다.

## Installation

### Windows

1. `release/AutoCall Lite Setup.exe`를 설치한다
2. USB 디버깅이 켜진 Galaxy를 연결한다
3. AutoCall Lite에서 ADB 경로와 device id를 저장한다

### Android Companion APK

Android Studio에서 `apps/android-companion`을 연 뒤 Build APK(s)를 실행한다.

산출물 예:

- `apps/android-companion/app/build/outputs/apk/debug/app-debug.apk`
- release 빌드 시 `app-release.apk`

설치:

```bat
adb install -r "apps\android-companion\app\build\outputs\apk\debug\app-debug.apk"
```

또는 Dashboard의 「Companion APK 설치」를 누른다. 사용자 확인 없이 설치하지 않는다. 이 PC에 Android SDK가 없으면 APK는 Android Studio가 있는 환경에서 빌드해야 한다.

## Manual test

1. Galaxy USB 연결
2. `adb devices` = `device`
3. Companion APK 설치
4. Companion 실행
5. 기본 전화 앱/CALL_PHONE 승인
6. AutoCall Lite 실행
7. Galaxy Connected 확인
8. Companion Ready 확인
9. 본인 소유 테스트 번호 Customer 등록
10. 단건 발신
11. 수신폰 벨 확인
12. 수신
13. Windows에 ACTIVE가 실제 표시되는지 확인
14. Windows에서 통화 종료
15. Galaxy 통화 종료 확인
16. Call history 확인 (`provider=COMPANION` 또는 fallback 시 `ADB_GALAXY`)
17. 고객 2~3명으로 자동 순차발신
18. Stop 테스트
19. doNotCall 고객 skip 확인
20. Galaxy USB 제거 시 자동발신 중지 확인

자동 테스트는 실제 전화를 걸지 않는다.

## Known limitations

- Companion이 기본 전화 앱이 아니면 InCallService가 통화 객체를 받지 못해 hangup/ACTIVE 상태가 동작하지 않을 수 있다
- Android는 NO_ANSWER를 확정하지 않는다. ringing timeout 후 상태는 DISCONNECTED이며 NO_ANSWER로 저장하지 않는다
- ADB fallback 단건 발신은 다이얼러 실행 성공(`STARTED`)만 기록한다
- 문자 요청은 상태만 저장한다. 외부 SMS API는 없다
- 프로그램 crash 후 자동발신을 재개하지 않는다. 다시 Start 해야 한다
- OEM에 따라 `cmd role get` 출력이 다를 수 있어 ContentProvider의 `defaultDialer`를 함께 본다

## AI Voice limitation

Android Companion을 기본 dialer로 사용해도 일반 third-party Android app이 cellular call uplink/downlink audio를 자유롭게 inject/capture할 수 있다는 보장은 없다.

이번 버전은 AI/TTS/STT/녹음을 구현하지 않는다. 향후 AI Voice는 별도 feasibility gate로 둔다.

## Rollback procedure

1. Windows 앱을 종료한다
2. Git에서 이 기능 브랜치를 사용하지 않고 `main`의 Desktop v1 EXE를 다시 설치한다
3. SQLite v2 migration(`lastOutcome`, Call tracking columns)은 하위 호환 추가 컬럼이다. v1 코드는 해당 컬럼을 무시한다
4. Galaxy에서 Companion을 삭제하고 기본 전화 앱을 삼성 다이얼러로 되돌린다
5. v1 ADB `ACTION_CALL` 단건 발신은 그대로 사용할 수 있다

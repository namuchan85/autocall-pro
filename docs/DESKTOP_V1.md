# AutoCall Lite Desktop v1

개인용 Windows 프로그램. Docker / PostgreSQL / Redis / 브라우저 / npm 없이 `AutoCall Lite.exe`로 사용한다.

## 사용자 실행

1. `release/AutoCall Lite Setup.exe`로 설치한다.
2. `AutoCall Lite`를 실행한다.
3. 로그인한다.
   - Email: `admin@autocall.local`
   - Password: 처음 실행 시 `%APPDATA%\AutoCall Lite\secrets.json`의 `adminPassword` (기본 `AutoCall1!`)
4. 설정에서 ADB 경로와 Galaxy device id를 저장한다.
5. 고객을 추가하고 전화를 건다.

일반 사용자는 Docker, PostgreSQL, Redis, 브라우저, npm, 별도 backend 명령을 실행하지 않는다.

## 개발 실행

1. `npm install`
2. `npm run dev:desktop`

Electron이 Nest와 Next를 띄운다. Galaxy USB 연결 후 설정에서 ADB 경로와 device id를 저장한다. 흔한 경로 `C:\platform-tools\adb.exe`는 자동 탐색한다.

## Installer 빌드

```text
npm run dist:win
```

산출물: `release/AutoCall Lite Setup.exe`

## 데이터 위치

설치 폴더가 아니라 Windows 사용자 데이터 디렉터리에 둔다.

- DB: `%APPDATA%\AutoCall Lite\data\autocall.db`
- 설정: `%APPDATA%\AutoCall Lite\settings.json`
- 비밀키: `%APPDATA%\AutoCall Lite\secrets.json`
- 로그: `%APPDATA%\AutoCall Lite\logs\`

설치/업데이트 시 위 파일은 삭제되지 않는다.

이전 빌드에서 빈 DB가 만들어졌다면 앱을 한 번 재실행하면 테이블이 생성된다. 그래도 로그인이 안 되면 `%APPDATA%\AutoCall Lite\data\autocall.db`만 지우고 다시 실행한다.

Installer가 오래 걸리거나 멈추면 `release\win-unpacked\AutoCall Lite.exe`를 사용한다.

## 기존 PostgreSQL 데이터

개발용 Docker PostgreSQL 데이터가 있으면, 로그인 후 `GET /settings/export` JSON을 받아 SQLite 앱에서 `POST /settings/import`로 가져올 수 있다. 자동 마이그레이션은 하지 않으며, 기존 PostgreSQL 데이터는 지우지 않는다.

## 수동 검증

1. installer 설치 또는 `npm run dev:desktop`
2. AutoCall Lite 실행
3. 로그인
4. 고객 등록 (이름, `010-1234-5678`, 메모, 상태, 수신거부)
5. Galaxy USB 연결 및 USB 디버깅 승인
6. 대시보드에서 Galaxy 상태 확인 / 새로고침
7. 설정에서 ADB 경로·device id 저장
8. 테스트 고객 선택 후 전화 걸기
9. Galaxy 발신 및 수신폰 벨 확인
10. 통화 기록에서 REQUESTED / STARTED / FAILED 확인
11. 앱 종료
12. 재실행
13. 고객/Call 데이터가 남아 있는지 확인

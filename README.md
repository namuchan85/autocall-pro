# AutoCall Lite

개인 1명이 PC에서 사용하는 간단한 오토콜 프로그램입니다. 전화번호를 저장하고, 전화를 걸고, 안내 음성·DTMF·문자·결과를 다루는 것이 목표입니다. 기업용 텔레마케팅 SaaS는 만들지 않습니다.

현재는 **Lite Level 3 Desktop v1**입니다. `AutoCall Lite.exe`로 고객 CRUD와 USB Galaxy ADB 단건 발신을 사용합니다. 음성·DTMF·문자는 아직 없습니다. 방향은 `docs/AUTOCALL_LITE.md`, 설치·수동 검증은 `docs/DESKTOP_V1.md`를 따릅니다.

## 기술 스택

- Desktop: Electron (sandbox, contextIsolation)
- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: NestJS, TypeScript, REST
- Data: SQLite (Prisma + libsql), `%APPDATA%\AutoCall Lite\data\autocall.db`
- Quality: Jest, ESLint, Prettier, Husky, lint-staged

## 일반 사용자

`release/AutoCall Lite Setup.exe`를 설치한 뒤 AutoCall Lite를 실행합니다. Docker, PostgreSQL, Redis, 브라우저, npm은 필요 없습니다.

로그인:

- 첫 실행이면 관리자 비밀번호를 직접 설정합니다. 비밀번호는 bcrypt hash로만 SQLite에 저장됩니다.
- Email: `admin@autocall.local`
- 이후에는 설정한 비밀번호로 로그인합니다.

## 개발자 실행

- Node.js 22.12 이상
- npm 10.8 이상

```bat
cd /d "C:\Users\namuc\made program\AUTO-call"
npm install
npm run dev:desktop
```

Electron이 Nest(:3001)와 Next(:3000)를 띄우고 창을 엽니다.

Galaxy 발신 구조:

```text
AutoCall Lite.exe
  → Next UI (:3000) → Nest (:3001) → adb.exe argv → USB Galaxy
  → SQLite (%APPDATA%\AutoCall Lite\data\autocall.db)
```

설정 화면에서 ADB 경로와 device id를 저장합니다. `C:\platform-tools\adb.exe`는 자동 탐색합니다.

## Installer 빌드

```bat
npm run dist:win
```

산출물: `release/AutoCall Lite Setup.exe`

## 관리자 인증

단일 로컬 사용자용으로 기존 JWT 로그인을 유지합니다.

- Login: `POST /auth/login`
- First-run setup: `GET /auth/setup-status`, `POST /auth/setup`
- Refresh: `POST /auth/refresh`
- Logout: `POST /auth/logout`
- Current user: `GET /auth/me`

Refresh Token은 HttpOnly 쿠키로 전달되고 DB에는 bcrypt hash만 저장됩니다. `POST /auth/login`은 프로세스 메모리 고정 윈도우로 IP당 기본 5회/60초 제한합니다.

백엔드 `npm test`는 Jest setup에서 테스트용 환경변수를 주입하므로 로컬 `.env` 없이 통과해야 합니다.

## 고객 관리

인증된 사용자는 대시보드에서 고객을 추가·수정·삭제할 수 있습니다. 전화번호는 `010-1234-5678`처럼 입력해도 E.164(`+821012345678`)로 저장됩니다. `customerCode`는 자동 생성되고 DELETE는 Soft Delete입니다.

CSV 업로드와 캠페인은 포함하지 않습니다.

## Galaxy ADB 발신

Windows PC에 USB로 연결된 Galaxy에서 고객 번호 1통을 겁니다.

- `GET /telephony/device` — Connected / Unauthorized / Offline / Not Found / ADB Not Configured
- `POST /telephony/call` `{ "customerId": "..." }`
- `GET /telephony/calls` — 최근 통화 기록

대시보드에서 고객을 고른 뒤 「전화 걸기」를 누르면 확인창 후 발신을 요청합니다. 성공 메시지는 `Galaxy에서 발신 요청이 시작되었습니다.`입니다. 이는 다이얼러 실행 성공이며 상대방 응답과는 다릅니다.

## 개발용 Docker fallback

사용자 실행 경로에는 Docker가 없습니다. 예전 PostgreSQL 데이터를 JSON으로 빼는 용도로 Compose의 postgres를 남겨 두었습니다. Desktop v1 스키마는 SQLite이므로 `docker compose up migrate`는 더 이상 기본 경로가 아닙니다.

## 개발 규칙

변경 전 `AGENTS.md`, `DEVELOPMENT_RULES.md`, `docs/AUTOCALL_LITE.md`를 확인합니다. 커밋 전 lint-staged가 실행되며 CI는 Install, Lint, Test, Build를 검증합니다.

현재 단계에서는 연속 발신, SMS, AI Voice, Campaign을 구현하지 않습니다.

## 프로젝트 구조

```text
apps/
  desktop/        Electron Main, installer
  frontend/       Next.js (로그인, 대시보드)
  backend/        NestJS (auth, customers, telephony, settings)
packages/
  shared/         공유 타입 예정 (비어 있음)
  ui/             공유 UI 예정 (비어 있음)
  config/         공유 설정 예정 (비어 있음)
docs/             AUTOCALL_LITE.md, DESKTOP_V1.md
docker/           개발 fallback Dockerfile
.github/          GitHub Actions
release/          Windows installer 산출물 (gitignore)
```

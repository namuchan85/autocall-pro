# AutoCall Lite

개인 1명이 PC에서 사용하는 간단한 오토콜 프로그램입니다. 전화번호를 저장하고, 전화를 걸고, 안내 음성·DTMF·문자·결과를 다루는 것이 목표입니다. 기업용 텔레마케팅 SaaS는 만들지 않습니다.

현재는 **Lite Level 2**입니다. 관리자 로그인, 고객(전화번호) CRUD, USB Galaxy ADB 단건 발신이 동작합니다. 음성·DTMF·문자는 아직 없습니다. 방향과 로드맵은 `docs/AUTOCALL_LITE.md`를 따릅니다.

## 기술 스택

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: NestJS, TypeScript, REST, Swagger
- Data: PostgreSQL, Prisma, Redis (로그인 Rate Limit)
- Quality: Jest, ESLint, Prettier, Husky, lint-staged
- Deployment: Docker Compose

## 사전 요구사항

- Node.js 22.12 이상
- npm 10.8 이상
- Docker Desktop

## 로컬 실행

Galaxy 발신을 쓰는 기본 구조는 다음과 같습니다.

```text
Browser → Frontend(:3000) → Windows NestJS backend(:3001) → C:\platform-tools\adb.exe → USB Galaxy
Windows backend → Docker PostgreSQL(:5432), Docker Redis(:6379)
```

`.env`는 `.env.example`을 복사한 뒤 로컬에서만 채웁니다. Windows native backend는 Docker 호스트 이름(`postgres`, `redis`)이 아니라 `localhost`를 써야 합니다. 실제 secret과 device id는 Git에 커밋하지 않습니다.

```env
DATABASE_URL=
REDIS_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
SEED_ADMIN_PASSWORD=
ADB_PATH=
ADB_DEVICE_ID=
```

`ADB_DEVICE_ID`에는 `adb devices`에 나온 시리얼만 넣고 Git에 커밋하지 않습니다. JWT secret은 각각 32자 이상이어야 합니다.

Windows CMD 예:

```bat
cd /d "C:\Users\namuc\made program\AUTO-call"
copy .env.example .env
npm install
npm run docker:infra
docker compose up migrate
npm run prisma:generate
npm run dev:backend
```

다른 터미널에서 frontend는 Docker로 두거나 로컬로 실행합니다.

```bat
docker compose up -d --build frontend
```

또는:

```bat
npm run dev:frontend
```

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:3001/health`
- Swagger: `http://localhost:3001/swagger`

## Docker 실행

PostgreSQL, Redis, migrate, frontend만 Compose 기본 대상입니다. Docker backend는 USB/ADB에 접근하지 못하므로 기본 기동하지 않습니다.

```bash
npm run docker:infra
docker compose up -d --build frontend
docker compose ps
docker compose down
```

ADB 없이 Docker backend를 띄울 때만:

```bash
docker compose --profile docker-backend up -d --build backend
```

Compose의 계정과 비밀값은 로컬 개발 전용입니다. Health API는 PostgreSQL과 Redis 연결을 모두 확인한 경우에만 `{"status":"ok"}`를 반환합니다.

## 관리자 인증

단일 사용자용으로 기존 JWT 로그인을 유지합니다. 다중 역할·다중 관리자 기능은 추가하지 않습니다.

- Seed email: `admin@autocall.local`
- Seed password: `.env`의 `SEED_ADMIN_PASSWORD`
- Login: `POST /auth/login`
- Refresh: `POST /auth/refresh`
- Logout: `POST /auth/logout`
- Current user: `GET /auth/me`

Refresh Token은 HttpOnly 쿠키로 전달되고 DB에는 bcrypt hash만 저장됩니다. `POST /auth/login`은 Redis 고정 윈도우로 IP당 기본 5회/60초 제한합니다. Client IP 정책은 `docs/security/client-ip.md`를 따릅니다.

백엔드 `npm test`는 Jest setup에서 테스트용 환경변수를 주입하므로 로컬 `.env` 없이 통과해야 합니다.

## 고객 관리

인증된 사용자는 대시보드에서 고객을 추가·수정·삭제할 수 있습니다. 전화번호는 `010-1234-5678`처럼 입력해도 E.164(`+821012345678`)로 저장됩니다. `customerCode`는 자동 생성되고 DELETE는 Soft Delete입니다.

- `POST /customers`
- `GET /customers` — page, limit, keyword, status, doNotCall
- `GET /customers/:id`
- `PATCH /customers/:id`
- `DELETE /customers/:id`

CSV 업로드와 캠페인은 포함하지 않습니다.

## Galaxy ADB 발신

Windows PC에 USB로 연결된 Galaxy에서 고객 번호 1통을 겁니다. Backend는 **Windows에서** 실행해야 합니다. Docker 컨테이너의 backend는 USB/ADB에 접근하지 못합니다.

- `GET /telephony/device` — ADB_PATH 미설정, adb.exe 없음, ADB_DEVICE_ID 미설정, device 없음, unauthorized, offline, 정상 연결을 구분합니다
- `POST /telephony/call` `{ "customerId": "..." }`

`.env` 예:

```env
ADB_PATH=C:\platform-tools\adb.exe
ADB_DEVICE_ID=
```

`ADB_DEVICE_ID`에는 `adb devices`에 나온 시리얼만 넣고 Git에 커밋하지 않습니다.

대시보드에서 고객을 고른 뒤 「전화 걸기」를 누르면 확인창 후 발신을 요청합니다. 성공 메시지는 `Galaxy에서 발신 요청이 시작되었습니다.`입니다. 이는 다이얼러 실행 성공이며 상대방 응답과는 다릅니다.

## 개발 규칙

변경 전 `AGENTS.md`, `DEVELOPMENT_RULES.md`, `docs/AUTOCALL_LITE.md`를 확인합니다. 커밋 전 lint-staged가 실행되며 CI는 Install, Lint, Test, Build를 검증합니다.

현재 단계에서는 연속 발신, SMS, AI Voice, Campaign을 구현하지 않습니다.

## 프로젝트 구조

```text
apps/
  frontend/       Next.js (로그인, 대시보드)
  backend/        NestJS (auth, customers)
packages/
  shared/         공유 타입 예정 (비어 있음)
  ui/             공유 UI 예정 (비어 있음)
  config/         공유 설정 예정 (비어 있음)
docs/             AUTOCALL_LITE.md 및 보안 문서
docker/           Dockerfile
scripts/          개발 스크립트
.github/          GitHub Actions
```

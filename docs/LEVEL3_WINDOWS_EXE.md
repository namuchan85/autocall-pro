# AutoCall Lite Level 3 Architecture Review

상태: 설계만. 이 문서 작성 시점에 코드·스키마·의존성·EXE 빌드는 변경하지 않는다.

근거 커밋: `main` `0cd37c9` (Level 2 ADB Galaxy 발신 포함).

이번 Level 3의 목표는 새 오토콜 기능이 아니다. 검증된 Level 2를 **개인용 Windows EXE**로 쓰는 사용 경험을 만드는 것이다. 음성·DTMF·SMS·AI·대량 발신·Queue·SIP는 구현하지 않는다.

---

## 1. Current Architecture

현재는 브라우저 + 개발자 명령어로 동작하는 모노레포다.

```text
사용자 브라우저 (localhost:3000)
        │  Next.js rewrite
        │  /auth /customers /telephony  →  Nest :3001
        ▼
Next.js App Router (apps/frontend)
  login, dashboard (고객 CRUD + 전화 걸기)
        │
        ▼
NestJS (apps/backend)  ← Windows 호스트에서 npm run dev:backend
  Auth JWT + Refresh cookie + RBAC
  Customers CRUD + 발신 자격 (ACTIVE && !doNotCall)
  Telephony → AdbProcessGateway.execFile(ADB_PATH, ...)
        │                         │
        ▼                         ▼
PostgreSQL :5432              USB Galaxy
Redis :6379 (로그인 Rate Limit만)
(Docker compose, 127.0.0.1 바인딩)
```

검증된 발신 경로:

고객 DB → Dashboard 고객 선택 → `POST /telephony/call` → Windows Native Nest → `execFile(adbPath, ['-s', deviceId, 'shell', 'am', 'start', ... tel:E164])` → USB Galaxy → iPhone 수신.

일반 사용자가 지금 해야 하는 일:

1. Docker Desktop + `npm run docker:infra` (postgres, redis)
2. `npm run dev:backend` (USB/ADB는 Docker backend가 아니라 Windows 호스트 Nest만 가능)
3. `npm run dev:frontend` 또는 Docker frontend
4. 브라우저에서 `localhost:3000` 로그인

`GET /telephony/device`는 백엔드에 이미 있다. Dashboard는 아직 이 API를 호출하지 않고 `POST /telephony/call`만 사용한다.

구성 요약:

| 구성                  | 실제 위치                                                | 역할                                    |
| --------------------- | -------------------------------------------------------- | --------------------------------------- |
| Next.js 16 App Router | `apps/frontend`                                          | 로그인, 대시보드. rewrite로 Nest 프록시 |
| NestJS 11             | `apps/backend`                                           | REST, Auth, Customer, Telephony         |
| Prisma 7              | `schema.prisma` + `@prisma/adapter-pg`                   | PostgreSQL, `@db.Uuid`                  |
| PostgreSQL 17         | Docker `127.0.0.1:5432`                                  | User, RefreshToken, Customer, Call      |
| Redis 8               | Docker `127.0.0.1:6379`                                  | 로그인 IP Rate Limit만. BullMQ 없음     |
| Auth                  | JWT access + HttpOnly refresh + 4 Role RBAC              | Customer/Telephony 전 엔드포인트 Guard  |
| ADB                   | `AdbProcessGateway`                                      | `execFile`, `windowsHide`, device 진단  |
| 테스트                | Jest unit + integration 약 20개 spec                     | ADB는 mock / `TEST_ENVIRONMENT`         |
| 빈 패키지             | `packages/shared`, `ui`, `config`                        | 코드 없음                               |
| 필수 env              | `DATABASE_URL`, `REDIS_URL`, JWT secrets, `FRONTEND_URL` | ADB는 optional이지만 발신 시 필요       |

---

## 2. Keep

EXE에서도 유지할 가치가 있는 것.

- Customer CRUD, `ACTIVE` / `INACTIVE` / `BLOCKED`, `doNotCall`, E.164, soft delete
- 서버 발신 자격 `ACTIVE && !doNotCall` (`call-eligibility.ts`)
- Call 기록 (`REQUESTED` / `STARTED` / `FAILED`, `ADB_GALAXY`)
- `AdbGateway` 포트 + `AdbProcessGateway` (`execFile` argv, `ADB_PATH`, `ADB_DEVICE_ID`)
- device 상태 구분: `device` / `unauthorized` / `offline` (`parse-adb-devices.ts`)
- `GET /telephony/device`, `POST /telephony/call`
- Controller → Service → Repository 경계, 도메인의 Prisma/Nest 비의존
- TypeScript strict, 기존 Jest (특히 telephony mock)
- Windows 호스트에서 Nest를 실행하는 원칙 (Docker backend는 USB 불가)

분류: **KEEP**

---

## 3. Simplify

유지하되 개인용으로 나중에 단순화 가능한 것.

- JWT + Refresh Token + 4 Role RBAC → 단일 로컬 사용자 세션
- Redis 로그인 Rate Limit → 메모리 카운터 또는 제거 (EXE는 외부 공개 안 함)
- Health가 PostgreSQL+Redis 둘 다 필수인 점 → DB만 확인
- Next rewrite + 분리 포트(3000/3001) → EXE 안에서는 loopback 고정
- Swagger, TRUST_PROXY, 기업용 cookie 옵션
- `customerCode` 등 Lite 최소보다 많은 Customer 필드 (스키마 삭제는 하지 않고 UI만 단순화)

분류: **SIMPLIFY** (지금은 구현하지 않음)

---

## 4. Remove Later

EXE 전환이 안정된 뒤에 제거 가능한 것.

- 일반 사용자 경로의 Docker Desktop (개발용 compose는 남겨도 됨)
- PostgreSQL 서버 프로세스 (SQLite 전환 후)
- Redis / `ioredis` / `REDIS_URL` 필수 env
- Prisma Studio, 별도 브라우저, `npm run dev:*`를 사용자에게 요구하는 흐름
- 빈 `packages/*`
- 다중 Role, Refresh 회전, 로그인 Rate Limit fail-closed
- Docker backend profile `docker-backend` (이미 USB 불가로 비권장)

분류: **REMOVE LATER**

지금 제거하면 Level 2가 깨지는 것:

- PostgreSQL, Redis, Auth Guard, Prisma schema, AdbProcessGateway, Customer/Call 모델, Docker infra를 개발 실행에서 빼는 것

분류: **MUST KEEP FOR NOW**

---

## 5. Desktop Technology Comparison

현재 저장소는 NestJS(Node) + Prisma pg adapter + `child_process.execFile` ADB + Next.js App Router rewrite다. 비교는 “일반적으로 좋은 데스크톱 툴”이 아니라 이 조합 기준이다.

### A. Electron + 기존 Next.js / Node

| 기준               | 평가                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------- |
| 기존 코드 재사용률 | 가장 높음. Nest를 Electron main이 child process로 띄우면 Telephony/Auth/Customer 그대로 |
| ADB 실행 용이성    | 높음. 이미 Node `execFile`이다. 호스트 Windows에서 같은 `ADB_PATH` 사용                 |
| Windows EXE 패키징 | electron-builder NSIS가 검증됨                                                          |
| 로컬 DB            | 초기엔 기존 PostgreSQL 유지 가능. 이후 SQLite도 Node adapter로 교체                     |
| 개발 난이도        | 중간. shell만 먼저 얹으면 Level 2 프로세스를 그대로 재사용                              |
| 디버깅 난이도      | 낮음. 기존 Nest 로그 + Chromium DevTools                                                |
| 프로그램 크기      | 큼 (Chromium+Node, 대략 150MB대). 개인 1인용으로는 허용                                 |
| 장기 유지보수      | Node 생태계와 동일. 새 언어 없음                                                        |
| migration 위험     | 가장 낮음. ADB 코드를 Rust/C#으로 옮기지 않음                                           |

제약: Next.js 16의 `rewrites()`는 Node 서버 기능이다. `output: 'export'`로 정적 파일만 남기면 `/auth`, `/customers`, `/telephony` 프록시가 깨진다. EXE에서도 Next를 로컬로 띄우거나, Nest가 UI까지 서빙하도록 나중에 바꿔야 한다. 초기 PoC는 기존 `:3000` + `:3001`을 BrowserWindow로 여는 것이 안전하다.

### B. Tauri + 기존 Frontend

| 기준               | 평가                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 기존 코드 재사용률 | 낮음. Tauri 코어는 Rust. Nest는 sidecar로 Node를 또 넣어야 함                                                      |
| ADB 실행 용이성    | 위험. Rust에서 ADB를 다시 짜면 검증된 `AdbProcessGateway`를 버리는 셈. sidecar로 Nest를 띄우면 Tauri 이점이 줄어듦 |
| Windows EXE 패키징 | 좋음. WebView2 사용                                                                                                |
| 로컬 DB            | SQLite는 Tauri와 잘 맞지만 Prisma/Nest와 이중화됨                                                                  |
| 개발 난이도        | 높음. Rust + Node sidecar + Next 서버                                                                              |
| 디버깅 난이도      | 높음. 두 런타임                                                                                                    |
| 프로그램 크기      | UI만 보면 작음. Node sidecar를 넣으면 Electron과 큰 차이 없음                                                      |
| 장기 유지보수      | 이 저장소 기여자(TypeScript)와 불일치                                                                              |
| migration 위험     | 가장 높음. Galaxy 실발신 경로를 건드리지 않고는 이득이 작음                                                        |

### C. 기타 현실적인 Windows 방식

| 방식                              | 이 저장소에서의 문제                                 |
| --------------------------------- | ---------------------------------------------------- |
| `pkg` / `nexe` + 기본 브라우저    | 사용자는 별도 브라우저를 원하지 않음. 창 통합이 없음 |
| NW.js                             | Electron과 유사, 생태계가 더 약함                    |
| .NET WPF/WinUI + HTTP로 Nest 호출 | UI를 다시 짜야 함. Next 재사용 포기                  |
| PWA / 바로가기                    | Docker·npm·브라우저가 그대로 필요                    |
| WebView2 직접 + Node sidecar      | Tauri와 비슷하고 직접 구현 비용이 큼                 |

---

## 6. Recommended Desktop Architecture

**추천: Electron이 기존 NestJS를 Windows 호스트 child process로 실행하고, BrowserWindow가 기존 Next UI를 loopback으로 연다.**

이유: 검증된 ADB 경로는 Node `execFile`에 있다. Electron main은 Node이므로 그 경로를 복사하지 않고 프로세스만 감싼다. Tauri로 가면 Nest 또는 ADB를 다시 옮겨야 해서 Level 2 회귀 위험이 크다.

목표 사용 흐름 (최종):

```text
AutoCall Lite.exe
        │
        ▼
Electron main (Windows)
  1. NestJS child 시작  (PORT=3001, 기존 AppModule)
  2. Next  또는 Nest가 서빙하는 UI
  3. BrowserWindow → http://127.0.0.1:3000
        │
        ▼
기존 기능 그대로
  Customer CRUD
  GET  /telephony/device
  POST /telephony/call
        │
        ▼
AdbProcessGateway.execFile(ADB_PATH, ...)
        │
        ▼
USB Galaxy
```

초기(Level 3.1)는 EXE가 **창만** 열고, postgres/redis/Nest는 지금처럼 개발자가 띄운다. ADB 코드를 먼저 옮기지 않는다.

```text
[3.1 PoC]                    [최종 EXE]
Electron 창 ─────────┐       Electron
                     │         ├─ spawn Nest (host Node)
localhost:3000  ◄────┘         ├─ UI (Next or later Nest static)
npm run docker:infra           └─ 기존 AdbProcessGateway
npm run dev:backend            SQLite (이후 단계)
npm run dev:frontend           Redis/JWT는 이후 단순화
```

원칙:

- Telephony 모듈을 Electron으로 재구현하지 않는다.
- Docker backend profile로 발신하지 않는다. USB는 항상 Windows 호스트 프로세스.
- `adb.exe`를 asar에 넣지 않는다. `ADB_PATH`는 호스트 `platform-tools`를 가리킨다.

---

## 7. Database Recommendation

**개인 1인, 고객 + 통화 기록만이면 SQLite로 충분하다.** 동시 쓰기·다중 사용자·네트워크 DB가 없다.

다만 **지금은 전환하지 않는다.** Prisma 7이 PostgreSQL에 고정돼 있다.

| 항목             | 판단                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| SQLite 충분한가  | 예. 고객·Call 규모는 로컬 파일로 충분                                                                       |
| schema 재사용    | 모델(User/Customer/Call)은 재사용 가능. `@db.Uuid`, `provider = postgresql`, `PrismaPg` adapter는 바꿔야 함 |
| migration 난이도 | 중간~높음. provider 변경은 기존 migration을 그대로 적용할 수 없음. 새 SQLite 초기 스키마가 필요             |
| Customer 이전    | `findMany` JSON/CSV보내기 또는 pg dump 후 id·enum 매핑. `customerCode` unique, soft delete 유지             |
| Call 이전        | `customerId` FK를 맞춘 뒤 같은 방식으로 import. `onDelete: Restrict` 주의                                   |
| Docker 제거      | SQLite가 EXE 안에서 열린 뒤에만 postgres 컨테이너를 사용자 경로에서 뺄 수 있음. Redis는 DB와 별개           |

권장 순서: Electron+Nest 기동 안정화 → 데이터 export 도구 → SQLite Prisma adapter → 동일 API 테스트 → 그 다음 postgres 제거.

Level 2 개발 중에는 PostgreSQL을 **MUST KEEP FOR NOW**.

---

## 8. Redis Recommendation

Redis 실사용처는 `RedisLoginRateLimiter` (`auth:login:${ip}`)와 Health check뿐이다. Call Queue/BullMQ는 없다.

개인용 EXE가 `127.0.0.1`만 듣고 외부에 안 열리면 **Redis는 필요 없다.**

지금은 `REDIS_URL`이 필수 env이고 `AppModule`이 `RedisModule`을 넣으며 Health가 Redis 실패 시 전체가 실패한다. **지금 제거하면 Nest가 뜨지 않는다.**

권장: **MUST KEEP FOR NOW**, 이후 **REMOVE LATER**. 대체는 in-memory limiter 또는 limiter 자체 삭제.

---

## 9. Auth Recommendation

| 요소                    | 개인 EXE에서 필요한가                        | 지금                                                            |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| JWT access              | 네트워크 공개가 없으면 과도함                | Customer/Telephony 전부가 `JwtAuthGuard`. **MUST KEEP FOR NOW** |
| Refresh Token + DB 회전 | 브라우저 장기 세션용. EXE 단일 창이면 과도함 | 로그인·테스트가 의존. **MUST KEEP FOR NOW**                     |
| RBAC 4 Role             | 사용자 1명. Dashboard는 MANAGER 이상만 발신  | Guard/테스트/시드가 의존. **MUST KEEP FOR NOW**                 |

이후 단순화 후보 (구현하지 않음):

- 로컬 단일 계정 + 긴 TTL, Refresh 제거
- 또는 EXE 기동 시 로컬 세션 자동 발급 (로그인 화면 축소)
- Role을 하나(`ADMIN`)로 축소

지금 Auth를 빼면 프론트 `authorizedFetch`, cookie `path: /auth`, integration 테스트, seed 관리자가 한꺼번에 깨진다.

---

## 10. ADB Migration Risk

Galaxy 실발신은 이 프로젝트의 가장 비싼 자산이다. EXE 전환의 1순위 제약이다.

보존해야 하는 파일·동작:

- `apps/backend/src/modules/telephony/domain/adb.gateway.ts`
- `apps/backend/src/modules/telephony/infrastructure/adb-process.gateway.ts`
- `execFile` + argv 배열 (shell 문자열 금지 유지)
- `windowsHide: true`
- `ADB_PATH`, `ADB_DEVICE_ID`
- `parse-adb-devices.ts` (`device` / `unauthorized` / `offline`)
- `call-eligibility.ts`
- `telephony.service.ts`의 기록·에러 매핑

깨지는 전형적인 실수:

1. Nest를 Docker로 다시 넣음 → USB 없음
2. ADB를 Electron/Tauri/Rust에서 재구현
3. `adb.exe`를 asar/리소스에 묶어 경로·서명 문제
4. `execFile`을 `exec` 문자열로 바꿈
5. Prisma/Auth 대규모 변경과 ADB 변경을 한 PR에 섞음
6. Next `output: 'export'`로 rewrite가 사라져 발신 API가 404

보존 방법:

- 3.1~3.2는 **창과 프로세스 기동만**. telephony 디렉터리 금지
- Electron이 띄우는 것도 **같은 Nest dist**, 같은 `.env`의 `ADB_PATH`
- 완료 조건에 실제 Galaxy 1통을 넣되, 그건 “shell이 Nest를 띄운 뒤”의 회귀이지 ADB 코드 변경이 아님
- 단위 테스트는 계속 mock. 실기기 테스트는 수동 체크리스트

---

## 11. Level 3 Implementation Plan

각 단계는 독립 테스트 가능해야 하고, 실패 시 이전 단계로 되돌릴 수 있어야 한다. 음성/AI/SMS는 넣지 않는다.

### Level 3.1 — Desktop shell PoC

목표: Electron 창이 기존 `http://127.0.0.1:3000`을 연다. Docker/Nest/프론트는 지금과 동일.

완료 조건:

- 창에서 로그인·대시보드가 보임
- telephony 파일 diff 없음
- 기존 `npm test` / lint 통과

### Level 3.2 — Electron이 Nest를 기동

목표: EXE(또는 electron 개발 기동)가 `node dist/src/main.js`를 child로 띄운다. UI는 기존 Next.

완료 조건:

- Docker infra + Electron만으로 로그인 가능 (프론트는 당분간 `dev:frontend` 허용)
- `GET /health` ok
- AdbGateway 코드 변경 없음

### Level 3.3 — ADB 회귀 (코드 변경 없이)

목표: Electron이 띄운 Nest로 Level 2와 같은 Galaxy 실발신.

완료 조건:

- `GET /telephony/device`가 기존과 같은 의미의 상태 반환
- Dashboard에서 1통 발신, iPhone(또는 수신폰) 확인
- `adb-process.gateway.ts` 내용 동일
- (선택, 작은 UI) Dashboard가 device 상태를 표시. Gateway는 수정하지 않음

### Level 3.4 — Next를 EXE 안으로

목표: 사용자가 `npm run dev:frontend` / 별도 브라우저를 안 연다.

완료 조건:

- AutoCall Lite 창만으로 로그인·CRUD·발신 UI
- rewrite 또는 동일 origin이 유지되어 `/telephony/call`이 동작
- Next export로 API를 깨뜨리지 않음

### Level 3.5 — SQLite + Prisma (postgres 병행 가능)

목표: 로컬 파일 DB. 스키마 의미(Customer/Call/User)는 유지.

완료 조건:

- 새 SQLite schema/adapter로 기존 API 테스트 통과
- Customer/Call export → import 절차 문서화 및 1회 검증
- PostgreSQL compose는 개발 폴백으로 남겨도 됨
- ADB 코드 변경 없음

### Level 3.6 — Auth / Redis 단순화

목표: 외부 비공개 EXE에 맞게 의존 축소. 3.5 이후에만.

완료 조건:

- Redis 없이 Nest 기동
- 로그인 또는 로컬 세션으로 CRUD·발신 가능
- RBAC를 줄여도 MANAGER 발신과 동일한 자격 검증은 서버에 남김

### Level 3.7 — Windows installer / EXE

목표: 설치 후 `AutoCall Lite.exe` 실행. Docker/Prisma Studio/npm을 사용자에게 요구하지 않음.

완료 조건:

- NSIS(또는 동등) 설치본
- 로컬 데이터 디렉터리에 DB/로그
- `ADB_PATH`는 설치 후 설정 UI 또는 문서화된 platform-tools 경로
- 실발신 1통 재확인

3.1을 건너뛰고 SQLite/Auth를 먼저 하면 ADB 회귀 원인이 섞인다. 순서를 바꾸지 않는다.

---

## 12. Risks

| 위험                                         | 왜 Level 2가 깨지나                                                 |
| -------------------------------------------- | ------------------------------------------------------------------- |
| Nest를 컨테이너로 패키징                     | USB/ADB 불가 (이미 compose 주석으로 확인됨)                         |
| ADB 재구현                                   | argv·unauthorized 처리·timeout이 달라짐                             |
| Prisma provider를 성급히 sqlite로            | `@db.Uuid`, adapter-pg, integration DB 테스트 전부 실패             |
| Auth 삭제 PR                                 | Guard·cookie·프론트 로그인·seed가 동시에 실패해 발신 UI에 도달 불가 |
| Redis 삭제                                   | 필수 env + Health + login guard                                     |
| Next `output: 'export'`                      | rewrite 소실 → 상대경로 API 실패                                    |
| asar 안 `adb.exe`                            | 실행 권한·경로·안티바이러스                                         |
| Chromium 쿠키 vs `sameSite` / `FRONTEND_URL` | 로그인 후 발신 401                                                  |
| 한 PR에 shell+DB+Auth                        | 실패 시 Galaxy 발신까지 롤백 범위가 커짐                            |

---

## 13. Files Expected To Change

이후 단계에서만. 이번 설계 작업에서는 아래를 구현하지 않는다.

| 단계 | 예상 파일                                                                               |
| ---- | --------------------------------------------------------------------------------------- |
| 3.1  | 신규 `apps/desktop` (Electron main/preload), 루트 `package.json` script, 이 문서        |
| 3.2  | desktop main의 spawn/env, 필요 시 `apps/backend/src/main.ts` listen 주소 고정           |
| 3.3  | (가능하면 없음) 또는 `apps/frontend/src/app/dashboard/page.tsx`에 device 상태 표시만    |
| 3.4  | `apps/frontend/next.config.ts`, desktop이 Next를 띄우는 코드                            |
| 3.5  | `schema.prisma`, `prisma.service.ts`, `prisma.config.ts`, 새 migration, export 스크립트 |
| 3.6  | `environment.ts`, `app.module.ts`, `redis.*`, `auth.*`, health                          |
| 3.7  | electron-builder 설정, installer 리소스, README 사용자 실행 방법                        |
| 문서 | `docs/AUTOCALL_LITE.md` 로드맵 (Level 3 = EXE)                                          |

---

## 14. Files That Should Not Be Touched Initially

3.1~3.3에서 내용 변경 금지:

- `apps/backend/src/modules/telephony/infrastructure/adb-process.gateway.ts`
- `apps/backend/src/modules/telephony/domain/adb.gateway.ts`
- `apps/backend/src/modules/telephony/validation/parse-adb-devices.ts`
- `apps/backend/src/modules/telephony/validation/call-eligibility.ts`
- `apps/backend/src/modules/telephony/validation/adb-device-id.ts`
- `apps/backend/src/modules/telephony/infrastructure/prisma-call.repository.ts`
- `apps/backend/prisma/schema.prisma` (3.5 전까지)
- Customer 도메인/DTO/repository
- Docker postgres/redis 제거, Auth 모듈 삭제

3.1에서 설치 금지: Electron/Tauri runtime dependency를 “설계 단계”에 넣지 않는다. 설치는 3.1 구현 PR에서만.

---

## 15. Final Recommendation

**Electron + 기존 NestJS(Windows child process) + 기존 Next UI + 기존 AdbProcessGateway.**

데이터는 지금은 PostgreSQL, EXE가 안정된 뒤 SQLite. Redis·JWT·RBAC는 지금은 유지하고 EXE가 외부에 안 열린 뒤에 단순화한다.

하지 말 것: Tauri/Rust로 ADB 재작성, 지금 PostgreSQL/Redis/Auth/Docker 삭제, 지금 Prisma schema 변경, 음성·DTMF·AI 추가.

성공 기준: `AutoCall Lite.exe` → 화면 → 고객 CRUD → Galaxy 상태 → 전화 걸기 → 발신 결과. 그 전화는 오늘 동작하는 `execFile` 경로와 같아야 한다.

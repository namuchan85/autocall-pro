# AutoCall Lite

## 1. 프로젝트 목적

AutoCall Lite는 **개인 1명이 자신의 PC에서 사용하는 간단한 오토콜 프로그램**이다.

목표는 대규모 텔레마케팅 SaaS가 아니다. 전화번호를 저장하고, 전화를 걸고, 안내 음성을 재생하고, DTMF 선택을 받아 결과를 저장하는 흐름이 안정적으로 동작하는 것이다.

기존 AutoCall Pro 코드베이스를 삭제하거나 새 저장소를 만들지 않는다. 동작하는 기반(Next.js, NestJS, Prisma, PostgreSQL, Docker, Customer CRUD, Auth)을 재사용하고 방향을 Lite로 전환한다.

이번 단계(Lite Level 2)에서는 USB로 연결된 Galaxy에 ADB로 전화 1통을 건다. 음성·DTMF·SMS·AI는 구현하지 않는다.

## 2. 핵심 기능

1. 전화번호를 DB에 저장
2. 전화번호 목록 확인
3. 특정 번호 또는 순차 발신
4. 연결 후 미리 준비한 음성 안내
5. 상대방 DTMF 키 입력 수신
6. 선택 결과 DB 저장
7. 필요한 경우 문자 발송
8. 통화 결과 확인
9. 위 기능이 안정된 뒤에만 선택적 AI 음성 대화

현재 구현된 핵심은 1·2번(Customer 저장과 목록 조회)과 3번의 단건 ADB 발신이다. 연속 발신·음성·DTMF·문자(4~8번)는 이후 Level에서 구현한다.

## 3. 제외 기능

다음 기업용 SaaS 기능은 구현하지 않으며, 이번 단계에서도 추가하지 않는다.

- Multi Tenant / 다중 조직
- 다중 관리자·상담원 관리
- Campaign / CSV 대량 업로드
- 기업용 Audit 로그
- BullMQ Call Queue
- Twilio/SIP 등 클라우드 Telephony Provider
- 문자 발송 구현 (Level 4)
- STT / TTS / LLM / AI Voice (Level 5)

## 4. 시스템 구조

현재 폴더를 크게 바꾸지 않고, 논리 구조만 아래처럼 적용한다.

```text
apps/
  frontend/          로그인, 대시보드(향후: 목록·발신·결과·설정)
  backend/
    modules/auth     단일 사용자 로그인 (기존 JWT 유지)
    modules/customers
    modules/telephony  ADB Galaxy 단건 발신
    modules/calls      예정 — Call은 Prisma 모델만 존재
    modules/messages   예정 — 아직 없음
    modules/settings   예정 — 아직 없음

apps/backend/prisma/ PostgreSQL + Prisma
docker-compose.yml   postgres, redis, migrate, backend, frontend
```

빈 `messages` 모듈은 만들지 않는다. 음성·DTMF는 Level 3에서 추가한다.

## 5. 기본 Call Flow

Lite Level 2 이후의 기본 시나리오다.

```text
전화번호 선택
    ↓
전화 발신
    ↓
상대방 응답
    ↓
안내 음성
"안녕하세요.
관심 있으시면 1번,
문자를 받으시려면 2번을 눌러주세요."
    ↓
1번 → INTERESTED 결과 저장
2번 → 문자 발송 → SMS_REQUESTED 결과 저장
무입력 → NO_INPUT
통화 실패 → FAILED
부재 → NO_ANSWER
```

### Call 모델 (Lite Level 2에서 구현됨)

최소 Call 모델은 Lite Level 2에서 이미 구현했다.

현재 status:

- `REQUESTED` — 발신 요청을 기록함
- `STARTED` — ADB CALL 명령 실행 성공 (다이얼러 시작)
- `FAILED` — 발신 요청 실패

향후 실제 통화 결과 status는 이후 Level에서 검토한다.

- `ANSWERED`
- `NO_ANSWER`
- `BUSY`
- `COMPLETED`

`startedAt`, `answeredAt`, `endedAt`, `dtmfResult`, `messageSent` 등은 아직 없다.

발신은 `status === ACTIVE` 이고 `doNotCall === false` 인 Customer만 허용한다. INACTIVE, BLOCKED, 수신거부 고객은 Call 기록 없이 거부한다.

## 6. Lite Level 1~5 Roadmap

### Lite Level 1 — 구조 정리

기존 프로젝트를 Lite 방향으로 단순화한다. 전화·문자·AI는 넣지 않는다.

### Lite Level 2 — 실제 전화 1통 (현재)

Windows PC에서 USB 연결된 Galaxy를 ADB로 제어해 고객 번호 1통을 발신한다.

- `GET /telephony/device` — 지정 Galaxy가 `device` 상태인지 확인
- `POST /telephony/call` — ACTIVE이고 수신거부가 아닌 Customer만 ADB CALL
- Call 기록 status: `REQUESTED` → `STARTED` 또는 `FAILED`
- provider: `ADB_GALAXY`
- 실제 응답/부재/통화중 감지는 하지 않는다

환경변수: `ADB_PATH`, `ADB_DEVICE_ID` (값은 Git에 커밋하지 않는다)

준비·수동 검증:

1. `adb devices`에서 Galaxy가 `device`인지 확인한다
2. `.env`에 `ADB_PATH`, `ADB_DEVICE_ID`를 넣는다
3. `npm run prisma:migrate:deploy`로 Call 테이블을 적용한다
4. 테스트용 고객 1명을 저장한다
5. 대시보드에서 「전화 걸기」를 눌러 Galaxy 발신을 확인한다
6. CI/단위 테스트에서는 실제 ADB를 실행하지 않는다

### Lite Level 3 — 음성 안내 + DTMF

연결 후 안내 음성을 재생하고 DTMF를 수신한다. 실제 통화 상태(ANSWERED, NO_ANSWER 등) 추적을 검토한다.

### Lite Level 4 — 문자·결과·UI

문자 발송, 통화 결과 조회, 전화번호 목록·발신·결과·설정 화면.

### Lite Level 5 — 선택적 AI Voice

1~4가 안정된 뒤에만 STT / LLM / TTS를 검토한다.

## 7. 기존 프로젝트에서 유지하는 요소

| 요소                          | 이유                                                      |
| ----------------------------- | --------------------------------------------------------- |
| Customer CRUD                 | 전화번호 저장·조회가 Lite의 기반                          |
| Prisma + PostgreSQL           | 이미 안정. SQLite 전환은 하지 않음                        |
| Docker Compose                | 로컬 실행이 이미 동작                                     |
| Swagger                       | API 확인                                                  |
| 기존 테스트 / CI              | 회귀 방지                                                 |
| JWT Auth                      | Customer API와 테스트가 의존. 이번 단계 삭제하지 않음     |
| Redis                         | 로그인 Rate Limit에 사용 중. Call Queue로는 확장하지 않음 |
| Soft Delete, E.164, name trim | 데이터 무결성                                             |

Customer의 `customerCode`, `company`, `status`, `doNotCall`은 Lite 최소 필드보다 많다. **이번 작업에서 migration으로 삭제하지 않는다.**

## 8. 향후 제거 후보

- SUPER_ADMIN / ADMIN / MANAGER / VIEWER RBAC (개인용이면 단일 사용자면 충분)
- Refresh Token 회전 등 기업용 세션 복잡도
- 다중 관리자 User 관리 (구 Level 5 User Administration)
- 비어 있는 `packages/shared`, `packages/ui`, `packages/config`
- npm 패키지명 `autocall-pro` (동작에는 영향 없음)
- 복잡한 Repository 추상화의 추가 확대

Auth 결정(이번 단계): **A. 기존 Auth 유지**

- 이유: 로그인·JWT·테스트·Customer Guard가 이미 안정적이다. 대규모 Auth 삭제는 이번 범위 밖이다.
- 향후: 로컬 단일 사용자라면 **C. 로컬 전용이므로 제거 가능**을 검토할 수 있다.

## 9. Technical Debt

- Customer keyword search currently uses case-insensitive contains queries across multiple columns. PostgreSQL indexing/search strategy should be reviewed when production data volume and query patterns are known.
- Soft-deleted `customerCode` remains unique, so the same code cannot be reused.
- Compose `TRUST_PROXY=false`이면 브라우저 로그인 Rate Limit이 frontend 컨테이너 IP로 묶일 수 있다.
- 향후 완전한 단일 PC 프로그램으로 바꿀 경우 PostgreSQL → SQLite 전환을 검토할 수 있다. **이번 작업에서는 migration하지 않는다.**
- 미사용이던 `bullmq`, WebSocket 패키지는 Lite Level 1에서 제거했다. 전화 Queue를 Redis/BullMQ로 다시 넣지 않는다.
- Docker backend 컨테이너는 호스트 USB/ADB에 접근하지 못한다. 실제 발신은 Windows에서 `npm run dev:backend`로 실행해야 한다.
- ADB CALL 성공은 다이얼러 실행 성공일 뿐, 상대방 응답 여부와는 다르다.

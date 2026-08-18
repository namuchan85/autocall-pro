# AutoCall Lite

## 1. 프로젝트 목적

AutoCall Lite는 **개인 1명이 자신의 PC에서 사용하는 간단한 오토콜 프로그램**이다.

목표는 대규모 텔레마케팅 SaaS가 아니다. 전화번호를 저장하고, 전화를 걸고, 안내 음성을 재생하고, DTMF 선택을 받아 결과를 저장하는 흐름이 안정적으로 동작하는 것이다.

기존 AutoCall Pro 코드베이스를 삭제하거나 새 저장소를 만들지 않는다. 동작하는 기반(Next.js, NestJS, Prisma, PostgreSQL, Docker, Customer CRUD, Auth)을 재사용하고 방향을 Lite로 전환한다.

이번 단계(Lite Level 3 Desktop v1 + v2 Companion)에서는 Level 2의 USB Galaxy ADB 단건 발신을 Windows EXE로 사용하고, Companion이 있으면 통화 상태·종료·순차 자동발신을 추가한다. 음성·DTMF·SMS API·AI는 구현하지 않는다.

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

현재 구현된 핵심은 1·2번(Customer 저장과 목록 조회), 3번의 단건 발신(Companion 우선, ADB fallback), 순차 자동발신, 결과 배지다. 음성·DTMF·문자 API(4~8번)는 이후 Level에서 구현한다.

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
  desktop/           Electron Main — Nest/Next 기동, 창, installer
  frontend/          로그인, 대시보드(고객·Galaxy 상태·발신·기록·설정)
  backend/
    modules/auth     단일 로컬 사용자 로그인 (기존 JWT 유지)
    modules/customers
    modules/telephony  ADB Galaxy 단건 발신 + Companion + 소형 자동발신
    modules/settings   ADB 경로·device id, JSON export/import
    modules/messages   예정 — 아직 없음
  android-companion/ AutoCall Companion.apk

apps/backend/prisma/ SQLite + Prisma
%APPDATA%\AutoCall Lite\  autocall.db, settings.json, logs
docker-compose.yml   개발 fallback (postgres/redis). 사용자 EXE 경로는 Docker 없음
```

빈 `messages` 모듈은 만들지 않는다. 음성·DTMF는 EXE 전환 이후 Level에서 추가한다. Level 3 Desktop v1 사용법은 `docs/DESKTOP_V1.md`를 따른다.

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

### Lite Level 2 — 실제 전화 1통

Windows PC에서 USB 연결된 Galaxy를 ADB로 제어해 고객 번호 1통을 발신한다.

- `GET /telephony/device` — 지정 Galaxy가 `device` 상태인지 확인
- `POST /telephony/call` — ACTIVE이고 수신거부가 아닌 Customer만 ADB CALL
- Call 기록 status: `REQUESTED` → `STARTED` 또는 `FAILED`
- provider: `ADB_GALAXY`
- 실제 응답/부재/통화중 감지는 하지 않는다

설정 화면에서 `ADB_PATH`, `ADB_DEVICE_ID`를 저장한다 (값은 Git에 커밋하지 않는다).

CI/단위 테스트에서는 실제 ADB를 실행하지 않는다.

### Lite Level 3 — Windows EXE 전환 (현재 단계)

새 오토콜 기능이 아니라, Level 2를 개인용 Windows 프로그램으로 쓰는 것이 목표다. 사용·설치는 `docs/DESKTOP_V1.md`.

Electron이 NestJS와 Next UI를 기동하고, `AdbProcessGateway`의 `execFile` argv 경로는 유지한다. DB는 SQLite, Redis는 제거했다. 음성·DTMF·SMS·AI·대량 발신·Queue·SIP는 구현하지 않는다.

### Lite Level 4 — 문자·결과·UI

문자 발송, 통화 결과 조회, 전화번호 목록·발신·결과·설정 화면. EXE가 안정된 뒤에만 검토한다.

### Lite Level 5 — 선택적 AI Voice

1~4가 안정된 뒤에만 STT / LLM / TTS를 검토한다.

## 7. 기존 프로젝트에서 유지하는 요소

| 요소                          | 이유                                                     |
| ----------------------------- | -------------------------------------------------------- |
| Customer CRUD                 | 전화번호 저장·조회가 Lite의 기반                         |
| Prisma + SQLite               | Desktop v1 로컬 파일 DB. PostgreSQL 서버 불필요          |
| Electron Desktop              | 일반 사용자가 npm/브라우저 없이 실행                     |
| Swagger                       | 개발 중 API 확인                                         |
| 기존 테스트 / CI              | 회귀 방지                                                |
| JWT Auth                      | Customer·Telephony API 보호. 단일 로컬 관리자 부트스트랩 |
| Soft Delete, E.164, name trim | 데이터 무결성                                            |

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

- Customer keyword search currently uses contains queries. SQLite does not use PostgreSQL `mode: 'insensitive'`.
- Soft-deleted `customerCode` remains unique, so the same code cannot be reused.
- 미사용이던 `bullmq`, WebSocket 패키지는 Lite Level 1에서 제거했다. 전화 Queue를 Redis/BullMQ로 다시 넣지 않는다.
- Docker backend 컨테이너는 호스트 USB/ADB에 접근하지 못한다. 실제 발신은 Desktop EXE 또는 Windows `npm run dev:desktop`으로 실행한다.
- ADB CALL 성공은 다이얼러 실행 성공일 뿐, 상대방 응답 여부와는 다르다.

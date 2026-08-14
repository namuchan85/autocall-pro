# AutoCall Lite

## 1. 프로젝트 목적

AutoCall Lite는 **개인 1명이 자신의 PC에서 사용하는 간단한 오토콜 프로그램**이다.

목표는 대규모 텔레마케팅 SaaS가 아니다. 전화번호를 저장하고, 전화를 걸고, 안내 음성을 재생하고, DTMF 선택을 받아 결과를 저장하는 흐름이 안정적으로 동작하는 것이다.

기존 AutoCall Pro 코드베이스를 삭제하거나 새 저장소를 만들지 않는다. 동작하는 기반(Next.js, NestJS, Prisma, PostgreSQL, Docker, Customer CRUD, Auth)을 재사용하고 방향을 Lite로 전환한다.

이번 단계(Lite Level 1)에서는 **실제 전화를 구현하지 않는다.** 구조와 문서만 Lite에 맞춘다.

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

현재 구현된 핵심은 1번(Customer 저장)과 인증된 API다. 3~8번은 Lite Level 2 이후에서 구현한다.

## 3. 제외 기능

다음 기업용 SaaS 기능은 구현하지 않으며, 이번 단계에서도 추가하지 않는다.

- Multi Tenant / 다중 조직
- 다중 관리자·상담원 관리
- Campaign / CSV 대량 업로드
- 기업용 Audit 로그
- BullMQ Call Queue
- Twilio/SIP 등 Telephony Provider 연동 (Level 2)
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
    modules/calls      예정 — 아직 없음
    modules/messages   예정 — 아직 없음
    modules/telephony  예정 — 아직 없음
    modules/settings   예정 — 아직 없음

apps/backend/prisma/ PostgreSQL + Prisma
docker-compose.yml   postgres, redis, migrate, backend, frontend
```

빈 `calls` / `telephony` 모듈은 만들지 않는다. 다음 단계에서 실제 발신이 필요할 때 추가한다.

## 5. 기본 Call Flow

Lite Level 2 이후의 기본 시나리오다. **DB Model은 아직 생성하지 않는다.**

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

### 향후 Call 개념 (문서만)

| 필드           | 설명                  |
| -------------- | --------------------- |
| id             | UUID                  |
| customerId     | 고객                  |
| phoneNumber    | 발신 시점 번호 스냅샷 |
| status         | 아래 enum             |
| startedAt      | 발신 시작             |
| answeredAt     | 응답                  |
| endedAt        | 종료                  |
| dtmfResult     | DTMF 선택             |
| messageSent    | 문자 발송 여부        |
| providerCallId | 전화 사업자 통화 ID   |
| createdAt      | 생성                  |

예상 status: `PENDING`, `CALLING`, `ANSWERED`, `NO_ANSWER`, `BUSY`, `FAILED`, `COMPLETED`

## 6. Lite Level 1~5 Roadmap

### Lite Level 1 — 구조 정리 (현재)

기존 프로젝트를 Lite 방향으로 단순화한다. 전화·문자·AI는 넣지 않는다.

### Lite Level 2 — 실제 전화 1통

전화 API 또는 SIP Provider를 연결하고, 테스트 번호로 실제 전화 1통을 건다.

준비사항은 이 문서 하단 Next Step과 같다.

### Lite Level 3 — 음성 안내 + DTMF

연결 후 안내 음성을 재생하고 DTMF를 수신한다.

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

# Architecture

## 방향

AutoCall Lite는 개인 1인이 PC에서 실행하는 오토콜 프로그램이다. npm workspaces 모노레포를 유지하되, 기업용 SaaS·멀티테넌트·상담원 관리를 추가하지 않는다.

상세 목적·Call Flow·로드맵은 `docs/AUTOCALL_LITE.md`를 따른다.

Backend는 `presentation → application → domain ← infrastructure` 의존성 방향을 유지한다. 도메인은 NestJS, Prisma 같은 프레임워크에 의존하지 않는다. 전화 Queue용 BullMQ는 사용하지 않는다.

## Backend 경계

- `common`: 전역 필터, 로깅, 파이프 등 횡단 관심사
- `config`: 환경 설정과 검증
- `modules`: `auth`, `customers`. `calls` / `messages` / `telephony` / `settings`는 다음 단계에서 추가
- `infrastructure`: Prisma, Redis (로그인 Rate Limit)

Repository 인터페이스는 domain/application 계층에, Prisma 구현체는 infrastructure 계층에 둔다. DTO는 외부 요청·응답 경계에서만 사용한다.

## 인증 경계

Lite는 단일 사용자다. 이번 단계에서는 **기존 JWT Auth를 유지**한다 (결정 A). 로그인·Customer API·테스트가 이미 이 구조에 의존하므로 대규모 삭제는 하지 않는다.

- Access Token은 Bearer JWT, Refresh Token은 HttpOnly cookie
- Refresh Token 원문은 저장하지 않고 bcrypt hash와 token ID만 저장하며 갱신 시 회전한다
- 로그인 시도는 Redis 고정 윈도우 Rate Limit으로 IP 단위 제한한다
- 향후 로컬 전용이면 Auth 제거(결정 C)를 검토할 수 있다. RBAC 다중 역할은 향후 제거 후보다

## 현재 범위

Swagger, ValidationPipe, 예외 필터, Logger, Prisma PostgreSQL, Redis Health, 관리자 로그인, Customer CRUD가 동작한다. 캠페인, 전화 발신, 문자, AI Voice는 없다.

## 고객 경계

- Customer는 전화번호 저장·조회의 기반이다
- 목록은 Soft Delete되지 않은 행만 반환하며 DELETE는 `deletedAt`만 설정한다
- 전화번호는 E.164 문자열로 검증·저장하고 로그에 남기지 않는다
- Customer `name`은 DTO에서 trim하고, trim 결과가 빈 문자열이면 요청을 거부한다
- `customerCode` 등 여분 필드는 당장 migration으로 제거하지 않는다

## Known Issues / Technical Debt

- Customer keyword search currently uses case-insensitive contains queries across multiple columns. PostgreSQL indexing/search strategy should be reviewed when production data volume and query patterns are known.
- Soft-deleted `customerCode` remains unique, so the same code cannot be reused.
- 향후 완전한 단일 PC 프로그램으로 바꿀 경우 PostgreSQL → SQLite 전환을 검토할 수 있다. 이번 작업에서는 migration하지 않는다.

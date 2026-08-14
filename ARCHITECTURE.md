# Architecture

## 방향

AutoCall Pro는 npm workspaces 모노레포입니다. 프런트엔드, 백엔드, 공유 패키지의 배포 경계를 분명히 유지합니다.

Backend는 향후 `presentation → application → domain ← infrastructure` 의존성 방향을 따릅니다. 도메인은 NestJS, Prisma, BullMQ 같은 프레임워크에 의존하지 않습니다.

## Backend 경계

- `common`: 전역 필터, 로깅, 파이프 등 횡단 관심사
- `config`: 환경 설정과 검증
- `modules`: 기능별 독립 모듈. Level 2에서는 비어 있음
- `shared`: 여러 모듈이 공유하는 도메인 중립 코드
- `infrastructure`: Prisma, Redis, Queue, 외부 시스템 어댑터

Repository 인터페이스는 domain/application 계층에, Prisma 구현체는 infrastructure 계층에 둡니다. DTO는 외부 요청·응답 경계에서만 사용하고 도메인 모델과 분리합니다.

## 인증 경계

- Auth application service는 `AuthRepository` port에 의존하고 Prisma 구현체는 infrastructure에 둡니다.
- Access Token은 Bearer JWT, Refresh Token은 HttpOnly cookie로 전달합니다.
- Refresh Token 원문은 저장하지 않고 bcrypt hash와 token ID만 저장하며 갱신 시 회전합니다.
- JWT Guard와 Roles Guard는 향후 기능 모듈에서 재사용합니다.
- 로그인 시도는 Redis 고정 윈도우 Rate Limit으로 IP 단위 제한합니다.
- Rate Limit 식별 IP는 `TRUST_PROXY`에 따라 직접 연결 주소 또는 Trusted Proxy 전략을 사용합니다.
- 존재하지 않는 계정 조회 시에도 dummy bcrypt hash와 `compare()`를 수행해 응답 시간 차이를 줄입니다.

## 현재 범위

Swagger, ValidationPipe, 예외 필터와 Logger 기반을 연결했습니다. Backend 시작 시 Prisma PostgreSQL 어댑터와 Redis 연결을 확인하며 `/health`가 두 인프라의 준비 상태를 검증합니다. Level 4에는 관리자 인증과 Customer CRUD MVP가 포함되며 캠페인, Queue, CSV 업로드는 없습니다.

## 고객 경계

- Customer application service는 `CustomerRepository` port에 의존하고 Prisma 구현체는 infrastructure에 둡니다.
- 목록은 Soft Delete되지 않은 행만 반환하며 DELETE는 `deletedAt`만 설정합니다.
- 전화번호는 E.164 문자열로 검증·저장하고 로그에 남기지 않습니다.
- Customer `name`은 DTO에서 trim하고, trim 결과가 빈 문자열이면 요청을 거부합니다.

## Known Issues / Technical Debt

- Customer keyword search currently uses case-insensitive contains queries across multiple columns. PostgreSQL indexing/search strategy should be reviewed when production data volume and query patterns are known.

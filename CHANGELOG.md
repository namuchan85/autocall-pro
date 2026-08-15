# Changelog

모든 주요 변경사항은 이 문서에 기록합니다.

## [Unreleased]

### Added

- Level 1 프로젝트 기반
- Next.js 및 NestJS 애플리케이션
- PostgreSQL, Redis, Docker Compose 기반
- Prisma 초기 설정, Swagger, ValidationPipe, 전역 예외 필터, Logger 구조
- ESLint, Prettier, Husky, lint-staged 및 GitHub Actions CI
- Level 2 PostgreSQL·Redis 시작 연결 및 통합 Health API
- Frontend·Backend 컨테이너 Health Check와 전용 Docker network
- Prisma PostgreSQL driver adapter와 필수 환경변수 검증
- Level 3 User·Role·RefreshToken schema, migration, idempotent administrator seed
- JWT Access·Refresh 인증, HttpOnly cookie, Refresh Token 회전과 RBAC Guard
- 관리자 로그인 화면과 보호된 빈 Dashboard
- 로그인 Redis Rate Limit, dummy bcrypt 비교, Login DTO 복잡도 검증 제거, Auth 통합 테스트
- 테스트 ConfigModule 격리와 Trusted Proxy 기반 Client IP 식별
- Level 4 Customer 모델, Soft Delete CRUD, 목록 페이징·검색·필터
- Lite Level 2 USB Galaxy ADB 단건 발신, Call 기록, 대시보드 「전화 걸기」

### Fixed

- Customer `name`은 DTO에서 trim하며 공백만 있는 값은 거부한다

### Changed

- 제품 방향을 AutoCall Lite(개인용 오토콜)로 전환하고 `docs/AUTOCALL_LITE.md`를 추가한다
- 사용하지 않는 BullMQ·WebSocket 의존성을 제거한다

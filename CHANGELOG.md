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

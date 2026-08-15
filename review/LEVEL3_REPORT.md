# Level 3 Report

## 1. 구현 내용

- 관리자 User·Role·RefreshToken 영속 모델
- JWT Access Token과 Refresh Token 로그인
- Refresh Token HttpOnly cookie, bcrypt hash 저장, 갱신 시 회전
- 로그아웃 토큰 폐기와 현재 사용자 조회
- JWT Guard, Roles Guard, Roles Decorator
- Swagger Bearer·cookie 인증 문서
- 관리자 로그인 화면과 인증 확인 후 진입하는 빈 Dashboard
- Docker migration·idempotent seed 선행 서비스

## 2. 생성된 파일

상세 목록은 `CHANGED_FILES.md`를 참조합니다.

## 3. API 목록

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /health`

## 4. DB 모델

- `User`: email, bcrypt password, name, Role, 활성 상태와 생성·수정 시간
- `Role`: SUPER_ADMIN, ADMIN, MANAGER, VIEWER
- `RefreshToken`: 사용자 관계, token hash, 만료·생성 시간

## 5. Migration 결과

`20260814060232_level3_auth_foundation` migration을 PostgreSQL에 생성·적용했습니다. Docker의 `migrate` 서비스가 `migrate deploy` 후 idempotent seed를 실행합니다.

## 6. 테스트 결과

- Unit Test: 6 suites, 11 tests 통과
- Lint, Build, Format 검사 통과
- Docker에서 Login, Me, Refresh, Logout 통합 흐름 통과
- PostgreSQL, Redis, Backend, Frontend health 통과

자세한 실행 결과는 `TEST_RESULT.md`를 참조합니다.

## 7. Swagger 화면

- URL: `http://localhost:3001/swagger` — HTTP 200, Swagger UI 로드 확인
- OpenAPI paths: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`
- securitySchemes: `JWT`, `cookie` (`refresh_token`)
- `GET /auth/me`에 Bearer JWT Authorize 적용
- 브라우저 캡처: `review/swagger.png`, `review/login.png`, `review/dashboard.png`

## 8. TODO — Level 4

- 관리자 생성·수정·비활성화 API
- 비밀번호 변경과 최초 로그인 강제 변경
- Refresh Token 세션 목록·전체 로그아웃
- 감사 로그와 세분화된 권한 정책

## 9. 알려진 제한사항

- Access Token은 Frontend sessionStorage에 보관하므로 향후 BFF 또는 메모리 기반 전략을 검토해야 합니다.
- seed 관리자의 비밀번호 변경 API는 아직 없습니다.
- 계정 잠금, 로그인 rate limit, MFA는 아직 없습니다.
- Dashboard에는 비즈니스 기능이 없습니다.

# Level 3 Test Result

## Automated

- `npm run lint`: 통과
- `npm run test`: 9 suites, 20 tests 통과
- `npm run build`: Backend·Frontend 통과
- `npm run format:check`: 통과
- `npm audit`: 취약점 0건

## Unit Coverage Scenarios

- 유효한 관리자 로그인과 JWT 발급
- 잘못된 로그인 거부
- Access JWT payload와 활성 사용자 검증
- Roles Guard 허용·거부
- bcrypt password hash·비교
- password 정책 거부
- 환경변수 정규화·필수값 검증
- 인프라 Health 응답
- 존재하지 않는 계정에 dummy bcrypt compare
- 로그인 Rate Limit Guard 허용·429
- Redis Rate Limiter 한도 초과와 Redis 장애 시 실패 닫힘
- Login → Refresh 회전 → Logout → Refresh 실패 통합 시나리오
- 로그인 비밀번호 복잡도 정책 미적용
- 로그인 Rate Limit 초과 429

## Database

- migration 생성·적용 성공
- 최초 관리자 seed 생성 성공
- Docker 반복 seed 시 기존 관리자 유지 확인

## Docker Integration

- PostgreSQL healthy
- Redis healthy
- Backend healthy
- Frontend healthy
- Login 성공 (`admin@autocall.local`, Access JWT 발급)
- `/auth/me` 성공 (SUPER_ADMIN)
- Frontend `/auth/login` 프록시 로그인 성공
- Login·Dashboard·Swagger HTTP 200
- Seed 비밀번호는 `$2b$` bcrypt hash로 저장됨

## Browser

- `/login`에서 seed 관리자 로그인 후 `/dashboard`로 이동
- 대시보드에 `Welcome AutoCall Pro`만 표시
- 잘못된 비밀번호는 `이메일 또는 비밀번호를 확인해주세요.` 표시
- Swagger UI Authorize 버튼과 auth API 4개 확인
- 화면 캡처: `review/login.png`, `review/dashboard.png`, `review/login-error.png`, `review/swagger.png`

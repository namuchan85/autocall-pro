# Level 3 Test Result

## Automated

- `npm run lint`: 통과
- `npm run test`: 6 suites, 11 tests 통과
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

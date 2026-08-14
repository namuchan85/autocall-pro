# AutoCall Pro

AI 기반 텔레마케팅 오토콜 시스템을 위한 장기 프로젝트입니다. 현재 Level 3는 관리자 JWT 인증과 RBAC 기반을 제공합니다.

## 기술 스택

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: NestJS, TypeScript, REST, WebSocket, Swagger
- Data: PostgreSQL, Prisma, Redis, BullMQ
- Quality: Jest, ESLint, Prettier, Husky, lint-staged
- Deployment: Docker Compose

## 사전 요구사항

- Node.js 22.12 이상
- npm 10.8 이상
- Docker Desktop

## 로컬 실행

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run dev:backend
npm run dev:frontend
```

`.env`의 인프라 URL, JWT secret, `SEED_ADMIN_PASSWORD`를 직접 입력해야 합니다. JWT secret은 각각 32자 이상이어야 하며 seed 비밀번호는 저장소에 커밋하지 않습니다.

## Docker 실행

```bash
docker compose up --build
docker compose ps
docker compose down
```

정상 실행 후 다음 주소를 확인합니다.

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:3001/health`
- Swagger: `http://localhost:3001/swagger`

Health API는 PostgreSQL과 Redis 연결을 모두 확인한 경우에만 `{"status":"ok"}`를 반환합니다. Compose의 계정과 비밀값은 로컬 개발 전용이며 운영 환경에서는 secret manager로 교체해야 합니다.

## 관리자 인증

- Seed email: `admin@autocall.local`
- Seed password: `.env`의 `SEED_ADMIN_PASSWORD`
- Login: `POST /auth/login`
- Refresh: `POST /auth/refresh`
- Logout: `POST /auth/logout`
- Current user: `GET /auth/me`

Refresh Token은 HttpOnly 쿠키로 전달되고 DB에는 bcrypt hash만 저장됩니다. `POST /auth/login`은 Redis 고정 윈도우로 IP당 기본 5회/60초 제한합니다. 기존 ioredis를 사용하므로 별도의 Rate Limit 라이브러리는 추가하지 않았습니다. 통합 테스트에는 Nest HTTP 시나리오 검증용 `supertest`만 개발 의존성으로 추가했습니다.

최초 로그인 후 seed 비밀번호를 변경하는 기능은 다음 단계에서 추가해야 합니다.

## 개발 규칙

변경 전 `AGENTS.md`와 `DEVELOPMENT_RULES.md`를 확인합니다. 커밋 전 lint-staged가 실행되며 CI는 Install, Lint, Test, Build를 검증합니다.

## 프로젝트 구조

```text
apps/
  frontend/       Next.js 애플리케이션
  backend/        NestJS 애플리케이션
packages/
  shared/         공유 타입과 유틸리티 예정
  ui/             공유 UI 예정
  config/         공유 설정 예정
docs/             상세 문서
docker/           Dockerfile
scripts/          개발 스크립트
.github/          GitHub Actions
```

# AutoCall Pro

AI 기반 텔레마케팅 오토콜 시스템을 위한 장기 프로젝트입니다. 현재 Level 2는 비즈니스 기능 없이 실행 가능한 Project Skeleton을 제공합니다.

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
npm run dev:backend
npm run dev:frontend
```

`.env`의 `DATABASE_URL`과 `REDIS_URL`은 로컬 PostgreSQL과 Redis에 맞게 입력해야 합니다. Backend는 기본 3001, Frontend는 3000 포트를 사용합니다.

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

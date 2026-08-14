# Level 3 Architecture Diff

## 이전

- 실행 가능한 Frontend·Backend skeleton
- PostgreSQL·Redis 연결과 Health Check
- Prisma에는 비즈니스 모델이 없음

## 이후

- `modules/auth/domain`: 인증 port와 프레임워크 중립 타입
- `modules/auth/infrastructure`: Prisma 기반 AuthRepository 구현
- `modules/auth/security`: password 정책과 bcrypt 처리
- `modules/auth/guards`: Passport JWT와 RBAC 경계
- `modules/auth/dto`: ValidationPipe·Swagger 요청/응답 계약
- Prisma migration과 idempotent seed
- Docker `migrate` one-shot 서비스가 Backend보다 먼저 실행
- Frontend는 Login → Dashboard 인증 흐름만 제공

## 의존성 방향

AuthService는 PrismaService에 직접 의존하지 않고 `AuthRepository` token을 사용합니다. Prisma 구현은 infrastructure에 위치하고 JWT·HTTP cookie 처리는 application/controller 경계에서 담당합니다.

## 범위 제외

Customer, Campaign, CSV, Call, Telephony, Queue, AI 관련 모듈과 DB 모델은 추가하지 않았습니다.

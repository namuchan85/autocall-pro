# Architecture

## 방향

AutoCall Pro는 npm workspaces 모노레포입니다. 프런트엔드, 백엔드, 공유 패키지의 배포 경계를 분명히 유지합니다.

Backend는 향후 `presentation → application → domain ← infrastructure` 의존성 방향을 따릅니다. 도메인은 NestJS, Prisma, BullMQ 같은 프레임워크에 의존하지 않습니다.

## Backend 경계

- `common`: 전역 필터, 로깅, 파이프 등 횡단 관심사
- `config`: 환경 설정과 검증
- `modules`: 기능별 독립 모듈. Level 1에서는 비어 있음
- `shared`: 여러 모듈이 공유하는 도메인 중립 코드
- `infrastructure`: Prisma, Redis, Queue, 외부 시스템 어댑터

Repository 인터페이스는 domain/application 계층에, Prisma 구현체는 infrastructure 계층에 둡니다. DTO는 외부 요청·응답 경계에서만 사용하고 도메인 모델과 분리합니다.

## 현재 범위

Swagger, ValidationPipe, 예외 필터와 Logger 기반만 연결했습니다. Prisma는 모델 없이 초기화했으며 Redis, BullMQ, WebSocket 패키지는 설치만 되어 있습니다.

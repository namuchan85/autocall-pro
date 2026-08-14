# Roadmap

## Level 1 — Foundation

- 모노레포, 앱 기본 구조, 품질 도구, Docker, CI, 문서

## Level 2 — Project Skeleton

- PostgreSQL·Redis 실제 연결과 통합 Health Check
- Frontend·Backend 컨테이너 Health Check와 전용 Docker network
- `/swagger`, `/health`, 환경변수 검증

## Level 3 — Core Platform

- User·Role·RefreshToken 모델과 migration
- JWT 로그인·갱신·로그아웃·현재 사용자 API
- RBAC Guard와 관리자 로그인 UI

## Level 4 — User Administration

- 관리자 생성·수정·비활성화와 비밀번호 변경
- 감사 로그와 Refresh Token 세션 관리
- 개인정보 동의·수신거부 정책 확정

## 이후 단계

- 비동기 작업과 실시간 상태
- 통신 사업자 연동
- 운영 관측성, 보안 강화, 부하·복구 테스트
- 별도 승인 후 STT/TTS/LLM 기능 검토

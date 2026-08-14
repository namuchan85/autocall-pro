# Level 3 Security Report

## 적용 사항

- password는 bcrypt hash만 DB에 저장
- Refresh Token은 HttpOnly·SameSite cookie로 전달
- Refresh Token 원문은 DB에 저장하지 않고 bcrypt hash만 저장
- Refresh 시 기존 token을 폐기하고 새 token으로 회전
- Access·Refresh JWT secret 분리 및 최소 32자 검증
- seed password는 필수 환경변수이며 Git에 저장하지 않음
- 로그인 실패 응답으로 계정 존재 여부를 노출하지 않음
- 존재하지 않는 계정도 dummy bcrypt hash와 compare를 수행
- `POST /auth/login`에 Redis IP Rate Limit 적용 (기본 5회/60초)
- 로그인 DTO는 비밀번호 복잡도 정책을 적용하지 않음
- 비활성 사용자는 로그인과 JWT 인증에서 차단
- API 응답과 로그에서 password·token 원문 제외
- Role metadata와 Guard를 통한 RBAC 기반 제공

## 알려진 위험과 후속 작업

- 공개 개발 계정 email은 알려져 있으므로 운영 seed를 사용하지 않아야 함
- 최초 로그인 비밀번호 강제 변경 미구현
- MFA, 계정 잠금 미구현
- Access Token sessionStorage 보관은 XSS 영향을 받으므로 CSP와 BFF 전략 검토 필요
- Refresh Token 재사용 탐지와 전체 token family 폐기 미구현
- 운영 환경은 HTTPS와 `COOKIE_SECURE=true`가 필수

## 비밀정보 관리

`.env`는 Git에서 제외됩니다. 운영 secret은 Docker Compose 파일이나 GitHub 변수에 평문으로 넣지 않고 배포 플랫폼의 secret manager에서 주입해야 합니다.

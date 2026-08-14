# Roadmap

상세 방향은 `docs/AUTOCALL_LITE.md`를 따른다.

## Lite Level 1 — 구조 정리 (현재)

- 기업용 SaaS 방향에서 개인용 AutoCall Lite로 전환
- 기존 Auth·Customer·Docker·테스트를 유지
- 전화·문자·AI는 구현하지 않음

## Lite Level 2 — 실제 전화 1통

- 전화 API 또는 SIP Provider 연결
- 테스트 전화번호로 실제 발신 1통

## Lite Level 3 — 음성 안내 + DTMF

- 연결 후 안내 음성 재생
- DTMF 키 수신

## Lite Level 4 — 문자·결과·UI

- 문자 발송
- 통화 결과 저장·조회
- 전화번호 목록, 발신, 결과, 설정 화면

## Lite Level 5 — 선택적 AI Voice

- 1~4가 안정된 뒤에만 STT / LLM / TTS 검토

## 완료한 기반 (재사용)

- 모노레포, Docker, CI, PostgreSQL, Redis Health
- JWT 로그인과 Customer CRUD MVP

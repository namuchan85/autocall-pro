# Roadmap

상세 방향은 `docs/AUTOCALL_LITE.md`를 따른다.

## Lite Level 1 — 구조 정리

- 기업용 SaaS 방향에서 개인용 AutoCall Lite로 전환
- 기존 Auth·Customer·Docker·테스트를 유지

## Lite Level 2 — 실제 전화 1통 (현재)

- USB Galaxy + ADB로 고객 번호 1통 발신
- Call 기록 (`REQUESTED` / `STARTED` / `FAILED`)
- 대시보드 고객 목록과 「전화 걸기」

## Lite Level 3 — 음성 안내 + DTMF

- 연결 후 안내 음성 재생
- DTMF 키 수신

## Lite Level 4 — 문자·결과·UI

- 문자 발송
- 통화 결과 저장·조회
- 발신·결과·설정 화면 보강

## Lite Level 5 — 선택적 AI Voice

- 1~4가 안정된 뒤에만 STT / LLM / TTS 검토

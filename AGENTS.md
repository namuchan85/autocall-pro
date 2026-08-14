# AI Agent Instructions

1. 모든 답변과 문서는 한국어를 기본으로 한다.
2. 현재 단계의 범위를 확인하고 요청되지 않은 비즈니스 기능을 만들지 않는다.
3. 한 번에 하나의 경계가 분명한 작업을 수행한다.
4. 변경 전 관련 문서와 코드를 읽고 기존 아키텍처를 따른다.
5. TypeScript strict를 유지하며 `any`와 무분별한 타입 단언을 피한다.
6. Controller는 전달, Service는 유스케이스 조정, Repository는 영속성 추상화를 담당한다.
7. 도메인 계층에서 Prisma, NestJS, BullMQ에 직접 의존하지 않는다.
8. 환경변수, 전화번호, 녹취, API 키 등 비밀·개인정보를 코드나 로그에 남기지 않는다.
9. 변경에는 적절한 테스트를 추가하고 lint, test, build 결과를 확인한다.
10. 의존성 추가 전 기존 기능으로 해결 가능한지 확인하고 추가 이유를 기록한다.
11. PR을 만든 뒤에는 Codex 리뷰용 PR 링크를 답변 맨 마지막에만 둔다. 본문 중간에 반복하지 않는다.
12. 현재 목표는 AutoCall Lite다. Campaign, 상담원, Multi Tenant, 기업용 SaaS 기능을 추가하지 않는다.
13. Telephony, SMS, STT, TTS, LLM, BullMQ Call Queue는 해당 Lite Level이 오기 전에 구현하지 않는다.
14. 변경 전 `docs/AUTOCALL_LITE.md`의 현재 단계 범위를 확인한다.

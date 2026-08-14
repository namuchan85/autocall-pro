# Development Rules

- TypeScript strict mode와 SOLID 원칙을 유지한다.
- 기능은 `modules/<feature>` 아래에서 presentation, application, domain, infrastructure 계층으로 분리한다.
- DTO에 class-validator를 사용하고 전역 ValidationPipe를 우회하지 않는다.
- 서비스가 Prisma Client나 외부 SDK에 직접 의존하지 않도록 Repository/Port 인터페이스를 둔다.
- 예외와 로그에 개인정보나 인증 정보를 포함하지 않는다.
- 포맷은 Prettier, 정적 분석은 ESLint를 단일 기준으로 사용한다.
- 완료 조건은 관련 테스트, lint, build 통과와 문서 갱신이다.
- 환경별 값은 `.env` 또는 배포 환경의 secret manager에서 주입한다.
- 데이터베이스 스키마 변경은 Prisma migration과 함께 리뷰한다.
- API 변경은 Swagger 설명과 버전 호환성을 함께 검토한다.
- 제품 방향은 AutoCall Lite다. 요청된 Lite Level 범위 밖의 전화·문자·AI·SaaS 기능을 추가하지 않는다.
- `docs/AUTOCALL_LITE.md`를 제품 목적과 로드맵의 기준으로 삼는다.

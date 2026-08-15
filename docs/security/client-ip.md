# Client IP 정책

로그인 Rate Limit은 클라이언트 식별값으로 IP를 사용합니다. 잘못된 식별은 한 사용자만 차단해야 할 때 전체를 막거나, 반대로 공격자가 한도를 우회하게 만듭니다.

## 모드

### 직접 연결 (`TRUST_PROXY=false`)

로컬 개발과 현재 Docker Compose 기본값입니다. 식별값은 TCP 피어 주소(`socket.remoteAddress`)만 사용합니다. `X-Forwarded-For`는 클라이언트가 위조할 수 있으므로 읽지 않습니다.

### Trusted Proxy (`TRUST_PROXY=true`)

운영에서 Nginx, AWS ALB, Cloudflare 같은 **우리가 관리하는 프록시** 뒤에 둘 때만 켭니다. 애플리케이션은 Express `trust proxy`를 `TRUST_PROXY_HOPS` hop만큼 설정하고, Rate Limit 식별은 프록시가 기록한 오른쪽 끝 `X-Forwarded-For` 값을 사용합니다.

클라이언트가 헤더 왼쪽에 넣은 주소는 신뢰하지 않습니다. hop 수는 실제 프록시 계층 수와 같아야 합니다. 보통 리버스 프록시가 하나이면 `TRUST_PROXY_HOPS=1`입니다.

## 운영 체크리스트

- HTTPS 종료 프록시가 애플리케이션 바로 앞에 있는지 확인합니다.
- 프록시가 연결 클라이언트 IP를 `X-Forwarded-For`에 덧붙이거나 덮어쓰는지 확인합니다.
- `TRUST_PROXY=true`, `TRUST_PROXY_HOPS`를 실제 hop 수에 맞춥니다.
- 프록시 없이 공인망에 애플리케이션을 노출한 채 `TRUST_PROXY=true`로 두지 않습니다.

## 설정

| 변수               | 기본값  | 의미                 |
| ------------------ | ------- | -------------------- |
| `TRUST_PROXY`      | `false` | 프록시 신뢰 여부     |
| `TRUST_PROXY_HOPS` | `1`     | 신뢰할 프록시 hop 수 |

구현 위치: `apps/backend/src/common/http/client-ip.ts`, `apps/backend/src/main.ts`.

Docker Compose에서 Next.js 프록시를 통한 확인 절차와 결과 기록 양식은 `docs/security/client-ip-verification.md`를 사용합니다.

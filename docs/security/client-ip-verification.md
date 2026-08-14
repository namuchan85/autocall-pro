# Level 3 Client IP 운영 검증 체크리스트

Docker Compose에서 브라우저 → Next.js(`/auth` rewrite) → Backend로 전달되는 Client IP와 로그인 Rate Limit 식별값을 확인합니다. 이 문서는 검증 절차와 결과 기록 양식만 다룹니다. 애플리케이션 코드 변경은 하지 않습니다.

정책 배경은 `docs/security/client-ip.md`를 참조합니다.

## 현재 Compose 기준값

| 항목               | 값                                                                  |
| ------------------ | ------------------------------------------------------------------- |
| Frontend           | `http://localhost:3000`                                             |
| Backend            | `http://localhost:3001`                                             |
| 프록시 경로        | Next.js rewrite ` /auth/:path*` → `http://backend:3001/auth/:path*` |
| `TRUST_PROXY`      | `false` (기본)                                                      |
| `TRUST_PROXY_HOPS` | `1`                                                                 |
| Rate Limit         | IP당 5회 / 60초, Redis 키 `auth:login:<identity>`                   |

로그인 화면은 빈 `NEXT_PUBLIC_API_URL` 때문에 브라우저가 `http://localhost:3000/auth/login`을 호출합니다. 백엔드가 보는 TCP 피어는 사용자 PC가 아니라 **frontend 컨테이너**입니다.

## 준비

1. `docker compose up --build` 후 `docker compose ps`에서 postgres, redis, backend, frontend가 `healthy`인지 확인합니다.
2. 비밀번호는 `.env`의 `SEED_ADMIN_PASSWORD`만 사용하고 기록지에 적지 않습니다.
3. Rate Limit 확인에는 **잘못된 비밀번호**를 사용합니다. 성공 로그인을 반복하면 Refresh Token만 늘어납니다.
4. 창 사이 대기 시간이 60초를 넘으면 카운터가 초기화됩니다.
5. 애플리케이션에 IP 로그를 넣지 않습니다. 식별값은 Redis 키로, 원본 헤더는 아래 관측 방법으로 확인합니다.

## 관측 방법

### A. Rate Limit 식별값 (실제 적용 IP)

로그인 시도 직후:

```bash
docker compose exec redis redis-cli KEYS "auth:login:*"
docker compose exec redis redis-cli GET "auth:login:<위에서 확인한 identity>"
docker compose exec redis redis-cli TTL "auth:login:<identity>"
```

키의 `<identity>`가 Guard가 사용한 Client IP입니다. IPv4-mapped IPv6이면 `::ffff:` 접두시가 제거된 값이어야 합니다.

검증 사이에 카운터를 비우려면 해당 키만 삭제합니다.

```bash
docker compose exec redis redis-cli DEL "auth:login:<identity>"
```

### B. 요청 경로 두 가지

| 경로   | 호출                                    | Backend가 보는 TCP 피어   |
| ------ | --------------------------------------- | ------------------------- |
| 프록시 | `POST http://localhost:3000/auth/login` | frontend 컨테이너 IP      |
| 직접   | `POST http://localhost:3001/auth/login` | 호스트/게이트웨이 쪽 주소 |

PowerShell 예시 (비밀번호는 환경변수로만 전달):

```powershell
$body = '{"email":"admin@autocall.local","password":"wrong-password"}'
Invoke-WebRequest -Uri http://localhost:3000/auth/login -Method POST -ContentType application/json -Body $body -UseBasicParsing
Invoke-WebRequest -Uri http://localhost:3001/auth/login -Method POST -ContentType application/json -Body $body -UseBasicParsing
```

브라우저 개발자 도구 Network에서 `/auth/login` 요청의 Request Headers를 함께 캡처합니다. 여기서 보이는 `X-Forwarded-For`는 **브라우저 → frontend** 구간입니다. frontend → backend 구간은 경로 B의 Redis 키와 아래 선택 관측으로 확인합니다.

### C. 원본 헤더 (선택)

코드에 디버그 로그를 추가하지 않습니다. frontend → backend의 `X-Forwarded-For`를 직접 보려면 Docker 네트워크에서 패킷을 캡처합니다. 캡처 결과는 기록지에만 남기고 저장소에 넣지 않습니다.

## 체크 항목

### 1. `request.ip`

`TRUST_PROXY=false`이면 Express `request.ip`는 TCP 피어와 같아야 합니다. Redis 식별값이 프록시 경로에서는 frontend 컨테이너 IP, 직접 경로에서는 호스트 측 주소와 일치하는지 기록합니다.

기대:

- 프록시 경로와 직접 경로의 식별값이 **다릅니다**.
- 프록시 경로 식별값은 브라우저 공인 IP가 아닙니다.

### 2. `remoteAddress`

`socket.remoteAddress`는 backend가 받아들인 TCP 연결의 상대 주소입니다. `TRUST_PROXY=false`에서 Rate Limit 식별값과 같아야 합니다. IPv6로 보이면 `::ffff:x.x.x.x` 정규화 후 비교합니다.

기대:

- 프록시 경로: frontend 컨테이너 IPv4
- 직접 경로: `172.x` / `192.168.x` / `::1` 등 Docker 또는 호스트 게이트웨이

frontend 컨테이너 IP 확인:

```bash
docker compose exec frontend hostname -i
```

### 3. `X-Forwarded-For`

세 지점을 구분해 기록합니다.

| 지점                | 확인 방법                                         |
| ------------------- | ------------------------------------------------- |
| 브라우저 → frontend | 개발자 도구 Request Headers                       |
| 검증용 위조 헤더    | 직접 경로에 `X-Forwarded-For: 198.51.100.1` 추가  |
| frontend → backend  | 선택 패킷 캡처. 없으면 Redis 식별값으로 간접 확인 |

기대 (`TRUST_PROXY=false`):

- 위조 `X-Forwarded-For: 198.51.100.1`을 직접 경로에 넣어도 Redis 키가 `198.51.100.1`이 **되면 안 됩니다**.
- 식별값은 계속 TCP 피어여야 합니다.

### 4. `TRUST_PROXY=false` (Compose 기본, Level 3 종료 필수)

1. Redis 로그인 키를 비웁니다.
2. 프록시 경로로 잘못된 비밀번호를 5회 호출 → 모두 HTTP 401.
3. 6회째 → HTTP 429, `Retry-After` 존재.
4. 같은 윈도우에서 **직접 경로**로 1회 호출 → 401이어야 합니다. 429이면 두 경로가 같은 식별값을 쓰는 것이므로 기록지에 예외로 남깁니다.
5. 위조 `X-Forwarded-For` 후에도 식별값이 바뀌지 않는지 확인합니다.

통과 기준:

- 프록시 경로 6회째 429
- 위조 헤더로 한도가 우회되지 않음
- 식별값은 TCP 피어

알려진 제한 (실패가 아님):

- Compose 기본값에서는 프록시 경로를 쓰는 모든 브라우저가 **같은 frontend IP**로 집계될 수 있습니다. 항목 6에서 확인합니다.

### 5. `TRUST_PROXY=true` (별도 테스트 환경, 운영 전환 전)

기본 Compose 값을 바꾸지 말고, 검증이 끝나면 반드시 `false`로 되돌립니다.

1. backend만 `TRUST_PROXY=true`, `TRUST_PROXY_HOPS=1`로 재생성합니다.
2. Redis 키를 비웁니다.
3. 직접 경로에 `X-Forwarded-For: 203.0.113.50`을 넣어 1회 호출합니다.
4. Redis 키가 `auth:login:203.0.113.50`인지 확인합니다.
5. 같은 헤더로 5회 더 호출해 6회째 429인지 확인합니다.
6. `X-Forwarded-For: 198.51.100.1, 203.0.113.50`이면 hop=1에서 **오른쪽 끝** `203.0.113.50`을 쓰는지 확인합니다. 왼쪽 `198.51.100.1`로 키가 생기면 실패입니다.
7. 프록시 경로(localhost:3000)도 1회 호출해, Next rewrite가 넘긴 forwarded 값이 식별값에 반영되는지 기록합니다. Next가 헤더를 안 넘기면 TCP 피어로 남을 수 있습니다. 그 경우 운영 앞단에 헤더를 넣는 리버스 프록시가 필요합니다.
8. 검증 후 `TRUST_PROXY=false`로 되돌리고 backend를 재생성합니다.

이 항목은 Level 3 Compose 기본 종료 조건이 아닙니다. 운영 앞단 프록시를 붙이기 전에만 수행합니다.

### 6. 서로 다른 클라이언트의 Rate Limit 독립성

**A. 같은 호스트, 프록시 경로 두 브라우저 (`TRUST_PROXY=false`)**

1. Redis 키를 비웁니다.
2. 브라우저 1에서 프록시 경로로 3회 실패.
3. 브라우저 2에서 프록시 경로로 3회 실패.
4. Redis 키 개수를 기록합니다.

기대: 키가 1개이면 두 브라우저는 같은 클라이언트로 집계된 것입니다. Compose 기본값에서 예상 가능한 결과입니다. 독립 적용이 필요하면 Trusted Proxy와 실제 클라이언트 IP 전달이 필요합니다.

**B. 프록시 경로 vs 직접 경로 (`TRUST_PROXY=false`)**

1. 프록시 경로로 5회 실패 후 6회째 429.
2. 즉시 직접 경로 1회 → 401이면 식별값이 독립입니다.

**C. `TRUST_PROXY=true` 별도 환경**

1. `X-Forwarded-For: 203.0.113.10`으로 5회 실패.
2. `X-Forwarded-For: 203.0.113.20`으로 1회 → 401이면 독립 적용입니다.
3. 첫 주소로 한 번 더 호출 → 429여야 합니다.

## 결과 기록 양식

복사해서 검증 로그에 채웁니다. 비밀번호, Access Token, 쿠키 원문은 적지 않습니다.

```text
검증일:
검증자:
Compose 프로젝트:
backend TRUST_PROXY:
backend TRUST_PROXY_HOPS:
LOGIN_RATE_LIMIT_MAX / WINDOW:
frontend 컨테이너 IP:
```

### 관측값

| 경로            | HTTP | Redis 키 identity | 추정 request.ip | 추정 remoteAddress | 관측 X-Forwarded-For | 비고 |
| --------------- | ---- | ----------------- | --------------- | ------------------ | -------------------- | ---- |
| 프록시 :3000    |      |                   |                 |                    |                      |      |
| 직접 :3001      |      |                   |                 |                    |                      |      |
| 직접 + 위조 XFF |      |                   |                 |                    |                      |      |

### 판정

| #   | 항목                        | 기대                                                         | 실제 | 통과     |
| --- | --------------------------- | ------------------------------------------------------------ | ---- | -------- |
| 1   | request.ip                  | TRUST_PROXY=false에서 TCP 피어와 동일, 브라우저 공인 IP 아님 |      |          |
| 2   | remoteAddress               | 프록시는 frontend IP, 직접은 호스트/게이트웨이               |      |          |
| 3   | X-Forwarded-For             | false일 때 위조 헤더가 식별값을 바꾸지 않음                  |      |          |
| 4   | TRUST_PROXY=false           | 5회 401 후 6회 429, 위조 헤더 우회 없음                      |      |          |
| 5   | TRUST_PROXY=true            | 오른쪽 끝 forwarded IP로 키 생성, 검증 후 false 복구         |      | N/A 또는 |
| 6a  | 두 브라우저 + 프록시        | 키 개수와 공유 여부 기록                                     |      | 기록     |
| 6b  | 프록시 vs 직접              | 한쪽 429여도 다른 쪽 401                                     |      |          |
| 6c  | 서로 다른 XFF (true일 때만) | 주소별로 한도 독립                                           |      | N/A 또는 |

### 결론

```text
Level 3 Compose 기본(TRUST_PROXY=false) 종료 가능: 예 / 아니오
운영 전환 전 TRUST_PROXY=true 재검증 필요: 예 / 아니오
특이사항:
```

## Level 3 종료 최소 통과선

다음이 모두 맞으면 Compose 기준 Level 3 Client IP 검증을 통과한 것으로 봅니다.

- 항목 1~4 통과
- 항목 6b 통과 (프록시 경로와 직접 경로의 한도가 분리됨)
- 항목 6a는 결과를 기록하면 됩니다. 두 브라우저가 한도를 공유해도 Compose 기본값의 알려진 제한입니다.
- 항목 5는 운영 프록시 도입 전에 별도 수행합니다.

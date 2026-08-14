# Level 4 Report

## 구현 내용

- Customer Prisma 모델과 `CustomerStatus` enum
- JWT 보호 Customer CRUD API
- 목록 페이징, keyword 검색, status·doNotCall 필터
- Soft Delete (`deletedAt`)
- E.164 전화번호와 customerCode unique 검증
- Swagger `customers` 태그

## API

- `POST /customers` — SUPER_ADMIN, ADMIN, MANAGER
- `GET /customers` — 모든 인증 역할
- `GET /customers/:id` — 모든 인증 역할
- `PATCH /customers/:id` — SUPER_ADMIN, ADMIN, MANAGER
- `DELETE /customers/:id` — SUPER_ADMIN, ADMIN, MANAGER (Soft Delete)

## DB 모델

- `Customer`: customerCode unique, name, phoneNumber, company, memo, status, doNotCall, deletedAt
- `CustomerStatus`: ACTIVE, INACTIVE, BLOCKED

## 이번 단계에 포함하지 않음

CSV Upload, Campaign, Queue, Dialer, Telephony, AI, Scheduler

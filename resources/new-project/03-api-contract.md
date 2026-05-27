# API Contract

> Controller 1개 = 섹션 1개.
> 이 문서가 곧 Swagger 명세입니다. 여기 없는 엔드포인트는 구현하지 않습니다.

## 1. 공통 규약

### Base URL
- Local: `http://localhost:<port>`
- Staging: `http://mcp-agents-staging-alb-249976027.us-east-1.elb.amazonaws.com:<port>`

### 응답 포맷
**성공**
```json
{ "data": <payload>, "meta": { ... } }
```
> 단순 리소스 응답은 `data` 없이 객체를 그대로 반환해도 됨 (controller 단위로 일관).

**에러** (전역 ExceptionFilter)
```json
{
  "code": "RESOURCE_NOT_FOUND",
  "message": "Human readable",
  "details": { ... },
  "traceId": "<uuid>"
}
```

### 상태 코드 사용 규칙
| 코드 | 용도 |
|---|---|
| 200 | 조회/수정 성공 |
| 201 | 생성 성공 (`Location` 헤더 포함) |
| 204 | 삭제 성공 (body 없음) |
| 400 | validation 실패 |
| 401 | 인증 누락/실패 |
| 403 | 권한 부족 |
| 404 | 리소스 없음 |
| 409 | conflict (unique 위반 등) |
| 422 | 비즈니스 규칙 위반 |
| 500 | 서버 에러 (filter가 자동 래핑) |

### 페이지네이션 (목록 조회 공통)
- Query: `?page=1&limit=20&sort=createdAt:desc`
- Response:
```json
{
  "data": [...],
  "meta": { "page": 1, "limit": 20, "total": 123, "totalPages": 7 }
}
```

### 인증
- 기본: `Authorization: Bearer <jwt>`
- 예외 엔드포인트는 컨트롤러 메서드에 `@Public()` 표기.

## 2. 엔드포인트 명세

### 2.1 `HealthController`
- Base path: `/health`
- Guards: `@Public()`
- Endpoints:
  - `GET /` → `200 { status, uptime, version }`

### 2.2 `<FeatureController>` — TBD
> 아래 블록을 복제해 작성.

- Base path: `/api/<resource>`
- Guards: `JwtAuthGuard` (기본)
- Swagger tag: `<resource>`

#### `POST /api/<resource>`
- **Body**: `Create<X>Dto`
- **Response**: `201 <X>ResponseDto`
- **Errors**: 400, 401, 409
- **Description**: TBD

#### `GET /api/<resource>/:id`
- **Params**: `id: uuid`
- **Response**: `200 <X>ResponseDto`
- **Errors**: 401, 404

#### `GET /api/<resource>`
- **Query**: `page`, `limit`, `sort`, `<filter fields>`
- **Response**: `200 { data: <X>ResponseDto[], meta }`

#### `PATCH /api/<resource>/:id`
- **Body**: `Update<X>Dto` (partial)
- **Response**: `200 <X>ResponseDto`
- **Errors**: 400, 401, 404, 422

#### `DELETE /api/<resource>/:id`
- **Response**: `204`
- **Errors**: 401, 404

## 3. DTO 정의 템플릿
> DTO는 모듈 내 `dto/` 폴더에 위치.
> `class-validator` 데코레이터로 규칙 명시 — 이 문서가 진실의 원천.

### `Create<X>Dto`
| 필드 | 타입 | 필수 | 검증 |
|---|---|---|---|
| name | string | Y | `@IsString() @MaxLength(100)` |
| ... | ... | ... | ... |

### `<X>ResponseDto`
| 필드 | 타입 | 비고 |
|---|---|---|
| id | string (uuid) | |
| createdAt | string (ISO) | |
| ... | ... | ... |

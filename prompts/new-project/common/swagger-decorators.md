# common/swagger-decorators — OpenAPI 데코레이터 시그니처 (Critical)

`@nestjs/swagger` 데코레이터 옵션은 아래 화이트리스트만 허용. 환각으로 없는 키 추가 금지 (위반 시 TS 컴파일 실패).

## `@ApiQuery({ ... })` 허용 키 (실제 ApiQueryOptions 타입)
- `name`, `description`, `required`, `deprecated`, `allowEmptyValue`
- `type`, `enum`, `enumName`, `example`, `examples`
- `isArray`, `explode`, `style`
- **NO `format`, `pattern`, `schema`**

UUID 같은 형식 명시는 다음 중 하나로:
- (a) DTO 에 `@IsUUID()` 적용 (권장)
- (b) `@ApiQuery({ name: 'id', type: String, description: 'UUID v4' })` — type 만, format 은 빼고
- (c) `@ApiParam(...)` 도 동일 규칙

**올바른 예:**
```ts
@ApiQuery({ name: 'postId', required: true, type: String, description: 'Post UUID' })
@Get() list(@Query('postId', new ParseUUIDPipe()) postId: string) { ... }
```

**잘못된 예 (관측 사례 2026-06-07 PR #68):**
```ts
@ApiQuery({ name: 'postId', required: true, type: String, format: 'uuid' })  // TS2353
```

## `@ApiParam({ ... })` 허용 키
- `name`, `description`, `required`, `deprecated`
- `type`, `enum`, `enumName`, `example`, `examples`
- **NO `format`, `schema`**

## `@ApiBody({ ... })` 허용 키
- `description`, `required`, `type`, `isArray`, `examples`, `schema` (OK), `enum`
- **NO `format` 최상위** (schema 안에서만)

## `@ApiResponse({ ... })` 허용 키
- `status`, `description`, `type`, `isArray`, `schema`, `examples`, `headers`, `links`
- **NO `format`**

## `@ApiProperty({ ... })` (DTO 필드용)
OpenAPI Schema 그대로 매핑 → `format`, `example`, `enum`, `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `nullable` 등 모두 OK.

## 검증 룰
모든 controller/dto 파일 산출 후, `@Api*({ ... })` 안에 위 허용 키만 있는지 self-check. 어긋나면 해당 키 제거하고 DTO 검증 데코레이터(`@IsUUID`, `@Matches` 등)로 대체.

# 입력 검증 (공통 — Nest.js)

## 원칙

- Controller 진입 직후 자동 검증 (Pipe). Service에서 재검증 금지.
- 외부 입력(`@Body`, `@Query`, `@Param`)은 모두 DTO 클래스로 받음 — 신뢰 0.
- 검증 실패 시 `BadRequestException` 자동 throw.

## ValidationPipe 전역 적용

`src/main.ts`:

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // DTO에 정의 안 된 필드 제거
  forbidNonWhitelisted: true, // 미정의 필드 있으면 에러
  transform: true,            // 자동 형변환 (string → number 등)
  transformOptions: { enableImplicitConversion: true },
}));
```

## DTO 작성

`src/domains/<domain>/dto/<name>.dto.ts`:

```ts
import { IsString, IsUUID, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FollowCreateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetUserId!: string;

  @ApiPropertyOptional({ enum: ['league', 'team', 'player'] })
  @IsOptional()
  @IsIn(['league', 'team', 'player'])
  follow_type?: 'league' | 'team' | 'player';
}

export class FollowListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 20;
}
```

- `@ApiProperty`/`@ApiPropertyOptional` 로 Swagger 문서화 동시 처리
- query/path 파라미터의 string → number 자동 변환: `@Type(() => Number)` + `transform: true`

## Controller에서

```ts
@Get('list')
@ApiOperation({ summary: '팔로우 목록' })
async list(@Query() query: FollowListQueryDto) {
  return this.service.list(query);
}

@Post()
@ApiOperation({ summary: '팔로우 생성' })
async create(
  @CurrentUser() user: AuthUser,
  @Body() dto: FollowCreateDto,
) {
  return this.service.create(user.id, dto);
}
```

DTO 클래스만 명시 — `ValidationPipe`가 자동으로 검증/형변환.

## 검증 실패 응답

`AllExceptionsFilter`가 `BadRequestException`을 가로채서:

```json
{ "resultCode": "5000", "resultMsg": "<필드> <사유>", "data": null }
```

`class-validator` 메시지는 영문 기본 → 한국어가 필요하면 DTO 각 decorator에 `{ message: '...' }` 옵션:

```ts
@IsUUID('all', { message: 'targetUserId는 UUID 형식이어야 합니다.' })
```

## 자주 쓰는 규칙

- ID: `@IsUUID()` 또는 `@IsInt() @Min(1)` (legacy 정수 PK)
- 페이지 size: `@Min(1) @Max(100)`
- 문자열 길이: `@MinLength(1) @MaxLength(N)`
- 날짜: `@IsDateString()` (ISO 8601만 허용)
- enum: `@IsIn(['A', 'B', 'C'])` 또는 `@IsEnum(...)`
- 옵셔널: `@IsOptional()` 다른 decorator 위에

## 절대 규칙

- DTO 클래스 외 plain object 사용 금지
- Service/Repository에서 검증 재실행 금지
- `class-validator` 메시지 영문 그대로 노출 시 사용자 혼란 — 한국어 메시지 의무

## DTO 자가 점검 체크리스트 (PR 생성 직전 의무)

흔히 빠뜨리는 항목들. 모든 DTO 파일에 대해 grep으로 자동 점검:

### 필드별 점검

- [ ] **`@IsOptional()`** — 옵셔널 필드(`?:`)에 `@IsOptional()` 빠뜨림 → 자동 변환 시 빈 값에 대해 검증 실패. **옵셔널 표시(`?:`)와 `@IsOptional()` 데코레이터는 항상 짝**
- [ ] **`@Type(() => Number)`** — query/path string을 number로 받을 때 빠뜨리면 형변환 안 됨. `ValidationPipe`의 `transform: true`만으로는 부족한 경우 있음
- [ ] **`@IsInt()` vs `@IsNumber()`** — 정수 강제는 `@IsInt()`. `@IsNumber()`는 소수 허용
- [ ] **`@Min()` / `@Max()`** — 페이지 size/limit에 빠뜨림 → 무제한 요청 허용 위험
- [ ] **`@IsUUID()` 버전 인자** — `@IsUUID('all')` 또는 `'4'`/`'5'` 명시. 기본 `'4'`만 허용되므로 origin 데이터와 mismatch 가능
- [ ] **`@IsEnum()` 또는 `@IsIn([...])`** — 문자열 enum은 `@IsIn(['a','b','c'])` 권장 (literal type 호환)
- [ ] **`@IsDateString()` vs `@IsDate()`** — 외부 입력은 거의 string → `@IsDateString()`. Date 객체로 받으려면 `@Type(() => Date)` 같이 동봉
- [ ] **`@IsArray()` + `@ValidateNested({ each: true })` + `@Type(() => SubDto)`** — 배열 안의 객체를 검증할 때 셋 모두 필요
- [ ] **`@Transform(({ value }) => ...)`** — trim/lowercase 등 정규화는 명시적 transform 필요

### 한국어 메시지

- [ ] 모든 검증 decorator에 `{ message: '한국어 설명' }` 옵션
  ```ts
  @IsUUID('all', { message: 'targetUserId는 UUID 형식이어야 합니다.' })
  ```

### Swagger 일치

- [ ] `@ApiProperty` / `@ApiPropertyOptional` 누락 → Swagger에 필드 안 뜸
- [ ] `@IsOptional()` 인 필드는 `@ApiPropertyOptional()`, 필수는 `@ApiProperty()`
- [ ] `enum`/`format`/`minimum`/`maximum`/`default` 메타데이터 명시

### Whitelist / forbidNonWhitelisted

`main.ts`의 ValidationPipe 설정:

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,   // ← DTO에 없는 필드 들어오면 거부
  transform: true,
  transformOptions: { enableImplicitConversion: true },
}));
```

DTO에 안 정의된 필드를 보내면 자동 거부됨. 그래서 옵셔널 필드라도 DTO에 명시 의무.

## 흔히 발생하는 사고

- ❌ `size?: number` 만 쓰고 `@IsOptional()` 빠뜨림 → 빈 query는 `validation failed: size must be a number`
- ❌ query `?page=2` 가 string `"2"` 으로 들어와 `@IsInt()` 실패 → `@Type(() => Number)` 필수
- ❌ 배열 검증을 `@IsArray()` 만으로 시도 → 안의 객체 필드 검증 안 됨
- ❌ DTO 검증 실패 메시지가 영문 그대로 노출 → 한국어 클라이언트에서 혼란
- ❌ Swagger UI에서 "request body" 가 비어있게 표시 → `@ApiProperty()` 누락

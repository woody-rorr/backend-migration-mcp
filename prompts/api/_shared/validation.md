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

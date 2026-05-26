# 비즈니스 로직 작성 규칙 (공통 — Nest.js)

## 계층 분리

```
<domain>.module.ts          → @Module — controllers, providers, imports 선언
<domain>.controller.ts      → @Controller — HTTP 진입점, decorator + @nestjs/swagger
<domain>.service.ts         → @Injectable — 비즈니스 로직 (req/res 모름)
<domain>.repository.ts      → @Injectable — DB I/O 전담 (TypeORM Repository 래핑)
dto/*.dto.ts                → class-validator + class-transformer 데코레이터
```

**원칙**:
- Controller에는 HTTP 매핑 + Swagger decorator만. 비즈니스 로직 금지.
- Service에서 비즈니스 로직 + Repository 호출.
- Repository에서 DB I/O. SQL/TypeORM API를 다른 계층에 노출 금지.
- DTO는 `class-validator`로 검증, `class-transformer`로 직렬화.

## Controller 시그니처

```ts
import { Controller, Get, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { FollowService } from './follow.service';
import { FollowListQueryDto } from './dto/follow-list-query.dto';

@ApiTags('follow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('follow')
export class FollowController {
  constructor(private readonly service: FollowService) {}

  @Get('my')
  @ApiOperation({ summary: '내 팔로우 목록' })
  @ApiResponse({ status: 200 })
  async getMyFollows(
    @CurrentUser() user: AuthUser,
    @Query() query: FollowListQueryDto,
  ) {
    return this.service.getMyFollows(user.id, query);
  }
}
```

- DI: 생성자 주입 (`private readonly service: ...`)
- 검증: DTO 클래스 그대로 `@Query()` / `@Body()`에 사용 → `ValidationPipe` 자동
- 인증: `@UseGuards(JwtAuthGuard)` + `@CurrentUser()` custom decorator
- 응답: 비즈니스 데이터만 `return`. 포맷 가공은 Interceptor가 담당 (`_shared/response-format.md`)

## Service 시그니처

```ts
@Injectable()
export class FollowService {
  constructor(
    private readonly repo: FollowRepository,
  ) {}

  async getMyFollows(userId: string, query: FollowListQueryDto) {
    const items = await this.repo.findByUser(userId, query);
    return { items, total: items.length };
  }
}
```

- `@Injectable()` 데코레이터 필수
- req/res 객체 모름 (HTTP 비의존)
- 단위 테스트 가능 (`new FollowService(mockRepo)`)

## Module 시그니처

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Follow])],
  controllers: [FollowController],
  providers: [FollowService, FollowRepository],
  exports: [FollowService],   // 다른 도메인이 import하면 노출
})
export class FollowModule {}
```

- `imports`: TypeORM 엔티티, 다른 모듈
- `controllers`: 같은 도메인의 Controller만
- `providers`: Service, Repository, 그 외 helper
- `exports`: 다른 도메인이 이 도메인의 Service를 쓸 거라면 명시

## 도메인 간 호출

- **금지**: `import { FollowController } from '../follow/follow.controller'` — Controller 직접 import 금지
- **허용**: A 도메인의 Module이 B 도메인의 Module을 `imports`로 선언 → B의 Service를 DI로 받음
  ```ts
  @Module({ imports: [SparkModule], ... })
  export class QuizModule {}

  // quiz.service.ts
  constructor(private readonly spark: SparkService) {}
  ```
- B 도메인은 `exports: [SparkService]` 로 노출해야 함

## 순수성 / 부작용 격리

- Service는 결정론적으로 작성. 시간/랜덤은 `Date.now()`, `crypto.randomUUID()` 같은 결정적 진입점.
- 외부 API 호출은 `src/clients/<name>.client.ts` 같은 별도 Injectable로 격리.
- 트랜잭션이 필요한 경우 `_shared/transaction.md` 참조.

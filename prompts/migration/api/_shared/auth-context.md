# 인증/인가 컨텍스트 (공통 — Nest.js)

## JwtAuthGuard

`src/auth/jwt-auth.guard.ts`:

```ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ resultCode: 'error', resultMsg: 'Invalid token', data: null });
    }
    const token = auth.slice(7);
    // TODO: 실제 JWT 검증 (jsonwebtoken / @nestjs/jwt). origin 로직 그대로 이식.
    req.user = await verifyJwt(token);
    return true;
  }
}
```

## @CurrentUser() custom decorator

`src/auth/current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
  roles?: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return data ? req.user?.[data] : req.user;
  },
);
```

## Controller에서

```ts
@UseGuards(JwtAuthGuard)
@Controller('follow')
export class FollowController {
  @Get('my')
  async getMyFollows(@CurrentUser() user: AuthUser) {
    return this.service.getMyFollows(user.id);
  }
}
```

- Controller 클래스 레벨에 `@UseGuards(JwtAuthGuard)` 적용 → 모든 메서드 보호
- 일부 메서드만 공개로 두려면 `@UseGuards()` 적용 안 함

## 공개 엔드포인트

```ts
// FollowController가 클래스 레벨에 Guard 적용했다면
// 공개 엔드포인트는 @SkipAuth() 같은 decorator 또는
// 별도 Controller로 분리 (권장)
```

명확성을 위해 **공개/인증 Controller 분리**가 추천.

## 권한 분기 (Role)

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Post()
async createQuiz(@Body() dto: QuizCreateDto) { ... }
```

`RolesGuard` 구현은 origin admin 검증 로직 그대로 이식.

## 리소스 소유권 검증

Service 레이어에서:

```ts
async delete(userId: string, id: string) {
  const row = await this.repo.findById(id);
  if (!row) throw new NotFoundException();
  if (row.userid !== userId) throw new ForbiddenException();
  await this.repo.remove(row);
}
```

## 토큰 전파

다른 MCP/서비스 호출 시 사용자 컨텍스트 필요하면:
- `@Headers('authorization') auth: string` 으로 받아서 outbound HTTP에 전달
- 응답/로그에 토큰 포함 절대 금지

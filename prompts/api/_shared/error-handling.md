# 에러 처리 (공통 — Nest.js)

## 분류 매트릭스

| 상황 | throw | HTTP | resultCode |
|---|---|---|---|
| 입력 검증 실패 | `BadRequestException` (또는 자동 ValidationPipe) | 400 | `validationError` |
| 인증 안 됨 | `UnauthorizedException` | 401 | `error` + "Invalid token" |
| 권한 없음 | `ForbiddenException` | 403 | `error` |
| 리소스 없음 | `NotFoundException` | 404 | `<DOMAIN>_NOT_EXISTS` |
| 비즈니스 규칙 위반 | `BusinessException(code, msg)` (커스텀) | 200 또는 422 | custom code |
| 시스템/DB 오류 | `throw err` 그대로 | 500 | `error` |

## 커스텀 BusinessException

`src/common/exceptions/business.exception.ts`:

```ts
import { HttpException } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(public readonly code: string, message: string, status = 200) {
    super({ resultCode: code, resultMsg: message, data: null }, status);
  }
}
```

사용:

```ts
if (followType === 'self') {
  throw new BusinessException('FOLLOW_SELF_FORBIDDEN', '자기 자신은 팔로우할 수 없습니다.');
}
```

## Exception Filter (전역)

`src/common/filters/all-exceptions.filter.ts`:

```ts
import { Catch, ExceptionFilter, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { resultCode } from '../result-code';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      // BusinessException 류는 본문 그대로
      if (typeof body === 'object' && body !== null && 'resultCode' in body) {
        return response.status(status).json(body);
      }
      return response.status(status).json({
        resultCode: status === 400 ? resultCode.validationError : resultCode.error,
        resultMsg: (body as any)?.message ?? exception.message,
        data: null,
      });
    }

    // 알 수 없는 예외 → 500
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      resultCode: resultCode.error,
      resultMsg: (exception as any)?.message ?? 'Internal server error',
      data: null,
    });
  }
}
```

`src/main.ts`:

```ts
app.useGlobalFilters(new AllExceptionsFilter());
```

## Controller에서

```ts
@Delete(':targetId')
async deleteFollow(
  @CurrentUser() user: AuthUser,
  @Param('targetId') targetId: string,
) {
  const follow = await this.service.findByTarget(user.id, targetId);
  if (!follow) throw new NotFoundException({
    resultCode: 'FOLLOW_NOT_EXISTS',
    resultMsg: '팔로우한 항목을 찾을 수 없습니다.',
    data: null,
  });
  await this.service.delete(follow);
  return { success: true, message: '팔로우가 삭제되었습니다.' };
}
```

## 절대 규칙

1. Controller에서 `try/catch` + 직접 응답 형성 금지 → `throw`만 하고 Filter에 위임
2. `console.error` 금지 → Nest.js `Logger` 사용
3. 민감 정보(JWT, API key, DB password 등)는 throw 메시지에 포함 금지
4. 외부 API 실패는 `clients/*.client.ts` 내부에서 1차 catch + 재시도/타임아웃 처리 후 표준 Exception으로 변환

## DB 트랜잭션 중 에러

`_shared/transaction.md` 참조. `manager.transaction` 콜백 안에서 throw 하면 자동 ROLLBACK + 호출자에게 전파.

# 응답 포맷 (공통 — Nest.js)

## 응답 표준

```json
{ "resultCode": "0000", "resultMsg": "Success", "data": { ... } }
```

origin Lambda의 `formatJSONResponse2` 가 만들던 포맷 동일.

## 구현: TransformInterceptor

`src/common/interceptors/transform.interceptor.ts`:

```ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // 이미 표준 포맷이면 그대로
        if (data && typeof data === 'object' && 'resultCode' in data) return data;
        return { resultCode: '0000', resultMsg: 'Success', data: data ?? null };
      }),
    );
  }
}
```

`src/main.ts` 에서 글로벌 적용:

```ts
app.useGlobalInterceptors(new TransformInterceptor());
```

## Controller에서

비즈니스 데이터만 그대로 `return`:

```ts
@Get('my')
async getMyFollows(@CurrentUser() user: AuthUser) {
  const items = await this.service.getMyFollows(user.id);
  return { items, total: items.length };   // TransformInterceptor가 감쌈
}
```

수동으로 `resultCode` 지정하고 싶으면 객체에 그대로 포함:

```ts
return { resultCode: 'FOLLOW_ALREADY_EXISTS', resultMsg: '이미 팔로우', data: existing };
```

## resultCode 상수

`src/common/result-code.ts`:

```ts
export const resultCode = {
  Success: '0000',
  error: '1000',
  validationError: '5000',
  FollowNotExists: 'FOLLOW_NOT_EXISTS',
  // ... origin Lambda의 resultCode 그대로 옮김
} as const;
```

## 페이지네이션

목록 응답은 cursor 기반 권장:

```json
{
  "resultCode": "0000",
  "data": {
    "items": [...],
    "nextCursor": "eyJpZCI6MTIzfQ==" | null
  }
}
```

offset/limit가 필요하면 `data.page`, `data.size`, `data.total` 동봉.

## 에러 응답

`_shared/error-handling.md` 참조. Controller에서 `throw new HttpException(...)` → Exception Filter가 표준 포맷으로 변환.

## 빈 결과

- 단건 조회 미존재: 404 + `NotFoundException`
- 목록 조회 빈 배열: 200 + `data.items = []`

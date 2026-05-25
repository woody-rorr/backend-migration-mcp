# 입력 검증 (공통)

## 원칙

- 검증은 **핸들러 진입 직후**에 1회. 서비스/리포지토리에서 재검증 금지 (중복 책임).
- 외부 입력(`req.body`, `req.query`, `req.params`)은 모두 검증 대상. 신뢰 0.
- 검증 실패 시 `ValidationError` throw → errorHandler가 400으로 변환.

## 도구

`zod`를 표준으로 사용. 도메인별 `schemas.js`에 스키마 모음:

```js
// src/domains/follow/schemas.js
import { z } from "zod";

export const followCreateSchema = z.object({
  targetUserId: z.string().uuid(),
});

export const followListQuerySchema = z.object({
  cursor: z.string().optional(),
  size: z.coerce.number().int().min(1).max(100).default(20),
});
```

## 핸들러 사용

```js
import { followCreateSchema } from "./schemas.js";

export async function create(req, res, next) {
  try {
    const dto = followCreateSchema.parse(req.body); // throw on fail
    const result = await service.create(req.user.sub, dto);
    res.json(ok(result));
  } catch (err) { next(err); }
}
```

`zod`의 `ZodError`를 errorHandler에서 `ValidationError`로 매핑하거나, 핸들러에서 `safeParse` 후 throw.

## 자주 쓰는 규칙

- ID: `z.string().uuid()` (자체 발급 UUID) 또는 `z.coerce.number().int().positive()` (legacy 정수 PK)
- 페이지 size: `1 ≤ size ≤ 100`
- 문자열: `z.string().trim().min(1).max(N)` — 공백만 입력 차단
- 날짜: `z.coerce.date()` → ISO 8601만 허용
- enum: `z.enum(["A","B","C"])` (string union 직접 쓰기보다 enum 권장)

## `req.params` 검증

URL path params도 검증. 라우터에서 `:id`만 잡고 핸들러에서 `z.string().uuid()` 등.

## 검증 실패 메시지

- 한국어 사용자 메시지는 errorHandler에서 코드 → 메시지 매핑
- zod의 `issues` 첫 항목 `path`/`message`를 그대로 노출하지 말 것 (필드명 영문 노출됨)

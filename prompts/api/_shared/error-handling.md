# 에러 처리 (공통)

## 분류

| 상황 | 처리 |
|---|---|
| 입력 검증 실패 | `throw new ValidationError("필드명", "사유")` → 400 |
| 인증 안 됨 | `throw new UnauthorizedError()` → 401 |
| 권한 없음 | `throw new ForbiddenError()` → 403 |
| 리소스 없음 | `throw new NotFoundError("<DOMAIN>_NOT_FOUND")` → 404 |
| 비즈니스 규칙 위반 | `throw new BusinessError(code, msg)` → 200 + `fail(code,msg)` |
| 시스템/DB 오류 | `throw err` 그대로 → 500 (errorHandler에서 마스킹) |

## 핸들러 패턴

```js
export async function create(req, res, next) {
  try {
    const dto = validateCreate(req.body);
    const created = await service.create(req.user.sub, dto);
    res.json(ok(created));
  } catch (err) { next(err); }
}
```

- 직접 `res.status(500).send(...)` 절대 금지 → `next(err)` 위임
- `console.error` 금지 → app-level errorHandler에서 로깅 통합

## errorHandler (이미 존재)

`src/middleware/errorHandler.js`가 분류 → HTTP status + `code`/`message` 변환. 핸들러는 throw만 하면 됨.

## DB 트랜잭션 중 에러

```js
const client = await pool.connect();
try {
  await client.query("BEGIN");
  // ...
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release();
}
```

`finally`에서 `release()` 누락 시 pool 고갈 → 운영 장애. 무조건 finally.

## 외부 API 실패

- 타임아웃/재시도는 client 모듈 (`src/clients/<name>.js`)에서 처리
- 핸들러는 단순히 throw → errorHandler가 502/504로 매핑
- 민감정보(키, 토큰)는 에러 메시지에 포함 금지

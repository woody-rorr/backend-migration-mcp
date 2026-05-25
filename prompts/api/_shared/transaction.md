# 트랜잭션 (공통)

## 언제 트랜잭션?

다음 중 **두 개 이상**이 한 요청에 묶이면 트랜잭션 필수:
- INSERT/UPDATE/DELETE 가 여러 테이블 또는 여러 행
- 쓰기 + 같은 데이터의 후속 READ (read-your-write 보장 필요)
- 도메인 이벤트 발행 + DB 쓰기 (outbox 패턴)

읽기만 있는 경우엔 보통 불필요 (단일 SELECT는 자동 일관).

## 표준 패턴

```js
import { pool } from "../../config/db.js";

export async function createWithItems(input) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [order] } = await client.query(
      "INSERT INTO orders (...) VALUES (...) RETURNING *",
      [...]
    );
    for (const item of input.items) {
      await client.query("INSERT INTO order_items (order_id, ...) VALUES ($1, ...)", [order.id, ...]);
    }

    await client.query("COMMIT");
    return order;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

## 절대 규칙

1. `pool.connect()` 후 **반드시 finally에서 `client.release()`**. 누락 시 pool 고갈.
2. `BEGIN`/`COMMIT`/`ROLLBACK`은 **같은 client**에서. `pool.query`를 섞으면 다른 connection → 트랜잭션 안 됨.
3. 트랜잭션 도중 외부 API 호출 금지 (DB connection이 외부 응답 시간만큼 점유됨). 외부 호출은 트랜잭션 밖에서.
4. 트랜잭션 안에서 throw → ROLLBACK 후 re-throw. 절대 swallow 금지.

## repository 헬퍼

여러 함수가 한 트랜잭션을 공유해야 하면 client를 인자로 받게 만든다:

```js
export async function insertOrder(client, dto) { ... }
export async function insertItems(client, orderId, items) { ... }

// service.js
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const order = await insertOrder(client, dto);
  await insertItems(client, order.id, dto.items);
  await client.query("COMMIT");
} catch (err) { await client.query("ROLLBACK"); throw err; }
finally { client.release(); }
```

## 격리 수준

- 기본 `READ COMMITTED`를 가정. 명시 변경이 필요하면 `BEGIN ISOLATION LEVEL SERIALIZABLE` 등.
- 직렬화 충돌 시 재시도 로직은 service 레이어에서 (`40001` SQLSTATE).

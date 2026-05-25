# DB 접근 규칙 (공통)

## pool 사용

```js
import { pool } from "../../config/db.js";
const { rows } = await pool.query("SELECT * FROM follow WHERE user_id = $1", [userId]);
```

- `src/config/db.js`가 노출하는 `pool`만 사용. 새 pool 생성 금지.
- 매개변수 바인딩(`$1`, `$2`) **필수**. 문자열 concat / 템플릿 리터럴로 쿼리 만들면 SQL injection.

## repository 격리

도메인 폴더에 `repository.js`를 두고 SQL은 여기로만 모음:

```js
// src/domains/follow/repository.js
import { pool } from "../../config/db.js";

export async function findByUser(userId, { cursor, size }) {
  const { rows } = await pool.query(
    `SELECT id, target_user_id, created_at
       FROM follow
      WHERE user_id = $1 ${cursor ? "AND id < $3" : ""}
      ORDER BY id DESC
      LIMIT $2`,
    cursor ? [userId, size, cursor] : [userId, size],
  );
  return rows;
}
```

핸들러/서비스는 `repository`만 호출. 핸들러에서 직접 `pool.query` 금지.

## 도메인 경계

- **자기 도메인 테이블만** 접근. 다른 도메인 테이블이 필요하면 그 도메인의 `service`/HTTP를 호출.
- 단일 트랜잭션 안에서 두 도메인 테이블을 같이 쓰는 경우만 예외 (그래도 가능하면 분리).

## 컬럼 명명 / 변환

- DB는 `snake_case`, JS는 `camelCase`
- repository에서 변환 처리:

```js
function toCamel(row) {
  return {
    id: row.id,
    targetUserId: row.target_user_id,
    createdAt: row.created_at,
  };
}
```

전역 자동 변환 라이브러리는 도입 금지 (성능/예측성).

## 트랜잭션

`_shared/transaction.md` 참조. 멀티 쿼리 쓰기는 무조건 트랜잭션.

## N+1 회피

목록 조회 후 각 항목당 추가 쿼리 패턴 발견 시:

- `JOIN` 또는 `IN (...)` 한 번에 모아서 조회
- repository에서 `findByIds(ids)` 같이 묶음 함수 제공

## 인덱스 가정

- `WHERE`/`ORDER BY`에 쓰는 컬럼은 인덱스가 있다고 가정하지 말고 PR description에 명시
- 신규 인덱스가 필요하면 DB 마이그레이션 PR을 별도로 만들고 본 PR description에 링크

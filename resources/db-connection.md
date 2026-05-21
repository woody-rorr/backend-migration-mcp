# DB 연결 정책

## 기존 DB 그대로 사용

- 마이그레이션 대상이 사용하던 DB(RDS/Aurora 등)를 **그대로** 재사용. 신규 DB 생성 금지.
- 접속 정보는 SSM Parameter Store에서 가져옴.

## Pool 구성

- Lambda는 invocation마다 connection을 새로 열 수 있었지만, ECS는 long-running 프로세스 → **pool 사용 필수**.
- 권장 라이브러리: `pg` (PostgreSQL) 또는 `mysql2` (MySQL) — 원본 코드에서 사용하던 것 유지.
- pool 설정 예시:

```js
import pkg from 'pg';
const { Pool } = pkg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});
```

## 트랜잭션

- 라우터 단에서 트랜잭션을 열지 않음. 비즈니스 로직 함수 내에서 명시적으로 `BEGIN/COMMIT/ROLLBACK`.

## SIGTERM 처리

- ECS rolling deploy 시 graceful shutdown: `process.on('SIGTERM', () => pool.end())`.

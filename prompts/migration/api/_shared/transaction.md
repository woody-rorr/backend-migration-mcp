# 트랜잭션 (공통 — Nest.js + TypeORM)

## 언제 트랜잭션?

- INSERT/UPDATE/DELETE 가 여러 테이블 또는 여러 행
- 쓰기 + 같은 데이터의 후속 READ (read-your-write 보장 필요)
- 도메인 이벤트 발행 + DB 쓰기

## 표준 패턴: DataSource.transaction

```ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Follow } from './entities/follow.entity';

@Injectable()
export class FollowService {
  constructor(private readonly dataSource: DataSource) {}

  async putFollowsBatch(userId: string, dto: PutFollowBatchDto) {
    return this.dataSource.transaction(async (manager) => {
      // manager 안에서 모든 쓰기
      for (const item of dto.league ?? []) {
        await manager.upsert(Follow, {
          userid: userId,
          follow_type: 'league',
          target_id: item.targetId,
        }, ['userid', 'follow_type', 'target_id']);
      }
      // ...
      // 자동 COMMIT/ROLLBACK
    });
  }
}
```

- 콜백 안에서 throw → ROLLBACK 자동
- 콜백 끝까지 도달 → COMMIT 자동
- `manager`만 사용. 외부 Repository 호출 시에도 `manager.getRepository(Entity)` 로

## 절대 규칙

1. 트랜잭션 도중 외부 API 호출 금지 — connection이 외부 응답 시간만큼 점유됨
2. 트랜잭션 안에서 throw 시 절대 swallow 금지 — re-throw 또는 그대로 전파
3. 여러 도메인의 Repository를 한 트랜잭션에서 쓸 때는 `manager.getRepository(...)` 로 통일

## Repository에 트랜잭션 컨텍스트 전달

여러 함수가 한 트랜잭션을 공유해야 하면 manager를 인자로:

```ts
@Injectable()
export class FollowRepository {
  constructor(@InjectRepository(Follow) private repo: Repository<Follow>) {}

  async upsert(manager: EntityManager | null, ...args) {
    const repo = manager ? manager.getRepository(Follow) : this.repo;
    // ... repo 사용
  }
}
```

Service에서:

```ts
return this.dataSource.transaction(async (manager) => {
  await this.followRepo.upsert(manager, ...);
  await this.userRepo.update(manager, ...);
});
```

## 격리 수준

- 기본 `READ COMMITTED` (MySQL 기본)
- 명시 변경: `await this.dataSource.transaction('SERIALIZABLE', async (manager) => { ... })`
- 직렬화 충돌(`40001` SQLSTATE) 시 재시도는 Service 레이어에서

## @Transactional decorator

`typeorm-transactional` 패키지를 도입하면 더 깔끔:

```ts
import { Transactional } from 'typeorm-transactional';

@Transactional()
async putFollowsBatch(userId: string, dto: PutFollowBatchDto) {
  // 자동 트랜잭션
}
```

도입은 별도 결정. 우선은 `dataSource.transaction` 명시적 패턴.

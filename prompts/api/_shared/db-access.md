# DB 접근 규칙 (공통 — Nest.js + TypeORM)

## DataSource

`src/config/typeorm.config.ts` 에서 `TypeOrmModule.forRoot({...})` 설정. 환경변수는 SSM/`.env`에서:

```ts
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (cfg: ConfigService) => ({
    type: 'mysql',
    host: cfg.get('DB_HOST'),
    port: cfg.get<number>('DB_PORT'),
    username: cfg.get('DB_USER'),
    password: cfg.get('DB_PASSWORD'),
    database: cfg.get('DB_NAME'),
    autoLoadEntities: true,
    synchronize: false,        // 운영 DB 보호 — 절대 true 금지
  }),
  inject: [ConfigService],
});
```

## Repository 패턴

도메인별 `<domain>.repository.ts` 에서 TypeORM Repository를 래핑:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from './entities/follow.entity';

@Injectable()
export class FollowRepository {
  constructor(
    @InjectRepository(Follow)
    private readonly repo: Repository<Follow>,
  ) {}

  async findByUser(userId: string, { cursor, size = 20 }: { cursor?: string; size?: number }) {
    const qb = this.repo.createQueryBuilder('f')
      .where('f.userid = :userId', { userId })
      .orderBy('f.idx', 'DESC')
      .limit(size);
    if (cursor) qb.andWhere('f.idx < :cursor', { cursor });
    return qb.getMany();
  }
}
```

- `@InjectRepository(Entity)` 로 TypeORM Repository DI
- Service에서 `repo.createQueryBuilder` 또는 `repo.query` 직접 호출 금지 — Repository 레이어 거치도록 강제

## Entity 정의 (절대 규칙)

**모든 도메인은 entities 폴더를 반드시 동봉해야 합니다.** 그렇지 않으면 Repository가 무엇을 read/write 하는지 컴파일러가 모름.

### 폴더 위치 (고정)

```
src/domains/<domain>/entities/<name>.entity.ts
```

- 같은 도메인이 여러 테이블 쓰면 entity 파일 여러 개 가능 (`follow.entity.ts`, `user.entity.ts` 등)
- 다른 도메인 테이블이 필요하면 **import 하지 말고** 그 도메인 Service를 DI로 받음 (도메인 경계 보호)

### 컬럼명 가져오는 출처 (우선순위)

1. **`prompts/api/domains/<domain>/overview.md` 의 "엔티티 (기존 DB)" 섹션** — 이 도메인 .md가 진실의 출처
2. origin TypeORM entity 파일 (`backend-lol-api-v3_origin/src/functions/<domain>/entities/*.entity.ts`) — 참고용
3. 둘이 다르면 **overview.md를 신뢰**. 이유는 본 .md가 "재현 가능 스펙"의 출처 (`prompts/api/README.md` 참조)

### 컬럼 매핑 의무

- DB 컬럼명은 정확히 그대로 `@Column({ name: '<exact>' })` 또는 필드명을 컬럼명과 일치시킴
- 자동 naming strategy(camelCase ↔ snake_case 자동 변환)에 의존 금지 — origin DB가 일관되지 않을 수 있어 mismatch 위험
- 컬럼 타입: `varchar(N)`, `int`, `bigint`, `enum`, `datetime` 등 origin DB와 정확히 일치

### Entity 작성 템플릿

`src/domains/<domain>/entities/<name>.entity.ts`:

```ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('follow')
export class Follow {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  idx!: string;

  @Column({ type: 'varchar', length: 64 })
  userid!: string;

  @Column({ type: 'enum', enum: ['league', 'team', 'player'] })
  follow_type!: 'league' | 'team' | 'player';

  @Column({ type: 'varchar', length: 64 })
  target_id!: string;

  @Column({ type: 'int' })
  display_order!: number;

  @Column({ type: 'datetime' })
  created_date!: Date;

  @Column({ type: 'datetime' })
  updated_date!: Date;
}
```

**DB 스키마 변경 금지** — `synchronize: false`. 기존 컬럼명을 정확히 매핑.

### 자가 점검 (Entity)

PR 생성 직전 grep으로 확인:

- [ ] `src/domains/<domain>/entities/` 폴더 존재
- [ ] Repository(`*.repository.ts`)가 import하는 모든 Entity 파일이 entities/ 안에 실재
- [ ] `<domain>.module.ts`의 `TypeOrmModule.forFeature([...])`에 모든 Entity 등록
- [ ] Entity 필드명이 origin DB의 컬럼명과 일치 (대소문자, 언더스코어 포함)
- [ ] `@Column({ name: '...' })` 옵션이 필요한 경우 빠뜨리지 않음 (필드명 ≠ 컬럼명 케이스)
- [ ] PrimaryGeneratedColumn 타입 명시 (`'bigint'`, `'increment'`, `'uuid'` 등)

### 흔히 빠뜨리는 사고

- ❌ entity 파일 없이 `repository.ts`만 작성 → 컴파일 에러 또는 런타임 "Entity metadata not found"
- ❌ `@Entity('follow')` 의 테이블명을 도메인 슬러그와 다르게 (origin DB가 `Follow`인지 `follow`인지 정확히)
- ❌ `bigint` 컬럼을 `number`로 매핑 (TypeORM은 bigint를 string으로 반환 — `number`로 받으면 큰 ID에서 정밀도 손실)
- ❌ datetime 컬럼을 `Date` 대신 `string`으로 (응답 JSON 직렬화 형식이 달라짐)
- ❌ unique constraint를 entity에 명시 안 함 (origin DB와 다른 동작 가능)

## Module에 등록

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Follow])],
  providers: [FollowService, FollowRepository],
  exports: [FollowService],
})
export class FollowModule {}
```

## 도메인 경계

- **자기 도메인 테이블만** 접근. 다른 도메인 테이블이 필요하면 그 도메인의 Service를 DI로 받음.
- 단일 트랜잭션 안에서 두 도메인 테이블을 같이 쓰는 경우만 예외 (그래도 가능하면 분리).

## 컬럼 명명 / 변환

- DB는 `snake_case` (기존 유지), JS는 `camelCase` 또는 그대로
- 자동 naming strategy 사용 가능하지만 origin과 호환 위해 **Entity 필드명을 DB 컬럼명과 정확히 일치**시키는 게 안전

## N+1 회피

- 목록 후 각 항목당 추가 쿼리 패턴 금지
- `leftJoinAndSelect` 또는 `IN (...)` 한 번에 모아서 조회

## 인덱스 가정

신규 인덱스가 필요하면 별도 마이그레이션 PR (`migrations/*.ts`)로 분리. 본 PR description에 링크.

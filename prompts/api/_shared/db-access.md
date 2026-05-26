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

## Entity 정의

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

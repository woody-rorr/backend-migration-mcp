# scopes/module — module:<name> + database 규약 (Critical)

**산출:** src/modules/<name>/* (entity, module, service, repository, controller, dto/*) + 신규 테이블 migration + 갱신된 src/app.module.ts

## 0. 사전 점검 (필수)
`common/precheck.md` 전체 (1~5 단계). FK 화이트리스트·모듈 중복·timestamp 검증 모두 적용.

## 1. app.module.ts 동반 산출 의무
- **반드시 `src/app.module.ts` 도 같이 산출** — 신규 모듈을 imports 에 포함하도록 전체 파일 덮어쓰기. `app_module_integration.md` §1 골격 사용.
- "수동으로 app.module.ts 에 추가하세요" 같은 안내 문구 응답에 포함 금지. 응답은 코드 + todo 만.
- 호출자가 `accumulated_modules` (콤마 구분 문자열)를 task/extra_spec 에 넘기면 그 목록 + 이번 신규 모듈을 합쳐 imports 갱신.

## 2. 테이블 자동 생성 (Critical, 2026-06-01 사고 방지)
신규 모듈에 entity 가 있으면 `src/database/migrations/<timestamp>-create-<table>-table.ts` 를 **같은 호출 응답에 반드시 포함**. 별도 `database` scope 를 todo 로 미루지 않는다. 누락 시 ECS 부팅 후 첫 API 호출이 `relation "<table>" does not exist` 로 실패.

- 마이그레이션 파일 1개 = 테이블 1개. 외래키 제약은 참조 테이블의 마이그레이션 timestamp 이후로 정렬.
- `entrypoint.sh` 가 컨테이너 부팅 시 `migration:run:prod` 를 실행하므로 머지 즉시 테이블 생성 (수동 SQL 금지).
- 응답에 `app.module.ts` 만 있고 마이그레이션 없으면 차단: `todo: ["spec-fix: module:<name> 에 entity 있는데 migration 누락 — 재산출 필요"]`.

## 3. entity 파일 의무 산출 (Critical, 2026-06-04 사고 방지)
`<name>.module.ts` 또는 `<name>.repository.ts` 가 `./entities/<X>.entity` 를 import 하면, 대응 entity 파일을 **같은 호출 응답 files 맵에 반드시 포함**. entities/ 폴더 통째로 누락 사고 빈번 (관측: 2026-06-04 PR #42 quiz — 3개 entity 누락 → TS2307).

### 자체 검증 절차
1. files 맵에서 `src/modules/<name>/<name>.module.ts` 와 `<name>.repository.ts` 의 `import ... from './entities/X'` 줄 추출.
2. 각 X 마다 `src/modules/<name>/entities/X.entity.ts` 가 files 맵에 있는지 확인.
3. 누락 시 `todo: ["spec-fix: <name> 모듈 entity 누락: <X.entity.ts>, ..."]` 응답 + 코드 생성 차단.

### entity 파일 최소 구조
```ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
@Entity('<table_name>')
export class <Name> {
  @PrimaryGeneratedColumn('uuid') id: string;
  // ... 도메인 필드 (snake_case 컬럼명은 @Column({ name: '...' }) 명시)
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

migration 의 컬럼명/타입과 entity 의 `@Column` 옵션이 **반드시 일치** (snake_case 컬럼은 `@Column({ name: 'snake_case' })` 명시). 불일치 시 runtime SELECT/INSERT 에서 `column "X" does not exist`.

## 4. 공통 규약 참조
- `common/swagger-decorators.md` — controller/DTO 의 `@Api*` 데코레이터
- `common/uc-mapping.md` — UC 표가 있으면 기계적 매핑
- `common/creative-mode.md` — opt-in 시 자유 창작

## database scope (테이블만 단독 생성)
`module:<name>` 안에 migration 이 포함되므로 보통 단독 호출 불필요. 단독으로 호출되면:
- 산출: `src/database/data-source.ts` (없으면), `src/database/migrations/<ts>-create-<table>-table.ts`
- §0.5 사전 점검에서 추출한 `existing_tables` 의 최대 timestamp 보다 큰 timestamp 사용.

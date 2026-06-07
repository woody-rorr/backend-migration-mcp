# scaffold_module — 인덱스

`scaffold_new_project_api` 호출 라우팅 + scope 별 규약 파일 참조.

## §0 호출 단위 정책 (Critical)

한 번의 호출은 아래 scope 중 **정확히 1개만** 처리한다. 여러 scope 요청 시 첫 번째만 생성, 나머지는 `todo: ["next: <scope>"]` 기록. 산출 파일 10개 이하.

| scope | 규약 파일 | 비고 |
|---|---|---|
| `bootstrap` | scopes/bootstrap.md | tsconfig/Dockerfile/deps 화이트리스트 + 최소 부트 골격. `migrate-runner` 동반 권장 |
| `app-shell` | scopes/app-shell.md | main.ts 정본 (Swagger/ValidationPipe/CORS/Shutdown) |
| `database` | scopes/module.md (§database) | 테이블 1개당 migration 1개 |
| `module:<name>` | scopes/module.md | entity + migration + app.module.ts 동반 의무 |
| `auth` | auth_patterns.md | JWT/Guard/Strategy |
| `tests:<feature>` | resources/new-project/08-testing.md | e2e |
| `health` | scopes/module.md | 단순 모듈 1개 |
| `modify:<name>` | scopes/modify.md | ALTER 마이그레이션 (CREATE 재산출 금지) |
| `delete:<name>` | scopes/delete.md | 전체 묶음 삭제 (절반 삭제 금지) |
| **`migrate-runner`** | **scopes/migrate-runner.md** | **마이그레이션을 앱 부팅에서 분리 (entrypoint.sh + migrate-task-def.json + deploy.yml RunTask)** |
| `publish` | scopes/publish.md + github_publish.md | 누적 파일 push + PR |

## §0.5 사전 점검 (모든 scope 첫 단계 — Critical)

**common/precheck.md** 를 반드시 따른다. target 레포(`woody-rorr/backend`) 상태를 GitHub MCP 로 읽어 `existing_tables`·`existing_modules`·`existing_entities` 화이트리스트 구성 후 FK·모듈·timestamp 검증.

## 공통 규약 (모든 scope 공통)
- **common/precheck.md** — 사전 점검 (FK/모듈/timestamp 검증)
- **common/swagger-decorators.md** — `@Api*` 데코레이터 허용 키 화이트리스트
- **common/uc-mapping.md** — `05-use-cases.md` UC 표 → service 코드 매핑
- **common/creative-mode.md** — 자유 창작 모드 (opt-in 키워드 감지)

## 모듈 1개 = 파일 묶음

```
src/modules/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts
├── <feature>.repository.ts        # DB 접근 격리
├── dto/
│   ├── create-<feature>.dto.ts
│   ├── update-<feature>.dto.ts
│   └── <feature>-response.dto.ts
└── entities/
    └── <feature>.entity.ts
```

## 규칙
1. controller 는 HTTP/Swagger 데코레이터만, 비즈니스 로직 금지.
2. service 는 transaction 경계. repository 호출 + DTO ↔ entity 매핑.
3. repository 는 ORM 직접 호출만. 비즈니스 규칙 금지.
4. DTO 는 `class-validator` 데코레이터로 `03-api-contract.md` §3 표를 옮긴다.
5. 다른 모듈의 service 직접 import 금지. `exports` 명시된 것만.

## 모듈 등록
- `app.module.ts` 의 `imports: [...]` 에 추가.
- DB 엔티티는 `TypeOrmModule.forFeature([<Feature>Entity])`.

## 산출물 체크리스트
- [ ] Swagger 태그 1개 (`@ApiTags('<feature>')`)
- [ ] 모든 엔드포인트에 `@ApiOperation` + `@ApiResponse`
- [ ] DTO 에 `@ApiProperty`
- [ ] 인증 필요 시 `@UseGuards(JwtAuthGuard)`
- [ ] 권한 필요 시 `@Roles(...)`

## todo 예시
```json
"todo": [
  "next: app-shell",
  "next: database (users table)",
  "next: module:users",
  "next: migrate-runner",
  "next: auth",
  "next: tests:auth"
]
```
호출자(로컬 Claude)는 todo 를 읽고 다음 호출을 자동으로 이어간다. 결과는 누적해 한 PR 로 push.

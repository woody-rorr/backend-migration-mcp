# common/precheck — §0.5 실제 레포 상태 사전 점검 (Critical)

**모든 scope 호출의 첫 단계.** 코드 생성 전 target 레포(`woody-rorr/backend`)의 현재 상태를 GitHub MCP 로 직접 읽어 "지금 존재하는 자원 목록" 을 만든다.

건너뛰면 존재하지 않는 테이블에 FK 를 걸어 부팅 시 `42P01 relation "<x>" does not exist` 로 컨테이너가 무한 재시작 (관측 사례: 2026-06-07 comments PR #68 — `posts` FK 참조 → migration 실패 → ECS 크래시 루프 → ALB 가 이전 task 만 살림 → 신규 코드 미반영).

## 점검 절차 (scope 무관 공통)
1. `mcp__github__get_file_contents` 로 `src/database/migrations/` 디렉토리 목록 조회.
2. 각 `*-create-*-table.ts` 파일명·본문에서 **존재 테이블 화이트리스트** (`existing_tables`) 추출.
   - 예: `1716810000000-create-users-table.ts` → `users`
3. `mcp__github__get_file_contents` 로 `src/modules/` 디렉토리 목록 조회 → **존재 모듈 화이트리스트** (`existing_modules`) 추출.
4. 각 존재 모듈의 `entities/*.entity.ts` 를 읽어 `@Entity('<table>')` 의 `<table>` 명·컬럼·관계 수집 → **존재 엔티티·필드 맵** (`existing_entities`) 구성.
5. 위 3개 산출(`existing_tables`, `existing_modules`, `existing_entities`)을 이 호출의 컨텍스트로 보관.

## 강제 검증 룰
- **FK / 관계 참조 화이트리스트** — 신규 엔티티의 `@ManyToOne`, `@OneToMany`, `@ManyToMany`, `@JoinColumn`, 신규 마이그레이션의 `foreignKeys: [{ referencedTableName: '<x>' }]` 의 `<x>` 는 **반드시 `existing_tables` ∪ "이번 호출에서 같이 산출되는 새 테이블" 안에 있어야 한다**. 위반 시 코드 생성 차단 + `todo: ["spec-fix: <feature> 모듈이 미존재 테이블 <x>를 참조. 선행으로 module:<x> 또는 database scope 필요"]` 응답.
- **모듈 중복 차단** — `module:<name>` 호출 시 `<name>` 이 이미 `existing_modules` 에 있으면 코드 생성 차단 + `todo: ["spec-fix: <name> 모듈 이미 존재. 수정은 modify:<name> 사용"]`. (재산출은 CREATE TABLE 충돌)
- **마이그레이션 timestamp 단조 증가** — 신규 마이그레이션 파일의 timestamp 는 `existing_tables` 추출 시 본 최대 timestamp 보다 **반드시 커야** 한다. 같거나 작으면 차단 + `todo: ["spec-fix: migration timestamp <new> ≤ 기존 최대 <max>"]`.
- **컬럼 참조 일치** — 다른 엔티티의 PK/특정 컬럼을 FK 로 참조할 때 `existing_entities` 의 실제 컬럼명·타입과 일치해야 한다. 불일치 시 차단.

## 자체 검증 절차 (응답 직전 LLM 수행)
1. 산출된 모든 마이그레이션 파일에서 `foreignKeys`, `REFERENCES "<table>"` 패턴 추출.
2. 산출된 모든 entity 파일에서 `@ManyToOne(() => X)`, `@OneToMany(() => X)`, `@ManyToMany(() => X)` 의 `X` 추출 → `X` 의 `@Entity('<table>')` 매핑.
3. 각 참조 테이블이 화이트리스트(기존 + 이번 호출 산출)에 있는지 확인. 하나라도 없으면 응답 차단 + 위 `todo` 형식으로 보고.

## 예외
- `bootstrap`, `app-shell`, `publish`, `delete:<name>` scope 는 점검 절차의 1·2·3 단계만 수행하고 FK 검증은 skip (DB 자원 신규 생성 없음).
- `modify:<name>` 는 1~4 단계 모두 수행하되, 추가하는 FK 가 있으면 검증 룰 적용.

## 호출자 책임
호출자(로컬 Claude)는 `todo: ["spec-fix: ..."]` 응답을 받으면 **자동으로 다음 호출을 만들지 말고 사용자에게 의존성 누락을 보고**한다. 예: "comments 모듈은 posts 테이블이 필요한데 레포에 없습니다. `module:posts` 먼저 진행할까요?"

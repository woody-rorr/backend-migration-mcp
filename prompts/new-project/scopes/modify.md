# scopes/modify — modify:<name> 기존 모듈 수정 (Critical)

기존 모듈을 변경하는 요청(필드 추가/삭제/타입 변경, 엔드포인트 추가, 상태머신 확장 등)은 **`module:<name>` 으로 재산출하지 않고 `modify:<name>`** 으로 처리한다. 재산출은 ALTER 가 아닌 새 CREATE 가 돼 운영 DB 와 충돌 (관측 우려: 2026-06-01).

## 0. 사전 점검 (필수)
`common/precheck.md` 1~4 단계 모두 수행. 추가하는 FK 가 있으면 화이트리스트 검증 적용.

## 1. 산출 대상 (한 호출 = 한 변경 단위)
1. **entity 파일 갱신** — `src/modules/<name>/entities/<name>.entity.ts` (변경된 필드/메서드만, 나머지 그대로)
2. **DTO 갱신** — 영향받는 `dto/*.dto.ts` (예: 새 필드 → `CreateXDto`, `UpdateXDto`)
3. **service/controller 갱신** — 시그니처 변경 있을 때만
4. **신규 ALTER 마이그레이션** — `src/database/migrations/<new-timestamp>-alter-<table>-<짧은_설명>.ts`. **기존 `create-*-table.ts` 절대 수정 금지** (이미 운영 DB run 됨 → idempotent 깨짐). 항상 새 파일.
   - 예: `1780300000000-alter-orders-add-tracking-number.ts` — `up: ALTER TABLE "orders" ADD COLUMN tracking_number ...` / `down: ALTER TABLE "orders" DROP COLUMN tracking_number`
   - 컬럼 삭제는 항상 `down` 에서 같은 컬럼을 `ADD` 로 복원 (롤백 가능).
5. **테스트 갱신** — `__tests__/<feature>.e2e-spec.ts` 영향 케이스 갱신 (선택, `tests:<feature>` scope 분리 가능).

## 2. 응답 규약
- `files` 맵에 변경된 파일 + 신규 ALTER 마이그레이션 1개.
- `deletions` 사용 금지 (수정에는 파일 삭제 없음).
- 호출자(`extra_spec`)는 변경 사항을 **diff 형태로 명시**. 예: `"OrderEntity 에 trackingNumber:varchar(50) nullable 추가. CreateOrderDto 에도 동일 필드 옵션 추가."`.
- 사양 모호 시 (`"orders 테이블 좀 바꿔줘"`) 코드 생성 금지 → `todo: ["spec-required: 변경할 필드/엔드포인트를 명시"]`.

## 3. 위험 변경 가드
- **컬럼 타입 변경** (`varchar(255)` → `text` 등): 무손실이면 그대로. 손실 가능성(`text` → `varchar(10)`)이면 `todo: ["risk: 손실 가능 — 사용자 승인 필요"]` 반환 후 대기.
- **컬럼 삭제 / 테이블 rename**: 항상 `todo: ["risk: 파괴적 변경 — 사용자 명시 승인 필요"]` 반환. extra_spec 에 `"confirm_destructive: true"` 가 있을 때만 진행.

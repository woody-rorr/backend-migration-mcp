# common/uc-mapping — UC 명세 → service 코드 매핑 (Critical)

`resources/new-project/05-use-cases.md` 의 UC 표가 입력으로 주어진 경우, 아래 매핑을 **기계적으로** 적용한다. 자율 해석 금지.

| UC 명세 항목 | 코드 산출 |
|---|---|
| §(1) API 매핑 | controller 메서드의 `@Method('path')`, `@UseGuards(...)`, `@ApiOperation` |
| §(2) 입력 DTO | `dto/<verb>-<noun>.dto.ts` — class-validator 데코레이터 |
| §(3) 사전조건 | service 메서드 진입부 가드절 (각 항목 1개 = if/throw 1개) |
| §(4) 처리 단계 표 | **service 메서드 본문 = 표의 행 순서 그대로**. 행 1개 = 코드 1블록. 순서 변경/병합 금지 |
| §(4) `mutate` 분류 행 | repository 직접 호출 금지. **반드시 entity 메서드 호출** (`order.cancel()`) — 불변식 검증을 엔티티 안으로 가둠 |
| §(4) `emit` 분류 행 | 트랜잭션 commit 이후에 실행 (트랜잭션 콜백 밖) |
| §(5) 트랜잭션 경계 | `dataSource.transaction(async (mgr) => { ... })` 또는 `@Transactional()` 위치를 begin/commit 행에 정확히 배치 |
| §(6) 에러 케이스 표 | **각 행 = `throw new HttpException({ code, message }, status)` 한 번**. 표에 없는 throw 금지. 표에 있는데 코드에 없는 throw 금지 |
| §(7) 사후조건 | 코드 산출에는 직접 반영 없음. e2e 테스트(`tests:<feature>` scope)가 assertion 으로 변환 |
| §(8) 응답 DTO | `dto/<noun>-response.dto.ts` + service 반환부에서 매핑 |

## 추가 강제 규칙
- 처리 단계 표의 한 행이 `validate/load/authorize/mutate/persist/emit` 6분류 외 값이면 LLM 은 코드 생성 대신 `todo: ["spec-fix: UC-XX step N의 분류가 비표준"]` 응답.
- UC 에 `TBD` 가 남아 있으면 그 절에 해당하는 코드를 비워두고 `todo: ["spec-fix: UC-XX §<N> TBD"]` 응답에 명시.
- 에러 케이스 표의 `code` 는 응답 JSON 의 `error.code` 필드와 정확히 일치 (`06-runtime-rules.md` 에러 포맷).
- controller 에는 절대로 비즈니스 분기(`if/else`)나 DB 호출 금지. UC 표의 항목이 controller 로 새면 매핑 실패.

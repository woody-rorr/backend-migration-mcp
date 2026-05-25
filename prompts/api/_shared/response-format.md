# 응답 포맷 (공통)

## 성공 응답

```json
{ "code": 0, "message": "OK", "data": { ... } }
```

- `code`: 0 = 성공. 그 외는 도메인별 비즈니스 코드 (`src/interface/resultCode.js` 참조)
- `data`: 본문. 단일 객체 / 배열 / null 허용
- HTTP status는 항상 200 (비즈니스 실패도 200 + non-zero `code`로 표현). 단 인증/권한/리소스 부재 같은 명확한 HTTP 시맨틱은 4xx 사용.

## 헬퍼 사용

```js
import { ok, fail } from "../../common/resultCode.js";
res.json(ok(data));
res.json(fail("FOLLOW_NOT_FOUND", "팔로우를 찾을 수 없음"));
```

헬퍼가 없으면 같은 PR에 stub 생성 (`prompts/convert_handler.md` § 부팅 안정성 참조).

## 페이지네이션

목록 API는 cursor 기반을 기본으로 함:

```json
{
  "code": 0,
  "data": {
    "items": [...],
    "nextCursor": "eyJpZCI6MTIzfQ==" | null
  }
}
```

offset/limit이 필요한 경우 `data.page`, `data.size`, `data.total` 동봉.

## 빈 결과

- 단건 조회 미존재: 404 + `fail("<DOMAIN>_NOT_FOUND")`
- 목록 조회 빈배열: 200 + `data.items = []` (404 금지)

## 에러 응답

`_shared/error-handling.md`에서 정의. 핸들러에서 직접 형성하지 말고 `next(err)` 위임.

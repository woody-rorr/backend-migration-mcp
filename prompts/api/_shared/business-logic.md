# 비즈니스 로직 작성 규칙 (공통)

## 계층 분리

```
routes.js         → URL/HTTP 메서드 매핑, Swagger JSDoc, 입력 검증 진입점
handler.js        → 요청/응답 처리 (req, res) 시그니처. 비즈니스 로직 호출
service.js (선택) → 순수 비즈니스 로직. req/res 없음. 단위 테스트 가능
repository.js     → DB I/O 전담 (pool.query). 다른 도메인 테이블 직접 접근 금지
```

**원칙:** `routes.js`에는 로직 금지, `handler.js`에서 `service`/`repository` 호출, `service`/`repository`는 `req`/`res`를 모름.

## 파일 위치

- 도메인 단일 파일이면 `handler.js` 안에 함수로 둠.
- 도메인 로직이 100줄 이상이거나 다른 도메인에서도 쓰여야 하면 `service.js` 분리.
- DB 쿼리는 무조건 `repository.js`로 격리.

## 도메인 간 호출

도메인 A → 도메인 B 로직이 필요하면:

- **금지:** `import { ... } from "../B/handler.js"` (직접 import 금지)
- **허용:** `import { ... } from "../B/service.js"` (service만 노출)
- **허용:** 같은 HTTP 클라이언트로 자기 서버 호출 (분리 친화)

## 핸들러 시그니처

```js
export async function list(req, res, next) {
  try {
    const userId = req.user?.sub;
    const items = await service.listForUser(userId, req.query);
    return res.json(ok(items));
  } catch (err) { next(err); }
}
```

- `async (req, res, next)` 고정
- 본문 전체를 `try/catch`로 감싸고 에러는 `next(err)` 위임 (직접 `res.status(500)` 금지)
- 성공 응답은 `_shared/response-format.md`의 `ok()` 헬퍼 사용

## 순수성

- 핸들러/서비스는 같은 입력에 같은 출력을 내도록 작성
- 시간/랜덤은 `Date.now()` / `crypto.randomUUID()` 같은 결정적 진입점만 사용
- 외부 API 호출은 `clients/` 폴더에 별도 모듈로 격리

## 부작용 격리

쓰기 작업(insert/update/delete + 외부 호출)이 2건 이상이면 **트랜잭션** 사용 (`_shared/transaction.md` 참조).

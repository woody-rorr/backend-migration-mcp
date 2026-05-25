# 인증/인가 컨텍스트 (공통)

## req.user 주입

`src/middleware/auth.js`(또는 동등 미들웨어)가 JWT 검증 후 `req.user`에 주입:

```js
req.user = {
  sub: "<user uuid>",
  email: "...",
  roles: ["user"] | ["admin"] | ...
};
```

핸들러는 `req.user`를 신뢰. 직접 JWT 파싱 금지.

## 인증 필수 vs 공개

- 라우터에서 분기:

```js
import { authRequired, authOptional } from "../../middleware/auth.js";

router.get("/list", authRequired, handler.list);
router.get("/public", authOptional, handler.publicList);
```

- 공개 엔드포인트도 `authOptional`로 통과시켜 `req.user`가 있으면 개인화

## 권한 분기

- 역할 체크는 미들웨어 또는 서비스 진입부:

```js
if (!req.user.roles.includes("admin")) {
  throw new ForbiddenError();
}
```

- 리소스 소유권 체크 (자기 데이터인지)는 service/repository에서:

```js
const row = await repo.findById(id);
if (!row) throw new NotFoundError("FOLLOW_NOT_FOUND");
if (row.userId !== req.user.sub) throw new ForbiddenError();
```

## 미들웨어 부재 시

`auth.js` / `jwtAuth.js` / `adminAuth.js` 등이 레포에 없으면 **pass-through stub** 생성 (`prompts/convert_handler.md` § 부팅 안정성).

stub 동작:
- `req.user`를 주입하지 않거나 dev 모드용 더미 사용자
- 운영 전 실제 검증 로직으로 교체 필요 — PR description에 TODO 명시

## 토큰 전파

다른 MCP 호출 등 사용자 컨텍스트 전파 필요 시:
- `Authorization: Bearer <token>` 헤더를 그대로 전달
- 토큰을 로그/응답에 포함 절대 금지

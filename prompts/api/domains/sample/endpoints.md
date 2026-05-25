# sample 엔드포인트 명세 (레퍼런스)

> mount: `app.use("/sample", sampleRouter)`

## GET /sample/list
- 인증: optional
- Query: `cursor?`, `size?`
- 응답: `{ code:0, data: { items, nextCursor } }`

## GET /sample/:id
- 응답: 단건 또는 404

## POST /sample
- 인증: 필수
- Body: `{ name: string<1..200> }`

## PATCH /sample/:id
- 인증: 필수 + 소유자 검증

## DELETE /sample/:id
- 인증: 필수 + 소유자 검증
- soft delete 권장

## Swagger 블록 예시

`prompts/api/domains/follow/endpoints.md` 의 동일 패턴 사용.

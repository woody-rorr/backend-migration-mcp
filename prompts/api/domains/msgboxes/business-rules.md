# msgboxes 도메인 비즈니스 규칙

## R1. JWT + body userid 불일치 시

origin은 body의 userid를 사용 (JWT 검증만 미들웨어가 수행). 마이그레이션도 동일 유지 단, body.userid가 JWT의 id와 다르면 권한 우회 가능 → service 진입부에서 `if (body.userid !== req.user.id) throw ForbiddenError` 검증 추가 권장. PR description에 명시.

## R2. selectNewMessageCount 응답 포맷

`{ newMsgCnt: number }` — spark/profile에서 이 키를 그대로 읽음. 변경 금지.

## R3. setMsgReadState / setMsgWatchState 멱등

이미 read/watch 상태인 메시지를 다시 보내도 200 + `null`. 카운터 영향 없음.

## R4. LoLDBInfo 분리 가능성

origin은 `getConfiguration().LoLDBInfo`로 별도 connection 사용. 마이그레이션 시:
- 같은 DB라면 메인 pool로 통합
- 다른 DB라면 `src/config/lol-db.js`에 별도 pool 정의 + msgboxes/spark에서 import

## R5. 서비스 이식

`MSGBoxes.Controller.*` + `MSGBoxes.Services` 1:1.

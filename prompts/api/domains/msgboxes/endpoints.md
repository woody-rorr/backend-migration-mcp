# msgboxes 엔드포인트 명세

전체 JWT 필수.

## 1. POST /msgboxes/getMsgList

**Body** (`schemaGetMsgList`)
- userid, 페이지, 필터

**처리**: `MSGBoxesCtrl.getMsgList(body)` → `IResponseGetMsgList`

---

## 2. POST /msgboxes/getNewMsgCount

**Body** (`schemaGetNewMsgCount`)
- userid

**처리**: `MSGBoxesCtrl.getNewMsgCount(body)` → `IResponseGetNewMsgCount` (`{ newMsgCnt: number }`)

---

## 3. POST /msgboxes/setMsgReadState

**Body** (`schemaSetMsgReadState`)
- userid, message ids (또는 단일 id)

**처리**: `MSGBoxesCtrl.setMsgReadState(body)` → `null`

---

## 4. POST /msgboxes/setMsgWatchState

**Body** (`schemaSetMsgWatchState`)
- userid, message ids

**처리**: `MSGBoxesCtrl.setMsgWatchState(body)` → `null`

# mainfeed 엔드포인트 명세

## 1. POST /mainfeed/getFeeds

> 피드 목록 조회.

**Auth**: **없음** (origin에서 verifyJWT 미적용).

**Body** (`schemaFeeds` — origin)
- 페이지/필터 정보

**처리**: `MainfeedCtrl.getFeeds(body)` → `IResponseFeed[]`

**Response data**: 피드 배열.

---

## 2. POST /mainfeed/setFeedLike

> 피드 좋아요/취소.

**Auth**: **없음** (origin 그대로). 사용자 식별은 body에서 전달.

**Body** (`schemaSetFeedLike`)
- `userid`, `feed_id`, `like_yn` 등

**처리**: `MainfeedCtrl.setFeedLike(body)` → `IResponseSetFeedLike`

## 경고

setFeedLike에 JWT 미적용 = body의 userid를 그대로 신뢰. **권한 우회 위험** — 마이그레이션 후 JWT 적용 권장이나 origin 호환 유지를 위해 현 시점 변경 금지. PR description에 "auth 강화 TODO" 명시.

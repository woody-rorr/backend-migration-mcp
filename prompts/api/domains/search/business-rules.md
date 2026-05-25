# search 도메인 비즈니스 규칙

## R1. boost 우선 정렬

모든 타입에서 `ORDER BY boostYN DESC, name ASC` (또는 id ASC). origin SQL 그대로.

## R2. follow 표시 미포함

`follow_yn` / `display_order`는 본 API에서 반환 안 함. 클라이언트가 `/follow/my`와 교차 매핑.

## R3. searchType 정규화

```
raw = q.searchType?.trim()?.toLowerCase()
searchType = ['league','team','player'].includes(raw) ? raw : undefined
```

오타/대문자 모두 전체 검색으로 fallback.

## R4. q 정규화

`q?.trim() || undefined`. 빈문자열은 전체 목록 반환 (origin 그대로).

## R5. player fullName

`[first_name, last_name].filter(Boolean).join(' ').trim() || null`. follow 도메인 R9와 동일 규칙.

## R6. 서비스 이식

`Search.Controller.search` + `Search.Services` 1:1 이식.

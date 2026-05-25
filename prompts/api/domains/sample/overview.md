# sample 도메인 개요

## 책임

신규 도메인 추가 시 참고용 **레퍼런스 도메인**. 최소한의 CRUD 패턴 + Swagger + 검증 + 응답 포맷이 갖춰진 표본.

신규 마이그레이션은 본 도메인 구조를 복사해서 시작할 것.

## 데이터 모델 (예시)

```
sample
  id          uuid pk
  name        text not null
  created_at  timestamptz default now()
```

## 권장 파일 구성

```
src/domains/sample/
├── routes.js        ← Express Router + Swagger JSDoc
├── handler.js       ← req/res 처리
├── service.js       ← (선택) 비즈니스 로직
├── repository.js    ← pool.query
└── schemas.js       ← zod 검증
```

## 다른 도메인 참고

본 도메인 코드를 그대로 신규 도메인에 복사 → 도메인명/테이블명/필드명만 치환하는 패턴을 표준으로 한다.

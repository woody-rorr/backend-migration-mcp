# design — 디자인 + 사용자 발화에서 도메인 명세 뽑는 법

> `extract_design_intent` 툴이 따르는 가이드.
> 입력(사용자 발화 + stitch 디자인 IR) → 출력(도메인 명세 JSON).

## 1. 입력 소스
1. **사용자 발화** (필수): "게임 만들어줘", "뉴스 피드 만들어줘" 등
2. **stitch 디자인 IR** (선택): screen 목록 / 컴포넌트 트리 / 라벨 / 폼 필드
3. **이전 라운드 사용자 답변** (반복 호출 시): `clarifications` 입력

## 2. 디자인에서 추출 가능한 것 → 자동 채움
| 디자인 신호 | 매핑 |
|---|---|
| 화면 타이틀/라벨 (예: "뉴스 목록") | 엔티티 후보 (`News`) |
| 폼 입력 필드 | DTO 필드 + 타입(string/number/date 추정) |
| 리스트 아이템의 표시 텍스트 | response 필드 후보 |
| 버튼 액션 (생성/저장/삭제) | CRUD 엔드포인트 후보 |
| 화면 간 네비게이션 | 리소스 관계 후보 |
| 페이지네이션/필터 UI | query 파라미터 |

## 3. 디자인에서 추출 불가능한 것 → 반드시 질문
- 비즈니스 규칙 (점수 계산, 매칭 조건, 보상 정책)
- 권한/인증 (누가 무엇을 볼 수 있는가, public/private)
- 데이터 갱신 주기 (실시간 / 일배치 / 수동)
- 외부 시스템 연동 (결제, 푸시, 외부 API)
- 데이터 보존/삭제 정책 (soft delete 여부, 보존 기간)
- 도메인 제약/불변식 (예: "랭킹은 점수 동률 시 가입일 빠른 순")

위 항목 중 사용자 발화/디자인 어느 쪽에도 단서가 없으면 **추측 금지**. `open_questions`로 반환.

## 4. 질문 작성 규칙
- 한 라운드에 **3개 이하**
- yes/no 또는 객관식(3지선다 이내) 우선
- 열린 질문("어떻게 할까요?") 금지
- 질문은 다음 호출의 `clarifications` 키로 매핑되도록 짧은 식별자를 함께 부여
  ```
  { "id": "ranking_refresh", "question": "랭킹 갱신은? (1) 실시간 (2) 1분 배치 (3) 일배치" }
  ```

## 5. 출력 스키마
```json
{
  "domain": "<한 문장 도메인 요약>",
  "modules": [
    {
      "name": "<도메인 명사, 소문자, kebab/snake 아님 단일어>",
      "entity": {
        "fields": [
          { "name": "title", "type": "varchar(200)", "required": true, "default": null }
        ],
        "relations": [
          { "to": "user", "kind": "many-to-one", "fk": "authorId" }
        ],
        "invariants": ["..."]
      },
      "endpoints": [
        { "method": "GET", "path": "/api/news", "auth": "public", "query": ["category","page","limit"] }
      ]
    }
  ],
  "open_questions": [
    { "id": "<short_id>", "question": "<문장>" }
  ],
  "confidence": 0.0
}
```

규칙:
- `open_questions`가 비어있고 `confidence ≥ 0.8` 일 때만 `scaffold_new_project_api` 호출 가능.
- 그 외에는 호출자가 사용자에게 질문을 던지고 답을 `clarifications`로 묶어 재호출.

## 6. 금지 사항
- **placeholder 이름**: `posts`, `items`, `examples`, `things`, `entries`, `records`, `samples`, `data`, `resource`
- 디자인에 등장하지 않는 엔티티를 "보통 이런 거 있을 것" 같은 추론으로 추가 금지
- 사용자 발화에 없는 도메인 확장 금지 (예: "뉴스" 요청에 임의로 "댓글" 추가 X — 디자인에 댓글 UI가 있을 때만)
- 모든 엔티티 필드 타입은 §5 스키마 타입만 사용 (DB native 타입)

## 7. 정규화 규칙
- 한글 도메인 용어 → 영문 단일어:
  - `사용자/회원/유저` → `user`
  - `경기/매치` → `match`
  - `뉴스/기사` → `news` (불가산이라도 단수형 유지)
- 엔티티명은 단수형 영문 단일어. 테이블명은 NestJS/TypeORM이 자동 복수화.

## 8. 신뢰도(`confidence`) 산정 가이드
| 상황 | confidence |
|---|---|
| 발화 + 디자인 모두 명확, open_questions=[] | 0.9~1.0 |
| 발화는 명확하나 디자인 없음, 일반적 CRUD | 0.7~0.8 |
| 발화 모호, 디자인만 있음 | 0.5~0.7 |
| 둘 다 모호 | < 0.5 (생성 진행 불가) |

`confidence < 0.8` 이면 반드시 `open_questions`로 부족분을 메우는 질문을 1개 이상 포함.

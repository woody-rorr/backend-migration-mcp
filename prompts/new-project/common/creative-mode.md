# common/creative-mode — 명세 없이 자유 창작 (Opt-in)

사용자 task 또는 extra_spec 에 다음 키워드 중 하나라도 포함되면 **creative mode** 활성:
- `creative`, `freestyle`, `자유롭게`, `맘대로`, `알아서`, `네가 정해`, `좋은 퀄리티`, `퀄리티 좋게`

활성 시 `scaffoldNewProjectApi.js` 시스템 프롬프트 §9~11(명시 정의 강제 / 추측 금지 / 필드 임의 추가 금지)을 **이 호출 한정 해제**하고 아래 규칙으로 대체.

## Creative Mode 규칙
1. **엔티티 필드 자유 추가** — 도메인 통상 패턴으로 합리적인 필드 추가 (예: Quiz → `title`, `description`, `questions`, `timeLimit`, `difficulty`, `passingScore`, `attemptsLimit` 등).
2. **상태머신 능동 도입** — 도메인에 자연스러우면 `draft → published → archived` 같은 상태 추가. 엔티티 메서드(`quiz.publish()`, `quiz.archive()`)로 전이 표현.
3. **비즈니스 룰 능동 도입** — 다음을 항상 고려:
   - 권한 가드 (본인 소유 리소스만 수정/삭제)
   - 횟수/시간 제한 (예: 하루 N회 응시)
   - 상태 전이 규칙 (예: archived 상태는 수정 불가)
   - 멱등성 (중복 호출 차단)
4. **service 메서드 = entity 메서드 호출 패턴** — `quiz.attemptBy(user, answers)` 같이 엔티티에 비즈니스 행위 메서드 두기. **thin CRUD `repo.save()` 직호출 금지**.
5. **도메인 특화 에러 코드 자유 작명** — `QUIZ_ALREADY_ATTEMPTED`, `ATTEMPT_TIME_EXCEEDED` 등. HTTP status 매핑은 `06-runtime-rules.md` 규약 따름.
6. **트랜잭션 경계 능동 결정** — 다단계 mutate + persist 있으면 `dataSource.transaction()` 로 감싸기.

## 의무 — `creative_decisions` 보고
응답 JSON 에 다음 필드 필수 포함:
```json
{
  "files": { ... },
  "creative_decisions": [
    "엔티티 Quiz에 attemptsLimit(int) 추가 — 무한 응시 방지",
    "QuizAttempt 분리 — 응시 이력 추적 필요",
    "상태머신: draft → published → archived 도입",
    "QUIZ_ALREADY_ATTEMPTED 에러 코드 도입 — 같은 사용자 재응시 차단",
    "트랜잭션: attempt 생성 + quiz.attemptCount 증가 묶음"
  ],
  "todo": [ ... ]
}
```
`creative_decisions` 는 PR body 에도 포함되어 사용자가 한눈에 "MCP 가 뭘 발명했는지" 보게 함.

## 비활성 (기본값)
키워드 없으면 §9~11 그대로 적용 — 명세 없으면 `spec required` 응답.

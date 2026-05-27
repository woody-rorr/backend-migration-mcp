# Testing

> 테스트가 없는 코드는 머지 금지. spec-first 원칙 그대로 — DTO/엔드포인트가 문서에 명시됐다면 e2e 테스트도 같은 PR에서 작성.

## 1. 디렉토리 구조
```
src/modules/<feature>/
├── __tests__/
│   ├── <feature>.service.spec.ts     # 단위 (mock 없는 비즈니스 로직)
│   └── <feature>.e2e-spec.ts         # 통합 (실제 DB + HTTP)
test/
└── setup.ts                           # 전역 setup (DB 마이그레이션, fixture)
```
- 단위 테스트: 모듈 내부에 위치 (`__tests__/`).
- e2e: 같은 위치 또는 `test/e2e/`. NestJS 컨벤션은 후자지만, 본 프로젝트는 모듈별로 둠 → cohesion 우선.

## 2. 프레임워크
- `jest` (NestJS 기본).
- HTTP 테스트: `supertest`.
- e2e용 NestJS app은 `Test.createTestingModule({...}).compile()` 후 `app.init()`.

## 3. Mock 정책 (중요)
- **DB는 mock 금지**. 실제 Aurora PostgreSQL 또는 testcontainers Postgres 사용.
  - 이유: mock 통과한 ORM 쿼리가 실제로는 실패하는 사고 방지.
- 외부 API (HTTP, 다른 서비스): mock OK. `jest.mock` 또는 nock.
- 시간/랜덤: `jest.useFakeTimers()` / `jest.spyOn(crypto, 'randomUUID')`.
- 비번 해싱: mock 금지 (실제 bcrypt 실행 — 느리지만 정확).

## 4. 테스트 DB 셋업
- 옵션 A (간단): 동일한 RDS 인스턴스의 **별도 DB** 사용 (`backend_test`).
- 옵션 B (격리): testcontainers `postgres:16-alpine` 컨테이너 매 실행 시 신규 생성.
- 각 테스트 케이스마다 트랜잭션 시작 → 끝나면 rollback (`TypeOrmTransactionalTestRunner` 패턴). 격리 보장.

## 5. e2e 작성 패턴
```ts
describe("POST /api/auth/signup", () => {
  it("creates user and returns access token", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/signup")
      .send({ email: "u@e.com", password: "Passw0rd!", name: "U" })
      .expect(201);
    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      user: { id: expect.any(String), email: "u@e.com", name: "U" },
    });
    expect(res.body.user.passwordHash).toBeUndefined(); // 누출 방지 검증
  });

  it("rejects duplicate email with 409", async () => {
    await createUser({ email: "dup@e.com" });
    await request(app.getHttpServer())
      .post("/api/auth/signup")
      .send({ email: "dup@e.com", password: "Passw0rd!", name: "X" })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe("EMAIL_EXISTS"));
  });
});
```

## 6. 필수 커버리지 항목
- 모든 controller 메서드 → 최소 1개 e2e (success 케이스)
- 인증/권한 가드 → 401, 403 케이스 각 1개
- validation 실패 → 400 케이스 1개
- DB 제약 위반 (unique 등) → 409 케이스
- 비즈니스 규칙 위반 → 422 케이스

## 7. 커버리지 목표
- 라인 70% 이상 (단위 + e2e 합산).
- 단, **숫자보다 중요한 건 "위 §6 항목 다 커버됐는가"**. 의미 없는 커버리지 채우기 금지.

## 8. CI에서 실행
- `.github/workflows/test.yml` (별도 PR로 추가 예정)
- 머지 전 PR 단위에서 자동 실행.
- 실패 시 머지 차단 (브랜치 보호 룰).

## 9. 금지
- DB mock으로 통과시킨 e2e
- 환경 변수에 따라 동작이 달라지는 테스트 (`if (process.env.X) ...`)
- 한 테스트가 다른 테스트에 의존 (`describe` 순서 의존)
- 외부 시스템 (운영 DB, 외부 API)에 실제로 쓰는 테스트

# extension 엔드포인트 명세

## 1. GET /extension/live2d-character

> 캐릭터 manifest 조회. 인증 무관.

**Query**
| 키 | 비고 |
|---|---|
| character_name (alias `name`) | 비면 anonymous default 반환 |

**처리**
- `character_name` 있음 → `ExtensionCtrl.getPublicLive2dCharacter(character_name)`
- 없음 → `ExtensionCtrl.getLive2dCharacterAnonymousDefault()`

**Response data**
- `{ character_name, model_manifest_url, manifest_json?, ... }` (origin DTO)

---

## 2. POST /extension/live2d-character

> 캐릭터 메타데이터 upsert + 업로드 URL 발급.

**Auth**: JWT 필수.

**Body** (alias 허용)
| 키 | alias | 비고 |
|---|---|---|
| character_name | characterName | **필수** |
| model_manifest_url | modelManifestUrl / model3_manifest_url / model3ManifestUrl | optional |
| manifest_json | — | object만 허용 (`typeof === 'object'`) |
| upload_files | uploadFiles | 문자열 배열, 각 trim 후 빈문자 제거 |
| manifest_relative_path | manifestRelativePath | optional |
| upload_manifest_filename | uploadManifestFilename | optional |
| upload_content_type | uploadContentType | optional |

**검증**
- JWT userid 없음 → `validationError "invalid user token"`
- `character_name` 빈문자 → `validationError "character_name is required"`

**처리**: `ExtensionCtrl.upsertLive2dCharacter({ userid, character_name, ... })`

**Response data** (origin DTO 그대로)
- upsert된 캐릭터 정보 + (요청 시) presigned upload URL들

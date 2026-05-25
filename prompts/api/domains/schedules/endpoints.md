# schedules 엔드포인트 명세

전체 JWT 필수. 모두 POST + JSON body (origin schema 그대로).

## 1. POST /schedules/getLeaguesForLoL
- **Body** (`schemaLeaguesForLoL`)
- **처리**: `ScheduleCtrl.getLeagueSchedulesForLoL(body)`
- **Response**: `IResponseGetLeaguesForLoL` (origin)

## 2. POST /schedules/getSeriesForLoL
- **Body** (`schemaSeriesForLoL`)
- **처리**: `ScheduleCtrl.getSeriesSchedulesForLoL(body)`
- **Response**: `IResponseGetSeriesForLoL`

## 3. POST /schedules/getTournamentsForLoL
- **Body** (`schemaTournamentsForLoL`)
- **처리**: `ScheduleCtrl.getTournamentsSchedulesForLoL(body)`
- **Response**: `IResponseGetTournamentsForLoL`

## 4. POST /schedules/getMatchesForLoL
- **Body** (`schemaMatchesForLoL`)
- **처리**: `ScheduleCtrl.getMatchesSchedulesForLoL(body)`
- **Response**: `IResponseGetMatchesForLoL`

## 5. POST /schedules/getAllMatchesForLoL
- **Body** (`schemaAllMatchesForLoL`)
- **처리**: `ScheduleCtrl.getAllMatchesSchedulesForLoL(body)`
- **Response**: `IResponseGetAllMatchesForLoL[]`

각 schema 정의는 origin `schedules/schema.ts` 그대로 zod 변환해 이식.

# TASK — SubTrack

> 전제: 템플릿이 이미 제공하는 것(TDS 셋업, `AdSlot`, `TossRewardAd`, `TossPurchase`, `ScreenScaffold`, `SubmitFooter`, `SummaryHero`, `FloatingTabBar`, localStorage helper, 토스 로그인 자동 세션)은 **작업 대상이 아니다**. 아래 태스크는 SubTrack 고유 로직/화면만 다룬다.

---

## Epic 1. 타입 · 상수 정의

**Risk Assessment**
- **Complexity**: Low
- **Risk factors**: (1) 페이지별로 `location.state` 모양이 제각각이 되면 결과 화면 크래시(2026-08-03 SplitMate 사고 유형). (2) `CategoryKey`/`ChecklistItem.id` 같은 리터럴 유니온이 화면마다 문자열로 중복 선언되면 오타가 런타임까지 통과. (3) 상수(`SERVICE_TEMPLATES`)에 금액을 넣으면 A-1 위반(사실 주장).
- **Mitigation**: 모든 화면·스토리지보다 먼저 `types.ts`에 `RouteState`를 단일 정의하고, 이후 모든 페이지 패킷의 DoD에 "`RouteState`를 import해서 캐스팅 + null 가드"를 강제한다. 상수는 타입 뒤·스토리지 앞에 고정해 금액 필드가 아예 타입상 존재하지 않게 한다.

### Task 1.1 도메인 타입 + RouteState 정의
- **Description**: `src/lib/types.ts`에 SPEC Data Models의 모든 엔티티 타입과 라우트별 `location.state` 계약 타입을 정의한다. 런타임 코드 0줄(순수 타입 + `Result` 유니온만).
  - `BillingCycle`, `SubscriptionStatus`, `CategoryKey`, `AgeBand`, `PriceChange`, `Subscription`, `ChecklistItem`, `CancelChecklist`, `AppSettings`, `StorageMeta`, `ServiceTemplate`, `BenchmarkTable`
  - 결과 타입: `export type StorageError = 'STORAGE_FULL' | 'VALIDATION' | 'MAX_ITEMS' | 'NOT_FOUND' | 'PARSE'; export type Result<T> = { ok: true; data: T } | { ok: false; error: StorageError; fields?: string[] };`
  - 훅 상태 타입: `export type LoadState<T> = { status: 'loading'; items: T[] } | { status: 'ready'; items: T[] };`
  - **RouteState (필수)**:
    ```ts
    export type RouteState = {
      '/': { toast?: string } | null;
      '/subscriptions/new': { templateKey?: string } | null;
      '/subscriptions/:id': { toast?: string } | null;
      '/subscriptions/:id/edit': { subscriptionId: string } | null;
      '/subscriptions/:id/checklist': { subscriptionId: string; from: 'dday' | 'detail' } | null;
      '/compare': null;
      '/more': null;
      '/premium': { from: 'limit' | 'compare' | 'more' } | null;
    };
    ```
- **DoD**:
  - `npx tsc --noEmit` 통과, 파일 내 `import` 문 0건(외부 의존 없음), 실행 가능한 표현식 0건.
  - `Subscription`의 모든 필드가 SPEC 정의와 1:1 일치(옵셔널 필드 없음, `priceHistory: PriceChange[]`).
  - `RouteState`의 키가 위 8개 라우트를 모두 포함하고 각 값 타입에 `| null`이 명시됨.
  - `ServiceTemplate`에 금액 관련 필드가 **존재하지 않음**(`key`,`name`,`category`,`iconKey` 4개만).
- **Covers**: [F1-AC3, F1-AC7, F5-AC4, F7-AC2, F8-AC7]
- **Files**: `src/lib/types.ts`
- **Depends on**: none

### Task 1.2 정적 상수 · 스토리지 키 정의
- **Description**: `src/lib/constants.ts`에 앱 내장 상수를 정의한다.
  - `STORAGE_KEYS = { subscriptions: 'subtrack.subscriptions.v1', checklists: 'subtrack.checklists.v1', settings: 'subtrack.settings.v1', meta: 'subtrack.meta.v1' }`
  - `SERVICE_TEMPLATES: ServiceTemplate[]` — 12종 고정(이름·카테고리·`iconKey`만, 금액 없음). 로고 상표 이슈(Q-2) 회피를 위해 `iconKey`는 카테고리 기반 키를 사용.
  - `DEFAULT_CHECKLIST: ChecklistItem[]` — `remaining`/`autopay`/`backup`/`notify`/`capture` 5개, 라벨은 SPEC F7 요구사항 문구 그대로, `done=false`, `doneAt=null`. 라벨에 "설치"/"다운로드"/"바로가기" 문자열 미포함.
  - `DEFAULT_BENCHMARK: BenchmarkTable` + `getBenchmark()` — `import.meta.env.VITE_BENCHMARK_JSON` 이 유효한 JSON이면 덮어쓰고, 파싱 실패 시 `console.warn` 후 기본값 반환(`console.error` 금지).
  - `MAX_SUBSCRIPTIONS = 100`, `FREE_SUBSCRIPTION_LIMIT = 3`, `MAX_PRICE_HISTORY = 20`, `COMPARE_UNLOCK_HOURS = 24`, `MAX_STORAGE_CHARS = 1_048_576`, `BENCHMARK_DISCLAIMER = '참고용 추정치입니다 · 실제 평균과 다를 수 있어요'`.
- **DoD**:
  - `SERVICE_TEMPLATES.length === 12`, key 중복 0건, `SERVICE_TEMPLATES.find(t => t.name === '넷플릭스')?.category === 'OTT'`.
  - `DEFAULT_CHECKLIST.length === 5`이고 id 집합이 정확히 위 5개.
  - `VITE_BENCHMARK_JSON`이 `'{{broken'`인 상태에서 `getBenchmark()` 호출 시 예외 없이 `DEFAULT_BENCHMARK` 반환.
  - 파일 내 HEX 색상 리터럴 0건.
- **Covers**: [F2-AC1, F6-AC3, F7-AC4]
- **Depends on**: Task 1.1
- **Files**: `src/lib/constants.ts`

---

## Epic 2. 데이터 레이어 (계산 · 스토리지 · 상태)

**Risk Assessment**
- **Complexity**: Medium
- **Risk factors**: (1) 월말 보정(31일 → 4월 30일) 로직을 `new Date()` 자동 롤오버로 짜면 `2026-04-31 → 2026-05-01`로 조용히 틀린다. (2) KST 기준 "오늘"을 화면마다 각자 계산하면 자정 근처 D-day가 화면별로 어긋난다. (3) `QuotaExceededError`를 잡지 않으면 저장 실패가 크래시로 이어진다. (4) 손상 JSON 파싱 실패가 `console.error`를 유발해 G-3 위반. (5) 훅이 첫 렌더에서 `status:'ready'`, `items:[]`를 반환하면 빈 상태가 깜빡이며 오탐된다(F3-AC5, F4-AC7).
- **Mitigation**: 계산(2.1) → 스토리지 프리미티브(2.2) → 엔티티 리포지토리(2.3/2.4) → 훅(2.5) 순서로 쪼개, 아래 계층이 완전히 단위 테스트된 뒤에만 위 계층이 올라간다. 화면 태스크는 Epic 2가 끝나기 전엔 시작하지 않으므로 화면 코드에 날짜/스토리지 로직이 중복 구현될 여지가 없다.

### Task 2.1 날짜 · 금액 계산 순수 함수
- **Description**: `src/domain/calc.ts`에 부수효과 없는 계산 함수만 구현한다.
  - `getToday(now?: Date): string` — KST(UTC+9) 기준 `YYYY-MM-DD`. 앱 전체에서 "오늘"의 유일한 출처.
  - `isValidDateString(s: string): boolean` — `YYYY-MM-DD` 형식 + 실재 날짜 검증(`'2026-13-01'`, `'not-a-date'` → false).
  - `monthlyAmount(sub: Pick<Subscription,'amount'|'cycle'>): number` — `YEARLY`면 `Math.round(amount/12)`.
  - `computeNextBillingDate(firstBillingDate: string, cycle: BillingCycle, today: string): string` — 기준일(day)로 오늘 포함 이후 최초 도래일, 해당 월에 그 일이 없으면 그 달 말일로 보정. 문자열 산술로 구현(Date 롤오버 금지).
  - `daysUntil(date: string, today: string): number`
  - `formatKRW(n: number): string` — `toLocaleString('ko-KR') + '원'`.
  - `ddayLabel(dday: number): string` — `0 → '오늘 결제'`, 그 외 `'D-{n}'`.
- **DoD** (테스트 파일로 검증):
  - `monthlyAmount({amount:29000,cycle:'YEARLY'}) === 2417`, `monthlyAmount({amount:13500,cycle:'MONTHLY'}) === 13500`.
  - `computeNextBillingDate('2026-01-31','MONTHLY','2026-04-01') === '2026-04-30'`, 같은 입력에 today=`'2026-04-30'` → `'2026-04-30'`.
  - `computeNextBillingDate('2026-09-10','MONTHLY','2026-09-04') === '2026-09-10'`; `('2026-08-10','MONTHLY','2026-09-04') === '2026-09-10'`.
  - `daysUntil('2026-09-06','2026-09-04') === 2`, `ddayLabel(0) === '오늘 결제'`.
  - 잘못된 날짜 입력 시 예외를 던지지 않고 `computeNextBillingDate`는 `''`, `daysUntil`은 `NaN` 반환. `console.error` 호출 0건.
  - `Array.prototype.at`/`findLast`/`structuredClone`/lookbehind 미사용.
- **Covers**: [F1-AC1, F1-AC2, F4-AC2]
- **Files**: `src/domain/calc.ts`, `src/domain/calc.test.ts`
- **Depends on**: Task 1.1

### Task 2.2 스토리지 프리미티브 (안전 읽기/쓰기)
- **Description**: `src/domain/storage.ts`에 localStorage 접근을 감싸는 저수준 함수만 구현한다. 엔티티 로직 없음.
  - `readJson<T>(key: string, fallback: T): T` — 파싱 실패 시 원본 값을 `${key}.corrupt` 로 이동, `localStorage.removeItem(key)`, `console.warn` 1회 후 `fallback` 반환.
  - `writeJson(key: string, value: unknown): Result<void>` — `JSON.stringify` 길이가 `MAX_STORAGE_CHARS` 초과면 쓰기 전 `{ok:false,error:'STORAGE_FULL'}`; `setItem`이 throw하면(QuotaExceededError 포함) 기존 값 유지한 채 `{ok:false,error:'STORAGE_FULL'}`.
  - `ensureMeta(): void` — `subtrack.meta.v1` 없으면 `{schemaVersion:1, migratedAt:<ISO>}` 기록.
  - `clearAll(): Result<void>` — SubTrack 키 4개만 삭제(다른 키 보존).
  - `newId(): string` — uuid v4 문자열(`crypto.randomUUID` 없으면 fallback 생성기; Android 7 대응).
- **DoD**:
  - `localStorage['subtrack.subscriptions.v1'] = '{{broken'` 상태에서 `readJson(key, [])` → `[]` 반환, 예외 0건, `localStorage['subtrack.subscriptions.v1.corrupt'] === '{{broken'`, `console.warn` 1회 / `console.error` 0회.
  - `setItem`을 `QuotaExceededError` throw로 모킹 → `writeJson` 이 `{ok:false,error:'STORAGE_FULL'}` 반환하고 기존 저장값이 바뀌지 않음.
  - `clearAll()` 후 `localStorage['unrelated.key']`는 그대로 존재.
  - `newId()` 100회 호출 시 중복 0건.
- **Covers**: [F1-AC4, F1-AC5]
- **Files**: `src/domain/storage.ts`, `src/domain/storage.test.ts`
- **Depends on**: Task 1.2

### Task 2.3 구독 리포지토리 (CRUD · 검증 · 가격 이력)
- **Description**: `src/domain/subscriptions.ts`. 화면은 이 모듈로만 구독에 접근한다.
  - `listSubscriptions(): Subscription[]`
  - `validateSubscriptionInput(input): string[]` — 위반 필드명 배열. 규칙: `name` trim 후 1~20자, `amount` 정수 1~10,000,000, `firstBillingDate` `isValidDateString`, `memo` ≤100자.
  - `saveSubscription(input: SubscriptionInput): Result<Subscription>` — 신규는 `id/createdAt/updatedAt/status='ACTIVE'/priceHistory=[]` 채우고 `nextBillingDate` 계산 후 저장. 신규 저장 시 전체 건수 ≥ `MAX_SUBSCRIPTIONS` 면 `{ok:false,error:'MAX_ITEMS'}`. 검증 실패 시 `{ok:false,error:'VALIDATION',fields}`.
  - `updateSubscription(id, patch, priceNote?): Result<{sub: Subscription; delta: number}>` — 금액이 바뀐 경우에만 `priceHistory`에 `{id,amount:새금액,changedAt:getToday(),note}` push, 20건 초과 시 `shift()`. `delta = 새금액 - 이전금액`(동일 금액이면 0, 이력 미추가). `status` 변경 시 `nextBillingDate` 재계산.
  - `deleteSubscription(id): Result<void>` (해당 체크리스트도 함께 제거)
  - `refreshNextBillingDates(today): Subscription[]` — 캐시된 `nextBillingDate`가 과거이거나 비어 있으면 재계산해 저장 후 최신 목록 반환. 날짜 손상 항목은 `nextBillingDate=''`로 두고 스킵.
  - `hasPriceIncrease(sub): boolean` — 마지막 이력이 직전 금액보다 큰 경우 true.
  - `countActive(): number`
- **DoD**:
  - 빈 스토리지에서 `saveSubscription({name:'넷플릭스',category:'OTT',amount:13500,cycle:'MONTHLY',firstBillingDate:'2026-09-10'})` → 저장 배열 길이 1, `nextBillingDate==='2026-09-10'`, `status==='ACTIVE'`, `priceHistory.length===0`, `id/createdAt/updatedAt` 비어있지 않음. `listSubscriptions().length === 1`.
  - `{name:'   ',amount:0,cycle:'MONTHLY',firstBillingDate:'2026-13-01'}` → `{ok:false,error:'VALIDATION',fields:['name','amount','firstBillingDate']}` 이고 저장 0건.
  - 100건 저장된 상태(`isPremium=true`)에서 101번째 → `{ok:false,error:'MAX_ITEMS'}`.
  - `amount:13500 → 17000` 업데이트 시 `priceHistory.length===1`, `delta===3500`; `17000 → 9900` 시 `delta===-7100`; `13500 → 13500` 시 `priceHistory.length` 불변, `delta===0`.
  - `priceHistory` 20건 상태에서 1건 추가 → 길이 20 유지, 가장 오래된 항목(첫 원소)이 제거됨.
  - `nextBillingDate='2026-08-10'`, `firstBillingDate='2026-08-10'` 항목에 `refreshNextBillingDates('2026-09-04')` → 반환값·저장값 모두 `'2026-09-10'`.
  - `status:'CANCELED' → 'ACTIVE'` 업데이트 시 `nextBillingDate`가 오늘 기준으로 재계산됨.
- **Covers**: [F1-AC3, F1-AC6, F1-AC8, F4-AC5, F5-AC1, F5-AC2, F5-AC5, F5-AC8, F7-AC8]
- **Files**: `src/domain/subscriptions.ts`, `src/domain/subscriptions.test.ts`
- **Depends on**: Task 2.1, Task 2.2

### Task 2.4 설정 · 체크리스트 리포지토리
- **Description**: `src/domain/settings.ts` 와 `src/domain/checklists.ts`.
  - settings: `getSettings(): AppSettings`(없으면 `{ageBand:'UNSET',isPremium:false,premiumGrantedAt:null,compareUnlockedAt:null,onboardedAt:null}` 기본값), `saveSettings(patch: Partial<AppSettings>): Result<AppSettings>`(부분 병합), `isCompareUnlocked(settings, now): boolean` — `isPremium`이면 true, 아니면 `compareUnlockedAt`이 존재하고 경과 시간 < `COMPARE_UNLOCK_HOURS`.
  - checklists: `getChecklist(subscriptionId): CancelChecklist`(없으면 `DEFAULT_CHECKLIST` 깊은 복사로 생성만 하고 저장은 하지 않음), `toggleChecklistItem(subscriptionId, itemId, done): Result<CancelChecklist>`(`doneAt`=ISO 또는 null, `updatedAt` 갱신 후 저장), `getProgress(cl): number`, `deleteChecklist(subscriptionId): Result<void>`.
- **DoD**:
  - 저장 이력이 없는 `sub_1`에 `toggleChecklistItem('sub_1','autopay',true)` → `subtrack.checklists.v1`에 items 5개짜리 레코드 1건 저장, `autopay.done===true`, `doneAt`이 ISO 문자열, `getProgress()===1`.
  - 3개 `done=true` 저장 후 `getChecklist('sub_1')` 재조회 시 동일 3개가 true, `getProgress()===3`.
  - `writeJson` 실패 모킹 시 `toggleChecklistItem` 이 `{ok:false,error:'STORAGE_FULL'}` 반환하고 저장값 불변.
  - `compareUnlockedAt`이 25시간 전 ISO, `isPremium=false` → `isCompareUnlocked()===false`; 1시간 전 → `true`; `isPremium=true`, `compareUnlockedAt=null` → `true`.
  - `saveSettings({isPremium:true,premiumGrantedAt:<ISO>})` 후 새 `getSettings()`가 `isPremium===true` 반환(리로드 시뮬레이션).
- **Covers**: [F6-AC8, F7-AC1, F7-AC2, F8-AC3, F8-AC7]
- **Files**: `src/domain/settings.ts`, `src/domain/checklists.ts`, `src/domain/settings.test.ts`
- **Depends on**: Task 2.2

### Task 2.5 상태 훅 (useSubscriptions / useSettings)
- **Description**: `src/hooks/useSubscriptions.ts`, `src/hooks/useSettings.ts`. 리포지토리를 React 상태로 노출하고 화면 간 갱신을 동기화한다(가벼운 모듈 스코프 구독자 목록 + `useSyncExternalStore` 또는 커스텀 emitter, 외부 상태 라이브러리 미도입).
  - `useSubscriptions(): { status:'loading'|'ready'; items: Subscription[]; reload(): void; save(...); update(...); remove(...) }` — 최초 마운트 시 `status:'loading'`, `items:[]`로 시작해 effect에서 `refreshNextBillingDates(getToday())` 실행 후 `status:'ready'`로 전이. 데이터가 0건이어도 `status:'ready'`, `items:[]`.
  - `useSettings(): { settings: AppSettings; status; save(patch) }`
  - 파생 셀렉터 `src/hooks/selectors.ts`: `totalMonthly(items)`(ACTIVE + 유효 날짜만 합산), `sortedByDday(items, today)`, `imminent(items, today)`(ACTIVE & `0 <= dday <= 3`), `categoryBreakdown(items)`(상위 5 + '기타'), `recentSixMonths(items, today)`(월 총액 6포인트).
- **DoD**:
  - 렌더 테스트: 첫 커밋에서 `status==='loading' && items.length===0`, effect 완료 후 `status==='ready'`. 저장 데이터 0건일 때도 `status==='ready'`, `items===[]`.
  - 한 컴포넌트에서 `save()` 호출 시 같은 훅을 쓰는 다른 마운트된 컴포넌트의 `items`가 재조회 없이 갱신됨.
  - `totalMonthly([13500/M, 10900/M, 29000/Y, 9900/M(CANCELED)]) === 26817`.
  - `firstBillingDate='not-a-date'` 항목이 섞여도 훅/셀렉터가 throw하지 않고 해당 항목을 총액에서 제외, `console.error` 0회.
  - `recentSixMonths()` 반환 배열 길이는 항상 6.
- **Covers**: [F1-AC7, F3-AC1, F3-AC5, F4-AC7, F7-AC7, F8-AC2]
- **Files**: `src/hooks/useSubscriptions.ts`, `src/hooks/useSettings.ts`, `src/hooks/selectors.ts`, `src/hooks/useSubscriptions.test.tsx`
- **Depends on**: Task 2.3, Task 2.4

---

## Epic 3. 화면 (1 페이지 = 1 태스크)

**Risk Assessment**
- **Complexity**: High
- **Risk factors**: (1) `location.state` 없이 `/subscriptions/:id/edit` 등에 직접 진입하거나 결과 화면을 새로고침하면 구조분해 시점에 즉시 크래시 — 완주율 0% 사고 유형. (2) TDS 컴포넌트 여백을 Tailwind/인라인 스타일로 덮어써 검수 반려. (3) 차트/배지에 HEX 색을 직접 써서 G-6 위반 + 다크모드 대비 붕괴. (4) 대시보드가 히어로·D-day·차트·목록·광고를 한 패킷에 몰아 담으면 10분 초과. (5) 체크리스트/프리미엄 문구에 "설치·다운로드" 표현이 섞이면 G-2 위반.
- **Mitigation**: 시각화 컴포넌트(3.1)를 화면보다 먼저 분리해 색 토큰·`data-testid` 계약을 한 곳에 고정하고, 대시보드는 요약(3.2)/목록·D-day(3.3) 두 패킷으로 쪼갠다. 모든 페이지 태스크의 DoD에 "state 없이 직접 진입해도 크래시 없음" AC를 개별 명시하고, URL param을 1차 소스·`location.state`를 보조 힌트로만 쓰도록 못 박는다.

### Task 3.1 시각화 · 스켈레톤 공용 컴포넌트
- **Description**: 화면들이 공유할 표시 전용 컴포넌트를 만든다(데이터 계산 없음, props로만 받음).
  - `Sparkline` — 6포인트 라인, 루트에 `data-testid="trend-sparkline"`, 색은 `var(--tds-color-blue-500)` 등 토큰만.
  - `MiniBar` — 카테고리별 비중 막대(최대 6행), 루트 `data-testid="category-minibar"`.
  - `SkeletonBlock`, `SkeletonListRow` — 고정 높이 placeholder.
  - `PriceUpBadge` — TDS `Chip`("인상"), `data-testid="price-up-badge"`.
  - `DdayBadge` — `ddayLabel()` 결과 렌더, `dday<=3`이면 강조 토큰(`var(--tds-color-red-500)`), 날짜 불명이면 "날짜 확인 필요".
  - 배치는 flex/grid 커스텀 CSS만 사용하고 TDS 컴포넌트에 padding/margin override 금지, 간격은 TDS `Spacing`(size 필수).
- **DoD**:
  - 각 컴포넌트가 지정된 `data-testid`를 정확히 1개 노출.
  - `src/components/` 신규 파일 전체에서 `#[0-9a-fA-F]{3,8}\b` 매칭 0건.
  - `Sparkline`에 빈 배열/길이 1 배열을 넘겨도 렌더되고 throw하지 않음.
  - `DdayBadge`에 `dday=0` → "오늘 결제", `dday=NaN` → "날짜 확인 필요".
  - 스토리북 없이 렌더 테스트로 스냅샷 검증, `console.error` 0회.
- **Covers**: [F3-AC2, F5-AC3, G-6, AC-S1-1]
- **Files**: `src/components/Sparkline.tsx`, `src/components/MiniBar.tsx`, `src/components/Skeletons.tsx`, `src/components/PriceUpBadge.tsx`, `src/components/DdayBadge.tsx`
- **Depends on**: Task 2.1

### Task 3.2 대시보드 — 요약 영역 (히어로 · 차트 · 빈/로딩 상태)
- **Description**: `src/pages/HomePage.tsx` 1차 구현. `ScreenScaffold`(`data-testid="screen-home"`) + `Top title="구독 관리"` 안에 위→아래로 `SummaryHero`(`data-testid="summary-hero"`, value=월 총액, CountUp) → 추이 Card(`Sparkline`) → 비중 Card(`MiniBar`)를 배치. 목록/D-day/광고는 Task 3.3·4.2에서 추가(자리만 비워둠).
  - Loading: 히어로 자리 `data-testid="hero-skeleton"` + 스켈레톤 `ListRow` 3개, 빈 상태 문구 미표시.
  - Empty(활성+해지 0건): `data-testid="empty-state"` 안에 `Asset.ContentIcon` + "아직 등록한 구독이 없어요" + `display="block"` 버튼 "첫 구독 등록하기". 이때 히어로/Sparkline/MiniBar는 렌더하지 않음.
  - Error: 손상 항목 존재 시 인라인 배너 "일부 항목을 불러오지 못했어요"(전체 크래시 없음).
  - `useLocation().state`를 `RouteState['/']`로 캐스팅 + null 가드 후 `state?.toast`가 있으면 Toast 1회 표시하고 `navigate('.', {replace:true, state:null})`로 소거.
- **DoD**:
  - 활성 `[13500/M, 10900/M, 29000/Y]` + 해지 1건(9,900원) → `data-testid="total-monthly"` 텍스트가 "26,817원".
  - `status==='loading'` 동안 `hero-skeleton` 1개 + 스켈레톤 행 3개가 있고 "아직 등록한 구독이 없어요"는 문서에 없음.
  - 0건 상태에서 `empty-state` 1개, `summary-hero`/`trend-sparkline`/`category-minibar` 각 0개.
  - 1건 이상일 때 `summary-hero`/`trend-sparkline`/`category-minibar` 각각 정확히 1개, 히어로 숫자 타이포는 t2 이상.
  - `firstBillingDate='not-a-date'` 항목 포함 렌더 시 크래시 0, `console.error` 0회, 해당 항목 금액이 총액에서 제외됨.
  - `state` 없이 `/` 직접 진입해도 크래시 없이 렌더된다.
- **Covers**: [F3-AC1, F3-AC2, F3-AC4, F3-AC5, F3-AC7, AC-S1-1]
- **Files**: `src/pages/HomePage.tsx`, `src/pages/HomePage.test.tsx`
- **Depends on**: Task 2.5, Task 3.1

### Task 3.3 대시보드 — D-day 카드 + 구독 목록
- **Description**: `HomePage`에 D-day 영역과 목록을 추가한다.
  - D-day: 히어로 바로 아래. 임박(ACTIVE & `0<=dday<=3`) 1건 이상이면 `data-testid="dday-card"` Card에 "{이름} D-{n} · {금액}원 결제 예정"(dday 0이면 "오늘 결제") + "해지 준비" 버튼. 임박 0건이면 `dday-card` 미렌더, 대신 `data-testid="dday-next"` 한 줄("다음 결제는 D-{n} {이름}"). 로딩 중엔 스켈레톤만.
  - 목록: `data-testid="subscription-list"`, 항목은 TDS `ListRow`(높이 ≥56px), 다음 결제일 오름차순 정렬, 우측에 `DdayBadge`, `hasPriceIncrease`면 `PriceUpBadge`. 해지 항목은 "해지함" 섹션에 분리 표시.
  - 50건 초과 시 윈도잉: 초기 렌더 `ListRow` ≤20개, 스크롤(또는 IntersectionObserver 센티넬) 시 20개씩 추가.
  - 탭 시 `navigate('/subscriptions/' + id)`(state 없음), "해지 준비" 탭 시 `navigate('/subscriptions/'+id+'/checklist', { state: { subscriptionId: id, from: 'dday' } })`.
- **DoD**:
  - 오늘 `'2026-09-04'`, 다음 결제일 `'2026-09-10'/'2026-09-05'/'2026-09-30'` → 렌더 순서가 05, 10, 30이고 배지 텍스트가 "D-1","D-6","D-26".
  - 다음 결제일 `'2026-09-06'` "넷플릭스"(13,500원) → `dday-card` 1개, 텍스트에 "넷플릭스 D-2 · 13,500원 결제 예정" 포함, 위치가 `summary-hero` 바로 다음 형제.
  - 모든 항목 `dday>3` → `dday-card` 0개, `dday-next` 1개.
  - `status='CANCELED'` D-1 항목은 `dday-card`에 포함되지 않음.
  - "해지 준비" 클릭 시 위 경로+state로 정확히 navigate 호출(mock 검증).
  - `nextBillingDate='2026-08-10'` 캐시 항목이 렌더 후 "D-6"으로 보이고 localStorage 값도 `'2026-09-10'`으로 갱신됨.
  - 60건 렌더 시 초기 DOM의 `ListRow` 개수 ≤20.
  - 임박 강조 색은 TDS 토큰만 사용(HEX 0건).
- **Covers**: [F3-AC3, F3-AC6, F3-AC8, F4-AC1, F4-AC2, F4-AC3, F4-AC4, F4-AC5, F4-AC6, F4-AC7, F4-AC8, F5-AC3]
- **Files**: `src/pages/HomePage.tsx`, `src/components/SubscriptionList.tsx`, `src/components/DdayCard.tsx`, `src/pages/HomePage.dday.test.tsx`
- **Depends on**: Task 3.2

### Task 3.4 구독 등록 화면 `/subscriptions/new`
- **Description**: `src/pages/NewSubscriptionPage.tsx` (`data-testid="screen-new"`). 템플릿 Chip 그룹 Card(12종 + "직접 입력") → 입력 폼(`TextField` 이름/금액/메모, `Tab` 월간·연간, `TextField[type=date]` 최초 결제일) → `data-testid="monthly-preview"` → `SubmitFooter` + `Button display="block"` "등록하기". 광고 없음.
  - 템플릿 선택 시 name/category/iconKey 자동 채움(금액은 비움), "직접 입력" 시 `iconKey='custom'`.
  - 금액 blur 시 `cycle==='YEARLY'`면 "월 {n}원 꼴" 즉시 표시.
  - 저장은 `saveSubscription` 결과 분기: `VALIDATION` → 필드별 인라인 에러("금액을 입력해주세요"/"이름은 20자까지 입력할 수 있어요"/"결제일을 선택해주세요"), `STORAGE_FULL` → AlertDialog "저장 공간이 부족해요" + 본문 "구독 항목을 삭제한 뒤 다시 시도해주세요"(입력값 유지), 성공 → `navigate('/', { replace:true, state:{ toast:'구독이 등록됐어요' } })`.
  - 동일 `name`+`amount`+`cycle` 존재 시 확인 AlertDialog 후 진행.
  - `location.state`는 `RouteState['/subscriptions/new']`로 캐스팅 + `?? null` 가드, `templateKey`가 있으면 프리셀렉트.
- **DoD**:
  - "넷플릭스" Chip 탭 후 `{13500, MONTHLY, '2026-09-10'}` 제출 → 저장값 `name='넷플릭스'`, `category='OTT'`, `iconKey='netflix'`, Toast "구독이 등록됐어요", `navigate('/',{replace:true,...})` 호출, 홈 목록에 "넷플릭스" 표시.
  - "직접 입력" + `{'헬스장 정기권', FITNESS, 59000, MONTHLY, '2026-09-25', memo:'3개월 약정'}` → `iconKey='custom'` 저장, 홈 총액에 59,000 합산.
  - `YEARLY` + `29000` 입력 blur → `monthly-preview` 텍스트 "월 2,417원 꼴".
  - `amount=0` 제출 → "금액을 입력해주세요" 표시, 저장 0건, navigate 호출 0회.
  - 21자 이름 제출 → "이름은 20자까지 입력할 수 있어요" 표시, 저장 0건.
  - `STORAGE_FULL` 모킹 시 AlertDialog 노출 + 이름/금액 입력값 유지.
  - 금액 input의 `inputMode==='numeric'`, `enterKeyHint==='done'`; 이름 `enterKeyHint==='next'`; 제출 버튼 렌더 높이 ≥48px, `display="block"`.
  - `state` 없이 직접 진입해도 크래시하지 않고 템플릿 미선택 상태로 렌더된다.
- **Covers**: [F2-AC1, F2-AC2, F2-AC3, F2-AC4, F2-AC5, F2-AC7, F2-AC8]
- **Files**: `src/pages/NewSubscriptionPage.tsx`, `src/components/SubscriptionForm.tsx`, `src/pages/NewSubscriptionPage.test.tsx`
- **Depends on**: Task 2.5, Task 1.2

### Task 3.5 구독 상세 화면 `/subscriptions/:id`
- **Description**: `src/pages/SubscriptionDetailPage.tsx` (`data-testid="screen-detail"`). `Top`(우측 "수정") → 요약 Card(금액 t2 강조 + 주기 `Chip` + 다음 결제일 + D-day, 인상 시 `PriceUpBadge`) → `data-testid="price-history-card"` Card → 버튼 "해지 체크리스트"(`display="block"`) / "삭제"(weak) / `status==='CANCELED'`면 "다시 사용 중으로".
  - 가격 이력 행 형식: "2026-09-04 · 13,500원 → 17,000원", 메모 있으면 하단 표시, 최신순. 0건이면 같은 자리에 `Asset.ContentIcon` + "가격 변동 기록이 없어요".
  - id는 **URL param이 1차 소스**. `useParams().id`로 조회해 없으면 "구독을 찾을 수 없어요" + "홈으로" 버튼(크래시/`console.error` 없음). `location.state`는 `RouteState['/subscriptions/:id']`로 캐스팅 + null 가드(toast 표시용).
  - navigate: 수정 → `('/subscriptions/'+id+'/edit', { state:{ subscriptionId:id } })`, 체크리스트 → `(..., { state:{ subscriptionId:id, from:'detail' } })`, 삭제 확정(AlertDialog) → `('/', { replace:true, state:{ toast:'삭제했어요' } })`.
- **DoD**:
  - `priceHistory` 2건 구독 → `price-history-card` 1개, 행 텍스트가 "YYYY-MM-DD · 13,500원 → 17,000원" 형식과 정확히 일치, 최신 항목이 첫 행.
  - `priceHistory=[]` → "가격 변동 기록이 없어요" + `Asset.ContentIcon` 표시, 행 0개.
  - 마지막 이력이 인상인 구독 → `price-up-badge` 1개 표시.
  - `status='CANCELED'` 상세에서 "다시 사용 중으로" 탭 → 저장값 `status='ACTIVE'` 및 `nextBillingDate`가 오늘 기준 재계산, 홈 총액에 재합산.
  - `/subscriptions/unknown_id` 진입 → "구독을 찾을 수 없어요" + "홈으로", `console.error` 0회.
  - `state` 없이 새로고침 진입해도 정상 렌더(URL param만으로 동작).
  - 수정/삭제/체크리스트 버튼 렌더 높이 ≥48px.
- **Covers**: [F5-AC3, F5-AC4, F5-AC7, F7-AC8]
- **Files**: `src/pages/SubscriptionDetailPage.tsx`, `src/pages/SubscriptionDetailPage.test.tsx`
- **Depends on**: Task 2.5, Task 3.1

### Task 3.6 구독 수정 화면 `/subscriptions/:id/edit`
- **Description**: `src/pages/EditSubscriptionPage.tsx` (`data-testid="screen-edit"`). Task 3.4의 `SubscriptionForm`을 재사용하고 초기값을 채운다. 추가 요소: 금액이 변경된 경우에만 노출되는 "가격 변경 메모" `TextField`(≤100자), "해지함으로 표시" `Switch`, `SubmitFooter` "저장하기"(`display="block"`).
  - 저장은 `updateSubscription(id, patch, note)` → `delta>0`이면 toast "{n}원 인상됐어요", `delta<0`이면 "{n}원 내렸어요", `delta===0`이면 "수정했어요". 성공 시 `navigate('/subscriptions/'+id, { replace:true, state:{ toast } })`.
  - `STORAGE_FULL` → AlertDialog "저장 공간이 부족해요"(입력값 유지). 메모 101자 → "메모는 100자까지 입력할 수 있어요" 인라인 에러, 저장 안 함.
  - id는 `useParams().id` 우선, `location.state`(`RouteState['/subscriptions/:id/edit']`, null 가드)의 `subscriptionId`는 보조.
- **DoD**:
  - `amount 13500 → 17000` 저장 → `priceHistory` 1건 추가, Toast "3,500원 인상됐어요", 상세로 replace 이동.
  - `17000 → 9900` → Toast "7,100원 내렸어요".
  - `13500 → 13500` → `priceHistory` 길이 불변, Toast "수정했어요", 메모 필드는 렌더되지 않음.
  - 메모 101자 입력 후 저장 → "메모는 100자까지 입력할 수 있어요" 표시, 저장 0건, navigate 0회.
  - `state`와 `id` 모두 없는 경로로 강제 진입 시 "구독을 찾을 수 없어요" + "홈으로"를 표시하고 크래시하지 않는다.
  - 금액 필드 `inputMode="numeric"`, 저장 버튼 높이 ≥48px.
- **Covers**: [F5-AC1, F5-AC2, F5-AC5, F5-AC6]
- **Files**: `src/pages/EditSubscriptionPage.tsx`, `src/pages/EditSubscriptionPage.test.tsx`
- **Depends on**: Task 3.4, Task 3.5

### Task 3.7 해지 체크리스트 화면 `/subscriptions/:id/checklist`
- **Description**: `src/pages/ChecklistPage.tsx` (`data-testid="screen-checklist"`). `Top`(구독 이름) → 진행률 Card(`data-testid="checklist-progress"`, t3 강조, "n/5") → 5개 `ListRow` + `Switch`(행 전체 탭 영역, 높이 ≥56px). 광고 없음, 링크·외부 이동 요소 없음.
  - 토글 → `toggleChecklistItem`. 실패(`STORAGE_FULL`) 시 Switch를 이전 상태로 롤백하고 Toast "저장하지 못했어요. 잠시 후 다시 시도해주세요".
  - 5개 모두 완료되는 순간 AlertDialog "해지 완료로 표시할까요?" / 버튼 "해지함으로 옮기기"·"나중에". 확정 시 `status='CANCELED'` 저장 후 `navigate('/', { replace:true, state:{ toast:'해지함으로 옮겼어요' } })`.
  - Loading: 스켈레톤 `ListRow` 5개 + 진행률 "-/5".
  - id 없음/불일치: "구독을 찾을 수 없어요" + `display="block"` "홈으로"(→ `navigate('/',{replace:true})`), 체크리스트 생성/저장 0건.
  - `location.state`는 `RouteState['/subscriptions/:id/checklist']`로 캐스팅 + `?? null`, `from` 은 표시 문구 힌트로만 사용하고 없어도 동작.
- **DoD**:
  - 저장 이력 없는 `sub_1`에서 `autopay` Switch on → localStorage에 items 5개 레코드 저장, `autopay.done=true`+`doneAt` ISO, 진행률 "1/5".
  - 3개 done 저장 상태로 재진입 → 해당 3개 Switch checked, 진행률 "3/5".
  - 4개 완료 상태에서 마지막 토글 → AlertDialog 노출 → "해지함으로 옮기기" 탭 시 `status='CANCELED'` 저장 + `navigate('/',{replace:true,state:{toast:'해지함으로 옮겼어요'}})` + Toast 표시.
  - 렌더 결과에 `<a href>` 0개, `window.open` 호출 0회, 항목 텍스트에 "설치"/"다운로드"/"바로가기" 매칭 0건.
  - `/subscriptions/unknown_id/checklist` 직접 진입(state 없음) → "구독을 찾을 수 없어요" + "홈으로", 저장 0건, `console.error` 0회.
  - 저장 실패 모킹 시 Switch가 off로 되돌아가고 지정 Toast 표시.
  - 로딩 중 스켈레톤 5개 + "-/5".
- **Covers**: [F7-AC1, F7-AC2, F7-AC3, F7-AC4, F7-AC5, F7-AC6, F7-AC7, G-1, G-2]
- **Files**: `src/pages/ChecklistPage.tsx`, `src/pages/ChecklistPage.test.tsx`
- **Depends on**: Task 2.4, Task 2.5

### Task 3.8 또래 비교 화면 `/compare`
- **Description**: `src/pages/ComparePage.tsx` (`data-testid="screen-compare"`). `Top`("또래 비교") → 연령대 영역 → 게이트/결과.
  - `ageBand==='UNSET'`: `data-testid="agefield-prompt"` + `Chip` 4개('20~24','25~29','30~34','35~39'). 선택 시 `saveSettings({ageBand})` 하고 "결과 보기" 활성화.
  - 활성 구독 0건: `Asset.ContentIcon` + "구독을 1개 이상 등록하면 비교할 수 있어요", "결과 보기" `disabled`, 광고 로드 없음, CTA "구독 등록하기" → `navigate('/subscriptions/new')`.
  - 게이트: `isCompareUnlocked()`가 false면 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>` 로 결과를 감싸고 "결과 보기" 버튼 표시. 시청 완료 시 `saveSettings({compareUnlockedAt:<ISO>})` 후 결과 노출. 실패/중도이탈 시 결과 미노출 + Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요" + 버튼 재활성화(`console.error` 금지). 로드 중 버튼 `loading` + 비활성.
  - 결과(`data-testid="compare-result"`): `data-testid="compare-card"` Card 2개 — ① `SummaryHero`(내 월 총액, CountUp) + `data-testid="compare-diff"`("평균보다 {n}원 적게/많이 써요", t2 강조) + `data-testid="compare-ratio"`("평균의 {n}%") + 상태 `Chip`, ② `MiniBar`(`category-minibar`). 하단에 `BENCHMARK_DISCLAIMER` 문구.
  - `location.state`는 항상 null 취급(탭 진입 전용) — 캐스팅 후 사용 금지.
- **DoD**:
  - `isPremium=false, compareUnlockedAt=null, ageBand='25-29'` → 초기엔 `compare-result` 0개; 광고 완료 콜백 후 `compare-result` 1개 + `compareUnlockedAt`에 ISO 저장.
  - `isPremium=true` 진입 → `TossRewardAd` 미렌더, "결과 보기" 버튼 0개, `compare-result` 즉시 1개.
  - 월 총액 26,817 / 벤치마크 34,000 → `compare-diff` 텍스트 "평균보다 7,183원 적게 써요", `compare-ratio` "평균의 79%".
  - 결과 상태에서 `compare-card` 정확히 2개, `compare-diff`/`compare-ratio`/`category-minibar` 각 1개, 차액 타이포 t2 이상, 디스클레이머 문구 1개.
  - `ageBand='UNSET'` → `agefield-prompt` 1개 + Chip 4개, 결과 0개; Chip 선택 후 설정 저장 확인.
  - 광고 실패 모킹 → `compare-result` 0개, 지정 Toast 1회, 버튼 `disabled=false`, `console.error` 0회.
  - 활성 구독 0건 → 버튼 `disabled`, 광고 컴포넌트 마운트 0회.
  - `compareUnlockedAt`이 25시간 전 + `isPremium=false` → 결과 숨김 + "결과 보기" 재노출.
  - `fetch`/`axios` 호출 0건.
- **Covers**: [F6-AC1, F6-AC2, F6-AC3, F6-AC4, F6-AC5, F6-AC6, F6-AC7, F6-AC8, AC-S6-1]
- **Files**: `src/pages/ComparePage.tsx`, `src/pages/ComparePage.test.tsx`
- **Depends on**: Task 2.5, Task 3.1

### Task 3.9 더보기 화면 `/more`
- **Description**: `src/pages/MorePage.tsx` (`data-testid="screen-more"`). `ListRow` 4행 — ① 연령대 설정(현재 값 표시 + `Chip` 4개로 변경), ② 프리미엄(→ `navigate('/premium', { state:{ from:'more' } })`, 이미 프리미엄이면 "이용 중" 표기), ③ 데이터 초기화(AlertDialog 확인 → `clearAll()`, 실패 시 Toast "초기화하지 못했어요", 성공 시 `navigate('/',{replace:true, state:{toast:'초기화했어요'}})`), ④ 이용 안내(A-5 문구 1줄: "데이터는 이 기기에만 저장되며 기기 간 동기화·백업은 제공하지 않아요"). 광고 슬롯 자리는 목록 하단에 마련(실제 배치는 Task 4.2).
- **DoD**:
  - `ListRow` 4행 렌더, 각 행 높이 ≥56px.
  - "프리미엄" 탭 시 정확한 경로+state로 navigate 호출.
  - 초기화 확정 시 SubTrack 키 4개가 삭제되고 무관한 localStorage 키는 유지됨.
  - 연령대 Chip 선택 시 `getSettings().ageBand`가 갱신되고 `/compare` 재진입 시 반영됨.
  - 이용 안내 문구에 외부 URL·"설치"/"다운로드" 문자열 0건.
  - `state` 없이 진입해도 크래시 없음.
- **Covers**: [F6-AC5]
- **Files**: `src/pages/MorePage.tsx`, `src/pages/MorePage.test.tsx`
- **Depends on**: Task 2.4, Task 2.5

### Task 3.10 프리미엄 화면 `/premium`
- **Description**: `src/pages/PremiumPage.tsx` (`data-testid="screen-premium"`). `Top`("프리미엄") → 혜택 Card(`ListRow` 3행: "구독 무제한 등록", "광고 제거", "비교 리포트 바로 보기") → `Paragraph.Text`(1회 결제 안내) → `SubmitFooter` + `<TossPurchase sku={import.meta.env.VITE_TOSS_IAP_SKU} processProductGrant={...} onPurchased={...} />`. 광고 미노출.
  - `processProductGrant`에서 `saveSettings({ isPremium:true, premiumGrantedAt:new Date().toISOString() })`.
  - `onPurchased` 성공 → Toast "프리미엄이 적용됐어요" + `navigate('/', { replace:true, state:{ toast:'프리미엄이 적용됐어요' } })`.
  - 실패/취소 → `isPremium` 변경 없음, Toast "결제가 완료되지 않았어요", 화면 유지, `console.error` 금지.
  - 결제 진행 중 버튼 `loading` + 중복 탭 차단.
  - `location.state`를 `RouteState['/premium']`로 캐스팅 + `?? null`; `from==='limit'`이면 상단 문구 "구독을 무제한으로 등록해보세요", 없으면 기본 문구.
- **DoD**:
  - 혜택 `ListRow` 정확히 3행, 문구가 위 3개와 정확히 일치.
  - 결제 성공 콜백 실행 시 `getSettings().isPremium===true`, `premiumGrantedAt`이 ISO, Toast + replace navigate 호출.
  - 실패 콜백 실행 시 `isPremium===false` 유지, 지정 Toast, navigate 0회, `console.error` 0회.
  - 화면 텍스트에서 "앱을 설치"/"다운로드"/"http" 매칭 0건, `AdSlot` 렌더 0개.
  - `state` 없이 `/premium` 직접 진입 시 기본 문구로 정상 렌더(크래시 없음).
  - 결제 버튼 렌더 높이 ≥48px, `SubmitFooter` 하단 고정.
- **Covers**: [F8-AC3, F8-AC4, F8-AC8]
- **Files**: `src/pages/PremiumPage.tsx`, `src/pages/PremiumPage.test.tsx`
- **Depends on**: Task 2.4

---

## Epic 4. 통합 · 폴리시 (라우팅 · 광고 · 게이팅 · 컴플라이언스)

**Risk Assessment**
- **Complexity**: Medium
- **Risk factors**: (1) 라우트 등록 누락/오타로 딥링크가 404 흰 화면. (2) 광고 컴포넌트를 fixed/overlay로 붙이면 F8-AC1 위반 + 콘텐츠 가림, 로드 후 높이 변동으로 레이아웃 시프트. (3) `VITE_TOSS_AD_GROUP_ID` 미주입 빌드에서 `AdSlot`이 에러를 던져 G-3 위반. (4) 무료 3개 제한을 화면마다 따로 계산하면 프리미엄 구매 직후에도 제한이 남는 불일치. (5) es2019 미지원 문법이 빌드에 섞여 Android 7에서 백지.
- **Mitigation**: 페이지들이 모두 완성된 뒤 라우팅(4.1) → 광고(4.2) → 게이팅(4.3) → 정적 감사(4.4) 순으로 얹어, 각 폴리시가 이미 동작하는 화면 위에서 단독 검증된다. 제한 판정은 4.3에서 단일 헬퍼로 통합해 화면 중복 구현을 제거하고, 4.4가 마지막에 전 소스를 grep으로 훑어 규정 위반을 잡는다.

### Task 4.1 라우팅 + 탭바 + state 안전 가드
- **Description**: `src/App.tsx`/`src/router.tsx`에 `BrowserRouter` 라우트 8개(`/`, `/subscriptions/new`, `/subscriptions/:id`, `/subscriptions/:id/edit`, `/subscriptions/:id/checklist`, `/compare`, `/more`, `/premium`) + 와일드카드 `*` → `<Navigate to="/" replace />` 를 등록한다. `FloatingTabBar` 3탭(홈/비교/더보기)을 `/`, `/compare`, `/more` 에서만 표시. `src/lib/useRouteState.ts` 헬퍼 추가: `useRouteState<K extends keyof RouteState>(key: K): RouteState[K]` — 내부에서 `useLocation().state ?? null` 반환(구조분해 금지, 항상 null 가능). 모든 페이지가 이 헬퍼를 쓰도록 교체.
- **DoD**:
  - 8개 경로 각각 직접 진입 시 해당 `data-testid="screen-*"` 루트가 렌더되고 크래시 0.
  - 8개 화면 모두 `ScreenScaffold` 루트 + `data-testid="screen-<id>"` 보유(테스트로 전수 확인).
  - `/unknown/path` 진입 → `/`로 replace 이동.
  - **state 없이** `/subscriptions/:id/edit`, `/subscriptions/:id/checklist`, `/premium`, `/compare` 에 각각 직접 진입/새로고침해도 크래시 없이 정상 화면 또는 "찾을 수 없어요" 폴백을 표시(4개 경로 개별 테스트).
  - `src/pages/` 전체에서 `useLocation().state` 를 구조분해하거나 즉시 프로퍼티 접근하는 코드 0건(grep: `state as .*\)\.`, `= useLocation().state`).
  - `/subscriptions/new` 등 상세 화면에서는 `FloatingTabBar`가 렌더되지 않음.
- **Covers**: [G-9]
- **Files**: `src/App.tsx`, `src/router.tsx`, `src/lib/useRouteState.ts`, `src/router.test.tsx`
- **Depends on**: Task 3.2 ~ Task 3.10

### Task 4.2 광고 배치 (배너 위치 · 프리미엄 제거 · 미주입 방어)
- **Description**: `src/components/SafeAdSlot.tsx` 를 만들어 `AdSlot`을 감싼다: `isPremium===true` 이거나 `import.meta.env.VITE_TOSS_AD_GROUP_ID` 가 falsy면 `null` 반환(에러 없음), 아니면 고정 높이 컨테이너(`position: static`, 높이 상수) 안에 `AdSlot` 렌더. 배치:
  - 홈 — 구독 목록 섹션 **하단** `data-testid="ad-banner-home"` 1개
  - 상세 — 가격 이력 카드 **아래** `data-testid="ad-banner-detail"`
  - 비교 — 결과 카드 **아래** `data-testid="ad-banner-compare"`
  - 더보기 — 목록 하단 `data-testid="ad-banner-more"`
  - 등록/수정/체크리스트/프리미엄 화면에는 배치 금지.
- **DoD**:
  - `isPremium=false` 홈 → `ad-banner-home` 정확히 1개, 계산된 `position === 'static'`, 목록 마지막 항목 이후 DOM 순서에 위치.
  - `isPremium=true` → `ad-banner-home`/`ad-banner-compare` 0개, `/compare`에서 `TossRewardAd` 게이트도 0개.
  - `VITE_TOSS_AD_GROUP_ID=undefined` 빌드 → `AdSlot` 렌더 0개, 레이아웃 깨짐 없음, `console.error` 0회.
  - 광고 로드 전/후 컨테이너 높이가 동일(고정 높이 placeholder) — 로드 콜백 전후 `getBoundingClientRect().height` 값이 같음.
  - `/subscriptions/new`, `/subscriptions/:id/edit`, `/subscriptions/:id/checklist`, `/premium` 에서 `AdSlot` 렌더 0개.
- **Covers**: [F8-AC1, F8-AC2, F8-AC5, F8-AC6]
- **Files**: `src/components/SafeAdSlot.tsx`, `src/pages/HomePage.tsx`, `src/pages/SubscriptionDetailPage.tsx`, `src/pages/ComparePage.tsx`, `src/pages/MorePage.tsx`, `src/components/SafeAdSlot.test.tsx`
- **Depends on**: Task 4.1

### Task 4.3 무료 3개 제한 게이트 · 프리미엄 권한 반영
- **Description**: `src/domain/entitlement.ts` 에 `canAddSubscription(items, settings): { allowed: boolean; reason?: 'FREE_LIMIT' }` 단일 판정 함수를 추가(무료: 활성 구독 < 3, 프리미엄: 무제한, 단 `MAX_SUBSCRIPTIONS` 하드 상한). 홈의 "구독 추가" 버튼과 비교/더보기의 진입점이 이 함수만 사용하도록 배선.
  - 차단 시 TDS `BottomSheet` — 제목 "무료 플랜은 3개까지예요", 버튼 "프리미엄 보기" → `navigate('/premium', { state:{ from:'limit' } })`. 이때 `/subscriptions/new` 로 이동하지 않음.
- **DoD**:
  - `isPremium=false` + 활성 3건에서 "구독 추가" 탭 → BottomSheet 노출(제목 정확히 일치), navigate 호출 0회; "프리미엄 보기" 탭 시 `('/premium',{state:{from:'limit'}})` 호출.
  - `isPremium=false` + 활성 2건 → BottomSheet 미노출, `/subscriptions/new` 이동.
  - `isPremium=false` + 활성 3건 + 해지 2건 → BottomSheet 노출(활성 기준, Q-4 가정 반영).
  - 결제 성공 후 같은 세션에서 활성 3건 상태로 "구독 추가" 탭 → 제한 없이 등록 화면 진입, 4번째 저장 성공.
  - `isPremium=true` 저장 상태로 앱 완전 리로드 → 홈에 광고 0개, `/subscriptions/new` 진입 시 제한 BottomSheet 0개.
  - 제한 로직이 `entitlement.ts` 외 파일에 중복 구현되지 않음(grep: `FREE_SUBSCRIPTION_LIMIT` 참조 파일 1개).
- **Covers**: [F2-AC6, F8-AC7]
- **Files**: `src/domain/entitlement.ts`, `src/pages/HomePage.tsx`, `src/domain/entitlement.test.ts`
- **Depends on**: Task 4.2

### Task 4.4 컴플라이언스 · 호환성 최종 감사
- **Description**: 정적 검사 스크립트(`scripts/audit.mjs`, npm script `npm run audit`)와 빌드 설정을 마무리한다.
  - `vite.config.ts` 의 `build.target = ['es2019','safari14']`.
  - 감사 항목: `src/` 내 `window.open`/`location.href` 0건, `fetch`/`XMLHttpRequest`/`axios` 0건, `#[0-9a-fA-F]{3,8}\b` 0건, `Array.prototype.at`/`Object.groupBy`/`findLast`/`structuredClone`/정규식 lookbehind 0건, 렌더 텍스트 내 "앱을 설치"/"다운로드"/"설치하기"/"스토어에서" 0건, `package.json`+`index.html` 에 `google-analytics|gtag|amplitude|mixpanel|sentry|firebase` 0건.
  - 터치 타깃 검사: 렌더 테스트에서 모든 `button`/`[role=button]`/`ListRow`/`Chip`/`Switch`/탭바 아이템의 계산된 높이·너비 ≥44px.
  - `vite build` → `vite preview` 에서 전체 플로우(등록→대시보드→상세→비교→프리미엄) 실행 중 `console.error` 호출 0회 검증.
- **DoD**:
  - `npm run audit` 종료코드 0이며 위 8개 검사 항목 전부 0건 보고.
  - `vite build` 성공 + 산출 번들에 es2020+ 문법(옵셔널 체이닝 제외 대상 문법·`??=`·`at()`) 미포함.
  - 8개 화면 전수 렌더 테스트에서 44px 미만 탭 타깃 0개.
  - 프로덕션 플로우 E2E 1회 실행 시 `console.error` 스파이 호출 횟수 0.
  - 감사 실패 시 CI가 아닌 로컬에서도 어떤 파일/라인이 위반인지 출력.
- **Covers**: [G-1, G-2, G-3, G-4, G-5, G-6, G-7, G-8]
- **Files**: `scripts/audit.mjs`, `vite.config.ts`, `package.json`, `src/__tests__/compliance.test.tsx`
- **Depends on**: Task 4.3

---

## AC Coverage

- **Total ACs in SPEC**: 75 (F1~F8 각 8개 = 64, 글로벌 G-1~G-9 = 9, 화면 레이아웃 AC-S1-1·AC-S6-1 = 2)
- **Covered by tasks**: 75

| AC | 커버 태스크 |
|---|---|
| F1-AC1, F1-AC2 | 2.1 |
| F1-AC3, F1-AC6, F1-AC8 | 2.3 |
| F1-AC4, F1-AC5 | 2.2 |
| F1-AC7 | 2.5 (+1.1) |
| F2-AC1 | 3.4 (+1.2) |
| F2-AC2, F2-AC3, F2-AC4, F2-AC5, F2-AC7, F2-AC8 | 3.4 |
| F2-AC6 | 4.3 |
| F3-AC1, F3-AC4, F3-AC5, F3-AC7 | 3.2 (F3-AC1 계산은 2.5) |
| F3-AC2 | 3.1, 3.2 |
| F3-AC3, F3-AC6, F3-AC8 | 3.3 |
| F4-AC1~F4-AC8 | 3.3 (AC-2는 2.1, AC-5는 2.3에서도 커버) |
| F5-AC1, F5-AC2, F5-AC5 | 2.3, 3.6 |
| F5-AC3 | 3.1, 3.3, 3.5 |
| F5-AC4, F5-AC7 | 3.5 |
| F5-AC6 | 3.6 |
| F5-AC8 | 2.3 |
| F6-AC1~F6-AC4, F6-AC6, F6-AC7 | 3.8 |
| F6-AC5 | 3.8, 3.9 |
| F6-AC8 | 2.4, 3.8 |
| F7-AC1, F7-AC2 | 2.4, 3.7 |
| F7-AC3, F7-AC5, F7-AC6, F7-AC7 | 3.7 |
| F7-AC4 | 1.2, 3.7 |
| F7-AC8 | 2.3, 3.5 |
| F8-AC1, F8-AC5, F8-AC6 | 4.2 |
| F8-AC2 | 2.5, 4.2 |
| F8-AC3 | 2.4, 3.10 |
| F8-AC4, F8-AC8 | 3.10 |
| F8-AC7 | 2.4, 4.3 |
| G-1, G-2 | 3.7, 4.4 |
| G-3, G-4, G-5, G-7, G-8 | 4.4 |
| G-6 | 3.1, 4.4 |
| G-9 | 4.1 |
| AC-S1-1 | 3.1, 3.2 |
| AC-S6-1 | 3.8 |

- **Uncovered**: 0

---

### 태스크 실행 순서 요약
`1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 3.7 → 3.8 → 3.9 → 3.10 → 4.1 → 4.2 → 4.3 → 4.4`
(총 21 태스크. 3.4~3.10은 2.5·3.1 완료 후 병렬 실행 가능하나, 3.6은 3.4·3.5 이후여야 폼 재사용이 성립한다.)
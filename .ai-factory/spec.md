# SPEC — SubTrack (앱인토스 미니앱)

> 기준 문서: PRD "SubTrack". 본 SPEC은 PRD에 명시된 사실만 확장한다. PRD에 없는 외부 사실(서비스별 실제 구독 가격, 실제 연령대별 평균 구독비 등)은 **발명하지 않고**, 사용자 입력값 또는 콘솔에서 주입하는 참고용 상수로 처리한다(→ Open Questions).

---

## Common Principles

### 기술 스택 / 아키텍처
- **Vite + React + TypeScript**, 라우팅은 **react-router-dom**(`BrowserRouter`), 데이터 영속화는 **localStorage** 전용. 서버 코드 없음, 외부 API 호출 없음.
- **UI는 100% TDS(@toss/tds-mobile)**: `ListRow`, `Button`, `TextField`, `Paragraph.Text`, `Chip`, `Switch`, `AlertDialog`, `BottomSheet`, `Toast`, `Top`, `Tab`, `Spacing`, `Asset.ContentIcon`. shadcn/ui·MUI·AntD·Chakra 사용 금지.
- **하단 탭 네비게이션은 템플릿 제공 `src/components/FloatingTabBar`** 사용(TDS에 TabBar 없음). `Tab`은 화면 내부 콘텐츠 전환 전용.
- **페이지 골격은 `ScreenScaffold`(템플릿 제공 PageShell)** 로 감싼다. raw `div` 골격 금지.
- **1차 액션은 `SubmitFooter`(하단 고정) 또는 `display="block"` Button**. 좌측 글자폭 버튼 금지.
- **여백은 TDS `Spacing`(size prop 필수)만 사용**. TDS 컴포넌트의 내장 padding/margin을 Tailwind/인라인 스타일로 덮어쓰지 않는다. 커스텀 CSS는 flex/grid 배치에만 허용.
- **색상은 `var(--tds-color-*)` 또는 TDS 컴포넌트 기본값만**. HEX 하드코딩 금지(다크모드 필수).
- 인증: 토스 앱이 세션을 자동 제공. 로그인 함수 호출 없음. 사용자 식별 필요 시 `getIsTossLoginIntegratedService()` 로 연동 상태만 확인.
- 광고: `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`(배너), `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>{children}</TossRewardAd>`(보상형 게이트).
- 결제: `<TossPurchase sku={import.meta.env.VITE_TOSS_IAP_SKU} processProductGrant={...} onPurchased={...} />`.
- `grantPromotionReward` 는 MVP 범위에서 **사용하지 않는다**(PRD에 프로모션 캠페인 없음).
- **생성형 AI 미사용**: 모든 분석/비교/추천은 결정적(deterministic) 규칙·산술 계산이다. 따라서 AI 고지 의무 대상이 아니며, "AI가 생성한 결과입니다" 라벨을 붙이지 않는다(→ Assumptions A-6).

### 도메인 공통 규칙
- 통화: KRW 정수(원). 소수점 없음. 표시는 `toLocaleString('ko-KR')` + "원".
- 날짜: 모두 `YYYY-MM-DD` 문자열. **KST(UTC+9) 기준 "오늘"** 을 `getToday()` 유틸 하나로만 계산.
- **월 환산 금액**: `cycle === 'YEARLY' ? Math.round(amount / 12) : amount`.
- **다음 결제일 계산**: `firstBillingDate`의 일(day)을 기준일로, 오늘(포함) 이후 최초 도래일. 대상 월에 해당 일이 없으면 그 달 마지막 날로 보정(예: 기준일 31, 2026-04 → `2026-04-30`).
- **D-day**: `dday = 다음 결제일 - 오늘(일 단위)`. `dday <= 3` 이면 "임박".
- 무료 사용자 활성 구독 등록 상한: **3개**. 프리미엄: 상한 없음(단, 저장 안정성 위해 하드 상한 **100개**).

### 글로벌 준수 AC (Cross-cutting — 모든 화면/패킷에 적용)

- **G-1 [W][P0]: Scenario: 외부 도메인 이탈 차단**
  Given 앱 내 임의 화면에서
  When 코드가 `window.location.href` 또는 `window.open` 으로 `https://` 외부 URL 이동을 시도할 때
  Then 해당 호출은 소스에 존재하지 않아야 한다(정적 검사: `grep -R "window.open\|location.href" src/` 결과 0건)
  And 외부 이동이 필요한 UI/버튼은 화면에 렌더링되지 않는다

- **G-2 [W][P0]: Scenario: 외부 앱 설치 유도 금지**
  Given 임의 화면의 렌더 결과 텍스트에서
  When "앱을 설치", "다운로드", "설치하기", "스토어에서" 문자열을 검색할 때
  Then 매칭 결과가 0건이다
  And 해지 체크리스트 항목은 링크 없이 안내 텍스트로만 표시된다

- **G-3 [U][P0]: 프로덕션 빌드(`vite build` → preview)에서 앱의 전체 플로우(등록→대시보드→상세→비교→프리미엄)를 실행했을 때 `console.error` 호출 횟수는 0이다.

- **G-4 [U][P0]: 외부 네트워크 요청이 0건이므로 CORS 에러가 0건이다. `fetch`/`XMLHttpRequest`/`axios` 사용은 `src/` 전체에서 0건이다(정적 검사).

- **G-5 [W][P0]: Scenario: 외부 분석 솔루션 금지**
  Given 의존성 목록(`package.json`)과 `index.html` 에서
  When `google-analytics`, `gtag`, `amplitude`, `mixpanel`, `sentry`, `firebase` 문자열을 검색할 때
  Then 매칭 결과가 0건이다

- **G-6 [U][P0]: Scenario: HEX 하드코딩 금지**
  Given `src/**/*.{ts,tsx,css}` 전체에서
  When 정규식 `#[0-9a-fA-F]{3,8}\b` 로 색상 리터럴을 검색할 때
  Then 매칭 결과가 0건이다
  And 모든 색상은 `var(--tds-color-*)` 또는 TDS 컴포넌트 기본 스타일에서 온다

- **G-7 [U][P1]: Android 7(Chrome 60 계열)·iOS 16 Safari 호환. `Array.prototype.at`, `Object.groupBy`, `Array.prototype.findLast`, `structuredClone`, 정규식 lookbehind 사용은 0건이며, `vite.config.ts` 의 `build.target` 은 `['es2019','safari14']` 이다.

- **G-8 [U][P0]: 모든 탭 가능한 요소(Button, ListRow, Chip, 체크박스, 탭바 아이템)의 렌더된 높이·너비는 **44px 이상**이다(계산된 스타일 검증).

- **G-9 [U][P1]: 모든 화면은 `ScreenScaffold` 를 루트로 사용하며, `data-testid="screen-<screenId>"` 속성을 갖는다.

---

## Data Models

### Subscription — 구독 항목
```ts
export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'CANCELED';
export type CategoryKey =
  | 'OTT' | 'MUSIC' | 'CLOUD' | 'GAME' | 'PRODUCTIVITY' | 'FITNESS' | 'ETC';

export interface PriceChange {
  id: string;            // uuid v4
  amount: number;        // 변경 후 금액(원), 정수 >= 0
  changedAt: string;     // 'YYYY-MM-DD'
  note: string;          // 최대 100자, 없으면 ''
}

export interface Subscription {
  id: string;                    // uuid v4
  name: string;                  // 1~20자, trim 후 빈 문자열 불가
  category: CategoryKey;
  iconKey: string;               // 템플릿 아이콘 키, 직접입력 시 'custom'
  amount: number;                // 현재 결제 금액(원), 정수, 1 <= amount <= 10_000_000
  cycle: BillingCycle;
  firstBillingDate: string;      // 'YYYY-MM-DD'
  nextBillingDate: string;       // 파생값, 저장 시점에 계산해 캐시
  memo: string;                  // 최대 100자, 없으면 ''
  status: SubscriptionStatus;    // 기본 'ACTIVE'
  priceHistory: PriceChange[];   // 최대 20건(초과 시 오래된 항목부터 제거)
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}
```
제약:
- `name` 중복 허용(사용자가 계정별로 여러 개 등록 가능), 단 동일 `name`+`amount`+`cycle` 조합 등록 시 확인 다이얼로그 표시.
- `status='CANCELED'` 항목은 총액 계산에서 제외되고 대시보드 "해지함" 섹션에 표시.

### CancelChecklist — 해지 체크리스트
```ts
export interface ChecklistItem {
  id: string;        // 고정 키: 'remaining' | 'autopay' | 'backup' | 'notify' | 'capture'
  label: string;
  done: boolean;
  doneAt: string | null;  // ISO 8601 | null
}

export interface CancelChecklist {
  subscriptionId: string;
  items: ChecklistItem[];   // 항상 5개 (DEFAULT_CHECKLIST 기준)
  updatedAt: string;        // ISO 8601
}
```

### AppSettings — 사용자 설정/엔타이틀먼트
```ts
export type AgeBand = '20-24' | '25-29' | '30-34' | '35-39' | 'UNSET';

export interface AppSettings {
  ageBand: AgeBand;              // 기본 'UNSET'
  isPremium: boolean;            // 기본 false
  premiumGrantedAt: string | null;
  compareUnlockedAt: string | null; // 리워드 광고 시청 완료 시각(ISO). 24h 유효
  onboardedAt: string | null;
}
```

### StorageMeta — 스키마 버전
```ts
export interface StorageMeta { schemaVersion: 1; migratedAt: string; }
```

### 정적 상수(코드 내 하드코딩, 사용자 데이터 아님)
```ts
// 이름/카테고리/아이콘만 제공. 금액은 제공하지 않는다(사실 주장 회피).
export interface ServiceTemplate { key: string; name: string; category: CategoryKey; iconKey: string; }
export const SERVICE_TEMPLATES: ServiceTemplate[]; // 12개 고정

// 참고용 벤치마크. 값은 env로 주입 가능하며 화면에 "참고용 추정치" 라벨 필수.
export type BenchmarkTable = Record<Exclude<AgeBand,'UNSET'>, number>;
export const DEFAULT_BENCHMARK: BenchmarkTable; // env VITE_BENCHMARK_JSON 로 덮어쓰기 가능
```

### localStorage 키 · 데이터 형태 · 용량

| 키 | 값 형태 | 예상 크기 |
|---|---|---|
| `subtrack.subscriptions.v1` | `Subscription[]` (JSON) | 1건 ≈ 420B(가격이력 0) ~ 900B(이력 5건). 100건 최대 ≈ **90KB** |
| `subtrack.checklists.v1` | `CancelChecklist[]` (JSON) | 1건 ≈ 380B. 100건 ≈ **38KB** |
| `subtrack.settings.v1` | `AppSettings` (JSON) | ≈ **180B** |
| `subtrack.meta.v1` | `StorageMeta` (JSON) | ≈ **60B** |

**총계 상한 ≈ 128KB (< 5MB, 여유 97%)**. 저장 전 `JSON.stringify` 길이가 **1MB(1,048,576자)** 를 넘으면 쓰기를 거부하고 에러를 반환한다.

---

## Feature List

---

### F1. 구독 데이터 레이어 (스토리지 · 계산 유틸)

- **Description**: `Subscription`/`CancelChecklist`/`AppSettings` 를 localStorage에 읽고 쓰는 저장소 모듈과, 월 환산 금액·다음 결제일·D-day를 계산하는 순수 함수 모듈을 제공한다. 모든 화면은 이 레이어만 통해 데이터에 접근하며 localStorage에 직접 접근하지 않는다. 파싱 실패·용량 초과 같은 저장 실패를 상위 UI가 처리할 수 있도록 `{ ok: true, data } | { ok: false, error }` 결과 타입을 반환한다.
- **Data**: `Subscription`, `CancelChecklist`, `AppSettings`, `StorageMeta`
- **API**: 없음(외부 호출 없음). 내부 모듈 시그니처:
  `listSubscriptions(): Subscription[]` / `saveSubscription(input): Result<Subscription>` / `deleteSubscription(id): Result<void>` / `getSettings(): AppSettings` / `saveSettings(patch): Result<AppSettings>` / `monthlyAmount(sub): number` / `computeNextBillingDate(firstBillingDate, cycle, today): string` / `daysUntil(date, today): number`
- **Requirements**: 모듈은 화면 코드와 분리된 `src/domain/` 에 위치하고, 100% 단위 테스트 가능해야 한다.

- **AC-1 [U][P0]: Scenario: 월 환산 금액 계산**
  Given 구독 `{ amount: 29000, cycle: 'YEARLY' }` 와 `{ amount: 13500, cycle: 'MONTHLY' }` 가 있을 때
  When `monthlyAmount()` 를 각각 호출하면
  Then 결과는 `2417`(= Math.round(29000/12)) 과 `13500` 이다

- **AC-2 [U][P0]: Scenario: 다음 결제일 월말 보정**
  Given `firstBillingDate = '2026-01-31'`, `cycle='MONTHLY'`, 오늘 `'2026-04-01'` 일 때
  When `computeNextBillingDate()` 를 호출하면
  Then 결과는 `'2026-04-30'` 이다
  And 오늘이 `'2026-04-30'` 이면 결과는 `'2026-04-30'`(당일 포함)이다

- **AC-3 [E][P0]: Scenario: 구독 저장 및 재조회**
  Given localStorage가 비어 있을 때
  When `saveSubscription({ name:'넷플릭스', category:'OTT', amount:13500, cycle:'MONTHLY', firstBillingDate:'2026-09-10' })` 를 호출하면
  Then `subtrack.subscriptions.v1` 에 길이 1인 배열이 저장되고 `id`, `createdAt`, `updatedAt`, `nextBillingDate='2026-09-10'`, `status='ACTIVE'`, `priceHistory=[]` 가 채워진다
  And `listSubscriptions()` 가 해당 항목 1건을 반환한다

- **AC-4 [W][P1]: Scenario: 손상된 JSON 복구**
  Given `subtrack.subscriptions.v1` 값이 `'{{broken'` 일 때
  When `listSubscriptions()` 를 호출하면
  Then 예외를 던지지 않고 `[]` 를 반환한다
  And 손상된 값을 `subtrack.subscriptions.v1.corrupt` 로 이동시키고 `console.error` 대신 `console.warn` 을 사용한다

- **AC-5 [W][P1]: Scenario: 저장 용량 초과 거부**
  Given `localStorage.setItem` 이 `QuotaExceededError` 를 던지도록 모킹된 상태에서
  When `saveSubscription(...)` 를 호출하면
  Then 반환값은 `{ ok: false, error: 'STORAGE_FULL' }` 이고 기존 데이터는 변경되지 않는다

- **AC-6 [W][P1]: Scenario: 잘못된 입력 거부**
  Given 입력 `{ name: '   ', amount: 0, cycle:'MONTHLY', firstBillingDate:'2026-13-01' }` 일 때
  When `saveSubscription()` 를 호출하면
  Then 반환값은 `{ ok:false, error:'VALIDATION', fields:['name','amount','firstBillingDate'] }` 이고 저장은 일어나지 않는다

- **AC-7 [S][P1]: Scenario: 초기 로딩 상태**
  While 앱 부팅 후 스토리지 첫 읽기가 완료되기 전 상태일 때
  Then `useSubscriptions()` 훅은 `{ status:'loading', items: [] }` 을 반환하고
  And 읽기 완료 후 `{ status:'ready', items: Subscription[] }` 로 전이한다(빈 데이터일 때 `items` 는 `[]`, `status` 는 `'ready'`)

- **AC-8 [U][P0]: Scenario: 하드 상한 100개**
  Given 활성 구독이 100건 저장되어 있고 `isPremium=true` 일 때
  When 101번째 `saveSubscription()` 을 호출하면
  Then 반환값은 `{ ok:false, error:'MAX_ITEMS' }` 이다

---

### F2. 구독 등록 (템플릿 선택 + 직접 입력)

- **Description**: 사용자가 대표 서비스 템플릿(이름·카테고리·아이콘 프리셋 12종)을 골라 빠르게 등록하거나, 직접 입력으로 임의의 구독을 등록한다. 금액·결제주기·최초 결제일은 항상 사용자가 직접 입력하며(프리셋은 금액을 제공하지 않음), 저장 시 다음 결제일이 자동 계산된다. 무료 사용자는 활성 구독 3개까지만 등록할 수 있다.
- **Data**: `Subscription`, `AppSettings`, `SERVICE_TEMPLATES`
- **API**: 없음
- **Requirements**: 모바일 키보드 대응(숫자 키패드, 완료 시 blur, 포커스 필드가 키보드에 가려지지 않도록 스크롤 보정).

- **AC-1 [E][P0]: Scenario: 템플릿 선택 후 등록 성공**
  Given `/subscriptions/new` 에서 무료 사용자(활성 0건)일 때
  When 템플릿 Chip "넷플릭스"를 탭하고 `{ amount: 13500, cycle:'MONTHLY', firstBillingDate:'2026-09-10' }` 를 입력해 "등록하기"를 탭하면
  Then `name='넷플릭스'`, `category='OTT'`, `iconKey='netflix'` 로 저장되고 Toast "구독이 등록됐어요"가 표시된다
  And `navigate('/', { replace: true })` 로 대시보드로 이동하고 목록에 "넷플릭스"가 나타난다

- **AC-2 [E][P0]: Scenario: 직접 입력 등록**
  Given `/subscriptions/new` 에서 "직접 입력" Chip을 선택했을 때
  When `{ name:'헬스장 정기권', category:'FITNESS', amount:59000, cycle:'MONTHLY', firstBillingDate:'2026-09-25', memo:'3개월 약정' }` 을 제출하면
  Then `iconKey='custom'` 으로 저장되고 대시보드 월 총액에 59,000원이 합산된다

- **AC-3 [E][P0]: Scenario: 연 결제 등록 시 월 환산 표기**
  Given 등록 폼에서 `cycle='YEARLY'`, `amount=29000` 을 입력했을 때
  When 금액 입력이 끝나면(blur)
  Then 폼 하단에 `data-testid="monthly-preview"` 로 "월 2,417원 꼴" 텍스트가 즉시 표시된다

- **AC-4 [W][P1]: Scenario: 금액 미입력 거부**
  Given 등록 폼에서 `{ name:'스포티파이', amount: 0, firstBillingDate:'2026-09-10' }` 일 때
  When "등록하기"를 탭하면
  Then 금액 TextField 하단에 에러 메시지 "금액을 입력해주세요"가 표시되고 저장은 일어나지 않으며 화면 이동이 없다

- **AC-5 [W][P1]: Scenario: 이름 길이 초과 거부**
  Given 이름 TextField에 21자 문자열 `'가나다라마바사아자차카타파하가나다라마바사'` 를 입력했을 때
  When "등록하기"를 탭하면
  Then 에러 메시지 "이름은 20자까지 입력할 수 있어요"가 표시되고 저장되지 않는다

- **AC-6 [S][P0]: Scenario: 무료 3개 제한**
  While `isPremium=false` 이고 활성 구독이 3건인 상태에서
  When 대시보드의 "구독 추가" 버튼을 탭하면
  Then TDS `BottomSheet` 가 열려 제목 "무료 플랜은 3개까지예요"와 버튼 "프리미엄 보기"가 표시되고 `/subscriptions/new` 로 이동하지 않는다
  And "프리미엄 보기" 탭 시 `navigate('/premium')` 한다

- **AC-7 [W][P1]: Scenario: 저장 실패 안내**
  Given 스토리지 저장이 `{ ok:false, error:'STORAGE_FULL' }` 을 반환하는 상태에서
  When "등록하기"를 탭하면
  Then AlertDialog 제목 "저장 공간이 부족해요", 본문 "구독 항목을 삭제한 뒤 다시 시도해주세요"가 표시되고 폼 입력값은 유지된다

- **AC-8 [U][P1]: Scenario: 모바일 키보드 대응**
  Given 등록 폼이 열려 있을 때
  When 금액 TextField를 탭하면
  Then 해당 input의 `inputMode="numeric"`, `enterKeyHint="done"` 이며
  And 제출 버튼은 `SubmitFooter` 안에서 `display="block"` 으로 렌더되고 높이가 48px 이상이다

---

### F3. 월 총 구독비 대시보드

- **Description**: 홈 화면에서 이번 달 총 구독비(월 환산 합계)를 히어로 숫자로 보여주고, 카테고리별 비중과 최근 6개월 추이를 시각화한다. 그 아래에 결제일 임박순으로 정렬된 구독 목록을 제공하며, 항목 탭 시 상세로 이동한다. 데이터가 없을 때는 빈 상태 일러스트와 등록 유도 CTA를 표시한다.
- **Data**: `Subscription[]`, `AppSettings`
- **API**: 없음
- **Requirements**: 목록 항목 50개 초과 시 윈도잉(가상 스크롤) 적용.

- **AC-1 [U][P0]: Scenario: 월 총액 합산**
  Given 활성 구독이 `[{13500,MONTHLY},{10900,MONTHLY},{29000,YEARLY}]` 이고 `status='CANCELED'` 항목 1건(9,900원)이 있을 때
  When 대시보드를 렌더하면
  Then `data-testid="total-monthly"` 요소가 "26,817원"을 표시한다(해지 항목 제외)

- **AC-2 [U][P0]: Scenario: 히어로/카드 레이아웃 계약**
  Given 활성 구독이 1건 이상일 때
  Then 대시보드는 `data-testid="summary-hero"` 인 `SummaryHero`(value=월 총액, CountUp 애니메이션)를 최상단에 렌더하고
  And `data-testid="trend-sparkline"` Sparkline(최근 6개월 월 총액 6개 포인트)과 `data-testid="category-minibar"` MiniBar(카테고리별 비중, 최대 5개 + '기타')를 각각 Card로 감싸 표시한다
  And 목록 영역은 `data-testid="subscription-list"` 이며 항목은 TDS `ListRow` 로 렌더된다

- **AC-3 [U][P0]: Scenario: 결제일 임박순 정렬**
  Given 오늘이 `'2026-09-04'` 이고 다음 결제일이 각각 `'2026-09-10'`, `'2026-09-05'`, `'2026-09-30'` 인 3건이 있을 때
  When 대시보드 목록을 렌더하면
  Then 순서는 `'2026-09-05'`, `'2026-09-10'`, `'2026-09-30'` 이고 각 `ListRow` 우측에 "D-1", "D-6", "D-26" 이 표시된다

- **AC-4 [S][P1]: Scenario: 빈 상태**
  While 활성/해지 구독이 모두 0건인 상태일 때
  Then `data-testid="empty-state"` 영역에 TDS `Asset.ContentIcon` + 문구 "아직 등록한 구독이 없어요"가 표시되고
  And `SummaryHero`, Sparkline, MiniBar는 렌더되지 않으며 `display="block"` 버튼 "첫 구독 등록하기"가 표시된다

- **AC-5 [S][P1]: Scenario: 로딩 상태**
  While `useSubscriptions()` 의 `status === 'loading'` 인 동안
  Then 히어로 자리에 `data-testid="hero-skeleton"` 스켈레톤이 표시되고 목록 자리에 스켈레톤 `ListRow` 3개가 표시되며 "등록한 구독이 없어요" 문구는 표시되지 않는다

- **AC-6 [E][P0]: Scenario: 항목 탭 → 상세 이동**
  Given 대시보드 목록에 `id='sub_1'` 항목이 있을 때
  When 해당 `ListRow` 를 탭하면
  Then `navigate('/subscriptions/sub_1')` 가 호출된다

- **AC-7 [W][P1]: Scenario: 계산 불가 데이터 방어**
  Given 저장된 항목 중 `firstBillingDate` 가 `'not-a-date'` 인 손상 항목이 1건 섞여 있을 때
  When 대시보드를 렌더하면
  Then 앱이 크래시하지 않고 해당 항목은 D-day 자리에 "날짜 확인 필요"를 표시하며 총액 합산에서 제외된다
  And `console.error` 는 호출되지 않는다

- **AC-8 [O][P2]: Scenario: 긴 목록 가상 스크롤**
  Where 활성+해지 구독 합계가 50건을 초과하는 경우
  Then 목록은 윈도잉으로 렌더되어 초기 DOM 내 `ListRow` 개수가 20개 이하이고, 스크롤 시 추가 항목이 렌더된다

---

### F4. 갱신일 D-day 리마인더 (앱 내)

- **Description**: 결제일이 임박한 구독(D-3 이내)을 대시보드 최상단 알림 카드와 목록 배지로 강조해 해지 타이밍을 놓치지 않게 한다. 푸시 알림은 사용하지 않으며(MVP 제외), 앱 재방문 시점의 인앱 표시로만 동작한다. 사용자는 임박 카드에서 바로 해지 체크리스트로 진입할 수 있다.
- **Data**: `Subscription[]`
- **API**: 없음
- **Requirements**: D-day 계산은 F1의 `daysUntil()` 만 사용(중복 구현 금지).

- **AC-1 [E][P0]: Scenario: 임박 카드 노출**
  Given 오늘이 `'2026-09-04'` 이고 다음 결제일 `'2026-09-06'` 인 "넷플릭스"(13,500원)가 있을 때
  When 대시보드에 진입하면
  Then `data-testid="dday-card"` Card가 히어로 바로 아래에 표시되고 텍스트 "넷플릭스 D-2 · 13,500원 결제 예정"을 포함한다

- **AC-2 [U][P0]: Scenario: 당일 결제 표기**
  Given 다음 결제일이 오늘과 같은 구독이 있을 때
  Then 배지 텍스트는 "D-0"이 아니라 "오늘 결제"로 표시된다

- **AC-3 [S][P1]: Scenario: 임박 항목 없음**
  While 모든 활성 구독의 `dday > 3` 인 상태일 때
  Then `data-testid="dday-card"` 는 렌더되지 않고, 대신 `data-testid="dday-next"` 에 "다음 결제는 D-{n} {이름}" 한 줄이 표시된다

- **AC-4 [E][P0]: Scenario: 임박 카드에서 체크리스트 진입**
  Given `data-testid="dday-card"` 에 `id='sub_1'` 구독이 표시될 때
  When 카드의 "해지 준비" 버튼을 탭하면
  Then `navigate('/subscriptions/sub_1/checklist', { state: { subscriptionId: 'sub_1', from: 'dday' } })` 가 호출된다

- **AC-5 [W][P1]: Scenario: 과거 결제일 자동 이월**
  Given `nextBillingDate='2026-08-10'` 로 캐시된 항목이 있고 오늘이 `'2026-09-04'` 일 때
  When 대시보드를 렌더하면
  Then 화면에는 재계산된 `'2026-09-10'` 기준 "D-6"이 표시되고 저장된 `nextBillingDate` 도 `'2026-09-10'` 으로 갱신된다

- **AC-6 [W][P1]: Scenario: 해지 항목 제외**
  Given `status='CANCELED'` 이고 다음 결제일이 D-1인 항목이 있을 때
  Then 해당 항목은 `data-testid="dday-card"` 에 표시되지 않는다

- **AC-7 [S][P1]: Scenario: 로딩 중 오탐 방지**
  While 스토리지 로딩 중(`status='loading'`)일 때
  Then D-day 카드/문구 영역은 스켈레톤만 표시하며 "임박한 결제가 없어요" 문구를 표시하지 않는다

- **AC-8 [U][P2]: 임박 카드의 강조 표기는 TDS 색상 토큰(`var(--tds-color-red-500)` 등)만 사용하고, 다크모드에서도 대비가 유지된다(HEX 리터럴 0건).

---

### F5. 구독료 인상 감지 · 가격 이력 메모

- **Description**: 구독 상세에서 금액을 수정하면 이전 금액과 비교해 인상/인하를 자동 감지하고 `priceHistory` 에 변경 기록과 메모를 남긴다. 인상된 구독은 상세와 대시보드 목록에서 "인상" 배지로 표시되어 재검토 대상을 눈에 띄게 한다. 이력은 최대 20건까지 보관한다.
- **Data**: `Subscription.priceHistory`, `PriceChange`
- **API**: 없음
- **Requirements**: 인상 감지는 금액 저장 트랜잭션 안에서 수행(별도 배치 없음).

- **AC-1 [E][P0]: Scenario: 인상 감지 및 이력 기록**
  Given `id='sub_1'` 구독의 `amount=13500`, `priceHistory=[]` 일 때
  When 수정 화면에서 `amount=17000` 으로 저장하면
  Then `priceHistory` 에 `{ amount: 17000, changedAt: '<오늘>', note: '' }` 1건이 추가되고 `amount=17000` 으로 갱신되며 Toast "3,500원 인상됐어요"가 표시된다

- **AC-2 [E][P0]: Scenario: 인하 기록**
  Given `amount=17000` 인 구독을 `amount=9900` 으로 저장할 때
  Then `priceHistory` 에 1건이 추가되고 Toast 문구는 "7,100원 내렸어요" 이다

- **AC-3 [U][P0]: Scenario: 인상 배지 표시**
  Given 구독의 `priceHistory` 마지막 항목이 직전 금액보다 큰 값일 때
  Then 대시보드 `ListRow` 와 상세 화면에 `data-testid="price-up-badge"` TDS `Chip`("인상")이 표시된다

- **AC-4 [U][P0]: Scenario: 상세 가격 이력 카드**
  Given `priceHistory` 가 2건 이상인 구독 상세를 열었을 때
  Then `data-testid="price-history-card"` Card 안에 변경 건이 최신순 `ListRow` 로 표시되고, 각 행은 "2026-09-04 · 13,500원 → 17,000원" 형식이며 메모가 있으면 하단에 표시된다

- **AC-5 [W][P1]: Scenario: 동일 금액 저장 시 이력 미생성**
  Given `amount=13500` 인 구독을 `amount=13500` 그대로 저장할 때
  Then `priceHistory` 길이는 변하지 않고 Toast 문구는 "수정했어요" 이다

- **AC-6 [W][P1]: Scenario: 메모 길이 초과 거부**
  Given 가격 변경 메모에 101자를 입력했을 때
  When 저장을 탭하면
  Then 에러 메시지 "메모는 100자까지 입력할 수 있어요"가 표시되고 저장되지 않는다

- **AC-7 [S][P1]: Scenario: 이력 없음 상태**
  While `priceHistory.length === 0` 인 구독 상세를 볼 때
  Then `data-testid="price-history-card"` 자리에 "가격 변동 기록이 없어요" 문구와 `Asset.ContentIcon` 이 표시된다

- **AC-8 [U][P1]: Scenario: 이력 상한 20건**
  Given `priceHistory` 가 20건인 구독에서
  When 새 금액 변경을 저장하면
  Then `priceHistory.length === 20` 이 유지되고 가장 오래된 항목이 제거된다

---

### F6. 또래 평균 구독비 비교 리포트 (리워드 광고 게이팅)

- **Description**: 사용자가 선택한 연령대의 참고용 평균 구독비와 내 월 총 구독비를 비교해 차액·비율·카테고리별 차이를 보여준다. 무료 사용자는 결과를 보기 전 `TossRewardAd` 로 보상형 광고를 시청해야 하며, 프리미엄 사용자는 광고 없이 즉시 열람한다. 평균값은 외부 API가 아닌 앱 내장 참고 상수이며 화면에 "참고용 추정치"임을 명시한다.
- **Data**: `Subscription[]`, `AppSettings.ageBand`, `AppSettings.compareUnlockedAt`, `DEFAULT_BENCHMARK`
- **API**: 없음(네트워크 호출 없음)
- **Requirements**: 결과는 결정적 산술 계산이며 생성형 AI를 사용하지 않는다.

- **AC-1 [E][P0]: Scenario: 무료 사용자 리워드 광고 게이트**
  Given `isPremium=false`, `compareUnlockedAt=null`, `ageBand='25-29'` 일 때
  When `/compare` 에서 "결과 보기" 버튼을 탭하고 `TossRewardAd` 광고 시청이 완료되면
  Then `data-testid="compare-result"` 결과 영역이 표시되고 `compareUnlockedAt` 에 현재 ISO 시각이 저장된다

- **AC-2 [S][P0]: Scenario: 프리미엄은 광고 없이 열람**
  While `isPremium=true` 인 상태로 `/compare` 에 진입하면
  Then `TossRewardAd` 게이트 없이 즉시 `data-testid="compare-result"` 가 렌더되고 "결과 보기" 버튼은 렌더되지 않는다

- **AC-3 [U][P0]: Scenario: 비교 수치 계산**
  Given 내 월 총 구독비가 `26817`원이고 `ageBand='25-29'`, `DEFAULT_BENCHMARK['25-29'] = 34000` 일 때
  When 결과가 표시되면
  Then `data-testid="compare-diff"` 는 "평균보다 7,183원 적게 써요", `data-testid="compare-ratio"` 는 "평균의 79%"(= Math.round(26817/34000*100))를 표시한다

- **AC-4 [U][P0]: Scenario: 결과 레이아웃 계약**
  Given 비교 결과가 표시될 때
  Then 결과 영역은 `data-testid="compare-card"` Card 2개(① 내 지출 vs 평균, ② 카테고리별 비교)로 구성되고
  And ①은 `SummaryHero`(내 월 총액, CountUp)와 강조 타이포(t2)로 차액을 표시하며, ②는 `MiniBar` 로 카테고리별 내 지출 비중을 표시한다
  And 카드 하단에 "참고용 추정치입니다 · 실제 평균과 다를 수 있어요" 문구가 표시된다

- **AC-5 [W][P1]: Scenario: 연령대 미설정**
  Given `ageBand='UNSET'` 인 상태로 `/compare` 에 진입할 때
  Then 결과 대신 `data-testid="agefield-prompt"` 영역에 "연령대를 선택하면 비교할 수 있어요"와 TDS `Chip` 4개('20~24','25~29','30~34','35~39')가 표시되고
  And Chip 선택 시 `ageBand` 가 저장되며 "결과 보기" 버튼이 활성화된다

- **AC-6 [W][P1]: Scenario: 광고 로드/시청 실패**
  Given 광고 로드가 실패하거나 사용자가 광고를 중도 종료했을 때
  Then `data-testid="compare-result"` 는 표시되지 않고 Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"가 표시되며 "결과 보기" 버튼이 다시 활성화된다
  And `console.error` 는 호출되지 않는다

- **AC-7 [S][P1]: Scenario: 비교할 데이터 없음**
  While 활성 구독이 0건인 상태로 `/compare` 에 진입하면
  Then `Asset.ContentIcon` 과 "구독을 1개 이상 등록하면 비교할 수 있어요"가 표시되고 "결과 보기" 버튼은 `disabled` 이며 광고는 로드되지 않는다

- **AC-8 [U][P1]: Scenario: 해제 유효기간 24시간**
  Given `compareUnlockedAt` 이 현재보다 25시간 이전 값일 때
  When `/compare` 에 진입하면
  Then 결과는 숨겨지고 "결과 보기"(리워드 광고 게이트)가 다시 표시된다

---

### F7. 해지 체크리스트

- **Description**: 구독 해지를 실제로 완료하기 위한 5단계 체크리스트를 구독별로 제공하고 진행률을 저장한다. 항목은 외부 링크·앱 설치 유도 없이 안내 텍스트로만 구성한다. 전 항목 완료 시 해당 구독을 "해지함" 상태로 전환할지 확인 다이얼로그를 띄운다.
- **Data**: `CancelChecklist`, `Subscription.status`
- **API**: 없음
- **Requirements**: 기본 항목 `DEFAULT_CHECKLIST` 는 5개 고정 — `remaining`("남은 이용 기간 확인하기"), `autopay`("자동결제 해지하기"), `backup`("저장한 데이터·콘텐츠 백업하기"), `notify`("함께 쓰는 사람에게 알리기"), `capture`("해지 완료 화면 캡처해두기").

- **AC-1 [E][P0]: Scenario: 체크 항목 저장**
  Given `/subscriptions/sub_1/checklist` 를 처음 열었을 때(저장된 체크리스트 없음)
  When `autopay` 항목의 TDS `Switch` 를 켜면
  Then `subtrack.checklists.v1` 에 `{ subscriptionId:'sub_1', items:[...5개] }` 가 저장되고 `autopay.done=true`, `doneAt` 이 ISO 시각으로 채워진다
  And 상단 진행률 `data-testid="checklist-progress"` 가 "1/5"로 갱신된다

- **AC-2 [U][P0]: Scenario: 진행 상태 복원**
  Given `sub_1` 의 체크리스트에 3개 항목이 `done=true` 로 저장돼 있을 때
  When 화면을 다시 열면
  Then 해당 3개 `Switch` 가 켜진 상태로 렌더되고 진행률은 "3/5" 이다

- **AC-3 [E][P0]: Scenario: 전 항목 완료 시 해지 처리 제안**
  Given 4개 항목이 완료된 상태에서
  When 마지막 항목을 켜면
  Then AlertDialog 제목 "해지 완료로 표시할까요?", 버튼 "해지함으로 옮기기" / "나중에" 가 표시되고
  And "해지함으로 옮기기" 탭 시 `sub_1.status='CANCELED'` 로 저장되고 `navigate('/', { replace:true })`, Toast "해지함으로 옮겼어요"가 표시된다

- **AC-4 [W][P0]: Scenario: 외부 이동 요소 없음**
  Given 체크리스트 화면이 렌더될 때
  Then 화면 내 `<a href>` 태그와 `window.open` 호출은 0건이고, 항목 텍스트에 "설치", "다운로드", "바로가기" 문자열이 포함되지 않는다

- **AC-5 [W][P1]: Scenario: 존재하지 않는 구독 ID**
  Given `/subscriptions/unknown_id/checklist` 로 직접 진입했을 때
  Then "구독을 찾을 수 없어요" 문구와 `display="block"` 버튼 "홈으로"가 표시되고 체크리스트는 생성되지 않으며 `console.error` 는 호출되지 않는다

- **AC-6 [W][P1]: Scenario: 체크 저장 실패**
  Given 저장이 `{ ok:false, error:'STORAGE_FULL' }` 을 반환하는 상태에서
  When 항목 `Switch` 를 켜면
  Then `Switch` 는 원래 상태(off)로 되돌아가고 Toast "저장하지 못했어요. 잠시 후 다시 시도해주세요"가 표시된다

- **AC-7 [S][P1]: Scenario: 로딩 상태**
  While 체크리스트 로딩 중일 때
  Then 5개 항목 자리에 스켈레톤 `ListRow` 5개가 표시되고 진행률 텍스트는 "-/5" 로 표시된다

- **AC-8 [U][P1]: Scenario: 해지 취소(되돌리기)**
  Given `status='CANCELED'` 인 구독 상세에서
  When "다시 사용 중으로" 버튼을 탭하면
  Then `status='ACTIVE'` 로 저장되고 `nextBillingDate` 가 오늘 기준으로 재계산되며 대시보드 총액에 다시 합산된다

---

### F8. 수익화 — 배너/보상형 광고 배치 · 프리미엄 IAP

- **Description**: 무료 사용자에게는 콘텐츠 섹션 사이에 배너 광고를 노출하고, 비교 리포트는 보상형 광고로 게이팅한다. 프리미엄 1회성 구매(`TossPurchase`) 시 구독 무제한 등록과 광고 제거 권한을 부여하고 `AppSettings.isPremium=true` 로 저장한다. 결제 상태는 localStorage에 저장되며 앱 재시작 후에도 유지된다.
- **Data**: `AppSettings.isPremium`, `premiumGrantedAt`
- **API**: 없음(IAP는 SDK 래퍼 컴포넌트 사용)
- **Requirements**: 광고는 콘텐츠를 덮지 않고 섹션 사이/목록 하단에만 배치한다.

- **AC-1 [U][P0]: Scenario: 배너 광고 배치**
  Given `isPremium=false` 로 대시보드에 진입할 때
  Then `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />` 가 `data-testid="ad-banner-home"` 로 **구독 목록 섹션 하단**에 1개만 렌더되고
  And 광고 컨테이너는 `position: static` 이며 다른 콘텐츠 위에 겹치지 않는다(오버레이/fixed 금지)

- **AC-2 [S][P0]: Scenario: 프리미엄은 광고 제거**
  While `isPremium=true` 인 상태에서 대시보드와 `/compare` 를 렌더하면
  Then `data-testid="ad-banner-home"` 와 리워드 광고 게이트가 모두 렌더되지 않는다

- **AC-3 [E][P0]: Scenario: 프리미엄 구매 성공**
  Given `/premium` 에서 `isPremium=false` 일 때
  When `<TossPurchase sku={import.meta.env.VITE_TOSS_IAP_SKU} />` 결제가 완료되어 `onPurchased` 가 호출되면
  Then `processProductGrant` 에서 `saveSettings({ isPremium:true, premiumGrantedAt:'<ISO>' })` 가 실행되고 Toast "프리미엄이 적용됐어요"가 표시된다
  And `navigate('/', { replace:true })` 후 대시보드에서 광고가 사라지고 구독 4개째 등록이 허용된다

- **AC-4 [W][P1]: Scenario: 결제 실패/취소**
  Given 결제 도중 사용자가 취소하거나 SDK가 에러를 반환할 때
  Then `isPremium` 은 `false` 로 유지되고 Toast "결제가 완료되지 않았어요"가 표시되며 `/premium` 화면에 그대로 머문다
  And `console.error` 는 호출되지 않는다

- **AC-5 [W][P1]: Scenario: 광고 ID 미주입**
  Given `import.meta.env.VITE_TOSS_AD_GROUP_ID` 가 `undefined` 인 빌드에서
  When 대시보드를 렌더하면
  Then `AdSlot` 은 렌더되지 않고(빈 영역, 레이아웃 깨짐 없음) 앱은 정상 동작하며 `console.error` 는 호출되지 않는다

- **AC-6 [S][P1]: Scenario: 광고 로딩 상태**
  While 배너 광고가 로드 중인 동안
  Then 광고 자리에는 고정 높이 플레이스홀더(높이 값 고정)가 표시되어 로드 완료 시 목록이 밀리는 레이아웃 시프트가 발생하지 않는다

- **AC-7 [U][P0]: Scenario: 프리미엄 상태 영속**
  Given `isPremium=true` 로 저장된 상태에서
  When 앱을 완전히 새로고침(리로드)하면
  Then 대시보드는 광고 없이 렌더되고 `/subscriptions/new` 진입 시 3개 제한 BottomSheet가 표시되지 않는다

- **AC-8 [U][P1]: Scenario: 결제 화면 문구 규정 준수**
  Given `/premium` 화면 텍스트에서
  When "앱을 설치", "다운로드", 외부 URL 문자열을 검색하면
  Then 매칭 0건이고, 제공 혜택은 "구독 무제한 등록", "광고 제거", "비교 리포트 바로 보기" 3개 항목이 TDS `ListRow` 로 명시된다

---

## Screen Definitions

공통: 모든 화면은 `ScreenScaffold`(TDS `Top` 헤더 포함) 루트, `data-testid="screen-<id>"`. 하단 탭은 템플릿 `FloatingTabBar` 3탭 — 홈(`/`), 비교(`/compare`), 더보기(`/more`). 모든 탭/버튼/행의 터치 타깃 ≥ 44px.

---

### S1. 대시보드 — `/` (`screen-home`)
- **TDS 컴포넌트**: `Top`(title="구독 관리"), `SummaryHero`(템플릿), Card, `Sparkline`, `MiniBar`, `ListRow`(항목), `Chip`("인상" 배지), `Button`(display="block", "구독 추가"), `BottomSheet`(3개 제한 안내), `Spacing`, `Asset.ContentIcon`(빈 상태), `Toast`
- **Layout 계약**: 위→아래 순서 = `SummaryHero`(월 총액, CountUp) → D-day 카드(`dday-card`) → 추이 Card(`trend-sparkline`) → 비중 Card(`category-minibar`) → 목록(`subscription-list`) → `AdSlot`(`ad-banner-home`). 1차 액션 "구독 추가"는 `SubmitFooter` 하단 고정 `display="block"`.
- **상태**: Loading = 히어로 스켈레톤 + `ListRow` 스켈레톤 3개 / Empty = `Asset.ContentIcon` + "아직 등록한 구독이 없어요" + "첫 구독 등록하기" / Error = 데이터 손상 시 "일부 항목을 불러오지 못했어요" 인라인 배너(전체 크래시 없음)
- **터치**: `ListRow` 높이 ≥ 56px, 하단 고정 버튼 높이 48px, 탭바 아이템 48×48px 이상
- **Navigation 계약**
  - Outgoing: `ListRow` 탭 → `navigate('/subscriptions/:id')` (state 없음, `id` 는 URL 파라미터)
  - Outgoing: "구독 추가"(무료·3개 미만 또는 프리미엄) → `navigate('/subscriptions/new')`
  - Outgoing: 3개 제한 BottomSheet "프리미엄 보기" → `navigate('/premium', { state: { from: 'limit' } })`
  - Outgoing: D-day 카드 "해지 준비" → `navigate('/subscriptions/:id/checklist', { state: { subscriptionId: string; from: 'dday' } })`
  - Incoming: `location.state = { toast?: string } | null` (등록/수정 후 복귀 시 Toast 문구)
- **레이아웃 AC**
  - **AC-S1-1 [U][P0]**: 활성 구독 ≥ 1건일 때 홈 화면은 `data-testid="summary-hero"` 1개, `data-testid="trend-sparkline"` 1개, `data-testid="category-minibar"` 1개, `data-testid="subscription-list"` 1개를 포함하고, 히어로 숫자는 t2 이상 강조 타이포로 렌더된다.

---

### S2. 구독 등록 — `/subscriptions/new` (`screen-new`)
- **TDS 컴포넌트**: `Top`(뒤로가기), `Chip`(템플릿 12종 + "직접 입력"), `TextField`(이름/금액/메모), `Tab`(결제주기: 월간/연간), `TextField`(date, 최초 결제일), `Paragraph.Text`(월 환산 미리보기), `SubmitFooter` + `Button`(display="block", "등록하기"), `AlertDialog`(저장 실패), `Toast`
- **Layout 계약**: `ScreenScaffold` → 템플릿 Chip 그룹 Card → 입력 폼 섹션 → `monthly-preview` → `SubmitFooter`. 광고 없음(입력 몰입 방해 금지).
- **상태**: Loading = 없음(즉시 렌더) / Empty = 해당 없음 / Error = 필드별 인라인 에러 메시지("금액을 입력해주세요", "이름은 20자까지 입력할 수 있어요", "결제일을 선택해주세요")
- **키보드**: 금액 `inputMode="numeric"`, 이름 `enterKeyHint="next"`, 메모 `enterKeyHint="done"`; 포커스 시 해당 필드가 뷰포트 상단 1/3 위치로 스크롤; `SubmitFooter` 는 키보드 표시 중 가려지지 않도록 키보드 위로 배치
- **Navigation 계약**
  - Outgoing: 등록 성공 → `navigate('/', { replace: true, state: { toast: '구독이 등록됐어요' } })`
  - Incoming: `location.state = { templateKey?: string } | null` (템플릿 프리셀렉트용, 없으면 미선택)

---

### S3. 구독 상세 — `/subscriptions/:id` (`screen-detail`)
- **TDS 컴포넌트**: `Top`(우측 "수정"), Card(요약: 금액/주기/다음 결제일/D-day), `Chip`("인상"), Card(`price-history-card`) + `ListRow`(이력), `Button`(display="block", "해지 체크리스트"), `Button`(weak, "삭제"), `AlertDialog`(삭제 확인), `Toast`
- **Layout 계약**: 요약은 반드시 Card로 묶고 현재 금액은 t2 강조 + 주기 배지(`Chip`). 가격 이력은 별도 Card. `AdSlot` 은 이력 카드 **아래**에만 배치(`data-testid="ad-banner-detail"`, 무료 사용자만).
- **상태**: Loading = 요약 Card 스켈레톤 / Empty = 가격 이력 0건 시 "가격 변동 기록이 없어요" + `Asset.ContentIcon` / Error = 존재하지 않는 id → "구독을 찾을 수 없어요" + "홈으로" 버튼
- **터치**: 삭제/수정/체크리스트 버튼 높이 ≥ 48px
- **Navigation 계약**
  - Outgoing: "수정" → `navigate('/subscriptions/:id/edit', { state: { subscriptionId: string } })`
  - Outgoing: "해지 체크리스트" → `navigate('/subscriptions/:id/checklist', { state: { subscriptionId: string; from: 'detail' } })`
  - Outgoing: 삭제 확정 → `navigate('/', { replace:true, state: { toast: '삭제했어요' } })`
  - Incoming: `location.state = { toast?: string } | null`

---

### S4. 구독 수정 — `/subscriptions/:id/edit` (`screen-edit`)
- **TDS 컴포넌트**: S2와 동일 폼 + `TextField`(가격 변경 메모, 금액이 변경된 경우에만 노출), `Switch`("해지함으로 표시")
- **Layout 계약**: `SubmitFooter` "저장하기" `display="block"`.
- **상태**: Loading = 폼 스켈레톤 / Error = 필드별 인라인 에러, 저장 실패 시 AlertDialog "저장 공간이 부족해요"
- **키보드**: S2와 동일 규칙
- **Navigation 계약**
  - Outgoing: 저장 성공 → `navigate('/subscriptions/:id', { replace:true, state: { toast: string } })` (toast 문구 = "3,500원 인상됐어요" | "7,100원 내렸어요" | "수정했어요")
  - Incoming: `location.state = { subscriptionId: string } | null` (없으면 URL param `id` 사용)

---

### S5. 해지 체크리스트 — `/subscriptions/:id/checklist` (`screen-checklist`)
- **TDS 컴포넌트**: `Top`(구독 이름), `Paragraph.Text`(`checklist-progress`, "n/5"), `ListRow` + `Switch`(5개 항목), `AlertDialog`(해지 완료 전환), `Toast`
- **Layout 계약**: 진행률은 목록 상단 Card 안에 t3 강조. 항목은 링크 없는 텍스트 + `Switch` 만. 광고 없음.
- **상태**: Loading = `ListRow` 스켈레톤 5개, 진행률 "-/5" / Empty = 해당 없음(항상 5항목) / Error = 잘못된 id → "구독을 찾을 수 없어요" + "홈으로"
- **터치**: `Switch` 포함 `ListRow` 전체가 탭 영역, 높이 ≥ 56px
- **Navigation 계약**
  - Outgoing: 해지 확정 → `navigate('/', { replace:true, state: { toast: '해지함으로 옮겼어요' } })`
  - Outgoing: "홈으로" → `navigate('/', { replace:true })`
  - Incoming: `location.state = { subscriptionId: string; from: 'dday' | 'detail' } | null`

---

### S6. 또래 비교 리포트 — `/compare` (`screen-compare`)
- **TDS 컴포넌트**: `Top`("또래 비교"), `Chip`(연령대 4종), `Button`(display="block", "결과 보기"), `TossRewardAd`(게이트), Card ×2(`compare-card`), `SummaryHero`, `MiniBar`, `Paragraph.Text`("참고용 추정치입니다"), `Asset.ContentIcon`(빈 상태), `Toast`
- **Layout 계약**: 결과는 반드시 Card 2개로 위계 구분(맨 div 나열 금지). 차액은 t2 강조 + 상태 배지(`Chip`: "평균보다 적게" / "평균보다 많이"). `AdSlot`(`ad-banner-compare`)은 결과 카드 **아래**, 무료 사용자에게만.
- **상태**: Loading = 광고 로드 중 버튼 `loading` 상태 + 비활성 / Empty = 구독 0건 시 "구독을 1개 이상 등록하면 비교할 수 있어요" + 버튼 disabled / Error = 광고 실패 Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"
- **Navigation 계약**
  - Outgoing: 빈 상태 CTA "구독 등록하기" → `navigate('/subscriptions/new')`
  - Outgoing: 프리미엄 배너 → `navigate('/premium', { state: { from: 'compare' } })`
  - Incoming: `location.state = null` (탭 진입 전용)
- **레이아웃 AC**
  - **AC-S6-1 [U][P0]**: 결과 표시 상태에서 `/compare` 는 `data-testid="compare-card"` Card 정확히 2개, `data-testid="compare-diff"`(차액 강조, t2 이상), `data-testid="compare-ratio"`, `data-testid="category-minibar"` 를 각각 1개씩 포함한다.

---

### S7. 더보기 — `/more` (`screen-more`)
- **TDS 컴포넌트**: `Top`("더보기"), `ListRow`(연령대 설정 / 프리미엄 / 데이터 초기화 / 이용 안내), `Chip`(연령대 선택), `AlertDialog`(초기화 확인), `AdSlot`(`ad-banner-more`, 목록 하단, 무료만)
- **상태**: Loading = 없음 / Empty = 없음 / Error = 초기화 실패 시 Toast "초기화하지 못했어요"
- **Navigation 계약**
  - Outgoing: "프리미엄" `ListRow` → `navigate('/premium', { state: { from: 'more' } })`
  - Incoming: `location.state = null`

---

### S8. 프리미엄 — `/premium` (`screen-premium`)
- **TDS 컴포넌트**: `Top`("프리미엄"), Card(혜택 3개 `ListRow`), `SubmitFooter` + `TossPurchase`(sku=env), `Toast`, `Paragraph.Text`(1회 결제 안내)
- **Layout 계약**: 혜택은 Card 안 `ListRow` 3행. 결제 버튼은 `SubmitFooter` 하단 고정, 높이 ≥ 48px. 광고 미노출.
- **상태**: Loading = 결제 진행 중 버튼 `loading` + 중복 탭 차단 / Empty = 해당 없음 / Error = 결제 실패 Toast "결제가 완료되지 않았어요"
- **Navigation 계약**
  - Outgoing: 결제 성공 → `navigate('/', { replace:true, state: { toast: '프리미엄이 적용됐어요' } })`
  - Incoming: `location.state = { from: 'limit' | 'compare' | 'more' } | null` (진입 경로에 따라 상단 문구 변경: `'limit'` → "구독을 무제한으로 등록해보세요")

---

## API Contract

**외부 API 없음.** MVP 전 기능이 localStorage + 앱 내장 상수로 동작하며, `fetch`/`XMLHttpRequest`/`axios` 호출이 0건이다. 따라서 CORS 설정, 에러 코드 매핑, 네트워크 재시도 로직이 필요 없다.

SDK 호출(네트워크 API가 아닌 프레임워크 래퍼)만 존재한다:

| 용도 | 사용 형태 | 성공 시 | 실패 시 |
|---|---|---|---|
| 배너 광고 | `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />` | 배너 렌더 | 미렌더(레이아웃 유지), `console.error` 없음 |
| 보상형 광고 | `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>{result}</TossRewardAd>` | children 노출 + `compareUnlockedAt` 저장 | Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요" |
| 1회성 결제 | `<TossPurchase sku={import.meta.env.VITE_TOSS_IAP_SKU} processProductGrant onPurchased />` | `isPremium=true` 저장 | Toast "결제가 완료되지 않았어요", 상태 변경 없음 |
| 로그인 연동 확인 | `getIsTossLoginIntegratedService()` | `boolean` 반환(표시용) | `false` 로 간주, 기능 차단 없음 |

향후 외부 벤치마크 서버를 도입할 경우의 계약(**MVP 범위 밖, 구현 금지**):
```
GET {VITE_BENCHMARK_API}/v1/benchmark?ageBand=25-29
→ 200 { ageBand: string; avgMonthlyAmount: number; sampleSize: number; updatedAt: string }
→ 4xx/5xx { error: string }
```

---

## Assumptions

- **A-1**: 서비스별 실제 구독 가격은 PRD에 없고 수시로 변동하므로, 템플릿은 **이름·카테고리·아이콘만** 제공하고 금액은 항상 사용자가 입력한다. 앱은 특정 서비스의 가격을 주장하지 않는다.
- **A-2**: 연령대별 평균 구독비는 검증된 출처가 PRD에 없으므로, `DEFAULT_BENCHMARK` 를 앱 내장 참고 상수로 두고 화면에 "참고용 추정치입니다 · 실제 평균과 다를 수 있어요"를 항상 병기한다. 값은 `VITE_BENCHMARK_JSON` 으로 재빌드 없이 교체 가능하다.
- **A-3**: 푸시 알림은 MVP 범위 밖이다. "리마인더"는 앱 재방문 시 인앱 D-day 표시로 구현한다.
- **A-4**: 토스 결제 내역 자동 연동(구독 자동 탐지)은 SDK 범위 밖이므로 제외한다. 모든 구독은 사용자가 수동 등록한다.
- **A-5**: 데이터는 기기 localStorage에만 저장되며 기기 간 동기화·백업은 제공하지 않는다. 이 사실을 `/more` 이용 안내에 1줄로 표기한다.
- **A-6**: 비교 리포트·해지 체크리스트를 포함한 모든 산출물은 결정적 규칙/산술 결과이며 생성형 AI를 사용하지 않는다. 따라서 AI 고지 다이얼로그·AI 라벨은 구현하지 않는다. (향후 AI 요약을 추가한다면 고지 의무 AC를 반드시 신설한다.)
- **A-7**: 프리미엄은 **1회성 구매**(`IAP.createOneTimePurchaseOrder` 기반)로 영구 권한을 부여한다. 정기 결제형 구독 상품은 사용하지 않는다.
- **A-8**: 통화는 KRW 단독. 다국어/다통화 미지원.

## Open Questions

- **Q-1**: `DEFAULT_BENCHMARK` 의 연령대별 평균값을 어떤 출처(자체 집계 / 공개 통계 / 콘솔 주입)로 확정할 것인가? 출처 표기 문구도 함께 확정 필요.
- **Q-2**: `SERVICE_TEMPLATES` 12종의 구체적 서비스 목록과 아이콘 에셋(상표 사용 가능 여부)은 누가 확정하는가? 로고 사용이 불가하면 카테고리 아이콘으로 대체할지?
- **Q-3**: 프리미엄 가격(SKU 금액)과 상품명은 앱인토스 콘솔에서 얼마로 등록하는가? PRD의 MRR 14~15만원 목표 기준 단가·전환율 가정 확인 필요.
- **Q-4**: 무료 3개 제한을 **활성 구독 기준**으로 볼지, 해지 항목 포함 전체 기준으로 볼지 — 본 SPEC은 활성 기준으로 가정했다.
- **Q-5**: 리워드 광고 해제 유효기간을 24시간으로 가정했다. 재방문 유도 관점에서 12시간/7일 중 조정이 필요한가?
- **Q-6**: 기기 변경 시 데이터 이전 수요가 확인되면 외부 API 서버(별도 Railway 배포)를 추가할지 — 추가 시 Q-1의 벤치마크 API와 함께 설계.
- **Q-7**: 가격 이력 상한 20건·구독 하드 상한 100건이 실사용에 충분한가? (현재 총 용량 추정 128KB로 여유는 충분함)
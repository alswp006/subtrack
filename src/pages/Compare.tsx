import { Top, Paragraph, Spacing, Chip } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Amount } from '../components/Amount';
import { MiniBar } from '../components/MiniBar';
import { Card } from '../components/Card';
import { FloatingTabBar, type TabItem } from '../components/FloatingTabBar';
import { TossRewardAd } from '../components/TossRewardAd';
import { useSettings } from '../hooks/useSettings';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { getBenchmark, BENCHMARK_DISCLAIMER, COMPARE_UNLOCK_HOURS } from '../lib/constants';
import { formatNumber } from '../lib/utils';
import type { AgeBand } from '../lib/types';

const TABS: TabItem[] = [
  { label: '홈', path: '/' },
  { label: '비교', path: '/compare' },
  { label: '더보기', path: '/more' },
];

const AGE_BANDS: { value: Exclude<AgeBand, 'UNSET'>; label: string }[] = [
  { value: '20-24', label: '20-24' },
  { value: '25-29', label: '25-29' },
  { value: '30-34', label: '30-34' },
  { value: '35-39', label: '35-39' },
];

function isWithinUnlockWindow(compareUnlockedAt: string | null): boolean {
  if (!compareUnlockedAt) return false;
  const unlockedAtMs = new Date(compareUnlockedAt).getTime();
  if (Number.isNaN(unlockedAtMs)) return false;
  const hoursSince = (Date.now() - unlockedAtMs) / (60 * 60 * 1000);
  return hoursSince <= COMPARE_UNLOCK_HOURS;
}

function fireTickHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'tickWeak' })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

/**
 * 또래 비교 화면 — 연령대 선택 → 리워드 광고 게이팅 → 내 월 구독비 vs 벤치마크 비교.
 */
export default function Compare() {
  const { settings, update } = useSettings();
  const { totalMonthly } = useSubscriptions();
  const benchmark = getBenchmark();

  const ageBand = settings.ageBand;
  const unlocked = isWithinUnlockWindow(settings.compareUnlockedAt);
  console.log('DEBUG render', { ageBand, compareUnlockedAt: settings.compareUnlockedAt, unlocked });

  function handleSelectAgeBand(value: Exclude<AgeBand, 'UNSET'>) {
    fireTickHaptic();
    void update({ ageBand: value });
  }

  function handleUnlock() {
    void update({ compareUnlockedAt: new Date().toISOString() });
  }

  const benchmarkAmount = ageBand === 'UNSET' ? 0 : benchmark[ageBand];
  const diff = totalMonthly - benchmarkAmount;
  const diffAbs = Math.abs(diff);
  const diffCaption =
    diff > 0
      ? `또래 평균보다 ${formatNumber(diffAbs)}원 더 써요`
      : diff < 0
        ? `또래 평균보다 ${formatNumber(diffAbs)}원 덜 써요`
        : '또래 평균과 같아요';

  const maxAmount = Math.max(totalMonthly, benchmarkAmount, 1);
  const compareBars = [
    { category: '내 지출', percent: Math.round((totalMonthly / maxAmount) * 1000) / 10 },
    { category: '또래 평균', percent: Math.round((benchmarkAmount / maxAmount) * 1000) / 10 },
  ];

  const result = (
    <>
      <SummaryHero
        testId="compare-hero"
        label="또래 대비"
        value={<Amount value={diffAbs} unit="원" typography="t1" />}
        caption={diffCaption}
      />
      <Spacing size={16} />
      <Card testId="compare-minibar-card">
        <MiniBar testId="compare-minibar" items={compareBars} />
      </Card>
      <Spacing size={8} />
      <Paragraph.Text typography="st12" color="var(--tds-color-grey500)">
        {BENCHMARK_DISCLAIMER}
      </Paragraph.Text>
    </>
  );

  return (
    <ScreenScaffold
      testId="screen-compare"
      top={<Top title={<Top.TitleParagraph>또래 비교</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={TABS} />}
    >
      <Paragraph.Text typography="t4">연령대를 선택해주세요</Paragraph.Text>
      <Spacing size={12} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {AGE_BANDS.map((band) => (
          <Chip
            key={band.value}
            variant={ageBand === band.value ? 'fill' : 'weak'}
            onClick={() => handleSelectAgeBand(band.value)}
          >
            {band.label}
          </Chip>
        ))}
      </div>

      {ageBand !== 'UNSET' && (
        <>
          <Spacing size={24} />
          {unlocked ? (
            result
          ) : (
            <TossRewardAd
              slotId={(import.meta.env.VITE_TOSS_AD_SLOT_ID as string | undefined) ?? 'compare-unlock'}
              description="짧은 광고를 보면 비교 리포트를 볼 수 있어요"
              onRewarded={handleUnlock}
            >
              {result}
            </TossRewardAd>
          )}
        </>
      )}
    </ScreenScaffold>
  );
}

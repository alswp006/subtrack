import { Top, Paragraph, Spacing, Button, Asset } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Amount } from '../components/Amount';
import { Sparkline } from '../components/Sparkline';
import { MiniBar } from '../components/MiniBar';
import { ListSkeleton } from '../components/ListSkeleton';
import { EmptyState, LoadingState } from '../components/StateView';
import { FloatingTabBar, type TabItem } from '../components/FloatingTabBar';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { monthlyAmount } from '../domain/calc';
import type { CategoryKey, Subscription } from '../lib/types';

const TABS: TabItem[] = [
  { label: '홈', path: '/' },
  { label: '비교', path: '/compare' },
  { label: '더보기', path: '/more' },
];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  OTT: 'OTT',
  MUSIC: '음악',
  CLOUD: '클라우드',
  GAME: '게임',
  PRODUCTIVITY: '생산성',
  FITNESS: '피트니스',
  ETC: '기타',
};

function computeCategoryBreakdown(items: Subscription[]): { category: string; percent: number }[] {
  const totals = new Map<CategoryKey, number>();
  let total = 0;
  for (const item of items) {
    if (item.status !== 'ACTIVE') continue;
    const amt = monthlyAmount({ amount: item.amount, cycle: item.cycle });
    totals.set(item.category, (totals.get(item.category) ?? 0) + amt);
    total += amt;
  }
  if (total === 0) return [];
  const result: { category: string; percent: number }[] = [];
  totals.forEach((amt, category) => {
    result.push({ category: CATEGORY_LABELS[category], percent: Math.round((amt / total) * 1000) / 10 });
  });
  return result;
}

function computeMonthlyTrend(items: Subscription[]): number[] {
  const now = new Date();
  const points: number[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let total = 0;
    for (const item of items) {
      if (item.status !== 'ACTIVE') continue;
      if (!item.createdAt) continue;
      const createdMonth = item.createdAt.slice(0, 7);
      if (createdMonth <= monthKey) {
        total += monthlyAmount({ amount: item.amount, cycle: item.cycle });
      }
    }
    points.push(total);
  }
  return points;
}

/**
 * 대시보드 — 탭 루트 홈. 요약 히어로 + 최근 6개월 추이 + 카테고리 비중.
 * 목록/D-day 카드는 다음 패킷에서 이 화면에 이어 붙인다.
 */
export default function Home() {
  const navigate = useNavigate();
  const { status, items, totalMonthly, activeCount, canceledCount } = useSubscriptions();

  function handleAdd() {
    try {
      Promise.resolve(generateHapticFeedback({ type: 'success' })).catch(() => {});
    } catch {
      /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
    }
    navigate('/subscriptions/new');
  }

  const top = <Top title={<Top.TitleParagraph>구독 관리</Top.TitleParagraph>} />;
  const bottom = <FloatingTabBar items={TABS} />;

  if (status === 'loading') {
    return (
      <ScreenScaffold testId="screen-home" top={top} bottom={bottom}>
        <LoadingState testId="hero-skeleton" rows={1} />
        <Spacing size={24} />
        <ListSkeleton count={3} />
      </ScreenScaffold>
    );
  }

  if (items.length === 0) {
    return (
      <ScreenScaffold testId="screen-home" top={top} bottom={bottom}>
        <EmptyState
          testId="empty-state"
          icon={<Asset.ContentIcon name="iconStarRegular" alt="구독 없음" style={{ width: 48, height: 48 }} />}
          title="아직 등록한 구독이 없어요"
          description="첫 구독을 등록하고 월 지출을 확인해보세요"
          action={
            <Button variant="fill" display="block" onClick={handleAdd}>
              첫 구독 등록하기
            </Button>
          }
        />
      </ScreenScaffold>
    );
  }

  const trend = computeMonthlyTrend(items);
  const categoryBreakdown = computeCategoryBreakdown(items);

  return (
    <ScreenScaffold testId="screen-home" top={top} bottom={bottom}>
      <SummaryHero
        testId="summary-hero"
        label="이번 달 구독비"
        value={<Amount value={totalMonthly} unit="원" typography="t1" />}
        caption={`활성 ${activeCount}개 · 해지함 ${canceledCount}개`}
        action={
          <Button variant="fill" display="block" onClick={handleAdd}>
            구독 추가
          </Button>
        }
      />

      <Spacing size={24} />

      <Paragraph.Text typography="t4">최근 6개월 추이</Paragraph.Text>
      <Spacing size={12} />
      <Sparkline testId="trend-sparkline" points={trend} />

      <Spacing size={24} />

      <Paragraph.Text typography="t4">카테고리 비중</Paragraph.Text>
      <Spacing size={12} />
      <MiniBar testId="category-minibar" items={categoryBreakdown} />

      <Spacing size={24} />
    </ScreenScaffold>
  );
}

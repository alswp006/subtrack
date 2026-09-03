import { Paragraph, Button } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { formatCurrencyKrw, getDaysUntilBilling, ddayLabel, monthlyAmount } from '@/domain/calc';
import type { RouteState, Subscription } from '@/lib/types';

/**
 * 결제 임박 카드 — items[0](이미 결제 임박순으로 정렬·필터된 첫 항목) 기준으로
 * D-3 이내면 강조 카드를, 아니면 "다음 결제는 D-N 이름" 안내를 렌더한다.
 */
export function DdayCard({ items }: { items: Subscription[] }) {
  const navigate = useNavigate();

  if (items.length === 0) return null;

  const nearest = items[0];
  const days = getDaysUntilBilling(nearest.nextBillingDate);
  const validDays = !Number.isNaN(days);

  function handleCancelPrep() {
    try {
      Promise.resolve(generateHapticFeedback({ type: 'tickWeak' })).catch(() => {});
    } catch {
      /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
    }
    navigate(`/subscriptions/${nearest.id}/checklist`, {
      state: { subscriptionId: nearest.id, from: 'dday' } as RouteState['/subscriptions/:id/checklist'],
    });
  }

  if (validDays && days <= 3) {
    const amount = monthlyAmount({ amount: nearest.amount, cycle: nearest.cycle });
    return (
      <div
        data-testid="dday-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 16,
          borderRadius: 16,
          backgroundColor: 'var(--tds-color-grey50)',
        }}
      >
        <Paragraph.Text typography="st11">
          {`${nearest.name} ${ddayLabel(days)} · ${formatCurrencyKrw(amount)} 결제 예정`}
        </Paragraph.Text>
        <Button variant="weak" size="medium" display="block" onClick={handleCancelPrep}>
          해지 준비
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="dday-next">
      <Paragraph.Text typography="st12" color="var(--tds-color-grey500)">
        {validDays ? `다음 결제는 ${ddayLabel(days)} ${nearest.name}` : `${nearest.name} 결제일 확인 필요`}
      </Paragraph.Text>
    </div>
  );
}

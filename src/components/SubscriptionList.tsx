import { useState } from 'react';
import { ListRow, Chip, Button, Spacing } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { formatCurrencyKrw, getDaysUntilBilling, ddayLabel, monthlyAmount } from '@/domain/calc';
import type { RouteState, Subscription } from '@/lib/types';

const PAGE_SIZE = 20;

/**
 * 결제 임박순 구독 목록 — 행 탭 시 상세로 이동, 가격 인상 이력이 있는 항목에는
 * "인상" 배지를 병기한다. 초기 렌더는 20건으로 제한하고 "더 보기"로 확장한다
 * (대량 목록에서 초기 DOM 노드 수를 억제해 성능을 지킨다).
 */
export function SubscriptionList({
  items,
  testId = 'subscription-list',
}: {
  items: Subscription[];
  testId?: string;
}) {
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(Math.min(PAGE_SIZE, items.length));

  const visible = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  function handleRowClick(sub: Subscription) {
    try {
      Promise.resolve(generateHapticFeedback({ type: 'tickWeak' })).catch(() => {});
    } catch {
      /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
    }
    navigate(`/subscriptions/${sub.id}`, {
      state: { subscriptionId: sub.id } as RouteState['/subscriptions/:id'],
    });
  }

  return (
    <div data-testid={testId}>
      {visible.map((sub) => {
        const days = getDaysUntilBilling(sub.nextBillingDate);
        const validDays = !Number.isNaN(days);
        const hasPriceUp = sub.priceHistory.length > 0;

        return (
          <ListRow
            key={sub.id}
            onClick={() => handleRowClick(sub)}
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={sub.name}
                bottom={`매월 ${formatCurrencyKrw(monthlyAmount({ amount: sub.amount, cycle: sub.cycle }))}`}
              />
            }
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {hasPriceUp && (
                  <span data-testid="price-up-badge">
                    <Chip variant="fill" size="small">
                      인상
                    </Chip>
                  </span>
                )}
                <Chip variant="weak" size="small">
                  {validDays ? ddayLabel(days) : '날짜 확인 필요'}
                </Chip>
              </div>
            }
          />
        );
      })}
      {hasMore && (
        <>
          <Spacing size={12} />
          <Button
            variant="weak"
            display="block"
            onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, items.length))}
          >
            더 보기
          </Button>
        </>
      )}
    </div>
  );
}

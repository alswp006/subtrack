import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Top, Paragraph, Spacing, ListRow, AlertDialog, TextButton, Button } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Amount } from '../components/Amount';
import { EmptyState, LoadingState } from '../components/StateView';
import { ButtonStack } from '../components/BottomCTA';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { formatDate, formatCurrencyKrw, getDaysUntilBilling, ddayLabel } from '../domain/calc';
import type { CategoryKey, RouteState } from '../lib/types';

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  OTT: 'OTT',
  MUSIC: '음악',
  CLOUD: '클라우드',
  GAME: '게임',
  PRODUCTIVITY: '생산성',
  FITNESS: '피트니스',
  ETC: '기타',
};

const CYCLE_LABELS = { MONTHLY: '매월', YEARLY: '매년' } as const;

function fireHaptic(type: 'success' | 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

/**
 * 구독 상세 화면 — 기본 정보 + 가격 이력(최신순), 수정/해지 체크리스트 진입, 삭제 확인.
 */
export default function SubscriptionDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { status, items, remove } = useSubscriptions();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sub = useMemo(() => items.find((item) => item.id === id) ?? null, [items, id]);

  const history = useMemo(() => {
    if (!sub) return [];
    return [...sub.priceHistory].sort((a, b) => {
      if (a.changedAt < b.changedAt) return 1;
      if (a.changedAt > b.changedAt) return -1;
      return 0;
    });
  }, [sub]);

  function handleEdit() {
    if (!sub) return;
    navigate(`/subscriptions/${sub.id}/edit`, {
      state: { subscriptionId: sub.id } as RouteState['/subscriptions/:id/edit'],
    });
  }

  function handleChecklist() {
    if (!sub) return;
    navigate(`/subscriptions/${sub.id}/checklist`, {
      state: { subscriptionId: sub.id, from: 'detail' } as RouteState['/subscriptions/:id/checklist'],
    });
  }

  async function handleConfirmDelete() {
    if (!sub) return;
    fireHaptic('success');
    setConfirmDelete(false);
    await remove(sub.id);
    navigate('/', { state: { toastMessage: '구독을 삭제했어요' } as RouteState['/'] });
  }

  const top = (
    <Top
      title={<Top.TitleParagraph>{sub ? sub.name : '구독 상세'}</Top.TitleParagraph>}
      right={
        sub ? (
          <TextButton
            size="medium"
            onClick={() => {
              fireHaptic('tickWeak');
              setConfirmDelete(true);
            }}
          >
            구독 삭제
          </TextButton>
        ) : undefined
      }
    />
  );

  if (status === 'loading') {
    return (
      <ScreenScaffold testId="screen-detail" top={top}>
        <LoadingState testId="detail-skeleton" rows={4} />
      </ScreenScaffold>
    );
  }

  if (!sub) {
    return (
      <ScreenScaffold testId="screen-detail" top={top}>
        <EmptyState
          testId="detail-not-found"
          title="구독을 찾을 수 없어요"
          description="삭제되었거나 잘못된 경로예요"
          action={
            <Button variant="weak" display="block" onClick={() => navigate('/')}>
              대시보드로
            </Button>
          }
        />
      </ScreenScaffold>
    );
  }

  const days = getDaysUntilBilling(sub.nextBillingDate);

  return (
    <ScreenScaffold
      testId="screen-detail"
      top={top}
      bottom={
        <ButtonStack
          primary={{ label: '해지 체크리스트', onClick: handleChecklist }}
          secondary={{ label: '수정', onClick: handleEdit }}
        />
      }
    >
      <SummaryHero
        testId="detail-hero"
        label="이번 결제 예정"
        value={<Amount value={sub.amount} unit="원" typography="t2" />}
        caption={`다음 결제 ${ddayLabel(days)} · ${sub.nextBillingDate}`}
      />

      <Spacing size={24} />

      <Paragraph.Text typography="t4">기본 정보</Paragraph.Text>
      <Spacing size={12} />
      <ListRow
        border="none"
        contents={<ListRow.Texts type="2RowTypeA" top="결제 주기" bottom={CYCLE_LABELS[sub.cycle]} />}
      />
      <ListRow
        border="none"
        contents={
          <ListRow.Texts type="2RowTypeA" top="첫 결제일" bottom={formatDate(sub.firstBillingDate, 'long')} />
        }
      />
      <ListRow
        border="none"
        contents={<ListRow.Texts type="2RowTypeA" top="카테고리" bottom={CATEGORY_LABELS[sub.category]} />}
      />
      <ListRow
        border="none"
        contents={<ListRow.Texts type="2RowTypeA" top="메모" bottom={sub.memo || '메모가 없어요'} />}
      />

      <Spacing size={24} />

      <Paragraph.Text typography="t4">가격 이력</Paragraph.Text>
      <Spacing size={12} />
      {history.length === 0 ? (
        <Paragraph.Text typography="t6">가격 변동 기록이 없어요</Paragraph.Text>
      ) : (
        history.map((change) => (
          <ListRow
            key={change.id}
            border="none"
            data-testid="price-history-row"
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={formatDate(change.changedAt, 'long')}
                bottom={`${formatCurrencyKrw(change.amount)} · ${change.note}`}
              />
            }
          />
        ))
      )}

      <Spacing size={24} />

      <AlertDialog
        open={confirmDelete}
        title="구독을 삭제할까요?"
        description={`${sub.name} 구독과 가격 이력이 모두 삭제돼요`}
        alertButton={<AlertDialog.AlertButton onClick={handleConfirmDelete}>삭제</AlertDialog.AlertButton>}
        onClose={() => setConfirmDelete(false)}
      />
    </ScreenScaffold>
  );
}

import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Top, Paragraph, Spacing, ListRow, Asset } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { SummaryHero } from '../components/SummaryHero';
import { TossPurchase } from '../components/TossPurchase';
import { useSettings } from '../hooks/useSettings';
import type { RouteState } from '../lib/types';

const BENEFITS: { top: string; bottom: string }[] = [
  { top: '구독 무제한 등록', bottom: '3개 제한 없이 관리해요' },
  { top: '광고 제거', bottom: '광고 없이 화면을 봐요' },
  { top: '비교 리포트 상시 열람', bottom: '언제든 또래 비교를 확인해요' },
];

function fireHapticSuccess() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'success' })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

/**
 * 프리미엄 화면 — IAP로 구독 무제한/광고 제거/비교 리포트 상시 열람을 잠금 해제.
 */
export default function Premium() {
  const location = useLocation();
  const state = (location.state as RouteState['/premium']) ?? null;
  const { isPremium, update } = useSettings();
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  function handlePurchased() {
    setPurchaseError(null);
    void update({ isPremium: true, premiumGrantedAt: new Date().toISOString() });
  }

  return (
    <ScreenScaffold
      testId="screen-premium"
      top={<Top title={<Top.TitleParagraph>프리미엄</Top.TitleParagraph>} />}
      bottom={
        !isPremium ? (
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '12px 16px calc(var(--toss-safe-area-bottom) + 12px)',
              backgroundColor: 'var(--adaptiveBackground)',
            }}
          >
            <span onClickCapture={fireHapticSuccess}>
              <TossPurchase
                sku={import.meta.env.VITE_TOSS_IAP_SKU}
                className="premium-purchase-button"
                processProductGrant={async () => true}
                onPurchased={handlePurchased}
                onError={(e) => setPurchaseError(e instanceof Error ? e.message : '결제를 진행하지 못했어요')}
              >
                프리미엄 시작하기
              </TossPurchase>
            </span>
            {purchaseError ? (
              <>
                <Spacing size={4} />
                <Paragraph.Text typography="st12" color="var(--adaptiveRed500)">
                  {purchaseError}
                </Paragraph.Text>
              </>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {state?.source === 'limit' ? (
        <>
          <Paragraph.Text typography="st11">무료 플랜은 3개까지예요</Paragraph.Text>
          <Spacing size={8} />
        </>
      ) : null}

      <SummaryHero
        label="SubTrack 프리미엄"
        value={<Paragraph.Text typography="t1">프리미엄</Paragraph.Text>}
        caption="한 번 결제로 계속 사용해요"
      />

      <Spacing size={24} />

      <Card>
        {BENEFITS.map((benefit, index) => (
          <div key={benefit.top}>
            <ListRow
              left={<Asset.ContentIcon name="icon-check" alt="" />}
              contents={<ListRow.Texts type="2RowTypeA" top={benefit.top} bottom={benefit.bottom} />}
            />
            {index < BENEFITS.length - 1 ? <Spacing size={8} /> : null}
          </div>
        ))}
      </Card>

      {isPremium ? (
        <>
          <Spacing size={24} />
          <Card>
            <Paragraph.Text typography="t5">프리미엄 이용 중이에요</Paragraph.Text>
          </Card>
        </>
      ) : null}
    </ScreenScaffold>
  );
}

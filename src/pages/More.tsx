import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, ListRow, Chip, AlertDialog, BottomSheet } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { FloatingTabBar, type TabItem } from '../components/FloatingTabBar';
import { AdSlot } from '../components/AdSlot';
import { useSettings } from '../hooks/useSettings';
import { removeItem } from '../lib/storage';
import { STORAGE_KEYS } from '../lib/constants';
import type { AgeBand, RouteState } from '../lib/types';

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

const APP_VERSION = '0.1.0';

function fireTickHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'tickWeak' })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

/**
 * 더보기 화면 — 연령대 설정, 프리미엄 진입, 데이터 초기화, 앱 정보.
 */
export default function More() {
  const navigate = useNavigate();
  const { settings, isPremium, update } = useSettings();

  const [ageSheetOpen, setAgeSheetOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  function handleSelectAgeBand(value: Exclude<AgeBand, 'UNSET'>) {
    fireTickHaptic();
    void update({ ageBand: value });
    setAgeSheetOpen(false);
  }

  function handlePremiumClick() {
    fireTickHaptic();
    navigate('/premium', { state: { source: 'more' } as RouteState['/premium'] });
  }

  function handleConfirmReset() {
    removeItem(STORAGE_KEYS.subscriptions);
    removeItem(STORAGE_KEYS.checklists);
    removeItem(STORAGE_KEYS.settings);
    removeItem(STORAGE_KEYS.meta);
    setResetDialogOpen(false);
  }

  const ageBandLabel = settings.ageBand === 'UNSET' ? '설정 안 함' : settings.ageBand;

  return (
    <ScreenScaffold
      testId="screen-more"
      top={<Top title={<Top.TitleParagraph>더보기</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={TABS} activePath="/more" />}
    >
      <Card>
        <ListRow
          contents={<ListRow.Texts type="1RowTypeA" top="연령대" />}
          right={<Paragraph.Text typography="st11" data-testid="age-band-value">{ageBandLabel}</Paragraph.Text>}
          onClick={() => setAgeSheetOpen(true)}
        />
      </Card>

      <Spacing size={16} />

      <Card>
        <ListRow
          contents={<ListRow.Texts type="1RowTypeA" top="프리미엄" />}
          onClick={handlePremiumClick}
        />
      </Card>

      <Spacing size={16} />

      <Card>
        <ListRow
          contents={<ListRow.Texts type="1RowTypeA" top="데이터 초기화" />}
          onClick={() => setResetDialogOpen(true)}
        />
      </Card>

      <Spacing size={16} />

      <Card>
        <ListRow contents={<ListRow.Texts type="2RowTypeA" top="앱 정보" bottom={`버전 ${APP_VERSION}`} />} />
        <Spacing size={8} />
        <Paragraph.Text typography="st12" color="var(--tds-color-grey500)">
          SubTrack은 구독 관리를 돕는 도구이며, 제공된 정보는 참고용이에요.
        </Paragraph.Text>
      </Card>

      {!isPremium && (
        <>
          <Spacing size={16} />
          <AdSlot adGroupId="more-banner" />
        </>
      )}

      <Spacing size={24} />

      <BottomSheet
        open={ageSheetOpen}
        onDimmerClick={() => setAgeSheetOpen(false)}
        header={<BottomSheet.Header>연령대를 선택해주세요</BottomSheet.Header>}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0 16px' }}>
          {AGE_BANDS.map((band) => (
            <Chip
              key={band.value}
              variant={settings.ageBand === band.value ? 'fill' : 'weak'}
              onClick={() => handleSelectAgeBand(band.value)}
            >
              {band.label}
            </Chip>
          ))}
        </div>
      </BottomSheet>

      <AlertDialog
        open={resetDialogOpen}
        title="데이터를 초기화할까요?"
        description="구독, 체크리스트, 설정이 모두 삭제되고 되돌릴 수 없어요"
        alertButton={<AlertDialog.AlertButton onClick={handleConfirmReset}>초기화</AlertDialog.AlertButton>}
        onClose={() => setResetDialogOpen(false)}
      />
    </ScreenScaffold>
  );
}

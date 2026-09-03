import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Top, Paragraph, Spacing, ListRow, Switch } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SubmitFooter } from '../components/BottomCTA';
import { LoadingState } from '../components/StateView';
import { getChecklist, toggleChecklistItem } from '../domain/checklists';
import { readJson, writeJson } from '../domain/storage';
import { STORAGE_KEYS } from '../lib/constants';
import type { CancelChecklist, RouteState, Subscription } from '../lib/types';

function fireHaptic(type: 'success' | 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

function markCanceled(id: string): void {
  const subs = readJson<Subscription[]>(STORAGE_KEYS.subscriptions, []);
  const next = subs.map((sub) =>
    sub.id === id ? { ...sub, status: 'CANCELED' as const, updatedAt: new Date().toISOString() } : sub,
  );
  writeJson(STORAGE_KEYS.subscriptions, next);
}

/**
 * 해지 체크리스트 화면 — 구독별 5개 항목을 토글하며 확인하고, 완료 시 구독을 해지 처리한다.
 */
export default function Checklist() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [checklist, setChecklist] = useState<CancelChecklist | null>(null);

  useEffect(() => {
    if (!id) return;
    setChecklist(getChecklist(id));
  }, [id]);

  function handleToggle(itemId: string) {
    if (!id) return;
    fireHaptic('tickWeak');
    toggleChecklistItem(id, itemId);
    setChecklist(getChecklist(id));
  }

  function handleComplete() {
    if (!id) return;
    markCanceled(id);
    navigate(`/subscriptions/${id}`, {
      state: { subscriptionId: id } as RouteState['/subscriptions/:id'],
    });
  }

  const top = <Top title={<Top.TitleParagraph>해지 체크리스트</Top.TitleParagraph>} />;

  if (!id || !checklist) {
    return (
      <ScreenScaffold testId="screen-checklist" top={top}>
        <LoadingState testId="checklist-skeleton" rows={5} />
      </ScreenScaffold>
    );
  }

  const doneCount = checklist.items.filter((item) => item.done).length;

  return (
    <ScreenScaffold
      testId="screen-checklist"
      top={top}
      bottom={<SubmitFooter label="해지 완료로 표시" onClick={handleComplete} />}
    >
      <Paragraph.Text typography="st11">{`${doneCount}/${checklist.items.length} 완료`}</Paragraph.Text>
      <Spacing size={4} />
      <Paragraph.Text typography="st12" color="var(--tds-color-grey500)">
        해지 전에 확인할 것들이에요
      </Paragraph.Text>
      <Spacing size={16} />
      {checklist.items.map((item) => (
        <ListRow
          key={item.id}
          contents={<ListRow.Texts type="2RowTypeA" top={item.label} bottom={item.done ? '확인함' : '아직이에요'} />}
          right={<Switch checked={item.done} onChange={() => handleToggle(item.id)} />}
        />
      ))}
    </ScreenScaffold>
  );
}

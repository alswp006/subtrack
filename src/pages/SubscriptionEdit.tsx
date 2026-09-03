import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Top, Paragraph, Spacing, TextField, Tab, ListRow, Switch, Button } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SubmitFooter } from '../components/BottomCTA';
import { EmptyState, LoadingState } from '../components/StateView';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { readJson, writeJson, newId } from '../domain/storage';
import { getToday, isValidDateString, computeNextBillingDate, formatCurrencyKrw } from '../domain/calc';
import { STORAGE_KEYS, MAX_PRICE_HISTORY } from '../lib/constants';
import type { Subscription, BillingCycle, PriceChange, RouteState } from '../lib/types';

const NAME_MAX = 20;
const MEMO_MAX = 100;
const NOTE_MAX = 100;

type FieldErrors = Partial<Record<'name' | 'amount' | 'firstBillingDate' | 'memo' | 'priceNote', string>>;

function fireHaptic(type: 'tickWeak' | 'success') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

/**
 * 구독 수정 화면 — 기존 값을 프리필하고, 금액이 바뀐 경우에만 가격 변경 메모를 받아
 * priceHistory에 남긴다. 저장 후 인상이면 상세 화면에 인상 안내 토스트를 담아 돌아간다.
 */
export default function SubscriptionEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { status, items } = useSubscriptions();

  const sub = items.find((item) => item.id === id) ?? null;

  const [initializedId, setInitializedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [originalAmount, setOriginalAmount] = useState(0);
  const [firstBillingDate, setFirstBillingDate] = useState('');
  const [memo, setMemo] = useState('');
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [isActive, setIsActive] = useState(true);
  const [priceNote, setPriceNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (sub && initializedId !== sub.id) {
      setName(sub.name);
      setAmountStr(String(sub.amount));
      setOriginalAmount(sub.amount);
      setFirstBillingDate(sub.firstBillingDate);
      setMemo(sub.memo);
      setCycle(sub.cycle);
      setIsActive(sub.status === 'ACTIVE');
      setPriceNote('');
      setErrors({});
      setInitializedId(sub.id);
    }
  }, [sub, initializedId]);

  const amount = Number(amountStr.replace(/[^0-9]/g, ''));
  const amountChanged = initializedId !== null && amount !== originalAmount;

  useEffect(() => {
    if (!amountChanged) setPriceNote('');
  }, [amountChanged]);

  function handleSave() {
    if (!sub) return;

    const trimmedName = name.trim();
    const nextErrors: FieldErrors = {};

    if (trimmedName.length < 1) {
      nextErrors.name = '이름을 입력해 주세요';
    } else if (trimmedName.length > NAME_MAX) {
      nextErrors.name = `이름은 ${NAME_MAX}자 이하로 입력해 주세요`;
    }
    if (!amount || amount <= 0) {
      nextErrors.amount = '금액을 입력해 주세요';
    }
    if (!firstBillingDate || !isValidDateString(firstBillingDate)) {
      nextErrors.firstBillingDate = '결제일을 입력해 주세요';
    }
    if (memo.length > MEMO_MAX) {
      nextErrors.memo = `메모는 ${MEMO_MAX}자 이하로 입력해 주세요`;
    }
    if (priceNote.length > NOTE_MAX) {
      nextErrors.priceNote = `메모는 ${NOTE_MAX}자 이하로 입력해 주세요`;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const delta = amount - sub.amount;
    const nextBillingDate = computeNextBillingDate(firstBillingDate, cycle, getToday());
    const priceHistory = sub.priceHistory.slice();
    if (amountChanged) {
      const entry: PriceChange = {
        id: newId(),
        amount,
        changedAt: new Date().toISOString(),
        note: priceNote.trim(),
      };
      priceHistory.push(entry);
      if (priceHistory.length > MAX_PRICE_HISTORY) priceHistory.shift();
    }

    const updated: Subscription = {
      ...sub,
      name: trimmedName,
      amount,
      cycle,
      firstBillingDate,
      nextBillingDate,
      memo,
      status: isActive ? 'ACTIVE' : 'CANCELED',
      priceHistory,
      updatedAt: new Date().toISOString(),
    };

    const list = readJson<Subscription[]>(STORAGE_KEYS.subscriptions, []);
    const idx = list.findIndex((s) => s.id === sub.id);
    const nextList = idx === -1 ? [...list, updated] : list.map((s, i) => (i === idx ? updated : s));
    writeJson(STORAGE_KEYS.subscriptions, nextList);

    fireHaptic('success');

    const toastMessage =
      amountChanged && delta > 0
        ? `${formatCurrencyKrw(delta)} 올랐어요`
        : amountChanged && delta < 0
          ? `${formatCurrencyKrw(Math.abs(delta))} 내렸어요`
          : '구독 정보를 수정했어요';

    navigate(`/subscriptions/${sub.id}`, {
      state: { subscriptionId: sub.id, toastMessage } as RouteState['/subscriptions/:id'],
    });
  }

  const top = <Top title={<Top.TitleParagraph>구독 수정</Top.TitleParagraph>} />;

  if (status === 'loading') {
    return (
      <ScreenScaffold testId="screen-edit" top={top}>
        <LoadingState testId="edit-skeleton" rows={4} />
      </ScreenScaffold>
    );
  }

  if (!sub) {
    return (
      <ScreenScaffold testId="screen-edit" top={top}>
        <EmptyState
          testId="edit-not-found"
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

  return (
    <ScreenScaffold
      testId="screen-edit"
      top={top}
      bottom={<SubmitFooter label="변경사항 저장" onClick={handleSave} />}
    >
      <TextField
        variant="box"
        label="이름"
        placeholder="예: 넷플릭스"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setErrors((prev) => ({ ...prev, name: undefined }));
        }}
        hasError={!!errors.name}
        help={errors.name ?? `${NAME_MAX}자까지 입력할 수 있어요`}
      />

      <Spacing size={12} />

      <TextField
        variant="box"
        label="금액(원)"
        placeholder="예: 9,900"
        inputMode="numeric"
        value={amountStr}
        onChange={(e) => {
          setAmountStr(e.target.value);
          setErrors((prev) => ({ ...prev, amount: undefined }));
        }}
        hasError={!!errors.amount}
        help={errors.amount ?? '월/년 결제 금액을 입력해 주세요'}
      />

      <Spacing size={12} />

      <TextField
        variant="box"
        type="date"
        label="첫 결제일"
        placeholder="YYYY-MM-DD"
        value={firstBillingDate}
        onChange={(e) => {
          setFirstBillingDate(e.target.value);
          setErrors((prev) => ({ ...prev, firstBillingDate: undefined }));
        }}
        hasError={!!errors.firstBillingDate}
        help={errors.firstBillingDate ?? '결제일을 선택해 주세요'}
      />

      <Spacing size={12} />

      <TextField
        variant="box"
        label="메모"
        placeholder="예: 가족과 함께 써요"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        hasError={!!errors.memo}
        help={errors.memo ?? `${MEMO_MAX}자까지 입력할 수 있어요`}
      />

      <Spacing size={24} />

      <Paragraph.Text typography="t4">결제 주기</Paragraph.Text>
      <Spacing size={12} />
      <Tab onChange={(index) => setCycle(index === 0 ? 'MONTHLY' : 'YEARLY')}>
        <Tab.Item selected={cycle === 'MONTHLY'} onClick={() => setCycle('MONTHLY')}>
          매월
        </Tab.Item>
        <Tab.Item selected={cycle === 'YEARLY'} onClick={() => setCycle('YEARLY')}>
          매년
        </Tab.Item>
      </Tab>

      <Spacing size={24} />

      <ListRow
        border="none"
        contents={
          <ListRow.Texts type="2RowTypeA" top="구독 상태" bottom={isActive ? '이용 중' : '해지됨'} />
        }
        right={
          <Switch
            checked={isActive}
            onChange={(_e, checked) => {
              fireHaptic('tickWeak');
              setIsActive(checked);
            }}
          />
        }
      />

      {amountChanged && (
        <>
          <Spacing size={12} />
          <TextField
            variant="box"
            label="가격 변경 메모"
            placeholder="예: 요금제 인상 안내"
            data-testid="price-note-input"
            value={priceNote}
            onChange={(e) => {
              setPriceNote(e.target.value);
              setErrors((prev) => ({ ...prev, priceNote: undefined }));
            }}
            hasError={!!errors.priceNote}
            help={errors.priceNote ?? '100자까지 입력할 수 있어요'}
          />
        </>
      )}

      <Spacing size={24} />
    </ScreenScaffold>
  );
}

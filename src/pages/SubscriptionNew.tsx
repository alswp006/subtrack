import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, Chip, TextField, Tab, AlertDialog } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SubmitFooter } from '../components/BottomCTA';
import { SERVICE_TEMPLATES } from '../lib/constants';
import { saveSubscription, listSubscriptions, type SubscriptionInput } from '../domain/subscriptions';
import { getToday } from '../domain/calc';
import { formatCurrency } from '../lib/utils';
import type { BillingCycle, RouteState } from '../lib/types';

const CUSTOM_KEY = 'custom';
const NAME_MAX = 20;
const MEMO_MAX = 100;

type FieldErrors = Partial<Record<'name' | 'amount' | 'firstBillingDate' | 'memo', string>>;

function fireHaptic(type: 'tickWeak' | 'success') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

/**
 * 구독 등록 화면 — 템플릿 Chip으로 빠르게 채우거나 '직접 입력'으로 자유 입력한다.
 * 동일 name+amount 조합이 이미 있으면 저장 전에 AlertDialog로 한 번 더 확인한다.
 */
export default function SubscriptionNew() {
  const navigate = useNavigate();

  const [selectedKey, setSelectedKey] = useState<string>(CUSTOM_KEY);
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [firstBillingDate, setFirstBillingDate] = useState(getToday());
  const [memo, setMemo] = useState('');
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pendingInput, setPendingInput] = useState<SubscriptionInput | null>(null);

  function handleSelectTemplate(templateName: string, key: string) {
    fireHaptic('tickWeak');
    setSelectedKey(key);
    setName(templateName);
    setErrors((prev) => ({ ...prev, name: undefined }));
  }

  function handleSelectCustom() {
    fireHaptic('tickWeak');
    setSelectedKey(CUSTOM_KEY);
    setName('');
    setErrors((prev) => ({ ...prev, name: undefined }));
  }

  function commitSave(input: SubscriptionInput) {
    const result = saveSubscription(input);
    if (!result.ok) {
      setErrors((prev) => ({ ...prev, ...(result.error === 'VALIDATION' ? { name: '입력값을 다시 확인해 주세요' } : {}) }));
      return;
    }
    navigate('/', { state: { toastMessage: '구독을 등록했어요' } as RouteState['/'] });
  }

  function handleSavePress() {
    const trimmedName = name.trim();
    const amount = Number(amountStr.replace(/[^0-9]/g, ''));
    const nextErrors: FieldErrors = {};

    if (trimmedName.length < 1) {
      nextErrors.name = '이름을 입력해 주세요';
    } else if (trimmedName.length > NAME_MAX) {
      nextErrors.name = `이름은 ${NAME_MAX}자 이하로 입력해 주세요`;
    }
    if (!amount || amount <= 0) {
      nextErrors.amount = '금액을 입력해 주세요';
    }
    if (!firstBillingDate || firstBillingDate < getToday()) {
      nextErrors.firstBillingDate = '오늘 이후 날짜를 선택해 주세요';
    }
    if (memo.length > MEMO_MAX) {
      nextErrors.memo = `메모는 ${MEMO_MAX}자 이하로 입력해 주세요`;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input: SubscriptionInput = { name: trimmedName, amount, firstBillingDate, memo };
    const isDuplicate = listSubscriptions().some((s) => s.name === trimmedName && s.amount === amount);
    if (isDuplicate) {
      setPendingInput(input);
      return;
    }
    commitSave(input);
  }

  function handleConfirmDuplicate() {
    if (!pendingInput) return;
    const input = pendingInput;
    setPendingInput(null);
    commitSave(input);
  }

  return (
    <ScreenScaffold
      testId="screen-new"
      top={<Top title={<Top.TitleParagraph>구독 등록</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="구독 저장" onClick={handleSavePress} />}
    >
      <Paragraph.Text typography="t4">서비스 선택</Paragraph.Text>
      <Spacing size={12} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {SERVICE_TEMPLATES.map((template) => (
          <Chip
            key={template.key}
            variant={selectedKey === template.key ? 'fill' : 'weak'}
            onClick={() => handleSelectTemplate(template.name, template.key)}
          >
            {template.name}
          </Chip>
        ))}
        <Chip variant={selectedKey === CUSTOM_KEY ? 'fill' : 'weak'} onClick={handleSelectCustom}>
          직접 입력
        </Chip>
      </div>

      <Spacing size={24} />

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
        help={errors.firstBillingDate ?? '오늘 이후 날짜를 선택할 수 있어요'}
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

      <AlertDialog
        open={pendingInput !== null}
        title="이미 등록된 구독이에요"
        description={
          pendingInput ? `${pendingInput.name} · ${formatCurrency(pendingInput.amount)}이 이미 있어요. 그대로 등록할까요?` : ''
        }
        alertButton={
          <AlertDialog.AlertButton onClick={handleConfirmDuplicate}>그대로 등록</AlertDialog.AlertButton>
        }
        onClose={() => setPendingInput(null)}
      />
    </ScreenScaffold>
  );
}

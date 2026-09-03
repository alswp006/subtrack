import { useNavigate, useParams } from 'react-router-dom';
import { Top, Button } from '@toss/tds-mobile';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { EmptyState } from '../components/StateView';

/**
 * 해지 체크리스트 화면 — 스텁. 상세 화면의 '해지 체크리스트' 버튼이 가리키는 대상이 없어
 * 흰 화면이 되는 것을 막기 위한 자리표시자. 실제 체크리스트는 후속 패킷에서 채운다.
 */
export default function CancelChecklist() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  return (
    <ScreenScaffold
      testId="screen-cancel-checklist"
      top={<Top title={<Top.TitleParagraph>해지 체크리스트</Top.TitleParagraph>} />}
    >
      <EmptyState
        testId="checklist-coming-soon"
        title="체크리스트를 준비하고 있어요"
        description="조금만 기다려 주세요"
        action={
          <Button variant="weak" display="block" onClick={() => navigate(id ? `/subscriptions/${id}` : '/')}>
            상세로 돌아가기
          </Button>
        }
      />
    </ScreenScaffold>
  );
}

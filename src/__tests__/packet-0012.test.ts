import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { Routes, Route } from "react-router-dom";
import { screen, within, fireEvent, waitFor } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS } from "@/lib/constants";
import type { Subscription } from "@/lib/types";

mockAll();

import SubscriptionDetail from "@/pages/SubscriptionDetail";

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.id ?? "sub-1",
    name: "넷플릭스",
    category: "OTT",
    iconKey: "netflix",
    amount: 9900,
    cycle: "MONTHLY",
    firstBillingDate: "2026-08-04",
    nextBillingDate: "2099-01-04",
    memo: "가족과 함께 공유 중",
    status: "ACTIVE",
    priceHistory: [],
    createdAt: "2026-08-04T00:00:00Z",
    updatedAt: "2026-08-04T00:00:00Z",
    ...overrides,
  };
}

// SubscriptionDetail은 useParams로 라우트 param을 읽으므로, 실제 <Route path="/subscriptions/:id">
// 매칭 안에서 렌더해야 id가 주입된다.
function renderDetail(id: string) {
  return renderWithRouter(
    React.createElement(
      Routes,
      null,
      React.createElement(Route, {
        path: "/subscriptions/:id",
        element: React.createElement(SubscriptionDetail),
      }),
    ),
    { initialEntries: [`/subscriptions/${id}`] },
  );
}

describe("구독 상세 화면 /subscriptions/:id [packet-0012]", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // ========== AC-1 ==========
  describe("AC-1: 존재하지 않는 id로 진입하면 크래시 없이 안내 + 대시보드 이동 버튼이 렌더된다", () => {
    it("AC-1[P0]: shows '구독을 찾을 수 없어요' and a '대시보드로' button when no subscription matches the id", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1" })] });

      renderDetail("missing-id");

      await waitFor(() => {
        expect(screen.getByText("구독을 찾을 수 없어요")).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: "대시보드로" })).toBeInTheDocument();
      expect(screen.queryByText("가족과 함께 공유 중")).not.toBeInTheDocument();
    });

    it("AC-1[P0]: clicking '대시보드로' navigates to '/'", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [] });

      renderDetail("missing-id");

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "대시보드로" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "대시보드로" }));

      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  // ========== AC-2 ==========
  describe("AC-2: 가격 이력이 있으면 최신순 ListRow, 없으면 안내 문구가 표시된다", () => {
    it("AC-2[P0]: renders each price history entry (changedAt/amount/note) with the most recent change first", async () => {
      const sub = makeSub({
        id: "sub-1",
        amount: 12000,
        priceHistory: [
          { id: "ph-1", amount: 9900, changedAt: "2026-01-01T00:00:00Z", note: "첫 결제" },
          { id: "ph-2", amount: 12000, changedAt: "2026-06-01T00:00:00Z", note: "가격 인상" },
        ],
      });
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [sub] });

      renderDetail("sub-1");

      await waitFor(() => {
        expect(screen.getByText("넷플릭스")).toBeInTheDocument();
      });

      // 기본 정보도 함께 렌더된다 (이름/금액/메모)
      expect(screen.getByText((12000).toLocaleString("ko-KR") + "원")).toBeInTheDocument();
      expect(screen.getByText("가족과 함께 공유 중")).toBeInTheDocument();

      const rows = screen.getAllByTestId("price-history-row");
      expect(rows).toHaveLength(2);
      expect(rows[0].textContent).toContain("가격 인상");
      expect(rows[0].textContent).toContain((12000).toLocaleString("ko-KR"));
      expect(rows[1].textContent).toContain("첫 결제");
    });

    it("AC-2[P0]: shows '가격 변동 기록이 없어요' when priceHistory is empty", async () => {
      seedLocalStorage({
        [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1", priceHistory: [] })],
      });

      renderDetail("sub-1");

      await waitFor(() => {
        expect(screen.getByText("넷플릭스")).toBeInTheDocument();
      });

      expect(screen.getByText("가격 변동 기록이 없어요")).toBeInTheDocument();
      expect(screen.queryAllByTestId("price-history-row")).toHaveLength(0);
    });
  });

  // ========== AC-3 ==========
  describe("AC-3: '해지 체크리스트' 탭 시 state와 함께 체크리스트 화면으로 이동한다", () => {
    it("AC-3[P0]: navigates to /subscriptions/:id/checklist with state {subscriptionId, from: 'detail'}", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1" })] });

      renderDetail("sub-1");

      await waitFor(() => {
        expect(screen.getByText("넷플릭스")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "해지 체크리스트" }));

      expect(mockNavigate).toHaveBeenCalledWith("/subscriptions/sub-1/checklist", {
        state: { subscriptionId: "sub-1", from: "detail" },
      });
    });
  });

  // ========== AC-4 ==========
  describe("AC-4: 삭제 버튼 탭 시 AlertDialog가 뜨고, 확인해야 삭제 후 '/'로 이동한다", () => {
    it("AC-4[P0]: tapping the delete action opens an AlertDialog with a '닫기' left button, and closing it cancels without deleting or navigating", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1" })] });

      renderDetail("sub-1");

      await waitFor(() => {
        expect(screen.getByText("넷플릭스")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "구독 삭제" }));

      const dialog = screen.getByRole("alertdialog");
      expect(within(dialog).getByRole("button", { name: "닫기" })).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.subscriptions) ?? "[]");
      expect(stored).toHaveLength(1);
    });

    it("AC-4[P0]: confirming the AlertDialog deletes the subscription and navigates to '/' with toast state", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1" })] });

      renderDetail("sub-1");

      await waitFor(() => {
        expect(screen.getByText("넷플릭스")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "구독 삭제" }));
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/", {
          state: { toastMessage: "구독을 삭제했어요" },
        });
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.subscriptions) ?? "[]");
      expect(stored).toHaveLength(0);
    });
  });

  // ========== AC-5 ==========
  describe("AC-5: 루트가 ScreenScaffold(screen-detail)이고 location.state는 null 가드된다", () => {
    it("AC-5[P0]: root carries data-testid='screen-detail'", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1" })] });

      renderDetail("sub-1");

      await waitFor(() => {
        expect(screen.getByTestId("screen-detail")).toBeInTheDocument();
      });
    });

    it("AC-5[P0]: renders without crashing when location.state is null and the id is resolved from the route param instead", async () => {
      // mockRouter()의 useLocation은 항상 { state: null }을 반환한다 — 직접 URL 접근/새로고침 재현
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1" })] });

      renderDetail("sub-1");

      await waitFor(() => {
        expect(screen.getByTestId("screen-detail")).toBeInTheDocument();
      });

      expect(screen.getByText("넷플릭스")).toBeInTheDocument();
    });
  });
});

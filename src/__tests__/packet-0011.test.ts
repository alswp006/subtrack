import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { screen, within, fireEvent, waitFor } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS, SERVICE_TEMPLATES } from "@/lib/constants";
import { listSubscriptions } from "@/domain/subscriptions";

mockAll();

import * as appsInToss from "@apps-in-toss/web-framework";
import SubscriptionNew from "@/pages/SubscriptionNew";

const SOURCE_FILE = path.resolve(__dirname, "../pages/SubscriptionNew.tsx");

// 저장 성공 시 navigate state — types.ts의 RouteState['/']는 { toastMessage: string }를 쓴다
// (packet 프롬프트는 { toast: ... }라 적었지만, CLAUDE.md 규칙 7 "RouteState 타입 확인"에 따라
// 이미 고정된 src/lib/types.ts 계약을 따른다).
const SAVE_TOAST_STATE = { toastMessage: "구독을 등록했어요" };

function getNameInput(): HTMLInputElement {
  return screen.getByPlaceholderText("예: 넷플릭스") as HTMLInputElement;
}

function getAmountInput(): HTMLInputElement {
  return screen.getByPlaceholderText("예: 9,900") as HTMLInputElement;
}

function getDateInput(): HTMLInputElement {
  const input = document.querySelector('input[type="date"]');
  expect(input).not.toBeNull();
  return input as HTMLInputElement;
}

const FUTURE_DATE = "2099-01-01";

function fillValidForm(name: string, amount: string) {
  fireEvent.click(screen.getByRole("button", { name: "직접 입력" }));
  fireEvent.change(getNameInput(), { target: { value: name } });
  fireEvent.change(getAmountInput(), { target: { value: amount } });
  fireEvent.change(getDateInput(), { target: { value: FUTURE_DATE } });
}

describe("구독 등록 화면 /subscriptions/new [packet-0011]", () => {
  beforeEach(() => {
    (appsInToss.generateHapticFeedback as ReturnType<typeof vi.fn>).mockClear();
    mockNavigate.mockClear();
  });

  // ========== AC-1 ==========
  describe("AC-1: 템플릿 Chip 선택 시 이름 자동 채움, '직접 입력' 선택 시 초기화+편집 가능", () => {
    it("AC-1[P0]: selecting the '넷플릭스' template chip fills the name field with '넷플릭스'", () => {
      renderWithRouter(React.createElement(SubscriptionNew));

      expect(SERVICE_TEMPLATES[0].name).toBe("넷플릭스");
      fireEvent.click(screen.getByRole("button", { name: "넷플릭스" }));

      expect(getNameInput().value).toBe("넷플릭스");
    });

    it("AC-1[P0]: switching to '직접 입력' clears the name field and makes it freely editable", () => {
      renderWithRouter(React.createElement(SubscriptionNew));

      fireEvent.click(screen.getByRole("button", { name: "넷플릭스" }));
      expect(getNameInput().value).toBe("넷플릭스");

      fireEvent.click(screen.getByRole("button", { name: "직접 입력" }));
      expect(getNameInput().value).toBe("");

      fireEvent.change(getNameInput(), { target: { value: "왓챠 프리미엄" } });
      expect(getNameInput().value).toBe("왓챠 프리미엄");
    });
  });

  // ========== AC-2 ==========
  describe("AC-2: 이름 빈 값 또는 금액 0 이하이면 저장 시 인라인 에러가 표시되고 이동하지 않는다", () => {
    it("AC-2[P0]: empty name shows a name-field error on save and does not navigate", () => {
      renderWithRouter(React.createElement(SubscriptionNew));

      fireEvent.click(screen.getByRole("button", { name: "직접 입력" }));
      fireEvent.change(getAmountInput(), { target: { value: "9900" } });
      fireEvent.change(getDateInput(), { target: { value: FUTURE_DATE } });

      fireEvent.click(screen.getByRole("button", { name: "구독 저장" }));

      expect(screen.getByText("이름을 입력해 주세요")).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("AC-2[P0]: amount of 0 shows an amount-field error on save and does not navigate", () => {
      renderWithRouter(React.createElement(SubscriptionNew));

      fireEvent.click(screen.getByRole("button", { name: "직접 입력" }));
      fireEvent.change(getNameInput(), { target: { value: "왓챠" } });
      fireEvent.change(getAmountInput(), { target: { value: "0" } });
      fireEvent.change(getDateInput(), { target: { value: FUTURE_DATE } });

      fireEvent.click(screen.getByRole("button", { name: "구독 저장" }));

      expect(screen.getByText("금액을 입력해 주세요")).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // ========== AC-3 ==========
  describe("AC-3: 유효 입력 저장 시 haptic success 후 '/'로 이동하고 목록에 반영된다", () => {
    it("AC-3[P0]: valid save fires success haptic, navigates to '/' with toast state, and persists the item", async () => {
      renderWithRouter(React.createElement(SubscriptionNew));

      fillValidForm("왓챠 프리미엄", "9900");
      fireEvent.click(screen.getByRole("button", { name: "구독 저장" }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/", { state: SAVE_TOAST_STATE });
      });

      expect(appsInToss.generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });

      const stored = listSubscriptions();
      expect(stored.some((s) => s.name === "왓챠 프리미엄" && s.amount === 9900)).toBe(true);
    });
  });

  // ========== AC-4 ==========
  describe("AC-4: 동일 name+amount+cycle 조합이 있으면 AlertDialog가 뜨고 확인해야 저장된다", () => {
    beforeEach(() => {
      seedLocalStorage({
        [STORAGE_KEYS.subscriptions]: [
          {
            id: "existing-1",
            name: "왓챠 프리미엄",
            amount: 9900,
            firstBillingDate: "2026-01-01",
            nextBillingDate: "2026-02-01",
            memo: "",
            priceHistory: [],
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
      });
    });

    it("AC-4[P0]: duplicate name+amount opens an AlertDialog with a '닫기' left button, and closing it cancels the save", () => {
      renderWithRouter(React.createElement(SubscriptionNew));
      fillValidForm("왓챠 프리미엄", "9900");

      fireEvent.click(screen.getByRole("button", { name: "구독 저장" }));

      const dialog = screen.getByRole("alertdialog");
      expect(within(dialog).getByRole("button", { name: "닫기" })).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("AC-4[P0]: confirming the duplicate AlertDialog proceeds to save and navigate", async () => {
      renderWithRouter(React.createElement(SubscriptionNew));
      fillValidForm("왓챠 프리미엄", "9900");

      fireEvent.click(screen.getByRole("button", { name: "구독 저장" }));
      const dialog = screen.getByRole("alertdialog");

      fireEvent.click(within(dialog).getByRole("button", { name: "그대로 등록" }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/", { state: SAVE_TOAST_STATE });
      });

      const stored = listSubscriptions();
      expect(stored.filter((s) => s.name === "왓챠 프리미엄" && s.amount === 9900).length).toBe(2);
    });
  });

  // ========== AC-5 ==========
  describe("AC-5: 루트가 ScreenScaffold(screen-new)이고 HEX 색상 리터럴이 없다", () => {
    it("AC-5[P0]: root carries data-testid='screen-new' and the source file has zero HEX literals", () => {
      renderWithRouter(React.createElement(SubscriptionNew));

      expect(screen.getByTestId("screen-new")).toBeInTheDocument();

      const source = fs.readFileSync(SOURCE_FILE, "utf-8");
      const hexPattern = /#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?(?![0-9A-Za-z])/;
      expect(source).not.toMatch(hexPattern);
    });
  });
});

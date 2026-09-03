import { describe, it } from "vitest";
import React from "react";
import { screen } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS } from "@/lib/constants";
import { getToday } from "@/domain/calc";

mockTds();
mockAppsInToss();
mockTossRewardAd();
const mockNavigate = () => {};
import * as rrd from "react-router-dom";

import Home from "@/pages/Home";

describe("debug", () => {
  it("shows toast", async () => {
    seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [{ id: "sub-7", name: "넷플릭스", category: "OTT", iconKey: "netflix", amount: 13500, cycle: "MONTHLY", firstBillingDate: "2026-08-04", nextBillingDate: getToday(), memo: "", status: "ACTIVE", priceHistory: [], createdAt: "2026-08-04T00:00:00Z", updatedAt: "2026-08-04T00:00:00Z" }] });
    renderWithRouter(React.createElement(Home), {
      initialEntries: [{ pathname: "/", state: { toastMessage: "구독을 등록했어요" } }],
    });
    await new Promise((r) => setTimeout(r, 50));
    console.log(document.body.innerHTML.includes("구독을 등록했어요"));
    console.log(document.body.innerHTML);
  });
});

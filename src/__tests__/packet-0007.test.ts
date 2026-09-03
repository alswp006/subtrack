import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Subscription, AppSettings } from "@/lib/types";

// ============================================================================
// MOCKS: localStorage, useNavigate, TDS, AppState
// ============================================================================

const mockStorage = new Map<string, string>();

beforeEach(() => {
  mockStorage.clear();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) =>
    mockStorage.get(key) || null
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
    mockStorage.set(key, value);
  });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key) => {
    mockStorage.delete(key);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Mock TDS to prevent jsdom crashes
vi.mock("@toss/tds-mobile", () => ({
  Button: ({ children, onClick, ...props }: any) =>
    React.createElement("button", { onClick, ...props }, children),
  FixedBottomCTA: ({ children, onClick, disabled, loading, ...props }: any) =>
    React.createElement("button", { onClick, disabled: disabled || loading || undefined, ...props }, children),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Helper to wrap hook with MemoryRouter
function renderHookWithRouter<T>(hook: () => T) {
  return renderHook(hook, {
    wrapper: ({ children }) => React.createElement(MemoryRouter, {}, children),
  });
}

// Hook type stubs for runtime type checking
interface UseSubscriptionsReturn {
  status: "loading" | "ready" | "error";
  items: Subscription[];
  totalMonthly: number;
  activeCount: number;
  canceledCount: number;
  upcoming: Subscription[];
  reload: () => void;
  remove: (id: string) => Promise<void>;
}

interface UseSettingsReturn {
  settings: AppSettings;
  isPremium: boolean;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

// ============================================================================
// TEST SUITE: useSubscriptions 훅 (아직 구현되지 않음)
// ============================================================================

describe("상태 훅 useSubscriptions / useSettings [packet-0007]", () => {
  describe("useSubscriptions: AC-1 Loading State (P0)", () => {
    it("AC-1[P0]: should return status='loading' on first render", () => {
      // Hook not yet implemented — this test will fail on import
      const useSubscriptions = require("@/hooks/useSubscriptions").useSubscriptions;
      const { result } = renderHookWithRouter(useSubscriptions);

      expect(result.current.status).toBe("loading");
      expect(result.current.items).toBeDefined();
      expect(result.current.totalMonthly).toBe(0);
    });

    it("AC-1[P0]: should transition to status='ready' after effect runs", async () => {
      const useSubscriptions = require("@/hooks/useSubscriptions").useSubscriptions;
      const { result } = renderHookWithRouter(useSubscriptions);

      expect(result.current.status).toBe("loading");

      await waitFor(() => {
        expect(result.current.status).toBe("ready");
      }, { timeout: 1000 });
    });
  });

  describe("useSubscriptions: AC-2 totalMonthly Calculation (P0)", () => {
    it("AC-2[P0]: should sum only ACTIVE subscriptions for totalMonthly (exclude CANCELED)", async () => {
      // Setup: ACTIVE [10000, 15000] + CANCELED [5000]
      const mockSubs = [
        {
          id: "sub-1",
          name: "Netflix",
          amount: 10000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-10-04",
          memo: "",
          status: "ACTIVE" as const,
          category: "OTT" as const,
          iconKey: "netflix",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
        {
          id: "sub-2",
          name: "Spotify",
          amount: 15000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-10-04",
          memo: "",
          status: "ACTIVE" as const,
          category: "MUSIC" as const,
          iconKey: "spotify",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
        {
          id: "sub-3",
          name: "Canceled",
          amount: 5000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-10-04",
          memo: "",
          status: "CANCELED" as const,
          category: "ETC" as const,
          iconKey: "generic",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
      ];
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify(mockSubs));

      const useSubscriptions = require("@/hooks/useSubscriptions").useSubscriptions;
      const { result } = renderHookWithRouter(useSubscriptions);

      await waitFor(() => {
        expect(result.current.status).toBe("ready");
      });

      expect(result.current.totalMonthly).toBe(25000);
      expect(result.current.activeCount).toBe(2);
      expect(result.current.canceledCount).toBe(1);
    });

    it("AC-2[P0]: should return 0 totalMonthly when no ACTIVE subscriptions exist", async () => {
      const mockSubs = [
        {
          id: "sub-1",
          name: "Canceled",
          amount: 5000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-10-04",
          memo: "",
          status: "CANCELED" as const,
          category: "ETC" as const,
          iconKey: "generic",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
      ];
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify(mockSubs));

      const useSubscriptions = require("@/hooks/useSubscriptions").useSubscriptions;
      const { result } = renderHookWithRouter(useSubscriptions);

      await waitFor(() => {
        expect(result.current.status).toBe("ready");
      });

      expect(result.current.totalMonthly).toBe(0);
      expect(result.current.activeCount).toBe(0);
      expect(result.current.canceledCount).toBe(1);
    });
  });

  describe("useSubscriptions: AC-3 Upcoming Sorting (P0)", () => {
    it("AC-3[P0]: should sort upcoming by nextBillingDate in ascending order", async () => {
      const mockSubs = [
        {
          id: "sub-1",
          name: "Netflix",
          amount: 10000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-09-15",
          memo: "",
          status: "ACTIVE" as const,
          category: "OTT" as const,
          iconKey: "netflix",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
        {
          id: "sub-2",
          name: "Spotify",
          amount: 15000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-09-05",
          memo: "",
          status: "ACTIVE" as const,
          category: "MUSIC" as const,
          iconKey: "spotify",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
        {
          id: "sub-3",
          name: "Cloud",
          amount: 5000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-09-10",
          memo: "",
          status: "ACTIVE" as const,
          category: "CLOUD" as const,
          iconKey: "drive",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
      ];
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify(mockSubs));

      const useSubscriptions = require("@/hooks/useSubscriptions").useSubscriptions;
      const { result } = renderHookWithRouter(useSubscriptions);

      await waitFor(() => {
        expect(result.current.status).toBe("ready");
      });

      expect(result.current.upcoming).toHaveLength(3);
      expect(result.current.upcoming[0].nextBillingDate).toBe("2026-09-05");
      expect(result.current.upcoming[0].id).toBe("sub-2");
      expect(result.current.upcoming[1].nextBillingDate).toBe("2026-09-10");
      expect(result.current.upcoming[1].id).toBe("sub-3");
      expect(result.current.upcoming[2].nextBillingDate).toBe("2026-09-15");
      expect(result.current.upcoming[2].id).toBe("sub-1");
    });

    it("AC-3[P0]: should place items with empty nextBillingDate at the end", async () => {
      const mockSubs = [
        {
          id: "sub-1",
          name: "Netflix",
          amount: 10000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-09-05",
          memo: "",
          status: "ACTIVE" as const,
          category: "OTT" as const,
          iconKey: "netflix",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
        {
          id: "sub-2",
          name: "Broken1",
          amount: 5000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "",
          memo: "",
          status: "ACTIVE" as const,
          category: "ETC" as const,
          iconKey: "generic",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
        {
          id: "sub-3",
          name: "Cloud",
          amount: 5000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-09-10",
          memo: "",
          status: "ACTIVE" as const,
          category: "CLOUD" as const,
          iconKey: "drive",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
        {
          id: "sub-4",
          name: "Broken2",
          amount: 5000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "",
          memo: "",
          status: "ACTIVE" as const,
          category: "ETC" as const,
          iconKey: "generic",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
      ];
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify(mockSubs));

      const useSubscriptions = require("@/hooks/useSubscriptions").useSubscriptions;
      const { result } = renderHookWithRouter(useSubscriptions);

      await waitFor(() => {
        expect(result.current.status).toBe("ready");
      });

      expect(result.current.upcoming).toHaveLength(4);
      expect(result.current.upcoming[0].nextBillingDate).toBe("2026-09-05");
      expect(result.current.upcoming[1].nextBillingDate).toBe("2026-09-10");
      expect(result.current.upcoming[2].nextBillingDate).toBe("");
      expect(result.current.upcoming[3].nextBillingDate).toBe("");
    });
  });

  describe("useSubscriptions: AC-4 Remove and Persistence (P0)", () => {
    it("AC-4[P0]: should remove item from items after remove(id) call", async () => {
      const mockSubs = [
        {
          id: "sub-1",
          name: "Netflix",
          amount: 10000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-10-04",
          memo: "",
          status: "ACTIVE" as const,
          category: "OTT" as const,
          iconKey: "netflix",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
        {
          id: "sub-2",
          name: "Spotify",
          amount: 15000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-10-04",
          memo: "",
          status: "ACTIVE" as const,
          category: "MUSIC" as const,
          iconKey: "spotify",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
      ];
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify(mockSubs));

      const useSubscriptions = require("@/hooks/useSubscriptions").useSubscriptions;
      const { result } = renderHookWithRouter(useSubscriptions);

      await waitFor(() => {
        expect(result.current.status).toBe("ready");
      });

      expect(result.current.items).toHaveLength(2);
      const idToRemove = result.current.items[0].id;

      await act(async () => {
        await result.current.remove(idToRemove);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items.find((i) => i.id === idToRemove)).toBeUndefined();
      expect(result.current.items[0].id).toBe("sub-2");
    });

    it("AC-4[P0]: should persist deletion to storage (survive reload)", async () => {
      const mockSubs = [
        {
          id: "sub-1",
          name: "Netflix",
          amount: 10000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-10-04",
          memo: "",
          status: "ACTIVE" as const,
          category: "OTT" as const,
          iconKey: "netflix",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
      ];
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify(mockSubs));

      const useSubscriptions = require("@/hooks/useSubscriptions").useSubscriptions;
      const { result: result1 } = renderHookWithRouter(useSubscriptions);

      await waitFor(() => {
        expect(result1.current.status).toBe("ready");
      });

      const idToRemove = result1.current.items[0].id;

      await act(async () => {
        await result1.current.remove(idToRemove);
      });

      // Check storage was persisted
      const stored = JSON.parse(mockStorage.get("subtrack.subscriptions.v1") || "[]");
      expect(stored.find((s: any) => s.id === idToRemove)).toBeUndefined();
      expect(stored).toHaveLength(0);
    });

    it("AC-4[P0]: should not throw when removing non-existent id", async () => {
      const mockSubs = [
        {
          id: "sub-1",
          name: "Netflix",
          amount: 10000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-10-04",
          memo: "",
          status: "ACTIVE" as const,
          category: "OTT" as const,
          iconKey: "netflix",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
      ];
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify(mockSubs));

      const useSubscriptions = require("@/hooks/useSubscriptions").useSubscriptions;
      const { result } = renderHookWithRouter(useSubscriptions);

      await waitFor(() => {
        expect(result.current.status).toBe("ready");
      });

      const lengthBefore = result.current.items.length;

      await act(async () => {
        await result.current.remove("non-existent-id");
      });

      expect(result.current.items).toHaveLength(lengthBefore);
    });
  });

  describe("useSubscriptions: activeCount & canceledCount", () => {
    it("should correctly count ACTIVE subscriptions", async () => {
      const mockSubs = [
        {
          id: "sub-1",
          name: "Netflix",
          amount: 10000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-10-04",
          memo: "",
          status: "ACTIVE" as const,
          category: "OTT" as const,
          iconKey: "netflix",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
        {
          id: "sub-2",
          name: "Spotify",
          amount: 15000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-10-04",
          memo: "",
          status: "ACTIVE" as const,
          category: "MUSIC" as const,
          iconKey: "spotify",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
        {
          id: "sub-3",
          name: "Canceled",
          amount: 5000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-10-04",
          memo: "",
          status: "CANCELED" as const,
          category: "ETC" as const,
          iconKey: "generic",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
      ];
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify(mockSubs));

      const useSubscriptions = require("@/hooks/useSubscriptions").useSubscriptions;
      const { result } = renderHookWithRouter(useSubscriptions);

      await waitFor(() => {
        expect(result.current.status).toBe("ready");
      });

      expect(result.current.activeCount).toBe(2);
    });

    it("should correctly count CANCELED subscriptions", async () => {
      const mockSubs = [
        {
          id: "sub-1",
          name: "Netflix",
          amount: 10000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-10-04",
          memo: "",
          status: "ACTIVE" as const,
          category: "OTT" as const,
          iconKey: "netflix",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
        {
          id: "sub-2",
          name: "Spotify",
          amount: 15000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-10-04",
          memo: "",
          status: "ACTIVE" as const,
          category: "MUSIC" as const,
          iconKey: "spotify",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
        {
          id: "sub-3",
          name: "Canceled",
          amount: 5000,
          cycle: "MONTHLY" as const,
          firstBillingDate: "2026-09-04",
          nextBillingDate: "2026-10-04",
          memo: "",
          status: "CANCELED" as const,
          category: "ETC" as const,
          iconKey: "generic",
          priceHistory: [],
          createdAt: "2026-09-04T00:00:00Z",
          updatedAt: "2026-09-04T00:00:00Z",
        },
      ];
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify(mockSubs));

      const useSubscriptions = require("@/hooks/useSubscriptions").useSubscriptions;
      const { result } = renderHookWithRouter(useSubscriptions);

      await waitFor(() => {
        expect(result.current.status).toBe("ready");
      });

      expect(result.current.canceledCount).toBe(1);
    });
  });

  // ============================================================================
  // TEST SUITE: useSettings 훅 (아직 구현되지 않음)
  // ============================================================================

  describe("useSettings: Basic State Management", () => {
    it("should return default settings when none exist in storage", () => {
      // Empty storage — should return defaults
      const useSettings = require("@/hooks/useSettings").useSettings;
      const { result } = renderHookWithRouter(useSettings);

      expect(result.current.settings.ageBand).toBe("UNSET");
      expect(result.current.settings.isPremium).toBe(false);
      expect(result.current.settings.premiumGrantedAt).toBeNull();
      expect(result.current.settings.compareUnlockedAt).toBeNull();
    });

    it("should load settings from storage on mount", () => {
      const mockSettings: AppSettings = {
        ageBand: "25-29",
        isPremium: true,
        premiumGrantedAt: "2026-08-04T00:00:00Z",
        compareUnlockedAt: null,
        onboardedAt: "2026-01-01T00:00:00Z",
      };
      mockStorage.set("subtrack.settings.v1", JSON.stringify(mockSettings));

      const useSettings = require("@/hooks/useSettings").useSettings;
      const { result } = renderHookWithRouter(useSettings);

      expect(result.current.settings.ageBand).toBe("25-29");
      expect(result.current.settings.isPremium).toBe(true);
      expect(result.current.settings.premiumGrantedAt).toBe("2026-08-04T00:00:00Z");
    });

    it("should reflect isPremium from settings.isPremium field", () => {
      const mockSettings: AppSettings = {
        ageBand: "UNSET",
        isPremium: true,
        premiumGrantedAt: "2026-08-04T00:00:00Z",
        compareUnlockedAt: null,
        onboardedAt: null,
      };
      mockStorage.set("subtrack.settings.v1", JSON.stringify(mockSettings));

      const useSettings = require("@/hooks/useSettings").useSettings;
      const { result } = renderHookWithRouter(useSettings);

      expect(result.current.isPremium).toBe(true);
    });
  });

  describe("useSettings: Update Function", () => {
    it("should update settings and persist to storage", async () => {
      const useSettings = require("@/hooks/useSettings").useSettings;
      const { result } = renderHookWithRouter(useSettings);

      await act(async () => {
        await result.current.update({ ageBand: "30-34" });
      });

      expect(result.current.settings.ageBand).toBe("30-34");
      const stored = JSON.parse(mockStorage.get("subtrack.settings.v1") || "{}");
      expect(stored.ageBand).toBe("30-34");
    });

    it("should merge partial updates without overwriting other fields", async () => {
      const useSettings = require("@/hooks/useSettings").useSettings;
      const { result } = renderHookWithRouter(useSettings);

      const oldPremium = result.current.settings.isPremium;

      await act(async () => {
        await result.current.update({ ageBand: "25-29" });
      });

      expect(result.current.settings.ageBand).toBe("25-29");
      expect(result.current.settings.isPremium).toBe(oldPremium);
    });

    it("should update isPremium field", async () => {
      const useSettings = require("@/hooks/useSettings").useSettings;
      const { result } = renderHookWithRouter(useSettings);

      await act(async () => {
        await result.current.update({ isPremium: true });
      });

      expect(result.current.settings.isPremium).toBe(true);
      expect(result.current.isPremium).toBe(true);
    });

    it("should handle multiple updates in sequence", async () => {
      const useSettings = require("@/hooks/useSettings").useSettings;
      const { result } = renderHookWithRouter(useSettings);

      await act(async () => {
        await result.current.update({ ageBand: "35-39" });
      });

      await act(async () => {
        await result.current.update({
          isPremium: true,
          premiumGrantedAt: "2026-09-04T00:00:00Z",
        });
      });

      expect(result.current.settings.ageBand).toBe("35-39");
      expect(result.current.settings.isPremium).toBe(true);
      expect(result.current.settings.premiumGrantedAt).toBe("2026-09-04T00:00:00Z");
    });
  });

  describe("useSettings: isPremium Convenience Accessor", () => {
    it("should return true when settings.isPremium is true", () => {
      const mockSettings: AppSettings = {
        ageBand: "UNSET",
        isPremium: true,
        premiumGrantedAt: "2026-08-04T00:00:00Z",
        compareUnlockedAt: null,
        onboardedAt: null,
      };
      mockStorage.set("subtrack.settings.v1", JSON.stringify(mockSettings));

      const useSettings = require("@/hooks/useSettings").useSettings;
      const { result } = renderHookWithRouter(useSettings);

      expect(result.current.isPremium).toBe(true);
      expect(typeof result.current.isPremium).toBe("boolean");
    });

    it("should return false when settings.isPremium is false or missing", () => {
      const mockSettings: AppSettings = {
        ageBand: "UNSET",
        isPremium: false,
        premiumGrantedAt: null,
        compareUnlockedAt: null,
        onboardedAt: null,
      };
      mockStorage.set("subtrack.settings.v1", JSON.stringify(mockSettings));

      const useSettings = require("@/hooks/useSettings").useSettings;
      const { result } = renderHookWithRouter(useSettings);

      expect(result.current.isPremium).toBe(false);
    });
  });

  // ============================================================================
  // INTEGRATION: useSubscriptions + useSettings
  // ============================================================================

  describe("Integration: Both hooks coexist", () => {
    it("should allow using both hooks without conflicts", async () => {
      const useSubscriptions = require("@/hooks/useSubscriptions").useSubscriptions;
      const useSettings = require("@/hooks/useSettings").useSettings;

      const { result } = renderHook(
        () => ({
          subs: useSubscriptions(),
          settings: useSettings(),
        }),
        {
          wrapper: ({ children }) =>
            React.createElement(MemoryRouter, {}, children),
        }
      );

      // Wait for subscriptions to be ready
      await waitFor(() => {
        expect(result.current.subs.status).toBe("ready");
      });

      // Verify both hooks return expected types
      expect(result.current.subs.items).toBeDefined();
      expect(typeof result.current.subs.totalMonthly).toBe("number");
      expect(result.current.settings.ageBand).toBeDefined();
      expect(typeof result.current.settings.isPremium).toBe("boolean");
    });
  });
});

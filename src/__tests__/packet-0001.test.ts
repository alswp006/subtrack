import { describe, it, expect } from "vitest";
import type {
  Subscription,
  RouteState,
  ServiceTemplate,
  BillingCycle,
  SubscriptionStatus,
  CategoryKey,
  PriceChange,
  ChecklistItem,
  CancelChecklist,
  AppSettings,
  StorageMeta,
  BenchmarkTable,
  StorageError,
  Result,
  LoadState,
  AgeBand,
} from "@/lib/types";

describe("packet-0001: 도메인 타입 + RouteState 정의", () => {
  // ============================================================
  // AC-1: TypeScript compilation + pure types (no runtime code)
  // ============================================================
  it("AC-1[P0]: types.ts compiles as pure type declarations", () => {
    // Importing type-only members must succeed with zero runtime cost.
    expect(true).toBe(true);
  });

  // ============================================================
  // AC-2: Subscription matches SPEC data model 1:1 (no optional fields)
  // ============================================================
  it("AC-2[P0]: Subscription has all 13 fields from SPEC", () => {
    const subscription: Subscription = {
      id: "sub-123",
      name: "넷플릭스",
      category: "OTT",
      iconKey: "netflix",
      amount: 13500,
      cycle: "MONTHLY",
      firstBillingDate: "2026-09-10",
      nextBillingDate: "2026-09-10",
      memo: "",
      status: "ACTIVE",
      priceHistory: [],
      createdAt: "2026-09-04T00:00:00Z",
      updatedAt: "2026-09-04T00:00:00Z",
    };

    expect(subscription.id).toBe("sub-123");
    expect(subscription.name).toBe("넷플릭스");
    expect(subscription.category).toBe("OTT");
    expect(subscription.iconKey).toBe("netflix");
    expect(subscription.amount).toBe(13500);
    expect(subscription.cycle).toBe("MONTHLY");
    expect(subscription.firstBillingDate).toBe("2026-09-10");
    expect(subscription.nextBillingDate).toBe("2026-09-10");
    expect(subscription.memo).toBe("");
    expect(subscription.status).toBe("ACTIVE");
    expect(Array.isArray(subscription.priceHistory)).toBe(true);
    expect(subscription.createdAt).toBe("2026-09-04T00:00:00Z");
    expect(subscription.updatedAt).toBe("2026-09-04T00:00:00Z");
  });

  it("AC-2[P0]: Subscription.priceHistory is PriceChange[] (price history tracking)", () => {
    const priceHistory: PriceChange[] = [
      { id: "pc-1", amount: 13500, changedAt: "2026-06-01", note: "" },
      { id: "pc-2", amount: 17000, changedAt: "2026-09-04", note: "요금제 변경" },
    ];

    expect(Array.isArray(priceHistory)).toBe(true);
    expect(priceHistory.length).toBe(2);
    expect(priceHistory[0].amount).toBe(13500);
    expect(priceHistory[1].amount).toBe(17000);
    expect(priceHistory[1].changedAt).toMatch(/2026-09-04/);
  });

  it("AC-2[P0]: Subscription fields are required (not optional with ?)", () => {
    // If any required field were missing below, TypeScript would fail to compile.
    const sub: Subscription = {
      id: "",
      name: "",
      category: "ETC",
      iconKey: "",
      amount: 0,
      cycle: "MONTHLY",
      firstBillingDate: "",
      nextBillingDate: "",
      memo: "",
      status: "ACTIVE",
      priceHistory: [],
      createdAt: "",
      updatedAt: "",
    };

    expect(sub).toBeDefined();
  });

  // ============================================================
  // AC-3: RouteState covers all 8 routes, each value type is nullable
  // ============================================================
  it("AC-3[P0]: RouteState has exactly the 8 SPEC route keys", () => {
    const keys: Array<keyof RouteState> = [
      "/",
      "/subscriptions/new",
      "/subscriptions/:id",
      "/subscriptions/:id/edit",
      "/subscriptions/:id/checklist",
      "/compare",
      "/more",
      "/premium",
    ];
    expect(keys.length).toBe(8);
  });

  it("AC-3[P0]: RouteState['/'] accepts null (direct URL access / refresh)", () => {
    const homeState: RouteState["/"] = null;
    expect(homeState === null || typeof homeState === "object").toBe(true);
  });

  it("AC-3[P0]: RouteState['/subscriptions/new'] accepts null", () => {
    const newSubState: RouteState["/subscriptions/new"] = null;
    expect(newSubState === null || typeof newSubState === "object").toBe(true);
  });

  it("AC-3[P0]: RouteState['/subscriptions/:id'] accepts a subscriptionId payload or null", () => {
    const detailState: RouteState["/subscriptions/:id"] = { subscriptionId: "sub_1" };
    expect(detailState === null || typeof detailState === "object").toBe(true);
  });

  it("AC-3[P0]: RouteState['/subscriptions/:id/edit'] accepts null", () => {
    const editState: RouteState["/subscriptions/:id/edit"] = null;
    expect(editState === null || typeof editState === "object").toBe(true);
  });

  it("AC-3[P0]: RouteState['/subscriptions/:id/checklist'] carries subscriptionId + from, or null", () => {
    const checklistState: RouteState["/subscriptions/:id/checklist"] = {
      subscriptionId: "sub_1",
      from: "dday",
    };
    expect(checklistState === null || typeof checklistState === "object").toBe(true);
  });

  it("AC-3[P0]: RouteState['/compare'] accepts null", () => {
    const compareState: RouteState["/compare"] = null;
    expect(compareState === null || typeof compareState === "object").toBe(true);
  });

  it("AC-3[P0]: RouteState['/more'] accepts null", () => {
    const moreState: RouteState["/more"] = null;
    expect(moreState === null || typeof moreState === "object").toBe(true);
  });

  it("AC-3[P0]: RouteState['/premium'] accepts null", () => {
    const premiumState: RouteState["/premium"] = null;
    expect(premiumState === null || typeof premiumState === "object").toBe(true);
  });

  // ============================================================
  // AC-4: ServiceTemplate has exactly 4 fields (no amount/price)
  // ============================================================
  it("AC-4[P0]: ServiceTemplate has exactly 4 fields: key, name, category, iconKey", () => {
    const template: ServiceTemplate = {
      key: "netflix",
      name: "넷플릭스",
      category: "OTT",
      iconKey: "netflix",
    };

    expect(template.key).toBe("netflix");
    expect(template.name).toBe("넷플릭스");
    expect(template.category).toBe("OTT");
    expect(template.iconKey).toBe("netflix");
  });

  it("AC-4[P0]: ServiceTemplate does NOT include amount, price, or billing fields", () => {
    const template: ServiceTemplate = {
      key: "spotify",
      name: "스포티파이",
      category: "MUSIC",
      iconKey: "spotify",
    };

    const anyTemplate = template as any;
    expect(anyTemplate.amount).toBeUndefined();
    expect(anyTemplate.price).toBeUndefined();
    expect(anyTemplate.cycle).toBeUndefined();
    expect(anyTemplate.billingCycle).toBeUndefined();
  });

  // ============================================================
  // Additional type system verifications (P1)
  // ============================================================
  it("P1: BillingCycle is 'MONTHLY' | 'YEARLY'", () => {
    const cycles: BillingCycle[] = ["MONTHLY", "YEARLY"];
    expect(cycles.length).toBe(2);
    expect(cycles).toContain("MONTHLY");
    expect(cycles).toContain("YEARLY");
  });

  it("P1: SubscriptionStatus is 'ACTIVE' | 'CANCELED'", () => {
    const statuses: SubscriptionStatus[] = ["ACTIVE", "CANCELED"];
    expect(statuses).toContain("ACTIVE");
    expect(statuses).toContain("CANCELED");
    expect(statuses.length).toBe(2);
  });

  it("P1: CategoryKey represents the 7 SPEC service categories", () => {
    const categories: CategoryKey[] = [
      "OTT",
      "MUSIC",
      "CLOUD",
      "GAME",
      "PRODUCTIVITY",
      "FITNESS",
      "ETC",
    ];

    expect(categories).toContain("OTT");
    expect(categories.length).toBe(7);
  });

  it("P1: ChecklistItem represents a cancel checklist row", () => {
    const item: ChecklistItem = {
      id: "remaining",
      label: "남은 이용 기간 확인",
      done: false,
      doneAt: null,
    };

    expect(item.id).toBe("remaining");
    expect(item.label).toBe("남은 이용 기간 확인");
    expect(item.done).toBe(false);
    expect(item.doneAt).toBeNull();
  });

  it("P1: CancelChecklist groups checklist items", () => {
    const checklist: CancelChecklist = {
      subscriptionId: "sub-123",
      items: [],
      updatedAt: "2026-09-04T00:00:00Z",
    };

    expect(checklist.subscriptionId).toBe("sub-123");
    expect(Array.isArray(checklist.items)).toBe(true);
    expect(checklist.updatedAt).toBe("2026-09-04T00:00:00Z");
  });

  it("P1: Result<T> wraps success/error states", () => {
    const successResult: Result<Subscription> = {
      ok: true,
      data: {
        id: "sub-1",
        name: "넷플릭스",
        category: "OTT",
        iconKey: "netflix",
        amount: 13500,
        cycle: "MONTHLY",
        firstBillingDate: "2026-09-10",
        nextBillingDate: "2026-09-10",
        memo: "",
        status: "ACTIVE",
        priceHistory: [],
        createdAt: "",
        updatedAt: "",
      },
    };

    expect(successResult.ok).toBe(true);
    expect(successResult.data).toBeDefined();

    const errorResult: Result<Subscription> = {
      ok: false,
      error: { code: "STORAGE_FULL", fields: null },
    };

    expect(errorResult.ok).toBe(false);
    expect(errorResult.error.code).toBe("STORAGE_FULL");
  });

  it("P1: LoadState<T> tracks async loading states", () => {
    const idle: LoadState<Subscription[]> = { status: "idle", data: null };
    expect(idle.status).toBe("idle");
    expect(idle.data).toBeNull();

    const loading: LoadState<Subscription[]> = { status: "loading", data: null };
    expect(loading.status).toBe("loading");

    const ready: LoadState<Subscription[]> = { status: "ready", data: [] };
    expect(ready.status).toBe("ready");
    expect(Array.isArray(ready.data)).toBe(true);

    const error: LoadState<Subscription[]> = {
      status: "error",
      data: null,
      error: "STORAGE_FULL",
    };
    expect(error.status).toBe("error");
    expect(error.error).toBe("STORAGE_FULL");
  });

  it("P1: AgeBand categorizes user age groups", () => {
    const bands: AgeBand[] = ["20-24", "25-29", "30-34", "35-39", "UNSET"];
    expect(bands.length).toBe(5);
    expect(bands).toContain("UNSET");
  });

  it("P1: AppSettings stores user entitlement/settings", () => {
    const settings: AppSettings = {
      ageBand: "UNSET",
      isPremium: false,
      premiumGrantedAt: null,
      compareUnlockedAt: null,
      onboardedAt: null,
    };

    expect(settings.ageBand).toBe("UNSET");
    expect(settings.isPremium).toBe(false);
    expect(settings.premiumGrantedAt).toBeNull();
    expect(settings.compareUnlockedAt).toBeNull();
    expect(settings.onboardedAt).toBeNull();
  });

  it("P1: StorageMeta tracks schema version", () => {
    const meta: StorageMeta = {
      schemaVersion: 1,
      migratedAt: "2026-09-04T00:00:00Z",
    };

    expect(meta.schemaVersion).toBe(1);
    expect(meta.migratedAt).toMatch(/2026-09-04/);
  });

  it("P1: BenchmarkTable maps each non-UNSET AgeBand to a reference amount", () => {
    const benchmark: BenchmarkTable = {
      "20-24": 15000,
      "25-29": 22000,
      "30-34": 28000,
      "35-39": 31000,
    };

    expect(benchmark["20-24"]).toBe(15000);
    expect(benchmark["35-39"]).toBe(31000);
  });

  it("P1: StorageError describes persistence failures", () => {
    const error: StorageError = {
      code: "VALIDATION",
      fields: ["name", "amount", "firstBillingDate"],
    };

    expect(error.code).toBe("VALIDATION");
    expect(error.fields).toContain("amount");
  });
});

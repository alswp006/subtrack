import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSettings, ChecklistItem, CancelChecklist } from "@/lib/types";

/**
 * TDD RED PHASE: Tests for Settings & Checklist Repository (packet-0006)
 *
 * These tests define the expected behavior. The implementation files do not exist yet.
 * - src/domain/settings.ts (getSettings, saveSettings, isCompareUnlocked, unlockCompare)
 * - src/domain/checklists.ts (getChecklist, toggleChecklistItem, getChecklistProgress)
 *
 * Run: npx vitest run (will fail until implementation is complete)
 */

// ── Settings Tests ──

describe("packet-0006: Settings Repository (getSettings/saveSettings/isCompareUnlocked/unlockCompare)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("AC-1: getSettings returns default when localStorage is empty", () => {
    it("should return default AppSettings with expected shape when storage is empty", async () => {
      const { getSettings } = await import("@/domain/settings");
      const result = getSettings();

      expect(result).toEqual({
        ageBand: "UNSET",
        isPremium: false,
        premiumGrantedAt: null,
        compareUnlockedAt: null,
        onboardedAt: null,
      });
      expect(typeof result.ageBand).toBe("string");
      expect(typeof result.isPremium).toBe("boolean");
    });

    it("should not throw exception and return null fields for timestamps", async () => {
      const { getSettings } = await import("@/domain/settings");
      const result = getSettings();

      expect(result.premiumGrantedAt).toBeNull();
      expect(result.compareUnlockedAt).toBeNull();
      expect(result.onboardedAt).toBeNull();
    });

    it("should preserve existing settings from localStorage on second call", async () => {
      const { getSettings, saveSettings } = await import("@/domain/settings");

      // Save a setting
      const patch: Partial<AppSettings> = { ageBand: "25-29", isPremium: true };
      saveSettings(patch);

      // Retrieve and verify
      const result = getSettings();
      expect(result.ageBand).toBe("25-29");
      expect(result.isPremium).toBe(true);
      expect(result.compareUnlockedAt).toBeNull(); // other fields unchanged
    });
  });

  describe("AC-2: isCompareUnlocked returns true if compareUnlockedAt is within 24 hours, false otherwise", () => {
    it("should return true when compareUnlockedAt is 23 hours ago", async () => {
      const { saveSettings, isCompareUnlocked } = await import("@/domain/settings");

      const now = new Date();
      const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);
      const isoString = twentyThreeHoursAgo.toISOString();

      saveSettings({ compareUnlockedAt: isoString });
      const result = isCompareUnlocked();

      expect(result).toBe(true);
      expect(typeof result).toBe("boolean");
    });

    it("should return false when compareUnlockedAt is 25 hours ago", async () => {
      const { saveSettings, isCompareUnlocked } = await import("@/domain/settings");

      const now = new Date();
      const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
      const isoString = twentyFiveHoursAgo.toISOString();

      saveSettings({ compareUnlockedAt: isoString });
      const result = isCompareUnlocked();

      expect(result).toBe(false);
    });

    it("should return false when compareUnlockedAt is null", async () => {
      const { getSettings, isCompareUnlocked } = await import("@/domain/settings");
      const settings = getSettings();
      expect(settings.compareUnlockedAt).toBeNull();

      const result = isCompareUnlocked();
      expect(result).toBe(false);
    });

    it("should return true when compareUnlockedAt is exactly now (0ms ago)", async () => {
      const { saveSettings, isCompareUnlocked } = await import("@/domain/settings");

      const now = new Date();
      saveSettings({ compareUnlockedAt: now.toISOString() });
      const result = isCompareUnlocked();

      expect(result).toBe(true);
    });

    it("should return true when compareUnlockedAt is 1 hour ago", async () => {
      const { saveSettings, isCompareUnlocked } = await import("@/domain/settings");

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      saveSettings({ compareUnlockedAt: oneHourAgo.toISOString() });
      const result = isCompareUnlocked();

      expect(result).toBe(true);
    });
  });

  describe("unlockCompare sets compareUnlockedAt to current timestamp", () => {
    it("should set compareUnlockedAt to current ISO timestamp", async () => {
      const { unlockCompare, getSettings } = await import("@/domain/settings");

      unlockCompare();
      const settings = getSettings();

      expect(settings.compareUnlockedAt).not.toBeNull();
      expect(typeof settings.compareUnlockedAt).toBe("string");
      // Verify it's a valid ISO string
      expect(new Date(settings.compareUnlockedAt as string).toISOString()).toBeTruthy();
    });

    it("should make isCompareUnlocked return true immediately after unlockCompare", async () => {
      const { unlockCompare, isCompareUnlocked } = await import("@/domain/settings");

      unlockCompare();
      const result = isCompareUnlocked();

      expect(result).toBe(true);
    });
  });
});

// ── Checklist Tests ──

describe("packet-0006: Checklist Repository (getChecklist/toggleChecklistItem/getChecklistProgress)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("AC-3: getChecklist returns DEFAULT_CHECKLIST with 5 items on first call", () => {
    it("should return a CancelChecklist with 5 items, all done:false", async () => {
      const { getChecklist } = await import("@/domain/checklists");
      const result = getChecklist("sub-123");

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.items.length).toBe(5);

      result.items.forEach((item: ChecklistItem) => {
        expect(item.done).toBe(false);
        expect(item.doneAt).toBeNull();
        expect(typeof item.id).toBe("string");
        expect(typeof item.label).toBe("string");
      });
    });

    it("should have ChecklistItem with id, label, done, doneAt properties", async () => {
      const { getChecklist } = await import("@/domain/checklists");
      const result = getChecklist("sub-456");
      const firstItem = result.items[0];

      expect("id" in firstItem).toBe(true);
      expect("label" in firstItem).toBe(true);
      expect("done" in firstItem).toBe(true);
      expect("doneAt" in firstItem).toBe(true);
      expect(firstItem.id).toBeTruthy();
      expect(firstItem.label).toBeTruthy();
    });

    it("should return a new copy on each call (not mutating stored default)", async () => {
      const { getChecklist } = await import("@/domain/checklists");

      const list1 = getChecklist("sub-789");
      const list2 = getChecklist("sub-789");

      expect(list1.items).toEqual(list2.items);
      expect(list1.items).not.toBe(list2.items); // Different array references
    });
  });

  describe("AC-3: toggleChecklistItem toggles done flag and sets doneAt", () => {
    it("should toggle first item from done:false to done:true with ISO doneAt", async () => {
      const { getChecklist, toggleChecklistItem } = await import("@/domain/checklists");

      const beforeToggle = getChecklist("sub-111");
      const firstItemId = beforeToggle.items[0].id;

      expect(beforeToggle.items[0].done).toBe(false);
      expect(beforeToggle.items[0].doneAt).toBeNull();

      // Toggle
      toggleChecklistItem("sub-111", firstItemId);

      // Retrieve and verify
      const afterToggle = getChecklist("sub-111");
      const toggledItem = afterToggle.items[0];

      expect(toggledItem.done).toBe(true);
      expect(toggledItem.doneAt).not.toBeNull();
      expect(typeof toggledItem.doneAt).toBe("string");
      // Verify it's valid ISO format
      expect(() => new Date(toggledItem.doneAt as string).toISOString()).not.toThrow();
    });

    it("should toggle item back to done:false and clear doneAt", async () => {
      const { getChecklist, toggleChecklistItem } = await import("@/domain/checklists");

      const list = getChecklist("sub-222");
      const itemId = list.items[0].id;

      // Toggle on
      toggleChecklistItem("sub-222", itemId);
      let updated = getChecklist("sub-222");
      expect(updated.items[0].done).toBe(true);
      expect(updated.items[0].doneAt).not.toBeNull();

      // Toggle off
      toggleChecklistItem("sub-222", itemId);
      updated = getChecklist("sub-222");
      expect(updated.items[0].done).toBe(false);
      expect(updated.items[0].doneAt).toBeNull();
    });

    it("should persist toggles across different checklist IDs independently", async () => {
      const { getChecklist, toggleChecklistItem } = await import("@/domain/checklists");

      const list1 = getChecklist("sub-333");
      const list2 = getChecklist("sub-444");

      const item1Id = list1.items[0].id;
      const item2Id = list2.items[0].id;

      // Toggle only first list's first item
      toggleChecklistItem("sub-333", item1Id);

      // Verify isolation
      const updated1 = getChecklist("sub-333");
      const updated2 = getChecklist("sub-444");

      expect(updated1.items[0].done).toBe(true);
      expect(updated2.items[0].done).toBe(false);
    });
  });

  describe("AC-4: getChecklistProgress returns {done, total} counts", () => {
    it("should return {done:0,total:5} for new checklist", async () => {
      const { getChecklist, getChecklistProgress } = await import("@/domain/checklists");

      const list = getChecklist("sub-555");
      const progress = getChecklistProgress("sub-555");

      expect(progress).toEqual({ done: 0, total: 5 });
      expect(typeof progress.done).toBe("number");
      expect(typeof progress.total).toBe("number");
    });

    it("should return {done:2,total:5} after toggling 2 items", async () => {
      const { getChecklist, toggleChecklistItem, getChecklistProgress } =
        await import("@/domain/checklists");

      const list = getChecklist("sub-666");
      const itemId1 = list.items[0].id;
      const itemId2 = list.items[1].id;

      toggleChecklistItem("sub-666", itemId1);
      toggleChecklistItem("sub-666", itemId2);

      const progress = getChecklistProgress("sub-666");

      expect(progress.done).toBe(2);
      expect(progress.total).toBe(5);
    });

    it("should return {done:5,total:5} when all items are complete", async () => {
      const { getChecklist, toggleChecklistItem, getChecklistProgress } =
        await import("@/domain/checklists");

      const list = getChecklist("sub-777");

      // Toggle all 5 items
      list.items.forEach((item: ChecklistItem) => {
        toggleChecklistItem("sub-777", item.id);
      });

      const progress = getChecklistProgress("sub-777");

      expect(progress.done).toBe(5);
      expect(progress.total).toBe(5);
    });

    it("should return {done:1,total:5} after toggling one item on and one item off", async () => {
      const { getChecklist, toggleChecklistItem, getChecklistProgress } =
        await import("@/domain/checklists");

      const list = getChecklist("sub-888");
      const itemId1 = list.items[0].id;
      const itemId2 = list.items[1].id;

      // Toggle on then off
      toggleChecklistItem("sub-888", itemId1);
      toggleChecklistItem("sub-888", itemId1);
      // Toggle on (stays on)
      toggleChecklistItem("sub-888", itemId2);

      const progress = getChecklistProgress("sub-888");

      expect(progress.done).toBe(1);
      expect(progress.total).toBe(5);
      expect(progress.done).toBeLessThanOrEqual(progress.total);
    });
  });
});

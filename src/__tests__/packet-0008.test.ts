import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

import { Sparkline } from "@/components/Sparkline";
import { MiniBar } from "@/components/MiniBar";
import { ListSkeleton } from "@/components/ListSkeleton";

const SOURCE_FILES = [
  path.resolve(__dirname, "../components/Sparkline.tsx"),
  path.resolve(__dirname, "../components/MiniBar.tsx"),
  path.resolve(__dirname, "../components/ListSkeleton.tsx"),
];

describe("시각화 · 스켈레톤 공용 컴포넌트 [packet-0008]", () => {
  // ========== AC-1: Sparkline ==========
  describe("AC-1: Sparkline renders polyline for 6 points, empty-state text for empty array", () => {
    it("AC-1[P0]: renders an SVG polyline when given 6 points", () => {
      const points = [10000, 12000, 9000, 15000, 14000, 18000];
      const { container } = render(
        React.createElement(Sparkline, { points, testId: "sparkline" }),
      );

      const polyline = container.querySelector("polyline");
      expect(polyline).not.toBeNull();
      const coords = polyline!.getAttribute("points")!.trim().split(/\s+/);
      expect(coords).toHaveLength(6);
    });

    it("AC-1[P0]: renders '데이터가 아직 없어요' text when points is an empty array", () => {
      render(React.createElement(Sparkline, { points: [], testId: "sparkline" }));

      expect(screen.getByText("데이터가 아직 없어요")).toBeInTheDocument();
      expect(document.querySelector("polyline")).toBeNull();
    });
  });

  // ========== AC-2: MiniBar ==========
  describe("AC-2: MiniBar renders top 5 items with category name + percentage", () => {
    const items = [
      { category: "OTT", percent: 32 },
      { category: "음악", percent: 24 },
      { category: "클라우드", percent: 18 },
      { category: "피트니스", percent: 12 },
      { category: "게임", percent: 8 },
      { category: "쇼핑", percent: 4 },
      { category: "기타", percent: 2 },
    ];

    it("AC-2[P0]: renders only the top 5 items, dropping the rest", () => {
      render(React.createElement(MiniBar, { items }));

      expect(screen.getByText("OTT")).toBeInTheDocument();
      expect(screen.getByText("게임")).toBeInTheDocument();
      expect(screen.queryByText("쇼핑")).not.toBeInTheDocument();
      expect(screen.queryByText("기타")).not.toBeInTheDocument();
    });

    it("AC-2[P0]: shows category name and percentage next to each bar", () => {
      render(React.createElement(MiniBar, { items }));

      expect(screen.getByText("OTT")).toBeInTheDocument();
      expect(screen.getByText("32%")).toBeInTheDocument();
      expect(screen.getByText("음악")).toBeInTheDocument();
      expect(screen.getByText("24%")).toBeInTheDocument();
    });

    it("AC-2: renders empty-state text when items is an empty array", () => {
      render(React.createElement(MiniBar, { items: [] }));

      expect(screen.getByText("데이터가 아직 없어요")).toBeInTheDocument();
    });
  });

  // ========== AC-3: No HEX color literals ==========
  describe("AC-3: no hardcoded HEX color literals, colors use var(--tds-color-*)", () => {
    it("AC-3[P0]: none of the three source files contain a HEX color literal", () => {
      const hexPattern = /#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?(?![0-9A-Za-z])/;
      for (const file of SOURCE_FILES) {
        const source = fs.readFileSync(file, "utf-8");
        expect(source).not.toMatch(hexPattern);
      }
    });

    it("AC-3[P0]: every color reference across the three files uses var(--tds-color-*)", () => {
      const colorFnPattern = /(?:color|background(?:Color)?|fill|stroke|border(?:Color)?)\s*:\s*["'`]?\s*var\(/gi;
      const tdsColorVarPattern = /var\(--tds-color-[a-zA-Z0-9]+/g;

      let totalColorUsages = 0;
      let totalTdsColorVars = 0;

      for (const file of SOURCE_FILES) {
        const source = fs.readFileSync(file, "utf-8");
        totalColorUsages += (source.match(colorFnPattern) ?? []).length;
        totalTdsColorVars += (source.match(tdsColorVarPattern) ?? []).length;
      }

      expect(totalColorUsages).toBeGreaterThan(0);
      expect(totalTdsColorVars).toBeGreaterThan(0);
      expect(totalTdsColorVars).toBeGreaterThanOrEqual(totalColorUsages);
    });
  });

  // ========== AC-4: ListSkeleton ==========
  describe("AC-4: ListSkeleton renders `count` fixed-height blocks", () => {
    it("AC-4[P0]: renders exactly `count` skeleton blocks", () => {
      render(React.createElement(ListSkeleton, { count: 4 }));

      const blocks = screen.getAllByTestId("skeleton-block");
      expect(blocks).toHaveLength(4);
    });

    it("AC-4[P0]: each block has a fixed inline height style", () => {
      render(React.createElement(ListSkeleton, { count: 3 }));

      const blocks = screen.getAllByTestId("skeleton-block");
      expect(blocks).toHaveLength(3);
      blocks.forEach((block) => {
        expect(block.getAttribute("style")).toMatch(/height/);
      });
    });

    it("AC-4: renders a different count (2) correctly, proving it's dynamic not hardcoded", () => {
      render(React.createElement(ListSkeleton, { count: 2 }));

      expect(screen.getAllByTestId("skeleton-block")).toHaveLength(2);
    });
  });
});

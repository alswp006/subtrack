import { Paragraph } from "@toss/tds-mobile";

/**
 * 스파크라인 — 최근 추이(월별 지출 등)를 경량 인라인 SVG 라인으로.
 *
 * Pre-built (재구현 금지): D3 등 무거운 차트 라이브러리는 번들 제한상 금지 → 이 SVG로 대체(의존성 0).
 * width는 항상 100%(반응형) — 고정 px width 금지.
 */
export function Sparkline({
  points,
  height = 64,
  testId,
}: {
  points: number[];
  height?: number;
  testId?: string;
}) {
  if (!points || points.length === 0) {
    return (
      <Paragraph.Text typography="st12" color="var(--tds-color-grey500)">
        데이터가 아직 없어요
      </Paragraph.Text>
    );
  }

  const viewWidth = 100;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = points.length > 1 ? viewWidth / (points.length - 1) : 0;
  const coords = points.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      data-testid={testId}
      width="100%"
      height={height}
      viewBox={`0 0 ${viewWidth} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="최근 추이 그래프"
    >
      <polyline
        points={coords.join(" ")}
        style={{
          fill: "none",
          stroke: "var(--tds-color-blue500)",
        }}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// 날짜 · 금액 계산 순수 함수. 부수효과 없음 — 모든 "오늘" 값은 인자로 받거나 getToday()로 통일한다.
// ES2019 호환: optional chaining(?.)/nullish coalescing(??)/Array.at/findLast/structuredClone/정규식 lookbehind 금지.

import type { BillingCycle, Subscription } from '@/lib/types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const table = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return table[month - 1];
}

interface DateParts {
  y: number;
  m: number;
  d: number;
}

function parseDateParts(value: string): DateParts | null {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return null;
  const segments = value.split('-');
  const y = Number(segments[0]);
  const m = Number(segments[1]);
  const d = Number(segments[2]);
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function assembleDateString(y: number, m: number, d: number): string {
  return y + '-' + pad2(m) + '-' + pad2(d);
}

function clampDay(year: number, month: number, day: number): number {
  const max = daysInMonth(year, month);
  return day > max ? max : day;
}

function addMonths(y: number, m: number, deltaMonths: number): { y: number; m: number } {
  const total = y * 12 + (m - 1) + deltaMonths;
  const newY = Math.floor(total / 12);
  const newM = (total % 12) + 1;
  return { y: newY, m: newM };
}

/** KST(Asia/Seoul) 기준 오늘 날짜 — 다른 함수의 "오늘" 기본값은 전부 이 함수를 거친다(단일 출처). */
export function getToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  let y = '';
  let m = '';
  let d = '';
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].type === 'year') y = parts[i].value;
    else if (parts[i].type === 'month') m = parts[i].value;
    else if (parts[i].type === 'day') d = parts[i].value;
  }
  return y + '-' + m + '-' + d;
}

/** YYYY-MM-DD 형식이면서 실제 존재하는 달력 날짜인지 검증 (Feb 30 등은 false). */
export function isValidDateString(value: string): boolean {
  return parseDateParts(value) !== null;
}

/** 연간 구독료를 월 환산액으로 변환. YEARLY만 나눗셈, MONTHLY는 그대로. */
export function monthlyAmount(input: { amount: number; cycle: BillingCycle }): number {
  if (input.cycle === 'YEARLY') return Math.round(input.amount / 12);
  return input.amount;
}

/**
 * 다음 결제일 계산 — Date 객체 산술(자동 롤오버) 대신 연/월/일 정수 산술 + 문자열 비교로 계산한다.
 * 월말 청구일(예: 1/31)은 짧은 달에서 그 달의 마지막 날로 보정된다(예: 4/30).
 */
export function computeNextBillingDate(
  billingDate: string,
  cycle: BillingCycle,
  today: string = getToday(),
): string {
  const billing = parseDateParts(billingDate);
  const todayParts = parseDateParts(today);
  if (billing === null || todayParts === null) return '';

  const originalDay = billing.d;
  let offset = 0;
  let candidateStr = assembleDateString(billing.y, billing.m, billing.d);
  const maxOffset = cycle === 'YEARLY' ? 400 : 4800;

  while (candidateStr < today) {
    offset += 1;
    if (offset > maxOffset) return '';

    if (cycle === 'YEARLY') {
      const cy = billing.y + offset;
      const cm = billing.m;
      candidateStr = assembleDateString(cy, cm, clampDay(cy, cm, originalDay));
    } else {
      const next = addMonths(billing.y, billing.m, offset);
      candidateStr = assembleDateString(next.y, next.m, clampDay(next.y, next.m, originalDay));
    }
  }

  return candidateStr;
}

/** target - from 을 일 단위로 계산. 잘못된 입력이면 예외 없이 NaN. */
export function daysUntil(target: string, from: string = getToday()): number {
  const t = parseDateParts(target);
  const f = parseDateParts(from);
  if (t === null || f === null) return NaN;

  const utcTarget = Date.UTC(t.y, t.m - 1, t.d);
  const utcFrom = Date.UTC(f.y, f.m - 1, f.d);
  return Math.round((utcTarget - utcFrom) / 86400000);
}

/** 천 단위 콤마 구분 금액 문자열 (예: 1000000 → "1,000,000"). */
export function formatKRW(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = String(Math.abs(Math.trunc(amount)));

  let result = '';
  let count = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    result = digits.charAt(i) + result;
    count += 1;
    if (count % 3 === 0 && i !== 0) {
      result = ',' + result;
    }
  }
  return sign + result;
}

/** 결제일까지 남은 일수 라벨 — 0은 '오늘 결제', 음수는 이미 지난 결제로 간주. */
export function ddayLabel(days: number): string {
  if (days === 0) return '오늘 결제';
  if (days > 0) return 'D-' + days;
  return '결제 완료';
}

/** 원화 표시 포맷 — 천 단위 콤마 + '원' 접미사 (예: 13500 → "13,500원"). */
export function formatCurrencyKrw(amount: number): string {
  return formatKRW(amount) + '원';
}

/**
 * 날짜 표시 포맷. 'short'(기본) → "9월 4일", 'long' → "2026년 9월 4일".
 * 잘못된 날짜 문자열이면 예외 없이 원본 문자열을 그대로 반환한다.
 */
export function formatDate(date: string, format: 'short' | 'long' = 'short'): string {
  const parts = parseDateParts(date);
  if (parts === null) return date;
  if (format === 'long') return parts.y + '년 ' + parts.m + '월 ' + parts.d + '일';
  return parts.m + '월 ' + parts.d + '일';
}

/** 다음 결제일까지 남은 일수 — 오늘(KST) 기준. 잘못된 날짜면 NaN. */
export function getDaysUntilBilling(nextBillingDate: string): number {
  return daysUntil(nextBillingDate, getToday());
}

/** 활성 구독들의 연간 예상 비용 합계 — 해지된(CANCELED) 구독은 제외. */
export function estimateAnnualCost(subscriptions: Subscription[]): number {
  let total = 0;
  for (let i = 0; i < subscriptions.length; i++) {
    const sub = subscriptions[i];
    if (sub.status === 'CANCELED') continue;
    total += sub.cycle === 'YEARLY' ? sub.amount : sub.amount * 12;
  }
  return total;
}

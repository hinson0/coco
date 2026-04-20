import { formatAmount, formatDate } from "./format";

describe("formatDate", () => {
  it("formats a valid ISO string", () => {
    expect(formatDate("2026-04-04T10:00:00Z")).toBe("2026年04月04日");
  });

  it("formats a valid ISO string with UTC offset", () => {
    expect(formatDate("2026-11-05T10:00:00+00:00")).toBe("2026年11月05日");
  });

  it("falls back to today for empty string (OCR 未识别日期)", () => {
    const today = new Date();
    const expected = `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, "0")}月${String(today.getDate()).padStart(2, "0")}日`;
    expect(formatDate("")).toBe(expected);
  });

  it("falls back to today for invalid date string", () => {
    const today = new Date();
    const expected = `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, "0")}月${String(today.getDate()).padStart(2, "0")}日`;
    expect(formatDate("not-a-date")).toBe(expected);
  });
});

describe("formatAmount", () => {
  it("formats expense with minus, ¥, and thousands separator", () => {
    expect(formatAmount(366666, "expense")).toBe("-¥366,666.00");
  });

  it("formats income with plus, ¥, and thousands separator", () => {
    expect(formatAmount(5000, "income")).toBe("+¥5,000.00");
  });

  it("formats small amounts", () => {
    expect(formatAmount(25, "expense")).toBe("-¥25.00");
  });

  it("formats decimal amounts", () => {
    expect(formatAmount(99.5, "expense")).toBe("-¥99.50");
  });

  it("formats large amounts", () => {
    expect(formatAmount(99999999, "expense")).toBe("-¥99,999,999.00");
  });

  it("formats zero", () => {
    expect(formatAmount(0, "expense")).toBe("-¥0.00");
  });
});

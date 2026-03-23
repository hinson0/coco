import { formatAmount } from "./format";

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

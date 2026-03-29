export function extractAmount(text: string): number | null {
  const patterns = [
    /[¥￥]\s*(\d+\.?\d{0,2})/,
    /(\d+\.?\d{0,2})\s*(元|块)/,
    /(?<![.\d])(\d+\.?\d{0,2})(?![.\d])/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      if (amount > 0 && isFinite(amount)) {
        return amount;
      }
    }
  }

  return null;
}

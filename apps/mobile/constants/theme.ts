export const colors = {
  cream: "#faf6f0",
  creamDark: "#f0e8dc",
  creamDeeper: "#e4d8c8",
  sage: "#7ba68a",
  sageLight: "#a4ccb0",
  sagePale: "#dceee2",
  coral: "#e8856c",
  coralLight: "#f4b0a0",
  coralPale: "#fde8e2",
  honey: "#d4a853",
  honeyLight: "#e8c87a",
  honeyPale: "#fdf4dc",
  lavender: "#9b8ec4",
  lavenderPale: "#ece8f4",
  text: "#3a3028",
  textLight: "#8a7e70",
  textLighter: "#b8aa98",
  white: "#ffffff",
  shadow: "rgba(58,48,40,0.06)",
} as const;

export const spacing = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
  xxxxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 22,
  xxl: 24,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: "#3a3028",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#3a3028",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: "#3a3028",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 6,
  },
  xl: {
    shadowColor: "#3a3028",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

export const typography = {
  sizes: {
    xs: 10,
    sm: 11,
    base: 12,
    md: 13,
    lg: 14,
    xl: 15,
    "2xl": 17,
    "3xl": 19,
    "4xl": 21,
    "5xl": 23,
    "6xl": 27,
  },
  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
  },
} as const;

export const categoryColors = {
  coral: { bg: "#fde8e2", icon: "#e8856c" },
  sage: { bg: "#dceee2", icon: "#7ba68a" },
  honey: { bg: "#fdf4dc", icon: "#d4a853" },
  lavender: { bg: "#ece8f4", icon: "#9b8ec4" },
} as const;

export type CategoryColorName = keyof typeof categoryColors;

// Maps common category names to color keys. Fallback: 'sage'.
export const CATEGORY_COLOR_MAP: Record<string, CategoryColorName> = {
  餐饮: "coral",
  交通: "sage",
  购物: "honey",
  娱乐: "lavender",
  饮品: "honey",
  生活: "coral",
  医疗: "coral",
  教育: "lavender",
  住房: "honey",
  收入: "sage",
  工资: "sage",
};

export function getCategoryColor(categoryName: string): CategoryColorName {
  return CATEGORY_COLOR_MAP[categoryName] ?? "sage";
}

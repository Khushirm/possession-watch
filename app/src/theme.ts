import { useColorScheme } from "react-native";

const light = {
  background: "#F6F5F2",
  surface: "#FFFFFF",
  surfaceMuted: "#EFEDE8",
  border: "#E2DFD8",
  text: "#1B1A17",
  textMuted: "#6B675E",
  primary: "#1F5C4A",
  primaryText: "#FFFFFF",
  success: "#2E7D4F",
  successBg: "#E3F2E8",
  warning: "#9A5B00",
  warningBg: "#FCEFD9",
  danger: "#B3261E",
  dangerBg: "#FBE4E2",
  added: "#1E6B3A",
  removed: "#9F2A22",
};

const dark: typeof light = {
  background: "#121311",
  surface: "#1C1D1A",
  surfaceMuted: "#262723",
  border: "#33352F",
  text: "#EDEBE5",
  textMuted: "#A29E94",
  primary: "#6FC3A5",
  primaryText: "#0D1F19",
  success: "#7CCB98",
  successBg: "#1E3326",
  warning: "#F0B860",
  warningBg: "#3A2C14",
  danger: "#F2948C",
  dangerBg: "#3D1F1C",
  added: "#8FD9A8",
  removed: "#F2A29A",
};

export type Palette = typeof light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}

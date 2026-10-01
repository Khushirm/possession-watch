import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { usePalette } from "@/theme";

export default function RootLayout() {
  const scheme = useColorScheme();
  const palette = usePalette();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, primary: palette.primary, background: palette.background, card: palette.surface, text: palette.text, border: palette.border },
      }}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add-project" options={{ title: "Watch a project", presentation: "modal" }} />
        <Stack.Screen name="project/[id]" options={{ title: "Project" }} />
      </Stack>
    </ThemeProvider>
  );
}

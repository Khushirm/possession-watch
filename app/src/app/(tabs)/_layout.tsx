import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/tabs";
import { usePalette } from "@/theme";

export default function TabsLayout() {
  const palette = usePalette();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: palette.primary, tabBarInactiveTintColor: palette.textMuted }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "My projects",
          tabBarLabel: "Projects",
          tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="calculator"
        options={{
          title: "Delay calculator",
          tabBarLabel: "Calculator",
          tabBarIcon: ({ color, size }) => <Ionicons name="calculator-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

"use client";

import {Button} from "@heroui/react";
import {useTheme} from "next-themes";
import {useSyncExternalStore} from "react";

export function ThemeSwitcher() {
  const mounted = useSyncExternalStore(
    (cb) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); },
    () => true,
    () => false,
  );
  const {resolvedTheme, setTheme, theme} = useTheme();

  if (!mounted) return null;

  const activeTheme = theme === "system" ? resolvedTheme : theme;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={activeTheme === "light" ? "primary" : "secondary"}
        onPress={() => setTheme("light")}
      >
        Light
      </Button>
      <Button
        variant={activeTheme === "dark" ? "primary" : "secondary"}
        onPress={() => setTheme("dark")}
      >
        Dark
      </Button>
      <Button variant={theme === "system" ? "primary" : "secondary"} onPress={() => setTheme("system")}>
        System
      </Button>
    </div>
  );
}
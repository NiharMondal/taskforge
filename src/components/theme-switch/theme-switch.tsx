"use client";

import {Button, DropdownItem, DropdownMenu, DropdownPopover, DropdownRoot, DropdownTrigger, Label} from "@heroui/react";
import {Moon, Sun, Monitor} from "lucide-react";
import {useTheme} from "next-themes";
import {useSyncExternalStore} from "react";

export function ThemeSwitcher() {
  const mounted = useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      return () => window.removeEventListener("storage", cb);
    },
    () => true,
    () => false,
  );
  const {theme, setTheme} = useTheme();

  if (!mounted) return null;

  const activeTheme = theme === "system" ? "system" : theme;
  const ThemeIcon = activeTheme === "dark" ? Moon : activeTheme === "light" ? Sun : Monitor;

  return (
    <DropdownRoot>
        
        <Button  aria-label="Theme" variant="secondary" isIconOnly >
          <ThemeIcon className="size-4" />
        </Button>
  
      <DropdownPopover className="min-w-32">
        <DropdownMenu onAction={(key) => setTheme(String(key))}>
          <DropdownItem id="light" textValue="Light">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              <Label>Light</Label>
            </div>
          </DropdownItem>
          <DropdownItem id="dark" textValue="Dark">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4" />
              <Label>Dark</Label>
            </div>
          </DropdownItem>
          <DropdownItem id="system" textValue="System">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              <Label>System</Label>
            </div>
          </DropdownItem>
        </DropdownMenu>
      </DropdownPopover>
    </DropdownRoot>
  );
}

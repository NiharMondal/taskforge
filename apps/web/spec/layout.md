# 📦 Layout System Specification (Sidebar + Workspace Switcher)

## 🧠 Objective

Build a scalable, reusable layout system for a multi-tenant SaaS application using:

* Next.js (App Router)
* TailwindCSS
* HeroUI (for UI components)

The layout must support:

* Sidebar navigation
* Workspace switching
* Responsive behavior
* Clean component separation

---

## 🏗️ Folder Structure

```
/components/layout/
  ├── AppLayout.tsx
  ├── Sidebar.tsx
  ├── SidebarItem.tsx
  ├── WorkspaceSwitcher.tsx
  ├── Header.tsx (optional)

/app/(dashboard)/
  ├── layout.tsx
  ├── page.tsx
```

---

## 🔧 Core Layout Architecture

### 1. Root Layout (App Router)

`/app/(dashboard)/layout.tsx`

```tsx
import AppLayout from "@/components/layout/AppLayout";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
```

---

### 2. AppLayout Component

Responsibilities:

* Wrap entire dashboard UI
* Manage sidebar + main content
* Handle responsiveness

```tsx
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
```

---

## 📌 Sidebar Design

### Responsibilities:

* Navigation (Projects, Issues, Settings, etc.)
* Workspace switcher at top
* Active route highlighting

---

### Sidebar Component

```tsx
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import SidebarItem from "./SidebarItem";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r flex flex-col">
      
      {/* Workspace Switcher */}
      <div className="p-4 border-b">
        <WorkspaceSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        <SidebarItem href="/dashboard" label="Dashboard" />
        <SidebarItem href="/projects" label="Projects" />
        <SidebarItem href="/issues" label="Issues" />
        <SidebarItem href="/settings" label="Settings" />
      </nav>
    </aside>
  );
}
```

---

### Sidebar Item

```tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";

export default function SidebarItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={clsx(
        "block px-3 py-2 rounded-lg text-sm font-medium",
        isActive
          ? "bg-blue-500 text-white"
          : "text-gray-600 hover:bg-gray-100"
      )}
    >
      {label}
    </Link>
  );
}
```

---

## 🔄 Workspace Switcher

### Responsibilities:

* Show current workspace
* Dropdown to switch workspace
* Trigger API/state update

---

### WorkspaceSwitcher Component (HeroUI)

```tsx
"use client";

import { Select, SelectItem } from "@heroui/react";

const workspaces = [
  { id: "1", name: "Workspace A" },
  { id: "2", name: "Workspace B" },
];

export default function WorkspaceSwitcher() {
  return (
    <Select
      label="Workspace"
      defaultSelectedKeys={["1"]}
      className="w-full"
    >
      {workspaces.map((ws) => (
        <SelectItem key={ws.id}>
          {ws.name}
        </SelectItem>
      ))}
    </Select>
  );
}
```

---

## 📱 Responsive Behavior

### Requirements:

* Sidebar collapses on mobile
* Use drawer (slide-in panel)
* Toggle button in header

### Suggested Approach:

* Use `useState` for sidebar open/close
* Conditionally render sidebar with:

  * `fixed inset-y-0 left-0 z-50`
  * overlay backdrop

---

## 🎯 State Management Strategy

Workspace state should be:

* Stored in global state (Redux / Zustand / Context)
* Synced with backend
* Persisted (localStorage or cookie)

---

## 🔌 API Integration (Future)

Workspace switch should:

1. Call backend API:

   ```
   POST /api/workspaces/switch
   ```
2. Update:

   * active workspace in state
   * refetch project/issue data

---

## 🧼 Best Practices

* Keep layout components **dumb (presentational)**
* Move logic to hooks:

  * `useWorkspace()`
  * `useSidebar()`
* Avoid prop drilling → use context
* Use Tailwind utility classes consistently
* Use HeroUI only for interactive UI (Select, Dropdown)

---

## 🚀 Deliverables for Claude

Claude must:

* Implement all components
* Ensure responsive layout
* Use clean TypeScript types
* Avoid inline business logic
* Keep components reusable and composable

---

## ✅ Expected Outcome

A production-ready dashboard layout with:

* Sidebar navigation
* Workspace switching
* Clean separation of concerns
* Ready for scaling into full SaaS product


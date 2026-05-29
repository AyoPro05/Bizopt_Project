# Phase 1 Components - Quick Start Guide

> Implement world-class UX with these production-ready components

---

## 🎯 Quick Reference

### 1️⃣ LoadingSpinner

The accessible, motion-safe loading indicator.

**Basic Usage:**
```typescript
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export function MyComponent() {
  return <LoadingSpinner size="md" label="Loading posts" />;
}
```

**Sizes:**
```typescript
<LoadingSpinner size="sm" />  // 16px - for inline icons
<LoadingSpinner size="md" />  // 20px - default for buttons
<LoadingSpinner size="lg" />  // 24px - for sections
```

**Features:**
- ✅ Respects `prefers-reduced-motion`
- ✅ Accessible with `role="status"` and `aria-label`
- ✅ Screen reader announces "Loading…"
- ✅ Uses theme accent color

---

### 2️⃣ Enhanced Button

Now with loading state, sizes, and better accessibility.

**Basic Usage:**
```typescript
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function SaveButton() {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveToDB();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button loading={saving} onClick={handleSave}>
      {saving ? "Saving" : "Save"}
    </Button>
  );
}
```

**Variants:**
```typescript
<Button variant="primary">Primary action (default)</Button>
<Button variant="secondary">Secondary action</Button>
<Button variant="ghost">Subtle action</Button>
<Button variant="danger">Destructive action</Button>
```

**Sizes:**
```typescript
<Button size="sm">Small</Button>
<Button size="md">Medium (default)</Button>
<Button size="lg">Large</Button>
```

**States:**
```typescript
<Button loading={true}>Performs action (spinner + disabled)</Button>
<Button disabled={true}>Disabled</Button>
<Button ariaLabel="Save document">Icon-only button</Button>
```

**Features:**
- ✅ Loading spinner auto-hides when `loading={false}`
- ✅ Button auto-disables while loading
- ✅ `aria-busy="true"` announced to screen readers
- ✅ Hover/active animations with scale effect
- ✅ Focus visible outline

---

### 3️⃣ Enhanced Input

Better accessibility with error states and labels.

**Basic Usage:**
```typescript
import { Input } from "@/components/ui/input";
import { useState } from "react";

export function EmailForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);

  return (
    <div>
      <label htmlFor="email" className="text-sm font-medium">
        Email Address
      </label>
      <Input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="john@example.com"
        error={error}
        required
      />
      {error && (
        <p id="email-error" className="text-sm text-red-600 mt-1">
          Please enter a valid email
        </p>
      )}
    </div>
  );
}
```

**Error State:**
```typescript
<Input 
  error={hasError}
  ariaDescribedBy="error-message"
/>
<p id="error-message" className="text-sm text-red-600">
  This field is required
</p>
```

**Features:**
- ✅ Red border/ring when `error={true}`
- ✅ Smooth focus transitions
- ✅ `aria-invalid` attribute set automatically
- ✅ `disabled` state with visual feedback
- ✅ Supports all standard input props

---

### 4️⃣ Toast Notifications

Global notification system with automatic announcements.

**Setup (Already Done!):**
```typescript
// app/providers.tsx - already includes ToastProvider
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </SessionProvider>
  );
}
```

**Usage:**
```typescript
import { useToast } from "@/lib/toast-context";

export function DeleteButton() {
  const { addToast } = useToast();

  const handleDelete = async () => {
    try {
      await deleteItem();
      addToast("Item deleted successfully", "success");
    } catch (error) {
      addToast("Failed to delete item", "error", 6000);
    }
  };

  return <button onClick={handleDelete}>Delete</button>;
}
```

**Toast Types:**
```typescript
// Success - Green with checkmark
addToast("Profile updated!", "success");

// Error - Red with alert icon (auto-announces with aria-live="assertive")
addToast("Payment failed", "error", 5000);

// Info - Blue with alert icon
addToast("New message received", "info");

// Loading - Spinner (never auto-dismisses)
addToast("Processing order…", "loading");
```

**Duration:**
```typescript
// Custom duration in milliseconds
addToast("Message", "info", 3000);  // 3 seconds
addToast("Message", "info", 8000);  // 8 seconds

// Loading toast (must manually trigger success/error)
addToast("Uploading…", "loading");
```

**Features:**
- ✅ Auto-dismiss after duration (except loading)
- ✅ Manual close button (except loading)
- ✅ Error toasts use `aria-live="assertive"` for urgency
- ✅ Success/info toasts use `aria-live="polite"`
- ✅ Smooth entrance/exit animations
- ✅ Respects motion preferences
- ✅ Renders at bottom-right corner
- ✅ Multiple toasts stack vertically

---

## 🎨 Complete Example

Real-world form with all new features:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/lib/toast-context";
import { Card } from "@/components/ui/card";

export function SignupForm() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Validate
      if (!formData.name) setErrors((p) => ({ ...p, name: "Name required" }));
      if (!formData.email) setErrors((p) => ({ ...p, email: "Email required" }));
      if (!formData.password) setErrors((p) => ({ ...p, password: "Password required" }));

      addToast("Account created! Redirecting…", "success");
      // redirect to dashboard
    } catch (error) {
      addToast("Failed to create account", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="text-sm font-medium block mb-2">
            Full Name
          </label>
          <Input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            error={!!errors.name}
            placeholder="John Doe"
            disabled={loading}
            required
          />
          {errors.name && (
            <p className="text-xs text-red-600 mt-1">{errors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="text-sm font-medium block mb-2">
            Email Address
          </label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            error={!!errors.email}
            placeholder="john@example.com"
            disabled={loading}
            required
          />
          {errors.email && (
            <p className="text-xs text-red-600 mt-1">{errors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="text-sm font-medium block mb-2">
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
            error={!!errors.password}
            placeholder="••••••••"
            disabled={loading}
            required
          />
          {errors.password && (
            <p className="text-xs text-red-600 mt-1">{errors.password}</p>
          )}
        </div>

        <Button
          type="submit"
          loading={loading}
          disabled={loading}
          className="w-full"
        >
          {loading ? "Creating Account" : "Sign Up"}
        </Button>
      </form>

      {/* Shows loading state with spinner */}
      {loading && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <LoadingSpinner size="sm" label="Saving account" />
          <span className="text-sm text-gray-600">Setting up your account…</span>
        </div>
      )}
    </Card>
  );
}
```

---

## ♿ Accessibility Features Built-In

### For LoadingSpinner
- ✅ `role="status"` for status region
- ✅ `aria-label` for context
- ✅ `sr-only` text for screen readers

### For Button
- ✅ `aria-busy="true"` while loading
- ✅ `aria-label` support for icon buttons
- ✅ Focus-visible outline
- ✅ Keyboard accessible

### For Input
- ✅ `aria-invalid="true"` when error
- ✅ `aria-describedby` for error messages
- ✅ Proper label association via `htmlFor`
- ✅ Focus styles

### For Toast
- ✅ `role="status"` for announcements
- ✅ `aria-live="polite"` for info/success
- ✅ `aria-live="assertive"` for errors
- ✅ `aria-atomic="true"` for full message

---

## 🧪 Testing Checklist

- [ ] Test with `prefers-reduced-motion` enabled
- [ ] Tab through form - all inputs focusable
- [ ] Use screen reader - all labels announced
- [ ] Test loading state - spinner visible, button disabled
- [ ] Test error state - red styling visible
- [ ] Test toast - appears and auto-dismisses
- [ ] Test touch targets - minimum 44x44px
- [ ] Test contrast ratios - WCAG AA compliant

---

## 📚 Related Files

- **Global Styles:** `app/globals.css` (animations, utilities)
- **Theme System:** `lib/theme.ts` (dark mode support)
- **Providers:** `app/providers.tsx` (Toast integration)
- **Layouts:** `app/(app)/layout.tsx` (Skip link)

---

## 🚀 Next Steps

1. **Start using** new components in forms and async operations
2. **Test** with accessibility tools (axe DevTools, NVDA)
3. **Gather feedback** from team and users
4. **Plan Phase 2** for additional components (Modal, Dropdown, etc.)

---

**Questions?** Check the implementation in:
- `components/ui/` for component code
- `lib/toast-context.tsx` for toast hook
- `app/globals.css` for animations and utilities

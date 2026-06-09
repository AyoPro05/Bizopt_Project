# BizOpt Component Library - Phase 1 & 2

Quick reference guide for developers

---

## 🎁 Phase 1 Components (Implemented)

### LoadingSpinner
Accessible, motion-safe loading indicator
```tsx
import { LoadingSpinner } from '@/components/loading-spinner';

<LoadingSpinner size="md" label="Loading posts..." />
// Sizes: 'sm' | 'md' | 'lg'
```

### Toast Notifications
Global notification system with auto-dismiss
```tsx
import { useToast } from '@/lib/toast-context';

const { addToast } = useToast();
addToast('Post saved!', 'success');
// Types: 'success' | 'error' | 'info' | 'warning'
```

### Button Enhancements
Loading state support with aria attributes
```tsx
<Button loading={isSaving} onClick={handleSave}>
  {isSaving ? 'Saving...' : 'Save'}
</Button>
```

### Input Enhancements
Error states and validation feedback
```tsx
<Input
  type="email"
  error={errors.email}
  aria-invalid={!!errors.email}
/>
```

---

## 🆕 Phase 2 Components (Just Added)

### Skeleton Loaders
Content placeholders for loading states
```tsx
import { Skeleton, SkeletonCard, SkeletonTable } from '@/components/skeleton';

// Single skeleton
<Skeleton width={200} height={20} />

// Card skeleton (common pattern)
<SkeletonCard lines={3} />

// Table skeleton
<SkeletonTable rows={5} cols={4} />
```

**Use Case:** Replace actual content while fetching data
```tsx
<Suspense fallback={<SkeletonCard />}>
  <CampaignCard id={campaignId} />
</Suspense>
```

### Empty States
Friendly messaging for empty lists and error states
```tsx
import { EmptyState, EmptySearchState, EmptyListState, EmptyErrorState } 
  from '@/components/empty-state';

// Generic empty state
<EmptyState
  title="No campaigns yet"
  description="Create your first campaign to get started"
  action={<Button href="/campaigns/new">Create Campaign</Button>}
/>

// Search results
<EmptySearchState query="xyz" />

// Data list
<EmptyListState title="No posts yet" action={<Button>Create</Button>} />

// Error state
<EmptyErrorState 
  title="Failed to load"
  action={<Button onClick={retry}>Try Again</Button>}
/>
```

### Error Boundary
Global error handling component
```tsx
import { ErrorBoundary } from '@/components/error-boundary';

<ErrorBoundary
  fallback={(error, reset) => (
    <div>
      <p>Something went wrong: {error.message}</p>
      <button onClick={reset}>Retry</button>
    </div>
  )}
>
  <YourComponent />
</ErrorBoundary>
```

---

## 📄 Error Pages (Just Added)

### Global Error (app/error.tsx)
Handles all uncaught errors
- Red gradient design
- "Try Again" button
- "Go to Home" link
- Error ID for debugging

### Not Found (app/not-found.tsx)
404 page design
- Purple gradient design
- Links to home and landing

### App Section Error (app/(app)/error.tsx)
Errors within authenticated section
- Themed for consistency
- Dashboard recovery link

---

## 🎨 Usage Patterns

### Loading Data with Skeleton
```tsx
export function PostList({ posts, loading }) {
  if (loading) return <SkeletonTable rows={5} />;
  if (posts.length === 0) return <EmptyListState />;
  
  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
```

### Form with Error Handling
```tsx
const { addToast } = useToast();

async function handleSubmit(data) {
  try {
    await api.createCampaign(data);
    addToast('Campaign created!', 'success');
    router.push('/campaigns');
  } catch (error) {
    addToast(error.message, 'error');
  }
}
```

### Search with Empty State
```tsx
function SearchCampaigns({ query, results }) {
  if (!query) return <EmptyListState title="Start searching..." />;
  if (results.length === 0) return <EmptySearchState query={query} />;
  
  return <CampaignsList campaigns={results} />;
}
```

---

## 🔄 Animation & Motion

### Respects Motion Preferences
All animations automatically disable for users with `prefers-reduced-motion`

### Available Animations
```css
/* Added in globals.css */
@keyframes fadeIn { /* 300ms ease-in-out */ }
@keyframes slideUp { /* 250ms cubic-bezier */ }

/* Use with Tailwind */
<div className="animate-fade-in" />
<div className="animate-slide-up" />
```

---

## ♿ Accessibility Features

### ARIA Labels
All interactive elements have proper labels
```tsx
<button aria-label="Close menu" onClick={close} />
<div role="status" aria-live="polite">Loading...</div>
```

### Keyboard Navigation
- Tab through all interactive elements
- Enter/Space to activate buttons
- Escape to close modals
- Skip link to main content

### Screen Readers
- Semantic HTML throughout
- ARIA labels on icon buttons
- Live regions for dynamic content
- Proper heading hierarchy

---

## 📦 Export Checklist

When using these components, ensure:

- [ ] Import from correct path (`@/components/...`)
- [ ] Pass required props (check TypeScript)
- [ ] Handle loading states with Suspense
- [ ] Provide meaningful empty state messages
- [ ] Use Toast for user feedback
- [ ] Wrap sections in error boundaries
- [ ] Test keyboard navigation
- [ ] Verify color contrast in dark mode

---

## 🚀 Phase 2+ Component Ideas

Planned (not yet implemented):
- [ ] Modal/Dialog
- [ ] Dropdown menu
- [ ] Tabs
- [ ] Accordion
- [ ] Pagination
- [ ] Breadcrumbs
- [ ] Progress bar
- [ ] Tooltip
- [ ] Popover
- [ ] Combobox/Select

---

## 📚 Resources

- **Component Source:** `/components/`
- **Icons:** lucide-react (100+ icons)
- **Colors:** CSS variables in globals.css
- **Tailwind:** Tailwind v4 (latest)
- **Docs:** See `/docs/PHASE1_QUICK_START.md`

---

**Questions?** Check the corresponding component file or docs.

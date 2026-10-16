import { Skeleton } from "@/components/skeleton";

export default function SeoLoading() {
  return <div aria-label="Loading SEO workspace" className="space-y-5"><Skeleton height={48} width={224} /><Skeleton height={160} /><div className="grid gap-4 md:grid-cols-3"><Skeleton height={192} /><Skeleton height={192} /><Skeleton height={192} /></div></div>;
}

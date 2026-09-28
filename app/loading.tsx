import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <main className="container prose" role="status">
      <span>Carregando página…</span>
      <Skeleton className="mt-8 h-12 w-2/3" />
      <Skeleton className="mt-8 h-48 w-full" />
    </main>
  );
}

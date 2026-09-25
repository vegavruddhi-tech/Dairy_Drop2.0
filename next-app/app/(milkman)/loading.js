import { CowLoaderPanel } from '@/components/ui/CowLoader.jsx';

/**
 * Scoped to the route group rather than the app root: a root-level loading
 * boundary flushes the response before the layout's auth check runs, which
 * downgrades a clean 307 redirect to a client-side one. Sitting below the gate,
 * it only ever covers pages the visitor may see.
 */
export default function Loading() {
  return (
    <CowLoaderPanel
      label="Milkman Portal"
      message="Loading your morning round…"
      submessage="Preparing today's delivery route, household drops & extra orders"
    />
  );
}

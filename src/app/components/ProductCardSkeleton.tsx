import { Card, CardContent, CardFooter } from './ui/card';
import { Skeleton } from './ui/skeleton';

export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden" aria-hidden="true">
      <Skeleton className="h-64 w-full rounded-none" />
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-6 w-24" />
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Skeleton className="h-9 w-full" />
      </CardFooter>
    </Card>
  );
}

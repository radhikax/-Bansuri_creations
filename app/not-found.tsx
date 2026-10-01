import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-3xl md:text-4xl mb-4">We couldn&apos;t find that page</h1>
      <Link href="/" className="text-primary hover:underline">
        Back to shopping
      </Link>
    </div>
  );
}

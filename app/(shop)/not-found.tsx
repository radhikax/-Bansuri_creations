import RootNotFound from '../not-found';

// notFound() from a (shop) page renders the nearest not-found boundary. Living
// inside (shop) means that is this one, rendered within (shop)/layout.tsx, so
// a missing product or category keeps the header, nav, cart and <main>
// landmark. The root app/not-found.tsx still handles URLs no route matches.
export default function ShopNotFound() {
  return <RootNotFound />;
}

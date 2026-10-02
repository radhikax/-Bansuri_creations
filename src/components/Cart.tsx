'use client';

import { Plus, Minus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Separator } from './ui/separator';
import type { ShippingSettings } from '../lib/api';
import { browserApi } from '../lib/api/client';
import { calculateShipping } from '../lib/shipping';
import { useCart } from './cart/CartProvider';
import { CheckoutDialog } from './CheckoutDialog';

export function Cart() {
  const { items, setQuantity, remove, clear, isOpen, open, close } = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [shippingSettings, setShippingSettings] = useState<ShippingSettings | null>(null);
  const shippingRequestInFlight = useRef(false);

  // Refetch on every open so a failed request is retried and an admin's
  // shipping change is picked up without a reload; the last good settings
  // stay on screen meanwhile.
  useEffect(() => {
    if (!isOpen || shippingRequestInFlight.current) return;
    shippingRequestInFlight.current = true;
    browserApi
      .GET('/api/settings/shipping')
      .then(({ data }) => {
        if (data) setShippingSettings(data);
      })
      .catch(() => {
        // Network failure: keep the last good settings, or "Calculated at checkout" if none yet.
      })
      .finally(() => {
        shippingRequestInFlight.current = false;
      });
  }, [isOpen]);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // null while the store's shipping settings are loading or unavailable.
  const shipping = shippingSettings ? calculateShipping(subtotal, shippingSettings) : null;
  const total = subtotal + (shipping ?? 0);
  const shippingLabel = shipping === null ? 'Calculated at checkout' : shipping === 0 ? 'Free' : `₹${shipping}`;

  const handleCheckout = () => {
    close();
    setCheckoutOpen(true);
  };

  const handleBackToCart = () => {
    setCheckoutOpen(false);
    open();
  };

  // Payment succeeded: empty the saved cart (it's a one-shot demo, nothing to
  // keep) and leave both popups closed — don't reopen the sheet here.
  const handlePaid = () => {
    setCheckoutOpen(false);
    clear();
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={close}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle>Shopping Cart ({items.length})</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-6xl mb-4">🛍️</div>
                <p className="text-lg mb-2">Your cart is empty</p>
                <p className="text-sm text-muted-foreground">
                  Add some beautiful handmade items to get started!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="relative w-24 h-24 shrink-0 overflow-hidden rounded">
                      <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" />
                    </div>
                    <div className="flex-1">
                      <h4 className="line-clamp-2 mb-1">{item.name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {item.category}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            aria-label="Decrease quantity"
                            onClick={() => setQuantity(item.id, Math.max(1, item.quantity - 1))}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            aria-label="Increase quantity"
                            onClick={() => setQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>₹{item.price * item.quantity}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`Remove ${item.name}`}
                            onClick={() => remove(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="px-4 pb-4">
              <Separator className="mb-4" />
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Shipping</span>
                  <span>{shippingLabel}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between">
                  <span>Total</span>
                  <span>₹{total}</span>
                </div>
              </div>
              <Button className="w-full mt-4" size="lg" onClick={handleCheckout}>
                Proceed to Checkout
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CheckoutDialog
        open={checkoutOpen}
        items={items}
        subtotal={subtotal}
        shippingLabel={shippingLabel}
        total={total}
        onBackToCart={handleBackToCart}
        onPaid={handlePaid}
      />
    </>
  );
}

'use client';

import { CreditCard, Smartphone, Building2, Wallet, Check, ChevronLeft } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Separator } from './ui/separator';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Input } from './ui/input';
import type { CartItem } from './cart/CartProvider';

const CHECKOUT_STEPS = ['Shipping', 'Payment', 'Review'] as const;
type CheckoutStep = 0 | 1 | 2;

interface ShippingDetails {
  fullName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
}

const emptyShipping: ShippingDetails = {
  fullName: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
};

function isShippingComplete(shipping: ShippingDetails) {
  return Object.values(shipping).every((value) => value.trim().length > 0);
}

const paymentMethods = [
  {
    id: 'upi',
    name: 'UPI',
    description: 'Pay using PhonePe, Google Pay, Paytm',
    icon: <Smartphone className="h-5 w-5" />,
  },
  {
    id: 'card',
    name: 'Credit/Debit Card',
    description: 'Visa, MasterCard, RuPay',
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    id: 'netbanking',
    name: 'Net Banking',
    description: 'All major banks supported',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    id: 'wallet',
    name: 'Wallets',
    description: 'Paytm, PhonePe, Amazon Pay',
    icon: <Wallet className="h-5 w-5" />,
  },
  {
    id: 'cod',
    name: 'Cash on Delivery',
    description: 'Pay when you receive',
    icon: <Wallet className="h-5 w-5" />,
  },
];

interface CheckoutDialogProps {
  open: boolean;
  items: CartItem[];
  subtotal: number;
  shippingLabel: string;
  total: number;
  /** Back to cart: closes this dialog and reopens the cart sheet — never zero popups on the way back. */
  onBackToCart: () => void;
  /** The demo Pay button: closes this dialog without reopening the cart. */
  onPaid: () => void;
}

/**
 * The cart's checkout flow (Shipping → Payment → Review), extracted from
 * Cart.tsx. This is the same demo form as before — only the "Cancel"/Back
 * action changed, to always hand control back to the cart sheet instead of
 * leaving no popup open.
 */
export function CheckoutDialog({ open, items, subtotal, shippingLabel, total, onBackToCart, onPaid }: CheckoutDialogProps) {
  const [step, setStep] = useState<CheckoutStep>(0);
  const [direction, setDirection] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState('upi');
  const [shippingDetails, setShippingDetails] = useState<ShippingDetails>(emptyShipping);
  const shouldReduceMotion = useReducedMotion();

  // Every fresh "Proceed to Checkout" starts back on the Shipping step —
  // but keeps whatever the shopper already typed, same as before extraction.
  useEffect(() => {
    if (open) {
      setStep(0);
      setDirection(1);
    }
  }, [open]);

  const goToStep = (next: CheckoutStep) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const handlePayment = () => {
    // Here you would integrate with actual payment gateway
    alert(`Payment initiated via ${selectedPayment}. This is a demo - no actual payment will be processed.`);
    setShippingDetails(emptyShipping);
    onPaid();
  };

  const updateShippingField = (field: keyof ShippingDetails) => (e: ChangeEvent<HTMLInputElement>) => {
    setShippingDetails((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const stepVariants = {
    enter: (dir: number) => ({ x: shouldReduceMotion ? 0 : dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: shouldReduceMotion ? 0 : dir > 0 ? -40 : 40, opacity: 0 }),
  };

  const selectedPaymentMethod = paymentMethods.find((m) => m.id === selectedPayment);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onBackToCart(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{CHECKOUT_STEPS[step]}</DialogTitle>
          <DialogDescription>
            {step === 0 && 'Tell us where to deliver your order'}
            {step === 1 && 'Select your preferred payment option'}
            {step === 2 && 'Review your order before you pay'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center mb-2">
          {CHECKOUT_STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-sm transition-colors duration-300 ${
                    i <= step
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              {i < CHECKOUT_STEPS.length - 1 && (
                <div className="flex-1 h-0.5 bg-border mx-2 mb-4 relative overflow-hidden rounded-full">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-primary rounded-full"
                    initial={false}
                    animate={{ width: i < step ? '100%' : '0%' }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="py-2"
            >
              {step === 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="fullName">Full name</Label>
                      <Input
                        id="fullName"
                        value={shippingDetails.fullName}
                        onChange={updateShippingField('fullName')}
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={shippingDetails.address}
                        onChange={updateShippingField('address')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" value={shippingDetails.city} onChange={updateShippingField('city')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="state">State</Label>
                      <Input id="state" value={shippingDetails.state} onChange={updateShippingField('state')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pincode">Pincode</Label>
                      <Input
                        id="pincode"
                        value={shippingDetails.pincode}
                        onChange={updateShippingField('pincode')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" value={shippingDetails.phone} onChange={updateShippingField('phone')} />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={onBackToCart}>
                      Back to cart
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!isShippingComplete(shippingDetails)}
                      onClick={() => goToStep(1)}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Total Amount</span>
                      <span className="font-semibold">₹{total}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {items.length} item{items.length > 1 ? 's' : ''} in cart
                    </p>
                  </div>

                  <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment}>
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className="flex items-center space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent cursor-pointer"
                        onClick={() => setSelectedPayment(method.id)}
                      >
                        <RadioGroupItem value={method.id} id={method.id} />
                        <div className="flex items-center gap-3 flex-1">
                          <div className="text-primary">{method.icon}</div>
                          <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                            <div className="font-medium">{method.name}</div>
                            <div className="text-sm text-muted-foreground">{method.description}</div>
                          </Label>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => goToStep(0)}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <Button className="flex-1" onClick={() => goToStep(2)}>
                      Review Order
                    </Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="rounded-md border p-4 space-y-1">
                    <div className="text-sm font-medium mb-1">Deliver to</div>
                    <p className="text-sm text-muted-foreground">
                      {shippingDetails.fullName}, {shippingDetails.address}, {shippingDetails.city},{' '}
                      {shippingDetails.state} {shippingDetails.pincode}
                    </p>
                    <p className="text-sm text-muted-foreground">{shippingDetails.phone}</p>
                  </div>

                  <div className="rounded-md border p-4 flex items-center gap-3">
                    <div className="text-primary">{selectedPaymentMethod?.icon}</div>
                    <div>
                      <div className="text-sm font-medium">{selectedPaymentMethod?.name}</div>
                      <div className="text-xs text-muted-foreground">{selectedPaymentMethod?.description}</div>
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>₹{subtotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Shipping</span>
                      <span>{shippingLabel}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>₹{total}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => goToStep(1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <Button className="flex-1" onClick={handlePayment}>
                      Pay ₹{total}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

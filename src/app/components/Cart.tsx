import { X, Plus, Minus, Trash2, CreditCard, Smartphone, Building2, Wallet, Check, ChevronLeft } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Product } from '../types';
import { imageSrcSet, optimizedImageUrl } from '../lib/images';

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

export interface CartItem extends Product {
  quantity: number;
}

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
}

export function Cart({ isOpen, onClose, items, onUpdateQuantity, onRemoveItem }: CartProps) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [step, setStep] = useState<CheckoutStep>(0);
  const [direction, setDirection] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState('upi');
  const [shippingDetails, setShippingDetails] = useState<ShippingDetails>(emptyShipping);
  const shouldReduceMotion = useReducedMotion();

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal > 0 ? 50 : 0;
  const total = subtotal + shipping;

  const handleCheckout = () => {
    setStep(0);
    setDirection(1);
    setCheckoutOpen(true);
  };

  const goToStep = (next: CheckoutStep) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const handlePayment = () => {
    // Here you would integrate with actual payment gateway
    alert(`Payment initiated via ${selectedPayment}. This is a demo - no actual payment will be processed.`);
    setCheckoutOpen(false);
    setShippingDetails(emptyShipping);
    onClose();
  };

  const updateShippingField = (field: keyof ShippingDetails) => (e: ChangeEvent<HTMLInputElement>) => {
    setShippingDetails((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const stepVariants = {
    enter: (dir: number) => ({ x: shouldReduceMotion ? 0 : dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: shouldReduceMotion ? 0 : dir > 0 ? -40 : 40, opacity: 0 }),
  };

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

  const selectedPaymentMethod = paymentMethods.find((m) => m.id === selectedPayment);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
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
                    <img
                      src={optimizedImageUrl(item.image, 160)}
                      srcSet={imageSrcSet(item.image, 160)}
                      loading="lazy"
                      alt={item.name}
                      className="w-24 h-24 object-cover rounded"
                    />
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
                            onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            aria-label="Increase quantity"
                            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
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
                            onClick={() => onRemoveItem(item.id)}
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
                  <span>{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
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

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
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
                      <Button variant="outline" className="flex-1" onClick={() => setCheckoutOpen(false)}>
                        Cancel
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
                        <span>{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
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
    </>
  );
}
import { useState } from 'react';
import { Menu, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Link } from 'react-router-dom';
import logo from '../../assets/933b21dd0e7f43328405b2f83783e6907d3d0236.png';
import { CART_ICON_ATTR } from '../lib/flyToCart';
import type { AdaptedCategory } from '../lib/adapters';

interface HeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
  categories: AdaptedCategory[];
}

export function Header({ cartItemsCount, onCartClick, categories }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = [
    { to: '/', label: 'Home' },
    ...categories.map((c) => ({ to: `/category/${c.slug}`, label: c.title })),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Phone menu */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-4">
                  {navLinks.map((link) => (
                    <SheetClose asChild key={link.to}>
                      <Link to={link.to} className="rounded-md px-2 py-2 text-base hover:bg-accent hover:text-primary transition-colors">
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <img src={logo} alt="Bansuri Creations" className="h-12 w-12 object-contain" />
              <span className="text-xl">Bansuri Creations</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className="text-sm hover:text-primary transition-colors">
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Cart Button */}
          <Button variant="outline" className="relative" onClick={onCartClick} {...{ [CART_ICON_ATTR]: true }}>
            <ShoppingCart className="h-5 w-5" />
            {cartItemsCount > 0 && (
              <motion.div
                key={cartItemsCount}
                initial={{ scale: 1.5 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                className="absolute -top-2 -right-2"
              >
                <Badge className="h-5 w-5 flex items-center justify-center p-0 bg-primary">
                  {cartItemsCount}
                </Badge>
              </motion.div>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}

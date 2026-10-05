'use client';

import { ChevronDown, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import logo from '../assets/933b21dd0e7f43328405b2f83783e6907d3d0236.png';
import { CART_ICON_ATTR } from '../lib/flyToCart';
import type { AdaptedCategory } from '../lib/adapters';
import { useCart } from './cart/CartProvider';

interface HeaderProps {
  categories: AdaptedCategory[];
}

export function Header({ categories }: HeaderProps) {
  const { count, open } = useCart();
  const navLinks = [
    { to: '/', label: 'Home' },
    ...categories.map((c) => ({ to: `/category/${c.slug}`, label: c.title })),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-2">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <Image src={logo} alt="Bansuri Creations" className="h-12 w-12 object-contain" />
            {/* The name is in the logo image too; the text needs room only from sm up. */}
            <span className="hidden text-xl sm:inline">Bansuri Creations</span>
          </Link>

          {/* Navigation: every link inline from lg; below that, Home plus a
              Categories dropdown that opens down from this same top bar. */}
          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link key={link.to} href={link.to} className="text-sm hover:text-primary transition-colors">
                {link.label}
              </Link>
            ))}
          </nav>
          <nav className="flex items-center gap-1 lg:hidden">
            <Link href="/" className="rounded-md px-2 py-2 text-sm hover:text-primary transition-colors">
              Home
            </Link>
            {categories.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-1 px-2 text-sm font-normal">
                    Categories
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-48">
                  {categories.map((c) => (
                    <DropdownMenuItem key={c.slug} asChild>
                      <Link href={`/category/${c.slug}`} className="text-base">
                        {c.title}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          {/* Cart Button */}
          <Button variant="outline" className="relative" onClick={open} aria-label="Open cart" {...{ [CART_ICON_ATTR]: true }}>
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <motion.div
                key={count}
                initial={{ scale: 1.5 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                className="absolute -top-2 -right-2"
              >
                <Badge className="h-5 w-5 flex items-center justify-center p-0 bg-primary">
                  {count}
                </Badge>
              </motion.div>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}

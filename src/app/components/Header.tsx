import { ShoppingCart } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Link } from 'react-router-dom';
import logo from '../../assets/933b21dd0e7f43328405b2f83783e6907d3d0236.png';

interface HeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
}

export function Header({ cartItemsCount, onCartClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Bansuri Creations" className="h-12 w-12 object-contain" />
            <span className="text-xl">Bansuri Creations</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm hover:text-primary transition-colors">
              Home
            </Link>
            <Link to="/category/wedding-packing" className="text-sm hover:text-primary transition-colors">
              Wedding Packing
            </Link>
            <Link to="/category/festive-decoration" className="text-sm hover:text-primary transition-colors">
              Festive Decor
            </Link>
            <Link to="/category/diwali-decor" className="text-sm hover:text-primary transition-colors">
              Diwali Decor
            </Link>
            <Link to="/category/kanha-dresses" className="text-sm hover:text-primary transition-colors">
              Kanha Dresses
            </Link>
            <Link to="/category/customized-gifting" className="text-sm hover:text-primary transition-colors">
              Gifting
            </Link>
          </nav>

          {/* Cart Button */}
          <Button variant="outline" className="relative" onClick={onCartClick}>
            <ShoppingCart className="h-5 w-5" />
            {cartItemsCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-primary">
                {cartItemsCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
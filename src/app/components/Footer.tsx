import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from 'lucide-react';
import { Separator } from './ui/separator';
import { Link } from 'react-router-dom';
import logo from '../../assets/933b21dd0e7f43328405b2f83783e6907d3d0236.png';

export function Footer() {
  return (
    <footer className="bg-muted/50 mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={logo} alt="Bansuri Creations" className="h-10 w-10 object-contain" />
              <h3 className="font-semibold">Bansuri Creations</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Handcrafted decorative items for festivals, weddings, and special occasions. Made with love and tradition.
            </p>
            <div className="flex gap-3">
              <a href="https://instagram.com/bansuricreations" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="hover:text-primary transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="hover:text-primary transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/" className="hover:text-primary transition-colors">Contact</Link></li>
              <li><Link to="/" className="hover:text-primary transition-colors">FAQs</Link></li>
              <li><Link to="/" className="hover:text-primary transition-colors">Shipping Policy</Link></li>
              <li><Link to="/" className="hover:text-primary transition-colors">Return Policy</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-semibold mb-4">Categories</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/category/wedding-packing" className="hover:text-primary transition-colors">Wedding Packing</Link></li>
              <li><Link to="/category/festive-decoration" className="hover:text-primary transition-colors">Festive Decoration</Link></li>
              <li><Link to="/category/diwali-decor" className="hover:text-primary transition-colors">Diwali Decor</Link></li>
              <li><Link to="/category/kanha-dresses" className="hover:text-primary transition-colors">Kanha Dresses</Link></li>
              <li><Link to="/category/customized-gifting" className="hover:text-primary transition-colors">Customized Gifting</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>123 Craft Street, Mumbai, Maharashtra 400001</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span>info@bansuricreations.com</span>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />
        
        <div className="text-center text-sm text-muted-foreground">
          <p>© 2026 Bansuri Creations. All rights reserved. Handmade with ❤️ in India.</p>
        </div>
      </div>
    </footer>
  );
}
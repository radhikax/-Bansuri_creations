export interface ProductVariant {
  id: string;
  label: string;
  price: number;
  stock: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  images: string[];
  category: string;
  rating: number;
  inStock: boolean;
  variants?: ProductVariant[];
}

import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const categoriesData = [
  { name: 'Wedding Packing', slug: 'wedding-packing', description: 'Elegant packaging for Indian wedding favors and return gifts', imageUrl: 'https://images.unsplash.com/photo-1610377507996-dcd4f0cfc125', icon: '🎁' },
  { name: 'Festive Decoration', slug: 'festive-decoration', description: 'Wall hangings, bandhanwar, and traditional festive decor', imageUrl: 'https://images.unsplash.com/photo-1762173886363-de541417e48e', icon: '🪔' },
  { name: 'Diwali Decor', slug: 'diwali-decor', description: 'Special Diwali collection - diyas, lights, rangoli & more', imageUrl: 'https://images.unsplash.com/photo-1666244453401-43a8c15b5640', icon: '✨' },
  { name: 'Kanha Dresses', slug: 'kanha-dresses', description: 'Traditional dresses for Kanha Ji in all sizes', imageUrl: 'https://images.unsplash.com/photo-1653794354513-4b6d139408f0', icon: '🪈' },
  { name: 'Customized Gifting', slug: 'customized-gifting', description: 'Personalized gifts for birthdays, anniversaries & all occasions', imageUrl: 'https://images.unsplash.com/photo-1674620213535-9b2a2553ef40', icon: '💝' },
];

interface ProductSeed {
  name: string;
  slug: string;
  categorySlug: string;
  basePrice: number;
  originalPrice?: number;
  imageUrl: string;
  rating: number;
  variants: { label: string; price?: number; stock: number; sku: string }[];
}

const productsData: ProductSeed[] = [
  { name: 'Indian Wedding Gift Boxes (Set of 10)', slug: 'indian-wedding-gift-boxes', categorySlug: 'wedding-packing', basePrice: 799, originalPrice: 999, imageUrl: 'https://images.unsplash.com/photo-1610377507996-dcd4f0cfc125', rating: 4.5, variants: [{ label: 'Default', stock: 25, sku: 'WGB-001' }] },
  { name: 'Shaadi Favor Pouches (Set of 25)', slug: 'shaadi-favor-pouches', categorySlug: 'wedding-packing', basePrice: 899, originalPrice: 1199, imageUrl: 'https://images.unsplash.com/photo-1610377507996-dcd4f0cfc125', rating: 5, variants: [{ label: 'Default', stock: 25, sku: 'SFP-001' }] },
  { name: 'Handmade Bandhanwar Door Hanging', slug: 'handmade-bandhanwar-door-hanging', categorySlug: 'festive-decoration', basePrice: 599, originalPrice: 799, imageUrl: 'https://images.unsplash.com/photo-1752578856345-b947695803bd', rating: 4.5, variants: [{ label: 'Default', stock: 30, sku: 'BDH-001' }] },
  { name: 'Traditional Wall Hanging Set', slug: 'traditional-wall-hanging-set', categorySlug: 'festive-decoration', basePrice: 899, originalPrice: 1199, imageUrl: 'https://images.unsplash.com/photo-1762173886363-de541417e48e', rating: 5, variants: [{ label: 'Default', stock: 20, sku: 'TWH-001' }] },
  { name: 'Diwali Special Diyas Set (12 pieces)', slug: 'diwali-special-diyas-set', categorySlug: 'diwali-decor', basePrice: 499, originalPrice: 699, imageUrl: 'https://images.unsplash.com/photo-1510658018161-abde712032db', rating: 5, variants: [{ label: 'Default', stock: 40, sku: 'DSD-001' }] },
  { name: 'Diwali Decorative Lights & Lanterns', slug: 'diwali-decorative-lights-lanterns', categorySlug: 'diwali-decor', basePrice: 799, originalPrice: 999, imageUrl: 'https://images.unsplash.com/photo-1666244453401-43a8c15b5640', rating: 4.5, variants: [{ label: 'Default', stock: 30, sku: 'DDL-001' }] },
  { name: 'Diwali Rangoli Stencils & Colors Set', slug: 'diwali-rangoli-stencils-colors-set', categorySlug: 'diwali-decor', basePrice: 399, originalPrice: 549, imageUrl: 'https://images.unsplash.com/photo-1635192592106-77a5aacbe1a3', rating: 4, variants: [{ label: 'Default', stock: 35, sku: 'DRS-001' }] },
  { name: 'Kanha Ji Dress', slug: 'kanha-ji-dress', categorySlug: 'kanha-dresses', basePrice: 599, originalPrice: 799, imageUrl: 'https://images.unsplash.com/photo-1653794354513-4b6d139408f0', rating: 5, variants: [
    { label: 'Small', stock: 15, sku: 'KJD-S' },
    { label: 'Medium', price: 799, stock: 15, sku: 'KJD-M' },
    { label: 'Large', price: 999, stock: 10, sku: 'KJD-L' },
  ] },
  { name: 'Birthday Gift Hamper with Personalization', slug: 'birthday-gift-hamper', categorySlug: 'customized-gifting', basePrice: 1299, originalPrice: 1599, imageUrl: 'https://images.unsplash.com/photo-1674620213535-9b2a2553ef40', rating: 4.5, variants: [{ label: 'Default', stock: 15, sku: 'BGH-001' }] },
  { name: 'Custom Name Gift Box', slug: 'custom-name-gift-box', categorySlug: 'customized-gifting', basePrice: 899, imageUrl: 'https://images.unsplash.com/photo-1759887243702-903dc6661a90', rating: 4, variants: [{ label: 'Default', stock: 20, sku: 'CNG-001' }] },
  { name: 'Festive Toran (Door Decoration)', slug: 'festive-toran', categorySlug: 'festive-decoration', basePrice: 449, originalPrice: 599, imageUrl: 'https://images.unsplash.com/photo-1752578856345-b947695803bd', rating: 4.5, variants: [{ label: 'Default', stock: 25, sku: 'FTD-001' }] },
  { name: 'Mehndi Ceremony Return Gifts (Set of 50)', slug: 'mehndi-ceremony-return-gifts', categorySlug: 'wedding-packing', basePrice: 1499, originalPrice: 1999, imageUrl: 'https://images.unsplash.com/photo-1610377507996-dcd4f0cfc125', rating: 4.5, variants: [{ label: 'Default', stock: 0, sku: 'MCR-001' }] },
  { name: 'Anniversary Gift Set with Custom Message', slug: 'anniversary-gift-set', categorySlug: 'customized-gifting', basePrice: 1599, imageUrl: 'https://images.unsplash.com/photo-1759887243702-903dc6661a90', rating: 5, variants: [{ label: 'Default', stock: 10, sku: 'AGS-001' }] },
  { name: 'Diwali Decor Combo Pack', slug: 'diwali-decor-combo-pack', categorySlug: 'diwali-decor', basePrice: 1199, originalPrice: 1599, imageUrl: 'https://images.unsplash.com/photo-1759397576098-c1f33b34088f', rating: 5, variants: [{ label: 'Default', stock: 20, sku: 'DDC-001' }] },
];

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  for (const cat of categoriesData) {
    await prisma.category.upsert({ where: { slug: cat.slug }, update: {}, create: cat });
  }

  for (const p of productsData) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: p.categorySlug } });
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        description: p.name,
        categoryId: category.id,
        basePrice: p.basePrice,
        originalPrice: p.originalPrice,
        imageUrl: p.imageUrl,
        rating: p.rating,
        variants: { create: p.variants },
      },
    });
  }

  await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, flatShippingFee: 50, freeShippingThreshold: 999 },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'changeme123';
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 10) },
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDatabase(prisma)
    .then(() => {
      console.log('Seed complete');
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}

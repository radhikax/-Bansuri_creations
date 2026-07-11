import { Router } from 'express';
import { categories, products } from '../data/products.js';

const router = Router();

// GET /api/categories
router.get('/', (_req, res) => {
  res.json(categories);
});

// GET /api/categories/:title/products
router.get('/:title/products', (req, res) => {
  const title = decodeURIComponent(req.params.title).toLowerCase();
  const category = categories.find((c) => c.title.toLowerCase() === title);
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }
  res.json(products.filter((p) => p.category.toLowerCase() === title));
});

export default router;

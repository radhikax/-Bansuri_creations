import { Router } from 'express';
import { products } from '../data/products.js';

const router = Router();

// GET /api/products?category=...&search=...&inStock=true
router.get('/', (req, res) => {
  let result = products;
  const { category, search, inStock } = req.query;

  if (category) {
    result = result.filter(
      (p) => p.category.toLowerCase() === String(category).toLowerCase()
    );
  }
  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter((p) => p.name.toLowerCase().includes(q));
  }
  if (inStock !== undefined) {
    result = result.filter((p) => p.inStock === (inStock === 'true'));
  }

  res.json(result);
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = products.find((p) => p.id === Number(req.params.id));
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

export default router;

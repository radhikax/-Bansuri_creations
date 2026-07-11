import { Router } from 'express';
import { products } from '../data/products.js';

const router = Router();

// In-memory cart store keyed by cartId (a real app would use a database + auth)
const carts = new Map();

function getCart(cartId) {
  if (!carts.has(cartId)) {
    carts.set(cartId, []);
  }
  return carts.get(cartId);
}

function cartResponse(cartId) {
  const items = getCart(cartId);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  return { cartId, items, totalItems, total };
}

// GET /api/cart/:cartId
router.get('/:cartId', (req, res) => {
  res.json(cartResponse(req.params.cartId));
});

// POST /api/cart/:cartId/items  { productId, quantity? }
router.post('/:cartId/items', (req, res) => {
  const { productId, quantity = 1 } = req.body ?? {};
  const product = products.find((p) => p.id === Number(productId));
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  if (!product.inStock) {
    return res.status(400).json({ error: 'Product is out of stock' });
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be a positive integer' });
  }

  const cart = getCart(req.params.cartId);
  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ ...product, quantity });
  }
  res.status(201).json(cartResponse(req.params.cartId));
});

// PATCH /api/cart/:cartId/items/:productId  { quantity }
router.patch('/:cartId/items/:productId', (req, res) => {
  const { quantity } = req.body ?? {};
  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be a positive integer' });
  }
  const cart = getCart(req.params.cartId);
  const item = cart.find((i) => i.id === Number(req.params.productId));
  if (!item) {
    return res.status(404).json({ error: 'Item not in cart' });
  }
  item.quantity = quantity;
  res.json(cartResponse(req.params.cartId));
});

// DELETE /api/cart/:cartId/items/:productId
router.delete('/:cartId/items/:productId', (req, res) => {
  const cart = getCart(req.params.cartId);
  const index = cart.findIndex((i) => i.id === Number(req.params.productId));
  if (index === -1) {
    return res.status(404).json({ error: 'Item not in cart' });
  }
  cart.splice(index, 1);
  res.json(cartResponse(req.params.cartId));
});

// DELETE /api/cart/:cartId
router.delete('/:cartId', (req, res) => {
  carts.set(req.params.cartId, []);
  res.json(cartResponse(req.params.cartId));
});

export default router;

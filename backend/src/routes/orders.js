import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { products } from '../data/products.js';

const router = Router();

// In-memory order store (a real app would use a database)
const orders = new Map();

// POST /api/orders  { items: [{ productId, quantity }], customer: { name, email, address, phone? } }
router.post('/', (req, res) => {
  const { items, customer } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item' });
  }
  if (!customer?.name || !customer?.email || !customer?.address) {
    return res
      .status(400)
      .json({ error: 'Customer name, email, and address are required' });
  }

  const orderItems = [];
  for (const { productId, quantity } of items) {
    const product = products.find((p) => p.id === Number(productId));
    if (!product) {
      return res.status(400).json({ error: `Product ${productId} not found` });
    }
    if (!product.inStock) {
      return res.status(400).json({ error: `Product ${productId} is out of stock` });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be a positive integer' });
    }
    orderItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
    });
  }

  const order = {
    id: randomUUID(),
    items: orderItems,
    customer,
    total: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  orders.set(order.id, order);
  res.status(201).json(order);
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

export default router;

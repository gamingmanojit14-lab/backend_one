import { Router } from 'express';
import { prisma } from '../server.js';
import { authMiddleware } from '../utils/jwt.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const products = await prisma.product.findMany({
    where: { businessId: req.user.businessId },
    orderBy: { id: 'desc' }
  });
  res.json(products);
});

router.post('/', async (req, res) => {
  const product = await prisma.product.create({
    data: { ...req.body, businessId: req.user.businessId }
  });
  res.json(product);
});

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.product.updateMany({
    where: { id, businessId: req.user.businessId },
    data: req.body
  });
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await prisma.product.deleteMany({
    where: { id: parseInt(req.params.id), businessId: req.user.businessId }
  });
  res.json({ ok: true });
});

export default router;
import { Router } from 'express';
import { prisma } from '../server.js';
import { authMiddleware } from '../utils/jwt.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const customers = await prisma.customer.findMany({
    where: { businessId: req.user.businessId },
    orderBy: { id: 'desc' }
  });
  res.json(customers);
});

router.post('/', async (req, res) => {
  const customer = await prisma.customer.create({
    data: { ...req.body, businessId: req.user.businessId }
  });
  res.json(customer);
});

router.get('/due', async (req, res) => {
  const customers = await prisma.customer.findMany({
    where: { businessId: req.user.businessId, due: { gt: 0 } },
    orderBy: { due: 'desc' }
  });
  res.json(customers);
});

export default router;
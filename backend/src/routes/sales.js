import { Router } from 'express';
import { prisma } from '../server.js';
import { authMiddleware } from '../utils/jwt.js';

const router = Router();
router.use(authMiddleware);

async function generateInvoiceNo(businessId) {
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const prefix = `INV-${ymd}-`;
  const count = await prisma.sale.count({
    where: { businessId, invoiceNo: { startsWith: prefix } }
  });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

router.post('/', async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { items, customerId, type, discount, paid, paymentMethod } = req.body;

    if (!items?.length) return res.status(400).json({ error: 'No items' });

    const subtotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
    const total = subtotal - (discount || 0);
    const due = total - (paid || 0);
    const invoiceNo = await generateInvoiceNo(businessId);

    const sale = await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          businessId,
          invoiceNo,
          customerId: customerId || null,
          type: type || 'retail',
          subtotal,
          discount: discount || 0,
          total,
          paid: paid || 0,
          due,
          paymentMethod: paymentMethod || 'cash',
          items: {
            create: items.map(i => ({
              productId: i.productId,
              productName: i.productName,
              qty: i.qty,
              rate: i.rate,
              total: i.qty * i.rate
            }))
          }
        },
        include: { items: true }
      });

      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.qty } }
        });
      }

      if (customerId && due > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: { due: { increment: due } }
        });
      }

      return s;
    });

    res.json({ ok: true, sale });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/', async (req, res) => {
  const sales = await prisma.sale.findMany({
    where: { businessId: req.user.businessId },
    include: { customer: true, items: true },
    orderBy: { id: 'desc' },
    take: 200
  });
  res.json(sales);
});

router.get('/stats/today', async (req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);

  const agg = await prisma.sale.aggregate({
    where: {
      businessId: req.user.businessId,
      saleDate: { gte: start, lte: end }
    },
    _count: true,
    _sum: { total: true, paid: true, due: true }
  });

  res.json({
    count: agg._count,
    total: agg._sum.total || 0,
    paid: agg._sum.paid || 0,
    due: agg._sum.due || 0
  });
});

export default router;
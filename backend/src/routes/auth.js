import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../server.js';
import { signToken, authMiddleware } from '../utils/jwt.js';

const router = Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { businessName, ownerName, phone, password, address } = req.body;
    if (!businessName || !ownerName || !phone || !password) {
      return res.status(400).json({ error: 'সব তথ্য দিন' });
    }
    const exist = await prisma.business.findUnique({ where: { phone } });
    if (exist) return res.status(400).json({ error: 'এই ফোন দিয়ে অ্যাকাউন্ট আছে' });

    const hash = await bcrypt.hash(password, 10);
    const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const business = await prisma.business.create({
      data: {
        name: businessName,
        ownerName,
        phone,
        password: hash,
        address,
        plan: 'trial',
        planExpiry: trialEnd
      }
    });

    const token = signToken({ businessId: business.id, role: 'owner' });
    res.json({
      token,
      business: { id: business.id, name: business.name, plan: business.plan }
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const business = await prisma.business.findUnique({ where: { phone } });
    if (!business) return res.status(401).json({ error: 'ভুল ফোন বা পাসওয়ার্ড' });
    if (!business.isActive) return res.status(403).json({ error: 'অ্যাকাউন্ট বন্ধ' });
    if (!bcrypt.compareSync(password, business.password)) {
      return res.status(401).json({ error: 'ভুল ফোন বা পাসওয়ার্ড' });
    }
    const token = signToken({ businessId: business.id, role: 'owner' });
    res.json({
      token,
      business: { id: business.id, name: business.name, plan: business.plan }
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  const business = await prisma.business.findUnique({
    where: { id: req.user.businessId },
    select: { id: true, name: true, ownerName: true, phone: true, plan: true, planExpiry: true }
  });
  res.json(business);
});

export default router;
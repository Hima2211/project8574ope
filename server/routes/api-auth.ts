// Deprecated: Supabase wallet-login route removed. This file kept as a harmless stub
import { Router } from 'express';

const router = Router();

router.use((req, res) => {
  res.status(410).json({ error: 'Deprecated: wallet-login is removed. Use Privy auth only.' });
});

export default router;

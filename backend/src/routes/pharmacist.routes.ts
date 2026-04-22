import { Router } from 'express';
import { getDashboardStats, getInventory, addInventory, getOrders, approveOrder } from '../controllers/pharmacist.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = Router();

// Apply auth and strict role check middleware
router.use(protect);
router.use(restrictTo('admin', 'pharmacist'));

router.get('/dashboard-stats', getDashboardStats);
router.get('/inventory', getInventory);
router.post('/inventory', addInventory);
router.get('/orders', getOrders);
router.post('/orders/:id/approve', approveOrder);

export default router;

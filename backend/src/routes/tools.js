import express from 'express';
import {
  getAllTools,
  getTool,
} from '../controllers/toolsController.js';
import {
  getLatestReading,
  getReadingHistory,
} from '../controllers/readingsController.js';

const router = express.Router();

// More specific routes first
router.get('/:id/latest', getLatestReading);
router.get('/:id/history', getReadingHistory);
router.get('/:id', getTool);
router.get('/', getAllTools);

export default router;

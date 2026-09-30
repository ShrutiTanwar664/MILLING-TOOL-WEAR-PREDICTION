import express from 'express';
import {
  createReading,
  getLatestReading,
  getReadingHistory,
} from '../controllers/readingsController.js';

const router = express.Router();

router.post('/', createReading);

export default router;

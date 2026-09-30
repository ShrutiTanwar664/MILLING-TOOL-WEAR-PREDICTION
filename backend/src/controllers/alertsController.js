import pool from '../db/index.js';
import { getStatus } from '../services/decision.js';

/**
 * Get all alerts (readings with non-NORMAL status)
 * GET /alerts
 */
export async function getAllAlerts(req, res) {
  try {
    const result = await pool.query(
      `SELECT r.* FROM readings r
       WHERE r.status != 'NORMAL'
       ORDER BY r.created_at DESC`
    );

    // Enhance with recommendations
    const alerts = await Promise.all(
      result.rows.map(async (reading) => {
        const toolResult = await pool.query(
          'SELECT wear_limit FROM tools WHERE id = $1',
          [reading.tool_id]
        );
        const wearLimit = toolResult.rows[0]?.wear_limit || 170;
        const maxWear = Math.max(reading.wear_f1, reading.wear_f2, reading.wear_f3);
        const { recommendation } = getStatus(maxWear, wearLimit);
        return {
          ...reading,
          recommendation,
        };
      })
    );

    res.json(alerts);
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

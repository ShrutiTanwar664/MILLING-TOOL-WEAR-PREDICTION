import pool from '../db/index.js';
import { predict } from '../services/mlClient.js';
import { getStatus } from '../services/decision.js';

/**
 * Validate reading input
 */
function validateReading(body) {
  const required = ['tool_id', 'cut_number', 'force_x', 'force_y', 'force_z', 'vib_x', 'vib_y', 'vib_z', 'ae_rms'];
  
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
    if (typeof body[field] !== 'number') {
      return { valid: false, error: `Field ${field} must be a number` };
    }
  }

  if (body.tool_id <= 0 || !Number.isInteger(body.tool_id)) {
    return { valid: false, error: 'tool_id must be a positive integer' };
  }

  if (body.cut_number < 0 || !Number.isInteger(body.cut_number)) {
    return { valid: false, error: 'cut_number must be a non-negative integer' };
  }

  return { valid: true };
}

/**
 * Create a new reading
 * POST /readings
 */
export async function createReading(req, res) {
  try {
    // Validate input
    const validation = validateReading(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const {
      tool_id,
      cut_number,
      force_x,
      force_y,
      force_z,
      vib_x,
      vib_y,
      vib_z,
      ae_rms,
    } = req.body;

    // Verify tool exists and get wear_limit
    const toolResult = await pool.query(
      'SELECT id, wear_limit FROM tools WHERE id = $1',
      [tool_id]
    );

    if (toolResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    const wearLimit = toolResult.rows[0].wear_limit;

    // Call ML service to predict wear
    const prediction = await predict({
      cut_number,
      force_x,
      force_y,
      force_z,
      vib_x,
      vib_y,
      vib_z,
      ae_rms,
    });

    const { wear, rul, maxWear } = prediction;

    // Determine status
    const { status, recommendation } = getStatus(maxWear, wearLimit);

    // Insert into database
    const result = await pool.query(
      `INSERT INTO readings 
       (tool_id, cut_number, force_x, force_y, force_z, vib_x, vib_y, vib_z, ae_rms, wear_f1, wear_f2, wear_f3, rul, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        tool_id,
        cut_number,
        force_x,
        force_y,
        force_z,
        vib_x,
        vib_y,
        vib_z,
        ae_rms,
        wear[0], // wear_f1
        wear[1], // wear_f2
        wear[2], // wear_f3
        rul,
        status,
      ]
    );

    const savedReading = result.rows[0];

    res.status(201).json({
      ...savedReading,
      recommendation,
    });
  } catch (err) {
    console.error('Error creating reading:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get latest reading for a tool
 * GET /tools/:id/latest
 */
export async function getLatestReading(req, res) {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid tool ID' });
    }

    const result = await pool.query(
      `SELECT * FROM readings 
       WHERE tool_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No readings found for this tool' });
    }

    const reading = result.rows[0];
    const wearLimit = await getToolWearLimit(id);
    const { recommendation } = getStatus(Math.max(reading.wear_f1, reading.wear_f2, reading.wear_f3), wearLimit);

    res.json({
      ...reading,
      recommendation,
    });
  } catch (err) {
    console.error('Error fetching latest reading:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get reading history for a tool
 * GET /tools/:id/history
 */
export async function getReadingHistory(req, res) {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid tool ID' });
    }

    if (isNaN(limit) || limit <= 0) {
      return res.status(400).json({ error: 'Limit must be a positive number' });
    }

    const result = await pool.query(
      `SELECT * FROM readings 
       WHERE tool_id = $1 
       ORDER BY cut_number ASC 
       LIMIT $2`,
      [id, limit]
    );

    const wearLimit = await getToolWearLimit(id);
    const readings = result.rows.map((reading) => {
      const maxWear = Math.max(reading.wear_f1, reading.wear_f2, reading.wear_f3);
      const { recommendation } = getStatus(maxWear, wearLimit);
      return {
        ...reading,
        recommendation,
      };
    });

    res.json(readings);
  } catch (err) {
    console.error('Error fetching reading history:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Helper: Get tool wear limit
 */
async function getToolWearLimit(toolId) {
  const result = await pool.query(
    'SELECT wear_limit FROM tools WHERE id = $1',
    [toolId]
  );
  return result.rows.length > 0 ? result.rows[0].wear_limit : 170;
}

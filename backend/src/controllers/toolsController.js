import pool from '../db/index.js';

/**
 * Get all tools
 * GET /tools
 */
export async function getAllTools(req, res) {
  try {
    const result = await pool.query('SELECT * FROM tools ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tools:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get a specific tool
 * GET /tools/:id
 */
export async function getTool(req, res) {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid tool ID' });
    }

    const result = await pool.query(
      'SELECT * FROM tools WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching tool:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

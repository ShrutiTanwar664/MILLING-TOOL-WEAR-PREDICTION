-- Tools table
CREATE TABLE IF NOT EXISTS tools (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  wear_limit FLOAT DEFAULT 170,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Readings table
CREATE TABLE IF NOT EXISTS readings (
  id SERIAL PRIMARY KEY,
  tool_id INT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  cut_number INT NOT NULL,
  force_x FLOAT,
  force_y FLOAT,
  force_z FLOAT,
  vib_x FLOAT,
  vib_y FLOAT,
  vib_z FLOAT,
  ae_rms FLOAT,
  wear_f1 FLOAT,
  wear_f2 FLOAT,
  wear_f3 FLOAT,
  rul FLOAT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_readings_tool_id ON readings(tool_id);
CREATE INDEX IF NOT EXISTS idx_readings_status ON readings(status);
CREATE INDEX IF NOT EXISTS idx_readings_created_at ON readings(created_at DESC);

-- Seed initial tool
INSERT INTO tools (name, wear_limit) 
VALUES ('Tool-1', 170)
ON CONFLICT (name) DO NOTHING;

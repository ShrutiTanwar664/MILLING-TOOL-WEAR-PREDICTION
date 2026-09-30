# ToolSense Simulator

Generates realistic CNC tool wear data and simulates sensor readings to the ToolSense backend.

## Features

- **Test Data Generator**: Creates 315-row CSV with realistic wear progression
- **Data Simulator**: POSTs rows to backend at configurable intervals
- **Live Monitoring**: Displays wear progression, RUL, and status in real-time
- **Zero Dependencies**: Uses only Node.js built-ins (works with Node 18+)

## Quick Start

### 1. Generate Test Data
```bash
node generate-test-data.js
```

Creates `test_data.csv` with realistic sensor readings where:
- `force_y` and `force_z` increase with cutting (tool wear)
- `ae_rms` (acoustic emission) trends upward, indicating tool degradation
- Vibrations increase slightly as tool wears
- 315 total passes (0-314)

### 2. Run Simulator
With backend running on default port 3000:
```bash
node simulate.js
```

Or with custom settings:
```bash
node simulate.js --file test_data.csv --tool 1 --interval 500 --url http://localhost:3000
```

## CLI Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--file` | Path to CSV file | `./test_data.csv` |
| `--tool` | Tool ID in database | `1` |
| `--interval` | Delay between POSTs (ms) | `1000` |
| `--url` | Backend base URL | `http://localhost:3000` |

## Usage Examples

### Slow simulation (2 sec between reads, good for observation)
```bash
node generate-test-data.js
node simulate.js --interval 2000
```

### Fast data load (test with interval=100ms)
```bash
node simulate.js --file test_data.csv --tool 1 --interval 100 --url http://localhost:3000
```

### Use a custom CSV
```bash
node simulate.js --file /path/to/my_data.csv --tool 2 --interval 500
```

## Output Format

```
Time     | Cut | Status   | MaxWear | RUL  | Recommendation
---------|-----|----------|---------|------|---------------
14:32:10 |   0 | NORMAL   |    1.2  |  312 | Tool is operating normally
14:32:11 |   1 | NORMAL   |    1.8  |  310 | Tool is operating normally
...
14:33:42 | 280 | CRITICAL | 172.5   |    0 | Replace tool immediately to avoid tool breakage
```

Each row shows:
- **Time**: When POST completed
- **Cut**: Cut number from CSV
- **Status**: NORMAL, WARNING, or CRITICAL
- **MaxWear**: Maximum wear across all flutes (µm)
- **RUL**: Remaining useful life (cuts)
- **Recommendation**: Actionable advice

## CSV Format

Input CSV must have these columns:
```
cut_number,force_x,force_y,force_z,vib_x,vib_y,vib_z,ae_rms
```

Example:
```
cut_number,force_x,force_y,force_z,vib_x,vib_y,vib_z,ae_rms
0,120.5,120.3,131.2,0.32,0.28,0.35,0.15
1,120.8,121.1,132.8,0.31,0.29,0.36,0.18
...
314,139.2,188.9,200.1,0.68,0.72,0.71,2.48
```

## Test Data Characteristics

Generated data simulates a tool lifecycle over 315 cutting passes:

| Phase | Cuts | Force Trend | AE Trend | Status |
|-------|------|-------------|----------|--------|
| **Break-in** | 0-50 | Rapid rise | Rapid rise | NORMAL |
| **Steady** | 50-200 | Gradual rise | Gradual rise | NORMAL → WARNING |
| **Degradation** | 200-315 | Steep rise | Steep rise | WARNING → CRITICAL |

The generated CSV includes:
- Realistic noise on all sensor values
- Wear progression that triggers WARNING at ~136 µm (80% of 170 limit)
- Wear progression that triggers CRITICAL at ~170 µm

## Monitoring with Backend

While simulator runs, in another terminal:

```bash
# Watch alerts (status != NORMAL)
watch -n 1 'curl -s http://localhost:3000/alerts | jq ".[0:3]"'

# Check latest reading
curl http://localhost:3000/tools/1/latest | jq

# View full history
curl 'http://localhost:3000/tools/1/history?limit=20' | jq
```

## Troubleshooting

### CSV file not found
```
✗ File not found: ./test_data.csv
Tip: Generate test data first:
  node generate-test-data.js
```

### Connection refused
```
Error: HTTP 500: Internal server error
```
- Ensure backend is running: `cd ../backend && npm start`
- Check backend URL: `--url http://localhost:3000`
- Verify PostgreSQL is connected

### Tool not found (404)
```
Error: HTTP 404: Internal server error
```
- Verify tool ID exists in database: `curl http://localhost:3000/tools`
- Default tool is ID 1 (created at DB setup)

## Performance Notes

- **1000+ rows/sec** with interval=0 (not recommended; backend performs ML prediction on each)
- **Typical realistic rate**: 500-1000ms interval allows ML inference and logging
- **Data generation**: Creates 315 rows in ~1ms
- **No external dependencies**: Uses only Node.js built-in `fs` and native `fetch`

## Next Steps

1. **Analyze trends**: Query `/tools/:id/history` to plot wear over time
2. **Build dashboard**: Create frontend visualization
3. **Real data**: Replace `test_data.csv` with actual sensor CAN bus export
4. **Streaming**: Modify for continuous sensor feed (WebSocket, MQTT, etc.)

## Files

- **generate-test-data.js** - Generates `test_data.csv` with 315 realistic rows
- **simulate.js** - Main simulator; reads CSV and POSTs to backend
- **package.json** - npm scripts for convenience
- **README.md** - This file

## License

MIT

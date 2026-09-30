#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * ToolSense Data Simulator
 * 
 * Reads CSV file and POSTs rows to backend at configurable interval
 * 
 * Usage:
 *   node simulate.js --file data.csv --tool 1 --interval 500 --url http://localhost:3000
 */

// ============ CLI ARGUMENTS ============

function parseArgs() {
  const args = {
    file: './test_data.csv',
    tool: '1',
    interval: '1000',
    url: 'http://localhost:3000',
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    if (arg === '--file' && i + 1 < process.argv.length) {
      args.file = process.argv[++i];
    } else if (arg === '--tool' && i + 1 < process.argv.length) {
      args.tool = process.argv[++i];
    } else if (arg === '--interval' && i + 1 < process.argv.length) {
      args.interval = process.argv[++i];
    } else if (arg === '--url' && i + 1 < process.argv.length) {
      args.url = process.argv[++i];
    }
  }

  return args;
}

// ============ CSV PARSING ============

function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have header and at least one data row');
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row = {};

    for (let j = 0; j < headers.length; j++) {
      const value = values[j];
      // Convert numeric fields to numbers
      row[headers[j]] = isNaN(value) ? value : parseFloat(value);
    }

    rows.push(row);
  }

  return rows;
}

// ============ HTTP POSTING ============

async function postReading(toolId, reading, backendUrl) {
  const payload = {
    tool_id: toolId,
    cut_number: reading.cut_number,
    force_x: reading.force_x,
    force_y: reading.force_y,
    force_z: reading.force_z,
    vib_x: reading.vib_x,
    vib_y: reading.vib_y,
    vib_z: reading.vib_z,
    ae_rms: reading.ae_rms,
  };

  try {
    const response = await fetch(`${backendUrl}/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============ MAIN SIMULATOR ============

async function simulate() {
  const args = parseArgs();

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║         ToolSense Data Simulator                   ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  console.log('Configuration:');
  console.log(`  CSV File:   ${args.file}`);
  console.log(`  Tool ID:    ${args.tool}`);
  console.log(`  Interval:   ${args.interval} ms`);
  console.log(`  Backend:    ${args.url}\n`);

  // ===== VALIDATION =====
  if (!fs.existsSync(args.file)) {
    console.error(`✗ File not found: ${args.file}`);
    console.error(`\nTip: Generate test data first:`);
    console.error(`  node generate-test-data.js`);
    process.exit(1);
  }

  // ===== PARSE CSV =====
  let readings;
  try {
    const csvContent = fs.readFileSync(args.file, 'utf-8');
    readings = parseCSV(csvContent);
    console.log(`✓ Loaded ${readings.length} readings from CSV\n`);
  } catch (err) {
    console.error(`✗ Error parsing CSV: ${err.message}`);
    process.exit(1);
  }

  // ===== POST READINGS =====
  const toolId = parseInt(args.tool);
  const intervalMs = parseInt(args.interval);
  let successCount = 0;
  let failureCount = 0;
  let maxWearSeen = 0;
  let lastStatus = 'UNKNOWN';

  console.log('Starting simulation...\n');
  console.log('Time     | Cut | Status   | MaxWear | RUL  | Recommendation');
  console.log('---------|-----|----------|---------|------|---------------');

  for (let i = 0; i < readings.length; i++) {
    const reading = readings[i];

    // POST to backend
    const result = await postReading(toolId, reading, args.url);

    const timestamp = new Date().toLocaleTimeString();

    if (result.success) {
      successCount++;
      const data = result.data;
      const maxWear = Math.max(data.wear_f1, data.wear_f2, data.wear_f3);
      maxWearSeen = Math.max(maxWearSeen, maxWear);
      lastStatus = data.status;

      const wearStr = maxWear.toFixed(1).padStart(6);
      const rulStr = String(data.rul).padStart(4);
      const statusStr = data.status.padEnd(8);
      const recStr = data.recommendation.substring(0, 30);

      console.log(
        `${timestamp} | ${String(reading.cut_number).padStart(3)} | ${statusStr} | ${wearStr} | ${rulStr} | ${recStr}`
      );
    } else {
      failureCount++;
      const timestamp = new Date().toLocaleTimeString();
      console.log(`${timestamp} | ${String(reading.cut_number).padStart(3)} | ERROR    | (failed to POST)`);
      console.error(`  Error: ${result.error}`);
    }

    // Wait before next POST (except after last one)
    if (i < readings.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  // ===== SUMMARY =====
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log(`║ Simulation Complete                                ║`);
  console.log('╚════════════════════════════════════════════════════╝\n');

  console.log('Summary:');
  console.log(`  Total Readings:   ${readings.length}`);
  console.log(`  Successful:       ${successCount}`);
  console.log(`  Failed:           ${failureCount}`);
  console.log(`  Max Wear Seen:    ${maxWearSeen.toFixed(2)} µm`);
  console.log(`  Final Status:     ${lastStatus}`);
  console.log(`\nView alerts: curl http://localhost:3000/alerts`);
  console.log(`View history: curl http://localhost:3000/tools/${toolId}/history?limit=50\n`);
}

// ===== ERROR HANDLING =====
simulate().catch((err) => {
  console.error('\n✗ Fatal error:', err.message);
  process.exit(1);
});

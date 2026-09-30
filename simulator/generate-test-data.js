#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * Generate realistic fake sensor data for 315 cutting passes
 * 
 * - Forces trend upward as tool wears
 * - AE (acoustic emission) trends upward as tool degrades
 * - Vibrations increase slightly with wear
 * - Per-row noise for realism
 */

function generateTestData(outputPath = './test_data.csv') {
  const rows = [];
  
  // CSV header
  rows.push('cut_number,force_x,force_y,force_z,vib_x,vib_y,vib_z,ae_rms');

  // Generate 315 rows of data
  for (let cutNumber = 0; cutNumber < 315; cutNumber++) {
    // Normalized progress (0 to 1)
    const progress = cutNumber / 314;

    // ===== FORCES: Base with gradual increase as tool wears =====
    // Early cuts: ~120-140 N, late cuts: ~180-200 N
    const forceBaseLine = 120 + progress * 60;
    const forceNoise = (Math.random() - 0.5) * 8;

    // force_x: relatively stable
    const force_x = (120 + progress * 20 + (Math.random() - 0.5) * 5).toFixed(2);

    // force_y: increases with tool wear
    const force_y = (forceBaseLine + forceNoise).toFixed(2);

    // force_z: also increases, more sensitive to wear
    const force_z = (130 + progress * 70 + (Math.random() - 0.5) * 10).toFixed(2);

    // ===== VIBRATIONS: Small, increase slightly with wear =====
    const vibBaseLine = 0.3 + progress * 0.4;

    const vib_x = (vibBaseLine + (Math.random() - 0.5) * 0.1).toFixed(3);
    const vib_y = (vibBaseLine + (Math.random() - 0.5) * 0.1).toFixed(3);
    const vib_z = (vibBaseLine + (Math.random() - 0.5) * 0.1).toFixed(3);

    // ===== AE_RMS (Acoustic Emission): Strong indicator of wear =====
    // Increases significantly as tool wears (0.1 to 2.5)
    // Faster increase at extremes (early wear, final breakage risk)
    const aeBase = Math.pow(progress, 1.8) * 2.5;
    const aeNoise = (Math.random() - 0.5) * 0.15;
    const ae_rms = Math.max(0.1, aeBase + aeNoise).toFixed(3);

    // Construct CSV row
    const row = [
      cutNumber,
      force_x,
      force_y,
      force_z,
      vib_x,
      vib_y,
      vib_z,
      ae_rms,
    ].join(',');

    rows.push(row);
  }

  // Write to file
  const csv = rows.join('\n');
  fs.writeFileSync(outputPath, csv, 'utf-8');

  console.log(`✓ Generated test data: ${outputPath}`);
  console.log(`  Rows: 315 (cut_number 0-314)`);
  console.log(`  Trends: force_y, force_z, ae_rms increase with wear`);
  console.log(`\nUsage: node simulate.js --file ${outputPath} --tool 1 --interval 500`);
}

// Run if called directly
const outputFile = process.argv[2] || './test_data.csv';
generateTestData(outputFile);

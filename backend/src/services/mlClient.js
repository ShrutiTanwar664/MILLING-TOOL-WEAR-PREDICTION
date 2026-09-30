/**
 * Mock ML Client - Predicts tool wear
 * 
 * Generates realistic wear progression:
 * - Starts at ~5-10 um
 * - Fast early rise (cuts 0-50)
 * - Slower rise in middle (cuts 50-200)
 * - Fast rise at end (cuts 200-315)
 * - Total ~0 to 180 um over 315 cuts
 * 
 * To replace with real HTTP call:
 * const response = await fetch(`${process.env.ML_SERVICE_URL}`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     force_x, force_y, force_z,
 *     vib_x, vib_y, vib_z,
 *     ae_rms, cut_number
 *   })
 * });
 * return response.json();
 */

export async function predict(reading) {
  const {
    cut_number,
    force_x = 0,
    force_y = 0,
    force_z = 0,
    vib_x = 0,
    vib_y = 0,
    vib_z = 0,
    ae_rms = 0,
  } = reading;

  // Base wear progression: sigmoid-like curve from 0 to ~180 um
  const t = cut_number / 315; // normalized cut number (0 to 1 at 315 cuts)
  
  // Smooth curve: fast early, flat middle, faster end
  const baseCurve = 180 * (
    3 * t * t - 2 * t * t * t
  );

  // Add small per-flute variation (±5 um) and noise (±2 um)
  const flute1Offset = 3 * Math.sin(cut_number * 0.1);
  const flute2Offset = -2 * Math.cos(cut_number * 0.15);
  const flute3Offset = 4 * Math.sin(cut_number * 0.08);
  
  const noiseFactor = 0.5 + 0.5 * Math.sin(cut_number * Math.PI / 50);
  const noise = (Math.random() - 0.5) * 2 * noiseFactor;

  // Calculate wear for each flute
  const wear_f1 = Math.max(0, baseCurve + flute1Offset + noise * 0.5);
  const wear_f2 = Math.max(0, baseCurve + flute2Offset + noise * 0.3);
  const wear_f3 = Math.max(0, baseCurve + flute3Offset + noise * 0.4);

  // Max wear across flutes
  const maxWear = Math.max(wear_f1, wear_f2, wear_f3);

  // Estimate RUL: assuming average wear increase per cut
  const avgWearIncreasePerCut = cut_number > 0 ? maxWear / cut_number : 0.01;
  const wearLimit = 170; // Default, but will be overridden by caller
  const remainingWear = Math.max(0, wearLimit - maxWear);
  const rul = Math.floor(remainingWear / Math.max(avgWearIncreasePerCut, 0.001));

  return {
    wear: [wear_f1, wear_f2, wear_f3],
    rul,
    maxWear,
  };
}

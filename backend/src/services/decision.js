/**
 * Decision Engine - Determines tool status based on wear
 */

export function getStatus(maxWear, wearLimit) {
  const normalThreshold = 0.8 * wearLimit;
  const criticalThreshold = wearLimit;

  let status, recommendation;

  if (maxWear < normalThreshold) {
    status = 'NORMAL';
    recommendation = 'Tool is operating normally';
  } else if (maxWear < criticalThreshold) {
    status = 'WARNING';
    recommendation = 'Consider reducing feed rate to extend tool life';
  } else {
    status = 'CRITICAL';
    recommendation = 'Replace tool immediately to avoid tool breakage';
  }

  return { status, recommendation };
}

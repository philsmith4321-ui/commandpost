// ZIP-centroid distance (server-only — `zipcodes` is in serverExternalPackages).
import { distance } from 'zipcodes';

// Haversine miles between two US ZIP centroids; null if either ZIP is unknown/invalid.
export function milesBetweenZips(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const za = String(a).trim().slice(0, 5);
  const zb = String(b).trim().slice(0, 5);
  if (!/^\d{5}$/.test(za) || !/^\d{5}$/.test(zb)) return null;
  const d = distance(za, zb);
  return typeof d === 'number' && Number.isFinite(d) ? d : null;
}

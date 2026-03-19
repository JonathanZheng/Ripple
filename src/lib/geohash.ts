import ngeohash from 'ngeohash';

// Precision 6 ≈ 1.2km × 0.6km — covers UTown in a handful of cells
export function encodeGeohash(lat: number, lng: number): string {
  return ngeohash.encode(lat, lng, 6);
}
 
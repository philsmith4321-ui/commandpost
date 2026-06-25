declare module 'zipcodes' {
  export function distance(a: string, b: string): number | null;
  export function lookup(
    zip: string | number
  ): { zip: string; latitude: number; longitude: number; city: string; state: string; country: string } | undefined;
}

// lib/countryGeo.ts
//
// ISO 3166-1 alpha-2 -> approximate [latitude, longitude] centroid, for
// plotting Visit.country (already populated server-side at /api/track
// from Vercel's geo headers — see that route's header comment) onto the
// world-map visualization in components/dashboard/dx/DxWorldMap.tsx.
//
// Coordinates are visual centroids (picked to land a marker somewhere
// sensible inside the country's silhouette on a flat equirectangular
// projection), not geographic/population centroids — close enough for a
// "where in the world" dot on a dashboard, not meant for anything that
// needs precision. Large countries (Russia, Canada, Brazil, the US,
// Australia, China) are nudged toward their population-dense regions
// rather than their true geometric middle, so the dot doesn't land in
// empty wilderness.
//
// Deliberately kept separate from lib/countries.ts's CountryDef — that
// list's `code`/`name` contract is relied on by the AI Agent's
// country-blocking picker (components/agent/AgentCountryBlocker.tsx)
// and this is purely additive display data for one panel, with no
// reason to touch that file or its existing consumers.

export const COUNTRY_GEO: Record<string, [number, number]> = {
  AF: [34.5, 69.2], AL: [41.3, 19.8], DZ: [36.7, 3.1], AD: [42.5, 1.5], AO: [-8.8, 13.2],
  AG: [17.1, -61.8], AR: [-34.6, -58.4], AM: [40.2, 44.5], AU: [-33.9, 151.2], AT: [48.2, 16.4],
  AZ: [40.4, 49.9], BS: [25.0, -77.4], BH: [26.2, 50.6], BD: [23.8, 90.4], BB: [13.1, -59.6],
  BY: [53.9, 27.6], BE: [50.8, 4.4], BZ: [17.3, -88.2], BJ: [6.4, 2.4], BT: [27.5, 89.6],
  BO: [-16.5, -68.1], BA: [43.9, 18.4], BW: [-24.7, 25.9], BR: [-23.6, -46.6], BN: [4.9, 114.9],
  BG: [42.7, 23.3], BF: [12.4, -1.5], BI: [-3.4, 29.4], CV: [14.9, -23.5], KH: [11.6, 104.9],
  CM: [3.9, 11.5], CA: [45.4, -75.7], CF: [4.4, 18.6], TD: [12.1, 15.0], CL: [-33.4, -70.6],
  CN: [31.2, 121.5], CO: [4.7, -74.1], KM: [-11.7, 43.3], CG: [-4.3, 15.3], CD: [-4.3, 15.3],
  CR: [9.9, -84.1], HR: [45.8, 16.0], CU: [23.1, -82.4], CY: [35.2, 33.4], CZ: [50.1, 14.4],
  DK: [55.7, 12.6], DJ: [11.6, 43.1], DM: [15.4, -61.4], DO: [18.5, -69.9], EC: [-0.2, -78.5],
  EG: [30.0, 31.2], SV: [13.7, -89.2], GQ: [3.8, 8.8], ER: [15.3, 38.9], EE: [59.4, 24.8],
  SZ: [-26.5, 31.5], ET: [9.0, 38.7], FJ: [-18.1, 178.4], FI: [60.2, 24.9], FR: [48.9, 2.4],
  GA: [0.4, 9.5], GM: [13.5, -16.6], GE: [41.7, 44.8], DE: [52.5, 13.4], GH: [5.6, -0.2],
  GR: [38.0, 23.7], GD: [12.1, -61.7], GT: [14.6, -90.5], GN: [9.5, -13.7], GW: [11.9, -15.6],
  GY: [6.8, -58.2], HT: [18.6, -72.3], HN: [14.1, -87.2], HK: [22.3, 114.2], HU: [47.5, 19.0],
  IS: [64.1, -21.9], IN: [28.6, 77.2], ID: [-6.2, 106.8], IR: [35.7, 51.4], IQ: [33.3, 44.4],
  IE: [53.3, -6.3], IL: [32.1, 34.8], IT: [41.9, 12.5], CI: [5.3, -4.0], JM: [18.0, -76.8],
  JP: [35.7, 139.7], JO: [31.9, 35.9], KZ: [43.2, 76.9], KE: [-1.3, 36.8], KI: [1.3, 173.0],
  KW: [29.4, 47.9], KG: [42.9, 74.6], LA: [18.0, 102.6], LV: [56.9, 24.1], LB: [33.9, 35.5],
  LS: [-29.3, 27.5], LR: [6.3, -10.8], LY: [32.9, 13.2], LI: [47.1, 9.5], LT: [54.7, 25.3],
  LU: [49.6, 6.1], MO: [22.2, 113.5], MG: [-18.9, 47.5], MW: [-13.9, 33.8], MY: [3.1, 101.7],
  MV: [4.2, 73.5], ML: [12.6, -8.0], MT: [35.9, 14.5], MH: [7.1, 171.4], MR: [18.1, -15.9],
  MU: [-20.2, 57.5], MX: [19.4, -99.1], FM: [6.9, 158.2], MD: [47.0, 28.9], MC: [43.7, 7.4],
  MN: [47.9, 106.9], ME: [42.4, 19.3], MA: [34.0, -6.8], MZ: [-25.9, 32.6], MM: [16.8, 96.2],
  NA: [-22.6, 17.1], NR: [-0.5, 166.9], NP: [27.7, 85.3], NL: [52.4, 4.9], NZ: [-36.8, 174.8],
  NI: [12.1, -86.3], NE: [13.5, 2.1], NG: [6.5, 3.4], KP: [39.0, 125.8], MK: [42.0, 21.4],
  NO: [59.9, 10.8], OM: [23.6, 58.5], PK: [33.7, 73.1], PW: [7.3, 134.5], PS: [31.9, 35.3],
  PA: [9.0, -79.5], PG: [-9.5, 147.2], PY: [-25.3, -57.6], PE: [-12.0, -77.0], PH: [14.6, 121.0],
  PL: [52.2, 21.0], PT: [38.7, -9.1], QA: [25.3, 51.5], RO: [44.4, 26.1], RU: [55.8, 37.6],
  RW: [-1.9, 30.1], KN: [17.3, -62.7], LC: [14.0, -61.0], VC: [13.2, -61.2], WS: [-13.8, -171.8],
  SM: [43.9, 12.5], ST: [0.2, 6.6], SA: [24.7, 46.7], SN: [14.7, -17.5], RS: [44.8, 20.5],
  SC: [-4.6, 55.5], SL: [8.5, -13.2], SG: [1.35, 103.8], SK: [48.1, 17.1], SI: [46.1, 14.5],
  SB: [-9.4, 159.9], SO: [2.0, 45.3], ZA: [-26.2, 28.0], KR: [37.6, 127.0], SS: [4.9, 31.6],
  ES: [40.4, -3.7], LK: [6.9, 79.9], SD: [15.6, 32.5], SR: [5.9, -55.2], SE: [59.3, 18.1],
  CH: [47.4, 8.5], SY: [33.5, 36.3], TW: [25.0, 121.6], TJ: [38.6, 68.8], TZ: [-6.8, 39.3],
  TH: [13.75, 100.5], TL: [-8.6, 125.6], TG: [6.1, 1.2], TO: [-21.1, -175.2], TT: [10.7, -61.5],
  TN: [36.8, 10.2], TR: [41.0, 29.0], TM: [37.9, 58.4], TV: [-8.5, 179.2], UG: [0.3, 32.6],
  UA: [50.4, 30.5], AE: [25.2, 55.3], GB: [51.5, -0.1], US: [39.8, -98.6], UY: [-34.9, -56.2],
  UZ: [41.3, 69.3], VU: [-17.7, 168.3], VA: [41.9, 12.5], VE: [10.5, -66.9], VN: [21.0, 105.8],
  YE: [15.4, 44.2], ZM: [-15.4, 28.3], ZW: [-17.8, 31.0],
};

export function countryLatLng(code: string | null | undefined): [number, number] | null {
  if (!code) return null;
  const hit = COUNTRY_GEO[code.toUpperCase()];
  return hit || null;
}

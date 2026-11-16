/**
 * Gujranwala district layout, read from the user's map screenshot (1286 x 583 px).
 * Pixel -> game metres:  x = (px - 1050) * K,  z = (py - 300) * K   (north = -z, east = +x)
 * The spawn / proving ground (game origin) sits on the open land east of the canal.
 * K = 0.7 m per pixel (compact version of the map: ~0.85 km x 0.6 km; roads and buildings keep real-world sizes).
 */
export const K = 0.7;
export const ORIGIN_PX = [1050, 300];
export const px = (x, y) => [(x - ORIGIN_PX[0]) * K, (y - ORIGIN_PX[1]) * K];
const P = (pts) => pts.map(([x, y]) => px(x, y));

export const MAP_BOUNDS = { minX: -840, maxX: 270, minZ: -330, maxZ: 330 };

/** type: highway (dual carriageway + median) | main (2 lanes + centre line) | street (lane) */
export const ROADS = [
  { name: 'GT Road', type: 'highway', w: 22, pts: P([[372, -120], [400, 0], [445, 290], [470, 470], [495, 583], [520, 700]]) },
  { name: 'Sialkot Bypass', type: 'highway', w: 20, pts: P([[300, 500], [470, 470], [600, 442], [700, 425], [760, 395], [790, 330], [820, 200], [850, 100], [875, -20], [890, -120]]) },
  { name: 'Sheikhupura Rd', type: 'main', w: 12, pts: P([[190, -80], [150, 0], [100, 120], [0, 320], [-70, 440]]) },
  { name: 'Makki Rd', type: 'main', w: 10, pts: P([[205, -120], [205, 0], [205, 583], [205, 720]]) },
  { name: 'Khwaja Gharib Nawaz Rd', type: 'main', w: 12, pts: P([[540, 100], [700, 100], [850, 96], [930, 100], [1000, 112], [1400, 138]]) },
  { name: 'Pipliwala Rd', type: 'main', w: 10, pts: P([[790, 520], [1000, 520], [1290, 525]]) },
  { name: 'Colony link N', type: 'street', w: 7, pts: P([[0, 150], [205, 150], [385, 148]]) },
  { name: 'Colony link S', type: 'street', w: 7, pts: P([[-60, 420], [205, 425], [470, 420]]) },
  { name: 'Shahpur Rd', type: 'street', w: 7, pts: P([[545, -120], [550, 200], [560, 450], [565, 720]]) },
  { name: 'Centre Rd', type: 'street', w: 7, pts: P([[650, -120], [655, 200], [650, 430]]) },
  { name: 'Nabi Pura Rd', type: 'street', w: 7, pts: P([[560, 290], [760, 300]]) },
  { name: 'Kangniwala Rd', type: 'street', w: 7, pts: P([[470, 215], [740, 225]]) },
  { name: 'Univ Rd', type: 'street', w: 7, pts: P([[300, 200], [372, 205]]) },
  { name: 'Farm Rd', type: 'street', w: 6, pts: P([[930, 300], [1100, 340], [1290, 455]]) }
];

export const CANAL = {
  name: 'Upper Chenab Canal',
  w: 34,
  pts: P([[925, -120], [905, 0], [885, 120], [855, 260], [825, 350], [795, 420], [755, 500], [725, 583], [695, 720]])
};
/** crossing points where the canal wall opens (bridges) */
export const BRIDGES = [{ name: 'Canal Bridge', at: px(886, 100), len: 70 }];

export const MINOR_CANALS = [
  { name: 'Shahpur Distributary', w: 5, pts: P([[520, -120], [545, 0], [548, 100], [550, 200], [556, 300], [560, 420]]) },
  { name: 'Khawah Minor', w: 4, pts: P([[880, 232], [860, 300], [840, 380], [800, 470], [775, 583]]) }
];

/**
 * Districts (pixel rectangles). type: colony = lanes + attached houses, villa = gated high-society plots,
 * factory = walled industrial compounds, village = sparse farmhouses.
 */
export const ZONES = [
  { name: 'Markaz-e-Sanat factory district', type: 'factory', rect: [-100, -125, 345, 330] },
  { name: 'West colonies', type: 'colony', rect: [-100, 345, 380, 740], dens: 0.96 },
  { name: 'Centre colonies', type: 'colony', rect: [440, -130, 800, 740], dens: 0.96 },
  { name: 'Master City', type: 'villa', rect: [940, -130, 1400, 215], dens: 1 },
  { name: 'East village', type: 'village', rect: [940, 330, 1400, 740], dens: 0.12 }
];

export const LANDMARKS = [
  { id: 'central-hospital', kind: 'hospital', name: 'Central Hospital', at: px(402, 36), w: 60, d: 20, floors: 5, yaw: 0 },
  { id: 'meridien', kind: 'hotel', name: 'Meridien Hotel', at: px(412, 146), w: 30, d: 30, floors: 12, yaw: 0 },
  { id: 'vu', kind: 'university', name: 'Virtual University of Pakistan', at: px(335, 205), w: 64, d: 42, floors: 3, yaw: 0 },
  { id: 'jinnah-park', kind: 'park', name: 'Jinnah Park', at: px(425, 285), w: 84, d: 56, floors: 0, yaw: 0 },
  { id: 'eye-hospital', kind: 'hospital', name: 'Ibrahim Trust Eye Hospital', at: px(745, 292), w: 44, d: 18, floors: 4, yaw: 0 },
  { id: 'ashraf-palace', kind: 'wedding', name: 'Ashraf Palace Marriage Hall', at: px(160, 430), w: 46, d: 34, floors: 3, yaw: 0 },
  { id: 'nazari-palace', kind: 'wedding', name: 'Nazari Palace Marriage Hall', at: px(212, 560), w: 44, d: 32, floors: 3, yaw: 0 },
  { id: 'butterfly-park', kind: 'park', name: 'Butterfly Park', at: px(1235, 262), w: 80, d: 60, floors: 0, yaw: 0 },
  { id: 'dairy-farm', kind: 'farm', name: 'Solo Dairy Farm', at: px(1260, 520), w: 100, d: 66, floors: 1, yaw: 0 },
  { id: 'master-city', kind: 'gate', name: 'Master City', at: px(930, 102), w: 30, d: 4, floors: 1, yaw: 0 },
  { id: 'central-mosque', kind: 'mosque', name: 'Jamia Masjid', at: px(500, 120), w: 30, d: 30, floors: 1 },
  { id: 'mosque-w', kind: 'mosque', name: 'Madni Masjid', at: px(40, 470), w: 30, d: 30, floors: 1 },
  { id: 'mosque-c', kind: 'mosque', name: 'Bilal Masjid', at: px(610, 365), w: 30, d: 30, floors: 1 },
  { id: 'school-1', kind: 'school', name: 'Govt High School', at: px(360, 520), w: 56, d: 30, floors: 2 },
  { id: 'school-2', kind: 'school', name: 'Cadet Academy', at: px(1010, 40), w: 46, d: 28, floors: 2 },
  { id: 'petrol-gt', kind: 'petrol', name: 'PSO Petrol Pump', at: px(468, 330), w: 28, d: 20, floors: 1 },
  { id: 'petrol-by', kind: 'petrol', name: 'Total Parco', at: px(720, 430), w: 28, d: 20, floors: 1 },
  { id: 'desi-babu', kind: 'shop', name: 'Desi Babu', at: px(772, 374), w: 12, d: 12, floors: 2, color: '#d9542b' },
  { id: 'pind', kind: 'shop', name: 'Pind Restaurant Rooftop', at: px(470, 541), w: 16, d: 13, floors: 3, color: '#b8862b' },
  { id: 'bazm', kind: 'shop', name: 'Bazm Cafe', at: px(902, 204), w: 12, d: 11, floors: 2, color: '#6a3d8f' },
  { id: 'mirha', kind: 'shop', name: 'Mirha Fast Food', at: px(1204, 240), w: 12, d: 10, floors: 2, color: '#c2331f' },
  { id: 'nybites', kind: 'shop', name: 'NY Bites', at: px(1108, 330), w: 11, d: 10, floors: 2, color: '#1c6fb0' },
  { id: 'atos', kind: 'shop', name: 'ATOS Gujranwala', at: px(1060, 250), w: 16, d: 12, floors: 3, color: '#2b3d6b' },
  { id: 'neelam', kind: 'shop', name: 'Neelam Boutique', at: px(1170, 353), w: 12, d: 10, floors: 2, color: '#0e7c86' },
  { id: 'gym', kind: 'shop', name: 'Gym Master City', at: px(1000, 235), w: 18, d: 14, floors: 2, color: '#222222' }
];

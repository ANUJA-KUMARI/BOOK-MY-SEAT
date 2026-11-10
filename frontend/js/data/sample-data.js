// TEMPORARY sample data for Phase 2. In Phase 4 the same shapes come from MySQL via /api.
// Field names match the planned database columns (snake_case) so the swap needs no page changes.
// All titles, cinemas and descriptions are invented for this demo.
// poster_url is left empty on purpose: the UI draws a styled fallback poster. Put a legitimate image URL here to test real posters.

export const MOVIES = [
  { id: 1, title: 'Midnight Monsoon', language: 'Hindi', duration_min: 138, certificate: 'UA', release_date: '2026-10-09', poster_url: '', genres: ['Drama', 'Romance'],
    description: 'Two strangers sharing a stalled Mumbai local during a night of record rain discover they are connected by a letter neither of them sent.' },
  { id: 2, title: 'The Last Local', language: 'Hindi', duration_min: 124, certificate: 'UA', release_date: '2026-10-16', poster_url: '', genres: ['Thriller', 'Drama'],
    description: 'A night-shift ticket checker notices the same passenger on every final train and slowly realises the man is running from something much bigger than the law.' },
  { id: 3, title: 'Rang De Raat', language: 'Hindi', duration_min: 151, certificate: 'UA', release_date: '2026-10-23', poster_url: '', genres: ['Action', 'Thriller'],
    description: 'A retired stunt double is pulled back into the city\'s underground racing scene when his old crew goes missing during Holi week.' },
  { id: 4, title: 'Chai & Chaos', language: 'Hindi', duration_min: 132, certificate: 'U', release_date: '2026-10-02', poster_url: '', genres: ['Comedy', 'Family'],
    description: 'Three generations of a Lucknow family try to keep their tea stall open while a wedding, a rival cafe and a runaway goat all collide on one Sunday.' },
  { id: 5, title: 'Echoes of Kutch', language: 'Hindi', duration_min: 128, certificate: 'U', release_date: '2026-09-25', poster_url: '', genres: ['Drama', 'Adventure'],
    description: 'A young cartographer crosses the white salt desert to find the village her grandmother never stopped talking about.' },
  { id: 6, title: 'Kaveri Express', language: 'Tamil', duration_min: 143, certificate: 'UA', release_date: '2026-10-18', poster_url: '', genres: ['Adventure', 'Drama'],
    description: 'A school teacher and a retired engine driver race to deliver a village\'s harvest on a decommissioned train before the monsoon floods the tracks.' },
  { id: 7, title: 'Dilli Heist', language: 'Hindi', duration_min: 127, certificate: 'UA', release_date: '2026-10-11', poster_url: '', genres: ['Comedy', 'Thriller'],
    description: 'Five very unqualified friends plan to rob a Chandni Chowk jewellery auction, mostly to settle an argument about who is the cleverest.' },
  { id: 8, title: 'Shadow of the Haveli', language: 'Hindi', duration_min: 118, certificate: 'A', release_date: '2026-10-25', poster_url: '', genres: ['Horror', 'Mystery'],
    description: 'A heritage-hotel inspector spends one night in a crumbling Rajasthan haveli and finds that its guest register keeps adding names.' },
  { id: 9, title: 'Skyline Protocol', language: 'English', duration_min: 112, certificate: 'UA', release_date: '2026-10-20', poster_url: '', genres: ['Sci-Fi', 'Action'],
    description: 'When a city\'s traffic AI begins rerouting people on purpose, a night-shift engineer has six hours to find out who taught it to do that.' },
];

export const CINEMAS = [
  { id: 1, name: 'Aurora Cinemas', city: 'New Delhi', address: 'District Centre, Saket' },
  { id: 2, name: 'Lotus Multiplex', city: 'New Delhi', address: 'Barakhamba Road, Connaught Place' },
  { id: 3, name: 'Starline Screens', city: 'New Delhi', address: 'Sector 12, Dwarka' },
];

const BASE_PRICES = { STANDARD: 220, PREMIUM: 320, RECLINER: 520 };
const PRICE_FACTOR = { 1: 1, 2: 1.2, 3: 0.9 };
const SLOTS = [[10, 30], [13, 45], [17, 0], [20, 15], [22, 45]];

/**
 * Builds shows for the next 5 days, always relative to "now", so the demo never runs out of future shows.
 * Each show has the same shape the API contract promises for GET /api/movies/:id/shows.
 * Show ids are stable (derived from movie, day, cinema and slot).
 */
export function buildShows(now = new Date()) {
  const shows = [];
  for (const movie of MOVIES) {
    for (let day = 0; day < 5; day += 1) {
      for (let c = 0; c < 2; c += 1) {
        const seed = movie.id + day + c;
        const cinema = CINEMAS[seed % CINEMAS.length];
        const slotIdx = [seed % 5, (seed + 2) % 5, (seed + 4) % 5].sort((a, b) => a - b);
        for (const s of slotIdx) {
          const [hh, mm] = SLOTS[s];
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hh, mm);
          const screenNo = (movie.id % 3) + 1;
          const prices = {};
          for (const [cat, base] of Object.entries(BASE_PRICES)) {
            prices[cat] = Math.round((base * PRICE_FACTOR[cinema.id]) / 10) * 10;
          }
          shows.push({
            id: movie.id * 1000 + day * 100 + c * 10 + s,
            movie_id: movie.id,
            start_time: start.toISOString(),
            status: 'SCHEDULED',
            cinema: { ...cinema },
            screen: { id: cinema.id * 10 + screenNo, name: `Screen ${screenNo}` },
            prices,
          });
        }
      }
    }
  }
  return shows;
}

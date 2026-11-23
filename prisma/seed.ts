// Seeds the database with the starter trips and ~6 months of departures.
// Safe to run more than once: trips (matched by slug) are updated, departures
// that already exist are kept, and nothing is deleted.
import { PrismaClient } from "@prisma/client";
import { buildSchedule } from "../lib/schedule.ts";
import { isoDate } from "../lib/pricing.ts";

const prisma = new PrismaClient();

type Seed = {
  slug: string; title: string; dest: string; country: string; region: string; kind: string; themes: string[];
  nights: number; stars: number; board: string; price: number; was: number | null; rating: number; reviews: number;
  beach: number | null; flight: boolean; freeCancel: boolean; tourManager: boolean; easyVisa: boolean;
  lastMinute: boolean; earlyBird: boolean; featured?: boolean; image: string; highlights: string[]; days: string[];
};

const T = (o: Seed) => ({
  ...o,
  themes: o.themes.join(","),
  highlights: o.highlights.join("\n"),
  days: o.days.join("\n"),
});

const trips = [
  T({ slug: "bali-ubud-seminyak-7n", title: "Ubud rice terraces & Seminyak sunsets", dest: "Bali", country: "Indonesia", region: "South-East Asia", kind: "package", themes: ["honeymoon", "beach"], nights: 7, stars: 5, board: "BB", price: 84900, was: 99900, rating: 9.1, reviews: 2184, beach: 150, flight: true, freeCancel: true, tourManager: false, easyVisa: true, lastMinute: true, earlyBird: false, featured: true, image: "/img/bali.jpg",
    highlights: ["Private pool villa in Ubud", "Kintamani volcano sunrise", "Candlelit beach dinner"],
    days: ["Arrive Denpasar, transfer to Ubud villa", "Rice terraces and Tirta Empul temple", "Free day: spa or Ayung rafting", "Kintamani sunrise and coffee plantation", "Move to Seminyak beach resort", "Nusa Penida day cruise", "Tanah Lot sunset", "Fly home"] }),
  T({ slug: "kerala-backwaters-munnar-6n", title: "Kerala backwaters & Munnar tea hills", dest: "Kerala", country: "India", region: "India", kind: "package", themes: ["family", "honeymoon", "nature"], nights: 6, stars: 4, board: "HB", price: 38500, was: 44000, rating: 8.9, reviews: 3410, beach: null, flight: true, freeCancel: true, tourManager: false, easyVisa: true, lastMinute: true, earlyBird: false, image: "/img/kerala.jpg",
    highlights: ["Overnight private houseboat", "Tea museum in Munnar", "Kathakali show in Kochi"],
    days: ["Arrive Kochi, Fort Kochi walk", "Drive to Munnar through Cheeyappara falls", "Tea gardens and Eravikulam park", "Thekkady spice plantation", "Alleppey houseboat overnight", "Kochi, fly home"] }),
  T({ slug: "switzerland-france-italy-10n", title: "Best of Switzerland, France & Italy", dest: "Europe", country: "Switzerland · France · Italy", region: "Europe", kind: "escorted", themes: ["group", "family"], nights: 10, stars: 4, board: "FB", price: 259000, was: 289000, rating: 9.0, reviews: 1288, beach: null, flight: true, freeCancel: false, tourManager: true, easyVisa: false, lastMinute: false, earlyBird: true, featured: true, image: "/img/swiss.jpg",
    highlights: ["Jungfraujoch, Top of Europe", "Eiffel Tower level 2", "Indian dinners every evening"],
    days: ["Fly to Paris, evening Seine cruise", "Eiffel Tower and Louvre exterior", "TGV to Geneva, drive to Interlaken", "Jungfraujoch excursion", "Mt Titlis and Lucerne", "Liechtenstein, drive to Innsbruck", "Venice gondola ride", "Pisa and Florence", "Rome: Colosseum and Vatican", "Rome free day", "Fly home"] }),
  T({ slug: "antalya-lara-all-inclusive-7n", title: "All-inclusive on the Lara coast", dest: "Antalya", country: "Turkey", region: "Mediterranean", kind: "package", themes: ["family", "beach"], nights: 7, stars: 5, board: "AI", price: 72400, was: 81000, rating: 8.7, reviews: 5120, beach: 0, flight: true, freeCancel: true, tourManager: false, easyVisa: true, lastMinute: true, earlyBird: false, featured: true, image: "/img/antalya.jpg",
    highlights: ["First beach line, private pier", "Aquapark and kids' club", "Ultra all-inclusive 24h"],
    days: ["Arrive Antalya, 20 min transfer", "Beach and aquapark", "Optional Old Town Kaleiçi", "Düden waterfalls trip", "Spa day", "Optional Pamukkale tour", "Free day", "Fly home"] }),
  T({ slug: "dubai-abu-dhabi-5n", title: "Dubai skyline, desert & Abu Dhabi", dest: "Dubai", country: "UAE", region: "Middle East", kind: "package", themes: ["family", "city"], nights: 5, stars: 4, board: "BB", price: 56700, was: 62500, rating: 8.6, reviews: 4890, beach: 600, flight: true, freeCancel: true, tourManager: false, easyVisa: true, lastMinute: false, earlyBird: false, image: "/img/dubai.jpg",
    highlights: ["Burj Khalifa level 124", "Dune bashing with BBQ dinner", "Sheikh Zayed Grand Mosque"],
    days: ["Arrive, Dhow cruise dinner", "City tour and Burj Khalifa", "Desert safari", "Abu Dhabi day trip", "Free day: Dubai Mall", "Fly home"] }),
  T({ slug: "kashmir-gulmarg-pahalgam-6n", title: "Kashmir: Gulmarg, Pahalgam, Dal Lake", dest: "Kashmir", country: "India", region: "India", kind: "escorted", themes: ["group", "family", "nature"], nights: 6, stars: 4, board: "FB", price: 46800, was: null, rating: 9.2, reviews: 2650, beach: null, flight: true, freeCancel: false, tourManager: true, easyVisa: true, lastMinute: false, earlyBird: true, featured: true, image: "/img/kashmir.jpg",
    highlights: ["Gondola to Kongdoori", "Shikara ride on Dal Lake", "Houseboat night"],
    days: ["Arrive Srinagar, Mughal gardens", "Gulmarg gondola", "Pahalgam via saffron fields", "Betaab and Aru valleys", "Sonamarg day trip", "Shikara ride, houseboat stay", "Fly home"] }),
  T({ slug: "maldives-water-villa-4n", title: "Maldives water villa escape", dest: "Maldives", country: "Maldives", region: "Indian Ocean", kind: "hotel", themes: ["honeymoon", "beach", "luxury"], nights: 4, stars: 5, board: "AI", price: 142000, was: 168000, rating: 9.5, reviews: 980, beach: 0, flight: false, freeCancel: true, tourManager: false, easyVisa: true, lastMinute: true, earlyBird: false, featured: true, image: "/img/maldives.jpg",
    highlights: ["Overwater villa with slide", "Seaplane transfer", "Snorkel house reef"],
    days: ["Seaplane to resort", "Snorkelling safari", "Sandbank picnic", "Spa and sunset cruise", "Depart"] }),
  T({ slug: "phuket-krabi-6n", title: "Phuket & Krabi island hopper", dest: "Thailand", country: "Thailand", region: "South-East Asia", kind: "package", themes: ["beach", "family", "honeymoon"], nights: 6, stars: 4, board: "BB", price: 48900, was: 54900, rating: 8.5, reviews: 6020, beach: 250, flight: true, freeCancel: true, tourManager: false, easyVisa: true, lastMinute: true, earlyBird: false, image: "/img/thai.jpg",
    highlights: ["Phi Phi by speedboat", "Four-island tour, Krabi", "Big Buddha viewpoint"],
    days: ["Arrive Phuket", "Phi Phi islands", "Phuket city tour", "Ferry to Krabi", "Four-island tour", "Free day", "Fly home"] }),
  T({ slug: "crete-family-beach-8n", title: "Crete family beach week", dest: "Crete", country: "Greece", region: "Mediterranean", kind: "package", themes: ["family", "beach"], nights: 8, stars: 4, board: "AI", price: 96800, was: 104000, rating: 8.8, reviews: 3380, beach: 80, flight: true, freeCancel: true, tourManager: false, easyVisa: false, lastMinute: false, earlyBird: true, image: "/img/crete.jpg",
    highlights: ["Sandy beach 80 m away", "Knossos palace trip", "Kids eat free"],
    days: ["Arrive Heraklion", "Beach day", "Knossos palace", "Balos lagoon", "Free day", "Chania old harbour", "Free day", "Beach day", "Fly home"] }),
  T({ slug: "royal-rajasthan-7n", title: "Royal Rajasthan: Jaipur, Jodhpur, Udaipur", dest: "Rajasthan", country: "India", region: "India", kind: "escorted", themes: ["group", "heritage", "family"], nights: 7, stars: 4, board: "HB", price: 42900, was: 48900, rating: 8.9, reviews: 2210, beach: null, flight: true, freeCancel: true, tourManager: true, easyVisa: true, lastMinute: false, earlyBird: false, image: "/img/rajasthan.jpg",
    highlights: ["Amber Fort", "Mehrangarh at dusk", "Lake Pichola boat ride"],
    days: ["Arrive Jaipur", "Amber Fort, City Palace", "Drive to Jodhpur", "Mehrangarh Fort", "Ranakpur temples to Udaipur", "Lake Pichola cruise", "City Palace Udaipur", "Fly home"] }),
  T({ slug: "hurghada-luxor-7n", title: "Hurghada reef & Luxor temples", dest: "Egypt", country: "Egypt", region: "Middle East", kind: "package", themes: ["beach", "heritage", "family"], nights: 7, stars: 5, board: "AI", price: 68300, was: 79900, rating: 8.4, reviews: 4410, beach: 0, flight: true, freeCancel: false, tourManager: false, easyVisa: true, lastMinute: true, earlyBird: false, image: "/img/egypt.jpg",
    highlights: ["Private reef for snorkelling", "Valley of the Kings", "Karnak by night"],
    days: ["Arrive Hurghada", "Reef day", "Luxor day trip", "Giftun island", "Spa day", "Desert quad safari", "Free day", "Fly home"] }),
  T({ slug: "japan-cherry-blossom-9n", title: "Japan in cherry-blossom season", dest: "Japan", country: "Japan", region: "East Asia", kind: "escorted", themes: ["group", "city", "heritage"], nights: 9, stars: 4, board: "BB", price: 298000, was: null, rating: 9.4, reviews: 740, beach: null, flight: true, freeCancel: false, tourManager: true, easyVisa: false, lastMinute: false, earlyBird: true, image: "/img/japan.jpg",
    highlights: ["Mt Fuji 5th station", "Bullet train to Kyoto", "Hiroshima & Miyajima"],
    days: ["Arrive Tokyo", "Asakusa, Shibuya", "Mt Fuji and Hakone", "Bullet train to Kyoto", "Fushimi Inari, Kinkaku-ji", "Nara deer park", "Hiroshima, Miyajima", "Osaka", "Universal Studios or free day", "Fly home"] }),
  T({ slug: "north-goa-beach-4n", title: "North Goa beach break", dest: "Goa", country: "India", region: "India", kind: "hotel", themes: ["beach", "honeymoon"], nights: 4, stars: 5, board: "BB", price: 24600, was: 29800, rating: 8.3, reviews: 7020, beach: 100, flight: false, freeCancel: true, tourManager: false, easyVisa: true, lastMinute: true, earlyBird: false, image: "/img/goa.jpg",
    highlights: ["Sea-view room", "Sunset cruise on Mandovi", "Late checkout"],
    days: ["Check in", "Beaches of the north", "Old Goa churches", "Free day", "Check out"] }),
  T({ slug: "western-mediterranean-cruise-7n", title: "Western Mediterranean cruise", dest: "Mediterranean", country: "Spain · France · Italy", region: "Mediterranean", kind: "cruise", themes: ["family", "luxury"], nights: 7, stars: 5, board: "FB", price: 154000, was: 179000, rating: 8.9, reviews: 1530, beach: null, flight: false, freeCancel: true, tourManager: false, easyVisa: false, lastMinute: false, earlyBird: true, image: "/img/cruise.jpg",
    highlights: ["Barcelona, Marseille, Genoa, Rome", "Balcony cabin", "Broadway-style shows"],
    days: ["Embark Barcelona", "Day at sea", "Marseille", "Genoa", "Civitavecchia for Rome", "Naples", "Day at sea", "Disembark"] }),
  T({ slug: "vietnam-hanoi-halong-hoian-8n", title: "Vietnam: Hanoi, Ha Long, Hoi An", dest: "Vietnam", country: "Vietnam", region: "South-East Asia", kind: "escorted", themes: ["group", "nature", "heritage"], nights: 8, stars: 4, board: "HB", price: 89500, was: 98000, rating: 9.0, reviews: 1120, beach: null, flight: true, freeCancel: true, tourManager: true, easyVisa: true, lastMinute: false, earlyBird: false, image: "/img/vietnam.jpg",
    highlights: ["Overnight Ha Long Bay cruise", "Hoi An lantern town", "Cu Chi tunnels"],
    days: ["Arrive Hanoi", "Old Quarter", "Ha Long cruise", "Ha Long to Hanoi, fly Da Nang", "Hoi An", "Ba Na hills", "Fly Ho Chi Minh", "Cu Chi tunnels", "Fly home"] }),
  T({ slug: "andaman-havelock-neil-6n", title: "Andaman: Havelock & Neil", dest: "Andaman", country: "India", region: "India", kind: "package", themes: ["honeymoon", "beach", "nature"], nights: 6, stars: 4, board: "BB", price: 52400, was: 58800, rating: 8.8, reviews: 1860, beach: 50, flight: true, freeCancel: true, tourManager: false, easyVisa: true, lastMinute: false, earlyBird: true, image: "/img/andaman.jpg",
    highlights: ["Radhanagar beach", "Scuba at Elephant beach", "Cellular Jail light show"],
    days: ["Arrive Port Blair, light show", "Ferry to Havelock", "Elephant beach", "Neil island", "Return to Port Blair", "Ross island", "Fly home"] }),
];

const start = isoDate(new Date());
let depCount = 0;
for (const t of trips) {
  const row = await prisma.trip.upsert({ where: { slug: t.slug }, update: t, create: t });
  const plan = buildSchedule({ tripId: row.slug, kind: row.kind, base: row.price, start, days: 180, lastMinute: row.lastMinute });
  const existing = new Set((await prisma.departure.findMany({ where: { tripId: row.id }, select: { date: true } })).map((d) => d.date));
  const fresh = plan.filter((p) => !existing.has(p.date)).map((p) => ({ ...p, tripId: row.id }));
  if (fresh.length) await prisma.departure.createMany({ data: fresh });
  depCount += fresh.length;
}
console.log(`Seeded ${trips.length} trips and ${depCount} new departures.`);
await prisma.$disconnect();

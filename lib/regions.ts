// Which region each country is in, for browsing visas by region. Pure data.

export const REGION_NAMES = ["Asia", "Middle East", "Europe", "Africa", "Americas", "Oceania"] as const;
export type Region = (typeof REGION_NAMES)[number];

const LIST: Record<Region, string> = {
  Asia: "AF BD BT BN KH CN HK IN ID JP KZ KG LA MO MY MV MN MM NP KP KR PK PH SG LK TW TJ TH TL TM UZ VN",
  "Middle East": "BH IR IQ IL JO KW LB OM PS QA SA SY TR AE YE",
  Europe: "AL AD AM AT AZ BY BE BA BG HR CY CZ DK EE FI FR GE DE GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA",
  Africa: "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW EH",
  Americas: "AG AR BS BB BZ BO BR CA CL CO CR CU DM DO EC SV GD GT GY HT HN JM MX NI PA PY PE KN LC VC SR TT US UY VE PR",
  Oceania: "AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU",
};

const BY_CODE: Record<string, Region> = Object.fromEntries(Object.entries(LIST).flatMap(([r, codes]) => codes.split(" ").map((c) => [c, r as Region])));
export const regionOf = (code: string): Region => BY_CODE[code.toUpperCase()] ?? "Asia";

import type { Offer } from "./types";

// These are regional navigation anchors, never physical datacenter coordinates.
export const earthRegions = [
  { id: "north-america", name: "North America", lon: -100, lat: 40, terms: ["us", "usa", "united states", "canada", "ca", "mexico", "mx", "north america"] },
  { id: "south-america", name: "South America", lon: -60, lat: -15, terms: ["brazil", "br", "chile", "cl", "argentina", "ar", "colombia", "co", "south america"] },
  { id: "europe", name: "Europe", lon: 15, lat: 50, terms: ["eu", "europe", "germany", "de", "france", "fr", "netherlands", "nl", "united kingdom", "uk", "gb", "sweden", "se", "finland", "fi", "norway", "no", "poland", "pl", "spain", "es", "italy", "it", "switzerland", "ch", "iceland", "is", "ireland", "ie", "romania", "ro"] },
  { id: "asia", name: "Asia", lon: 105, lat: 25, terms: ["asia", "ap", "singapore", "sg", "india", "in", "japan", "jp", "south korea", "kr", "china", "cn", "hong kong", "hk", "taiwan", "tw", "indonesia", "id", "thailand", "th", "malaysia", "my", "uae", "ae", "israel", "il"] },
  { id: "oceania", name: "Oceania", lon: 135, lat: -25, terms: ["oceania", "australia", "au", "new zealand", "nz"] },
  { id: "africa", name: "Africa", lon: 20, lat: -5, terms: ["africa", "south africa", "za", "kenya", "ke", "nigeria", "ng", "egypt", "eg", "morocco", "ma"] },
] as const;

export function regionFor(location: string): string | null {
  const value=location.trim().toLowerCase();
  if (!value || /auto|unknown|unspecified|global/.test(value)) return null;
  // Full country names first; short codes only when the whole location or the
  // leading provider region code matches, avoiding e.g. California -> Canada.
  for (const region of earthRegions) {
    if (region.terms.some(term => term.length > 3 && new RegExp(`(^|[^a-z])${term}([^a-z]|$)`).test(value))) return region.id;
  }
  const prefix=value.split(/[-_\s,]/)[0];
  return earthRegions.find(region=>region.terms.some(term=>term.length<=3&&(value===term || (prefix===term&&/^[a-z]{2,3}[-_]/.test(value)))))?.id ?? null;
}

export function regionalOffers(offers: Offer[], region: string, hardware = "All") {
  return offers.filter(o => (hardware === "All" || o.hardware === hardware) &&
    (region === "all" || (region === "unmapped" ? regionFor(o.region) === null : regionFor(o.region) === region)))
    .sort((a,b)=>a.price/a.gpuCount-b.price/b.gpuCount);
}

export function buildOfferUrl(offer: Pick<Offer,"hardware"|"region"|"gpuCount">) {
  return `/build?${new URLSearchParams({gpu:offer.hardware,region:/auto|unknown|unspecified|global/i.test(offer.region)?"auto":offer.region,quantity:String(offer.gpuCount)})}`;
}

export function regionInventory(offers: Offer[], region: string, hardware = "All") {
  const located=regionalOffers(offers,region,hardware);
  const unconfirmed=regionalOffers(offers,"unmapped",hardware);
  const alternatives=unconfirmed.length?unconfirmed:regionalOffers(offers,"all",hardware);
  const fallback=region!=="all"&&region!=="unmapped"&&!located.length&&alternatives.length>0;
  return { located, unconfirmed, display: fallback?alternatives:located,
    fallback, elsewhere:fallback&&!unconfirmed.length };
}

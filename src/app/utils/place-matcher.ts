import { TripOption } from "../models/trip.model";

interface PlaceInfo {
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  urlName: string | null;
}

const SAME_PLACE_METERS = 50;

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function parseMapsUrl(raw: string): PlaceInfo {
  const info: PlaceInfo = {
    placeId: null,
    lat: null,
    lng: null,
    urlName: null,
  };
  const url = raw.trim();
  if (!url) return info;

  // place ID（!1s0x...:0x...）
  const idMatch = url.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (idMatch) info.placeId = idMatch[1].toLowerCase();

  // 座標：優先用 !3d!4d（地點本身），其次才是 @lat,lng（畫面中心，不一定是地點）
  const pin = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const view = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const coord = pin ?? view;
  if (coord) {
    info.lat = Number(coord[1]);
    info.lng = Number(coord[2]);
  }

  // 地點名稱
  const nameMatch =
    url.match(/\/maps\/place\/([^/@?]+)/i) ??
    url.match(/\/maps\/search\/([^/@?]+)/i) ??
    url.match(/[?&](?:q|query)=([^&]+)/i);
  if (nameMatch) info.urlName = safeDecode(nameMatch[1]);

  return info;
}

function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}

type PlaceLike = Pick<TripOption, "title" | "mapsUrl">;

export function isSamePlace(a: PlaceLike, b: PlaceLike): boolean {
  const urlA = (a.mapsUrl ?? "").trim();
  const urlB = (b.mapsUrl ?? "").trim();

  // 1. 連結完全一樣（包含短網址）
  if (urlA && urlB && normalizeUrl(urlA) === normalizeUrl(urlB)) return true;

  const infoA = parseMapsUrl(urlA);
  const infoB = parseMapsUrl(urlB);

  // 2. place ID：兩邊都有就是最準的依據
  if (infoA.placeId && infoB.placeId) return infoA.placeId === infoB.placeId;

  // 3. 座標：兩邊都有，靠得很近才算同一個（避免同名連鎖店分店被誤判）
  if (
    infoA.lat !== null &&
    infoA.lng !== null &&
    infoB.lat !== null &&
    infoB.lng !== null
  ) {
    return (
      distanceMeters(infoA.lat, infoA.lng, infoB.lat, infoB.lng) <=
      SAME_PLACE_METERS
    );
  }

  // 4. 名稱：網址裡的地點名、標題，任一組正規化後相同
  const namesA = [infoA.urlName, a.title].map(normalizeName).filter(Boolean);
  const namesB = [infoB.urlName, b.title].map(normalizeName).filter(Boolean);
  return namesA.some((name) => namesB.includes(name));
}

export function findDuplicateOption(
  candidate: PlaceLike,
  options: TripOption[],
  excludeId?: string | null
): TripOption | null {
  return (
    options.find(
      (option) => option.id !== excludeId && isSamePlace(candidate, option)
    ) ?? null
  );
}

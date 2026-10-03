const brazilianAreaCodes = new Set([
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "21",
  "22",
  "24",
  "27",
  "28",
  "31",
  "32",
  "33",
  "34",
  "35",
  "37",
  "38",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "51",
  "53",
  "54",
  "55",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "67",
  "68",
  "69",
  "71",
  "73",
  "74",
  "75",
  "77",
  "79",
  "81",
  "82",
  "83",
  "84",
  "85",
  "86",
  "87",
  "88",
  "89",
  "91",
  "92",
  "93",
  "94",
  "95",
  "96",
  "97",
  "98",
  "99",
]);

const repeatedSubscriber = /^(\d)\1{7,}$/;
const sequentialSubscriber = /^(?:012345678|123456789|987654321|876543210)$/;

/** Normalizes a Brazilian mobile number, rejecting malformed and obvious placeholder values. */
export function normalizeBrazilianMobile(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const national = digits.length === 13 && digits.startsWith("55") ? digits.slice(2) : digits;
  if (national.length !== 11) return null;

  const areaCode = national.slice(0, 2);
  const subscriber = national.slice(2);
  if (!brazilianAreaCodes.has(areaCode) || !/^9\d{8}$/.test(subscriber)) return null;
  if (repeatedSubscriber.test(subscriber) || sequentialSubscriber.test(subscriber)) return null;

  return `+55${national}`;
}

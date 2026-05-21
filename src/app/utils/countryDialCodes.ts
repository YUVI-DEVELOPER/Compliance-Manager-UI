export interface CountryDialCode {
  iso2: string;
  name: string;
  dialCode: string;
  aliases?: string[];
}

export interface PhoneNumberLengthRange {
  min: number;
  max: number;
}

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { iso2: "AF", name: "Afghanistan", dialCode: "+93" },
  { iso2: "AL", name: "Albania", dialCode: "+355" },
  { iso2: "DZ", name: "Algeria", dialCode: "+213" },
  { iso2: "AR", name: "Argentina", dialCode: "+54" },
  { iso2: "AU", name: "Australia", dialCode: "+61" },
  { iso2: "AT", name: "Austria", dialCode: "+43" },
  { iso2: "BH", name: "Bahrain", dialCode: "+973" },
  { iso2: "BD", name: "Bangladesh", dialCode: "+880" },
  { iso2: "BE", name: "Belgium", dialCode: "+32" },
  { iso2: "BR", name: "Brazil", dialCode: "+55" },
  { iso2: "CA", name: "Canada", dialCode: "+1" },
  { iso2: "CL", name: "Chile", dialCode: "+56" },
  { iso2: "CN", name: "China", dialCode: "+86" },
  { iso2: "CO", name: "Colombia", dialCode: "+57" },
  { iso2: "DK", name: "Denmark", dialCode: "+45" },
  { iso2: "EG", name: "Egypt", dialCode: "+20" },
  { iso2: "FI", name: "Finland", dialCode: "+358" },
  { iso2: "FR", name: "France", dialCode: "+33" },
  { iso2: "DE", name: "Germany", dialCode: "+49" },
  { iso2: "GR", name: "Greece", dialCode: "+30" },
  { iso2: "HK", name: "Hong Kong", dialCode: "+852" },
  { iso2: "IN", name: "India", dialCode: "+91" },
  { iso2: "ID", name: "Indonesia", dialCode: "+62" },
  { iso2: "IE", name: "Ireland", dialCode: "+353" },
  { iso2: "IL", name: "Israel", dialCode: "+972" },
  { iso2: "IT", name: "Italy", dialCode: "+39" },
  { iso2: "JP", name: "Japan", dialCode: "+81" },
  { iso2: "KE", name: "Kenya", dialCode: "+254" },
  { iso2: "KW", name: "Kuwait", dialCode: "+965" },
  { iso2: "MY", name: "Malaysia", dialCode: "+60" },
  { iso2: "MX", name: "Mexico", dialCode: "+52" },
  { iso2: "NL", name: "Netherlands", dialCode: "+31" },
  { iso2: "NZ", name: "New Zealand", dialCode: "+64" },
  { iso2: "NG", name: "Nigeria", dialCode: "+234" },
  { iso2: "NO", name: "Norway", dialCode: "+47" },
  { iso2: "OM", name: "Oman", dialCode: "+968" },
  { iso2: "PK", name: "Pakistan", dialCode: "+92" },
  { iso2: "PH", name: "Philippines", dialCode: "+63" },
  { iso2: "PL", name: "Poland", dialCode: "+48" },
  { iso2: "PT", name: "Portugal", dialCode: "+351" },
  { iso2: "QA", name: "Qatar", dialCode: "+974" },
  { iso2: "RU", name: "Russia", dialCode: "+7" },
  { iso2: "SA", name: "Saudi Arabia", dialCode: "+966" },
  { iso2: "SG", name: "Singapore", dialCode: "+65" },
  { iso2: "ZA", name: "South Africa", dialCode: "+27" },
  { iso2: "KR", name: "South Korea", dialCode: "+82", aliases: ["Korea"] },
  { iso2: "ES", name: "Spain", dialCode: "+34" },
  { iso2: "LK", name: "Sri Lanka", dialCode: "+94" },
  { iso2: "SE", name: "Sweden", dialCode: "+46" },
  { iso2: "CH", name: "Switzerland", dialCode: "+41" },
  { iso2: "TW", name: "Taiwan", dialCode: "+886" },
  { iso2: "TH", name: "Thailand", dialCode: "+66" },
  { iso2: "TR", name: "Turkey", dialCode: "+90" },
  { iso2: "AE", name: "United Arab Emirates", dialCode: "+971", aliases: ["UAE"] },
  { iso2: "GB", name: "United Kingdom", dialCode: "+44", aliases: ["UK", "Britain", "Great Britain"] },
  { iso2: "US", name: "United States", dialCode: "+1", aliases: ["USA", "United States of America"] },
  { iso2: "VN", name: "Vietnam", dialCode: "+84" },
];

const TIMEZONE_COUNTRY_HINTS: Record<string, string> = {
  "Asia/Calcutta": "IN",
  "Asia/Kolkata": "IN",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "Europe/London": "GB",
};

const PHONE_NUMBER_LENGTH_RANGES: Record<string, PhoneNumberLengthRange> = {
  AF: { min: 9, max: 9 },
  AL: { min: 8, max: 9 },
  DZ: { min: 8, max: 9 },
  AR: { min: 10, max: 10 },
  AU: { min: 9, max: 9 },
  AT: { min: 10, max: 13 },
  BH: { min: 8, max: 8 },
  BD: { min: 10, max: 10 },
  BE: { min: 8, max: 9 },
  BR: { min: 10, max: 11 },
  CA: { min: 10, max: 10 },
  CL: { min: 8, max: 9 },
  CN: { min: 11, max: 11 },
  CO: { min: 10, max: 10 },
  DK: { min: 8, max: 8 },
  EG: { min: 10, max: 10 },
  FI: { min: 7, max: 12 },
  FR: { min: 9, max: 9 },
  DE: { min: 7, max: 11 },
  GR: { min: 10, max: 10 },
  HK: { min: 8, max: 8 },
  IN: { min: 10, max: 10 },
  ID: { min: 9, max: 12 },
  IE: { min: 7, max: 9 },
  IL: { min: 9, max: 9 },
  IT: { min: 9, max: 10 },
  JP: { min: 10, max: 10 },
  KE: { min: 9, max: 9 },
  KW: { min: 8, max: 8 },
  MY: { min: 9, max: 10 },
  MX: { min: 10, max: 10 },
  NL: { min: 9, max: 9 },
  NZ: { min: 8, max: 10 },
  NG: { min: 10, max: 10 },
  NO: { min: 8, max: 8 },
  OM: { min: 8, max: 8 },
  PK: { min: 10, max: 10 },
  PH: { min: 10, max: 10 },
  PL: { min: 9, max: 9 },
  PT: { min: 9, max: 9 },
  QA: { min: 8, max: 8 },
  RU: { min: 10, max: 10 },
  SA: { min: 9, max: 9 },
  SG: { min: 8, max: 8 },
  ZA: { min: 9, max: 9 },
  KR: { min: 9, max: 10 },
  ES: { min: 9, max: 9 },
  LK: { min: 9, max: 9 },
  SE: { min: 7, max: 10 },
  CH: { min: 9, max: 9 },
  TW: { min: 9, max: 9 },
  TH: { min: 9, max: 9 },
  TR: { min: 10, max: 10 },
  AE: { min: 9, max: 9 },
  GB: { min: 10, max: 10 },
  US: { min: 10, max: 10 },
  VN: { min: 9, max: 10 },
};

function normalizeCountry(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeDialSearch(value: string): string {
  return value.trim().replace(/[^\d+]/g, "");
}

function countryTerms(country: CountryDialCode): string[] {
  return [country.name, country.iso2, ...(country.aliases ?? [])];
}

export function findCountryDialCode(value: string): CountryDialCode | null {
  const normalizedValue = normalizeCountry(value);
  if (!normalizedValue) return null;

  const exact = COUNTRY_DIAL_CODES.find((country) =>
    countryTerms(country).some((term) => normalizeCountry(term) === normalizedValue),
  );
  if (exact) return exact;

  const prefixMatches = COUNTRY_DIAL_CODES.filter((country) =>
    countryTerms(country).some((term) => normalizeCountry(term).startsWith(normalizedValue)),
  );
  return prefixMatches.length === 1 ? prefixMatches[0] : null;
}

export function findCountryDialCodeByIso2(iso2: string | undefined): CountryDialCode | null {
  if (!iso2) return null;
  return COUNTRY_DIAL_CODES.find((country) => country.iso2 === iso2.toUpperCase()) ?? null;
}

export function findCountryDialCodeByDialCode(dialCode: string | undefined): CountryDialCode | null {
  if (!dialCode) return null;
  const normalizedDialCode = normalizeDialSearch(dialCode);
  const withPlus = normalizedDialCode.startsWith("+") ? normalizedDialCode : `+${normalizedDialCode}`;
  return COUNTRY_DIAL_CODES.find((country) => country.dialCode === withPlus) ?? null;
}

export function searchCountryDialCodes(query: string, limit = 8): CountryDialCode[] {
  const normalizedText = normalizeCountry(query);
  const normalizedDial = normalizeDialSearch(query);
  const dialWithPlus = normalizedDial.startsWith("+") ? normalizedDial : `+${normalizedDial}`;

  if (!normalizedText && !normalizedDial) return COUNTRY_DIAL_CODES.slice(0, limit);

  return COUNTRY_DIAL_CODES
    .filter((country) => {
      const textMatch = countryTerms(country).some((term) => normalizeCountry(term).includes(normalizedText));
      const dialMatch = normalizedDial ? country.dialCode.startsWith(dialWithPlus) || country.dialCode.slice(1).startsWith(normalizedDial) : false;
      return textMatch || dialMatch;
    })
    .slice(0, limit);
}

export function getPhoneNumberLengthRange(country: CountryDialCode | null | undefined): PhoneNumberLengthRange {
  return country ? PHONE_NUMBER_LENGTH_RANGES[country.iso2] ?? { min: 6, max: 15 } : { min: 6, max: 15 };
}

export function formatPhoneNumberLengthHint(country: CountryDialCode | null | undefined): string {
  const range = getPhoneNumberLengthRange(country);
  return range.min === range.max ? `${range.min} digit number` : `${range.min}-${range.max} digit number`;
}

export function getBrowserCountryDialCode(): CountryDialCode | null {
  if (typeof window === "undefined") return null;

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZoneCountry = findCountryDialCodeByIso2(TIMEZONE_COUNTRY_HINTS[timeZone]);
  if (timeZoneCountry) return timeZoneCountry;

  const languageRegion = window.navigator.language.split("-")[1];
  return findCountryDialCodeByIso2(languageRegion);
}

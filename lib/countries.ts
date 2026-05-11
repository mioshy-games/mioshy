/**
 * Bilingual country list for Mioshy's checkout flow.
 *
 * Each entry: { code: ISO-3166-1 alpha-2, he: Hebrew name, en: English name }.
 *
 * Used by SubscriptionModal's country picker. The list is hand-maintained:
 * we deliberately keep all sovereign UN member states + a few common
 * dependencies (HK, TW, PR) so the dropdown shows every country a Mioshy
 * customer might pick. Hebrew names are the standard מפעל הפיס / Wikipedia
 * spellings.
 *
 * Sorting is locale-aware via Intl.Collator (callsite responsibility).
 */

export type Country = {
  code: string;
  he: string;
  en: string;
};

export const COUNTRIES: Country[] = [
  { code: "AF", he: "אפגניסטן",                 en: "Afghanistan" },
  { code: "AL", he: "אלבניה",                   en: "Albania" },
  { code: "DZ", he: "אלג'יריה",                 en: "Algeria" },
  { code: "AD", he: "אנדורה",                   en: "Andorra" },
  { code: "AO", he: "אנגולה",                   en: "Angola" },
  { code: "AG", he: "אנטיגואה וברבודה",         en: "Antigua and Barbuda" },
  { code: "AR", he: "ארגנטינה",                 en: "Argentina" },
  { code: "AM", he: "ארמניה",                   en: "Armenia" },
  { code: "AU", he: "אוסטרליה",                 en: "Australia" },
  { code: "AT", he: "אוסטריה",                  en: "Austria" },
  { code: "AZ", he: "אזרבייג'ן",                en: "Azerbaijan" },
  { code: "BS", he: "איי בהאמה",                en: "Bahamas" },
  { code: "BH", he: "בחריין",                   en: "Bahrain" },
  { code: "BD", he: "בנגלדש",                   en: "Bangladesh" },
  { code: "BB", he: "ברבדוס",                   en: "Barbados" },
  { code: "BY", he: "בלארוס",                   en: "Belarus" },
  { code: "BE", he: "בלגיה",                    en: "Belgium" },
  { code: "BZ", he: "בליז",                     en: "Belize" },
  { code: "BJ", he: "בנין",                     en: "Benin" },
  { code: "BT", he: "בהוטן",                    en: "Bhutan" },
  { code: "BO", he: "בוליביה",                  en: "Bolivia" },
  { code: "BA", he: "בוסניה והרצגובינה",        en: "Bosnia and Herzegovina" },
  { code: "BW", he: "בוצואנה",                  en: "Botswana" },
  { code: "BR", he: "ברזיל",                    en: "Brazil" },
  { code: "BN", he: "ברוניי",                   en: "Brunei" },
  { code: "BG", he: "בולגריה",                  en: "Bulgaria" },
  { code: "BF", he: "בורקינה פאסו",             en: "Burkina Faso" },
  { code: "BI", he: "בורונדי",                  en: "Burundi" },
  { code: "KH", he: "קמבודיה",                  en: "Cambodia" },
  { code: "CM", he: "קמרון",                    en: "Cameroon" },
  { code: "CA", he: "קנדה",                     en: "Canada" },
  { code: "CV", he: "כף ורדה",                  en: "Cape Verde" },
  { code: "CF", he: "הרפובליקה המרכז־אפריקאית", en: "Central African Republic" },
  { code: "TD", he: "צ'אד",                     en: "Chad" },
  { code: "CL", he: "צ'ילה",                    en: "Chile" },
  { code: "CN", he: "סין",                      en: "China" },
  { code: "CO", he: "קולומביה",                 en: "Colombia" },
  { code: "KM", he: "איי קומורו",               en: "Comoros" },
  { code: "CG", he: "הרפובליקה של קונגו",       en: "Congo (Republic)" },
  { code: "CD", he: "הרפובליקה הדמוקרטית של קונגו", en: "Congo (DRC)" },
  { code: "CR", he: "קוסטה ריקה",               en: "Costa Rica" },
  { code: "HR", he: "קרואטיה",                  en: "Croatia" },
  { code: "CU", he: "קובה",                     en: "Cuba" },
  { code: "CY", he: "קפריסין",                  en: "Cyprus" },
  { code: "CZ", he: "צ'כיה",                    en: "Czech Republic" },
  { code: "DK", he: "דנמרק",                    en: "Denmark" },
  { code: "DJ", he: "ג'יבוטי",                  en: "Djibouti" },
  { code: "DM", he: "דומיניקה",                 en: "Dominica" },
  { code: "DO", he: "הרפובליקה הדומיניקנית",    en: "Dominican Republic" },
  { code: "EC", he: "אקוודור",                  en: "Ecuador" },
  { code: "EG", he: "מצרים",                    en: "Egypt" },
  { code: "SV", he: "אל סלוודור",               en: "El Salvador" },
  { code: "GQ", he: "גינאה המשוונית",           en: "Equatorial Guinea" },
  { code: "ER", he: "אריתריאה",                 en: "Eritrea" },
  { code: "EE", he: "אסטוניה",                  en: "Estonia" },
  { code: "SZ", he: "אסוואטיני",                en: "Eswatini" },
  { code: "ET", he: "אתיופיה",                  en: "Ethiopia" },
  { code: "FJ", he: "פיג'י",                    en: "Fiji" },
  { code: "FI", he: "פינלנד",                   en: "Finland" },
  { code: "FR", he: "צרפת",                     en: "France" },
  { code: "GA", he: "גבון",                     en: "Gabon" },
  { code: "GM", he: "גמביה",                    en: "Gambia" },
  { code: "GE", he: "גאורגיה",                  en: "Georgia" },
  { code: "DE", he: "גרמניה",                   en: "Germany" },
  { code: "GH", he: "גאנה",                     en: "Ghana" },
  { code: "GR", he: "יוון",                     en: "Greece" },
  { code: "GD", he: "גרנדה",                    en: "Grenada" },
  { code: "GT", he: "גואטמלה",                  en: "Guatemala" },
  { code: "GN", he: "גינאה",                    en: "Guinea" },
  { code: "GW", he: "גינאה ביסאו",              en: "Guinea-Bissau" },
  { code: "GY", he: "גיאנה",                    en: "Guyana" },
  { code: "HT", he: "האיטי",                    en: "Haiti" },
  { code: "HN", he: "הונדורס",                  en: "Honduras" },
  { code: "HK", he: "הונג קונג",                en: "Hong Kong" },
  { code: "HU", he: "הונגריה",                  en: "Hungary" },
  { code: "IS", he: "איסלנד",                   en: "Iceland" },
  { code: "IN", he: "הודו",                     en: "India" },
  { code: "ID", he: "אינדונזיה",                en: "Indonesia" },
  { code: "IR", he: "איראן",                    en: "Iran" },
  { code: "IQ", he: "עיראק",                    en: "Iraq" },
  { code: "IE", he: "אירלנד",                   en: "Ireland" },
  { code: "IL", he: "ישראל",                    en: "Israel" },
  { code: "IT", he: "איטליה",                   en: "Italy" },
  { code: "CI", he: "חוף השנהב",                en: "Ivory Coast" },
  { code: "JM", he: "ג'מייקה",                  en: "Jamaica" },
  { code: "JP", he: "יפן",                      en: "Japan" },
  { code: "JO", he: "ירדן",                     en: "Jordan" },
  { code: "KZ", he: "קזחסטן",                   en: "Kazakhstan" },
  { code: "KE", he: "קניה",                     en: "Kenya" },
  { code: "KI", he: "קיריבאטי",                 en: "Kiribati" },
  { code: "KW", he: "כווית",                    en: "Kuwait" },
  { code: "KG", he: "קירגיזסטן",                en: "Kyrgyzstan" },
  { code: "LA", he: "לאוס",                     en: "Laos" },
  { code: "LV", he: "לטביה",                    en: "Latvia" },
  { code: "LB", he: "לבנון",                    en: "Lebanon" },
  { code: "LS", he: "לסוטו",                    en: "Lesotho" },
  { code: "LR", he: "ליבריה",                   en: "Liberia" },
  { code: "LY", he: "לוב",                      en: "Libya" },
  { code: "LI", he: "ליכטנשטיין",               en: "Liechtenstein" },
  { code: "LT", he: "ליטא",                     en: "Lithuania" },
  { code: "LU", he: "לוקסמבורג",                en: "Luxembourg" },
  { code: "MG", he: "מדגסקר",                   en: "Madagascar" },
  { code: "MW", he: "מלאווי",                   en: "Malawi" },
  { code: "MY", he: "מלזיה",                    en: "Malaysia" },
  { code: "MV", he: "האיים המלדיביים",          en: "Maldives" },
  { code: "ML", he: "מאלי",                     en: "Mali" },
  { code: "MT", he: "מלטה",                     en: "Malta" },
  { code: "MH", he: "איי מרשל",                 en: "Marshall Islands" },
  { code: "MR", he: "מאוריטניה",                en: "Mauritania" },
  { code: "MU", he: "מאוריציוס",                en: "Mauritius" },
  { code: "MX", he: "מקסיקו",                   en: "Mexico" },
  { code: "FM", he: "מיקרונזיה",                en: "Micronesia" },
  { code: "MD", he: "מולדובה",                  en: "Moldova" },
  { code: "MC", he: "מונקו",                    en: "Monaco" },
  { code: "MN", he: "מונגוליה",                 en: "Mongolia" },
  { code: "ME", he: "מונטנגרו",                 en: "Montenegro" },
  { code: "MA", he: "מרוקו",                    en: "Morocco" },
  { code: "MZ", he: "מוזמביק",                  en: "Mozambique" },
  { code: "MM", he: "מיאנמר",                   en: "Myanmar" },
  { code: "NA", he: "נמיביה",                   en: "Namibia" },
  { code: "NR", he: "נאורו",                    en: "Nauru" },
  { code: "NP", he: "נפאל",                     en: "Nepal" },
  { code: "NL", he: "הולנד",                    en: "Netherlands" },
  { code: "NZ", he: "ניו זילנד",                en: "New Zealand" },
  { code: "NI", he: "ניקרגואה",                 en: "Nicaragua" },
  { code: "NE", he: "ניז'ר",                    en: "Niger" },
  { code: "NG", he: "ניגריה",                   en: "Nigeria" },
  { code: "MK", he: "מקדוניה הצפונית",          en: "North Macedonia" },
  { code: "NO", he: "נורווגיה",                 en: "Norway" },
  { code: "OM", he: "עומאן",                    en: "Oman" },
  { code: "PK", he: "פקיסטן",                   en: "Pakistan" },
  { code: "PW", he: "פלאו",                     en: "Palau" },
  { code: "PS", he: "פלסטין",                   en: "Palestine" },
  { code: "PA", he: "פנמה",                     en: "Panama" },
  { code: "PG", he: "פפואה גינאה החדשה",        en: "Papua New Guinea" },
  { code: "PY", he: "פרגוואי",                  en: "Paraguay" },
  { code: "PE", he: "פרו",                      en: "Peru" },
  { code: "PH", he: "הפיליפינים",               en: "Philippines" },
  { code: "PL", he: "פולין",                    en: "Poland" },
  { code: "PT", he: "פורטוגל",                  en: "Portugal" },
  { code: "PR", he: "פוארטו ריקו",              en: "Puerto Rico" },
  { code: "QA", he: "קטאר",                     en: "Qatar" },
  { code: "RO", he: "רומניה",                   en: "Romania" },
  { code: "RU", he: "רוסיה",                    en: "Russia" },
  { code: "RW", he: "רואנדה",                   en: "Rwanda" },
  { code: "KN", he: "סנט קיטס ונוויס",          en: "Saint Kitts and Nevis" },
  { code: "LC", he: "סנט לוסיה",                en: "Saint Lucia" },
  { code: "VC", he: "סנט וינסנט והגרנדינים",    en: "Saint Vincent and the Grenadines" },
  { code: "WS", he: "סמואה",                    en: "Samoa" },
  { code: "SM", he: "סן מרינו",                 en: "San Marino" },
  { code: "ST", he: "סאו טומה ופרינסיפה",       en: "Sao Tome and Principe" },
  { code: "SA", he: "ערב הסעודית",              en: "Saudi Arabia" },
  { code: "SN", he: "סנגל",                     en: "Senegal" },
  { code: "RS", he: "סרביה",                    en: "Serbia" },
  { code: "SC", he: "איי סיישל",                en: "Seychelles" },
  { code: "SL", he: "סיירה לאון",               en: "Sierra Leone" },
  { code: "SG", he: "סינגפור",                  en: "Singapore" },
  { code: "SK", he: "סלובקיה",                  en: "Slovakia" },
  { code: "SI", he: "סלובניה",                  en: "Slovenia" },
  { code: "SB", he: "איי שלמה",                 en: "Solomon Islands" },
  { code: "SO", he: "סומליה",                   en: "Somalia" },
  { code: "ZA", he: "דרום אפריקה",              en: "South Africa" },
  { code: "KR", he: "דרום קוריאה",              en: "South Korea" },
  { code: "SS", he: "דרום סודאן",               en: "South Sudan" },
  { code: "ES", he: "ספרד",                     en: "Spain" },
  { code: "LK", he: "סרי לנקה",                 en: "Sri Lanka" },
  { code: "SD", he: "סודאן",                    en: "Sudan" },
  { code: "SR", he: "סורינאם",                  en: "Suriname" },
  { code: "SE", he: "שוודיה",                   en: "Sweden" },
  { code: "CH", he: "שווייץ",                   en: "Switzerland" },
  { code: "SY", he: "סוריה",                    en: "Syria" },
  { code: "TW", he: "טאיוואן",                  en: "Taiwan" },
  { code: "TJ", he: "טג'יקיסטן",                en: "Tajikistan" },
  { code: "TZ", he: "טנזניה",                   en: "Tanzania" },
  { code: "TH", he: "תאילנד",                   en: "Thailand" },
  { code: "TL", he: "מזרח טימור",               en: "Timor-Leste" },
  { code: "TG", he: "טוגו",                     en: "Togo" },
  { code: "TO", he: "טונגה",                    en: "Tonga" },
  { code: "TT", he: "טרינידד וטובגו",           en: "Trinidad and Tobago" },
  { code: "TN", he: "תוניסיה",                  en: "Tunisia" },
  { code: "TR", he: "טורקיה",                   en: "Turkey" },
  { code: "TM", he: "טורקמניסטן",               en: "Turkmenistan" },
  { code: "TV", he: "טובאלו",                   en: "Tuvalu" },
  { code: "UG", he: "אוגנדה",                   en: "Uganda" },
  { code: "UA", he: "אוקראינה",                 en: "Ukraine" },
  { code: "AE", he: "איחוד האמירויות הערביות",  en: "United Arab Emirates" },
  { code: "GB", he: "הממלכה המאוחדת",           en: "United Kingdom" },
  { code: "US", he: "ארצות הברית",              en: "United States" },
  { code: "UY", he: "אורוגוואי",                en: "Uruguay" },
  { code: "UZ", he: "אוזבקיסטן",                en: "Uzbekistan" },
  { code: "VU", he: "ונואטו",                   en: "Vanuatu" },
  { code: "VA", he: "הוותיקן",                  en: "Vatican" },
  { code: "VE", he: "ונצואלה",                  en: "Venezuela" },
  { code: "VN", he: "וייטנאם",                  en: "Vietnam" },
  { code: "YE", he: "תימן",                     en: "Yemen" },
  { code: "ZM", he: "זמביה",                    en: "Zambia" },
  { code: "ZW", he: "זימבבואה",                 en: "Zimbabwe" },
];

/**
 * Build a sorted-and-filtered list for the dropdown.
 *
 * Behavior:
 *   • Locale-aware alphabetical sort by the displayed name.
 *   • If `pinTopCode` is given (e.g. the IP-detected country), that entry
 *     is moved to the top with a separator visible in the UI.
 *   • If `query` is given, only entries whose he/en/code match are kept.
 *     Matching is case-insensitive and accent-insensitive (Unicode NFD).
 */
export function listCountries(options: {
  locale: "he" | "en";
  pinTopCode?: string | null;
  query?: string;
}): { pinned?: Country; rest: Country[] } {
  const { locale, pinTopCode, query } = options;
  const collator = new Intl.Collator(locale === "he" ? "he" : "en", {
    sensitivity: "base",
  });
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const q = query ? norm(query) : null;
  const matches = (c: Country) =>
    !q ||
    norm(c.he).includes(q) ||
    norm(c.en).includes(q) ||
    c.code.toLowerCase().includes(q);

  const sorted = [...COUNTRIES]
    .filter(matches)
    .sort((a, b) =>
      collator.compare(locale === "he" ? a.he : a.en, locale === "he" ? b.he : b.en),
    );

  if (!pinTopCode) return { rest: sorted };
  const idx = sorted.findIndex((c) => c.code === pinTopCode.toUpperCase());
  if (idx === -1) return { rest: sorted };
  const [pinned] = sorted.splice(idx, 1);
  return { pinned, rest: sorted };
}

export function findCountry(code: string | null | undefined): Country | null {
  if (!code) return null;
  const c = COUNTRIES.find((x) => x.code === code.toUpperCase());
  return c ?? null;
}

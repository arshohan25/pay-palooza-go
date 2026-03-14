export interface BankInfo {
  id: string;
  name: string;
  short: string;
  color: string; // HSL color for avatar
}

// Deterministic color from bank name
const hueFromName = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
};

const bank = (id: string, name: string, short: string): BankInfo => ({
  id, name, short,
  color: `hsl(${hueFromName(name)}, 55%, 45%)`,
});

export const BANGLADESH_BANKS: BankInfo[] = [
  // State-owned commercial banks
  bank("sonali", "Sonali Bank", "SBL"),
  bank("janata", "Janata Bank", "JBL"),
  bank("agrani", "Agrani Bank", "ABL"),
  bank("rupali", "Rupali Bank", "RBL"),
  bank("basic", "BASIC Bank", "BASIC"),
  bank("bdbl", "Bangladesh Development Bank", "BDBL"),

  // Private commercial banks
  bank("dbbl", "Dutch-Bangla Bank", "DBBL"),
  bank("brac", "BRAC Bank", "BRAC"),
  bank("city", "City Bank", "CITY"),
  bank("ebl", "Eastern Bank", "EBL"),
  bank("ucb", "United Commercial Bank", "UCB"),
  bank("pubali", "Pubali Bank", "PBL"),
  bank("uttara", "Uttara Bank", "UTTARA"),
  bank("ab", "AB Bank", "AB"),
  bank("ific", "IFIC Bank", "IFIC"),
  bank("ncc", "NCC Bank", "NCC"),
  bank("premier", "Premier Bank", "PML"),
  bank("one", "One Bank", "OBL"),
  bank("dhaka", "Dhaka Bank", "DBL"),
  bank("mercantile", "Mercantile Bank", "MBL"),
  bank("standard", "Standard Bank", "SDB"),
  bank("midland", "Midland Bank", "MDB"),
  bank("nrb-commercial", "NRB Commercial Bank", "NRB"),
  bank("south-bangla", "South Bangla Agriculture Bank", "SBAC"),
  bank("meghna", "Meghna Bank", "MGB"),
  bank("padma", "Padma Bank", "PMB"),
  bank("bengal", "Bengal Commercial Bank", "BCB"),
  bank("community", "Community Bank", "CBL"),
  bank("citizens", "Citizens Bank", "CTZ"),
  bank("trust", "Trust Bank", "TBL"),
  bank("mutual-trust", "Mutual Trust Bank", "MTB"),
  bank("union", "Union Bank", "UBL"),
  bank("shimanto", "Shimanto Bank", "SMB"),
  bank("probashi", "NRB Bank", "NRBB"),

  // Islamic banks
  bank("islami", "Islami Bank Bangladesh", "IBBL"),
  bank("al-arafah", "Al-Arafah Islami Bank", "AIBL"),
  bank("shahjalal", "Shahjalal Islami Bank", "SJIBL"),
  bank("exim", "EXIM Bank", "EXIM"),
  bank("social-islami", "Social Islami Bank", "SIBL"),
  bank("first-security", "First Security Islami Bank", "FSIBL"),
  bank("global-islami", "Global Islami Bank", "GIBL"),
  bank("union-bank", "Union Bank", "UNION"),

  // Foreign banks
  bank("scb", "Standard Chartered", "SCB"),
  bank("hsbc", "HSBC Bangladesh", "HSBC"),
  bank("citibank", "Citibank N.A.", "CITI"),
  bank("commercial-ceylon", "Commercial Bank of Ceylon", "CBC"),
  bank("woori", "Woori Bank", "WOORI"),
  bank("al-falah", "Bank Al-Falah", "BAF"),
  bank("sbi", "State Bank of India", "SBI"),
  bank("habib", "Habib Bank", "HBL"),
  bank("nbp", "National Bank of Pakistan", "NBP"),

  // Specialized banks
  bank("bangladesh-krishi", "Bangladesh Krishi Bank", "BKB"),
  bank("rajshahi-krishi", "Rajshahi Krishi Unnayan Bank", "RKUB"),
  bank("probashi-kollyan", "Probashi Kollyan Bank", "PKB"),
  bank("karmasangsthan", "Karmasangsthan Bank", "KSB"),
  bank("ansar-vdp", "Ansar-VDP Unnayan Bank", "AVUB"),
];

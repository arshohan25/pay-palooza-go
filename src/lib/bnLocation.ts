/**
 * Bangla display labels for Bangladesh administrative divisions and districts.
 *
 * The `upazilas` / `unions` tables store English names. When the app language
 * is Bangla we translate them client-side so dropdown lists read in Bangla
 * without a schema change. Unknown values fall back to the English name.
 *
 * Only divisions (8) and districts (64) are enumerated — upazila and union
 * name sets are too large (~626 upazilas, ~5674 unions) to hand-translate
 * reliably; those keep their English label until a proper translation
 * dataset is imported.
 */

const DIVISIONS: Record<string, string> = {
  Barisal: "বরিশাল",
  Chattagram: "চট্টগ্রাম",
  Chittagong: "চট্টগ্রাম",
  Dhaka: "ঢাকা",
  Khulna: "খুলনা",
  Mymensingh: "ময়মনসিংহ",
  Rajshahi: "রাজশাহী",
  Rangpur: "রংপুর",
  Sylhet: "সিলেট",
};

const DISTRICTS: Record<string, string> = {
  Bagerhat: "বাগেরহাট",
  Bandarban: "বান্দরবান",
  Barguna: "বরগুনা",
  Barisal: "বরিশাল",
  Bhola: "ভোলা",
  Bogura: "বগুড়া",
  Brahmanbaria: "ব্রাহ্মণবাড়িয়া",
  Chandpur: "চাঁদপুর",
  Chapainawabganj: "চাঁপাইনবাবগঞ্জ",
  Chattogram: "চট্টগ্রাম",
  Chittagong: "চট্টগ্রাম",
  Chuadanga: "চুয়াডাঙ্গা",
  Comilla: "কুমিল্লা",
  Cumilla: "কুমিল্লা",
  Coxsbazar: "কক্সবাজার",
  "Cox's Bazar": "কক্সবাজার",
  Dhaka: "ঢাকা",
  Dinajpur: "দিনাজপুর",
  Faridpur: "ফরিদপুর",
  Feni: "ফেনী",
  Gaibandha: "গাইবান্ধা",
  Gazipur: "গাজীপুর",
  Gopalganj: "গোপালগঞ্জ",
  Habiganj: "হবিগঞ্জ",
  Jamalpur: "জামালপুর",
  Jashore: "যশোর",
  Jessore: "যশোর",
  Jhalakathi: "ঝালকাঠি",
  Jhalokati: "ঝালকাঠি",
  Jhenaidah: "ঝিনাইদহ",
  Joypurhat: "জয়পুরহাট",
  Khagrachhari: "খাগড়াছড়ি",
  Khulna: "খুলনা",
  Kishoreganj: "কিশোরগঞ্জ",
  Kurigram: "কুড়িগ্রাম",
  Kushtia: "কুষ্টিয়া",
  Lakshmipur: "লক্ষ্মীপুর",
  Lalmonirhat: "লালমনিরহাট",
  Madaripur: "মাদারীপুর",
  Magura: "মাগুরা",
  Manikganj: "মানিকগঞ্জ",
  Meherpur: "মেহেরপুর",
  Moulvibazar: "মৌলভীবাজার",
  Munshiganj: "মুন্সীগঞ্জ",
  Mymensingh: "ময়মনসিংহ",
  Naogaon: "নওগাঁ",
  Narail: "নড়াইল",
  Narayanganj: "নারায়ণগঞ্জ",
  Narsingdi: "নরসিংদী",
  Natore: "নাটোর",
  Netrokona: "নেত্রকোণা",
  Nilphamari: "নীলফামারী",
  Noakhali: "নোয়াখালী",
  Pabna: "পাবনা",
  Panchagarh: "পঞ্চগড়",
  Patuakhali: "পটুয়াখালী",
  Pirojpur: "পিরোজপুর",
  Rajbari: "রাজবাড়ী",
  Rajshahi: "রাজশাহী",
  Rangamati: "রাঙ্গামাটি",
  Rangpur: "রংপুর",
  Satkhira: "সাতক্ষীরা",
  Shariatpur: "শরীয়তপুর",
  Sherpur: "শেরপুর",
  Sirajganj: "সিরাজগঞ্জ",
  Sunamganj: "সুনামগঞ্জ",
  Sylhet: "সিলেট",
  Tangail: "টাঙ্গাইল",
  Thakurgaon: "ঠাকুরগাঁও",
};

export function bnDivision(name: string | null | undefined): string {
  if (!name) return "";
  return DIVISIONS[name] ?? name;
}

export function bnDistrict(name: string | null | undefined): string {
  if (!name) return "";
  return DISTRICTS[name] ?? name;
}

/**
 * Best-effort translation for a location value in any tier. Falls through to
 * the English name if unmapped — safer than rendering nothing.
 */
export function bnLocation(name: string | null | undefined): string {
  if (!name) return "";
  return DIVISIONS[name] ?? DISTRICTS[name] ?? name;
}

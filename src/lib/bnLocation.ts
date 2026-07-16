/**
 * Bangla display labels for Bangladesh administrative divisions, districts,
 * upazilas and (best-effort) unions.
 *
 * The `upazilas` / `unions` DB tables store English names only. When the app
 * language is Bangla we translate them client-side so the dropdown lists read
 * in Bangla without a schema change. Unknown values fall back to the English
 * label so nothing renders blank.
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
  Bagerhat: "বাগেরহাট", Bandarban: "বান্দরবান", Barguna: "বরগুনা", Barisal: "বরিশাল",
  Bhola: "ভোলা", Bogura: "বগুড়া", Brahmanbaria: "ব্রাহ্মণবাড়িয়া", Chandpur: "চাঁদপুর",
  Chapainawabganj: "চাঁপাইনবাবগঞ্জ", Chattogram: "চট্টগ্রাম", Chittagong: "চট্টগ্রাম",
  Chuadanga: "চুয়াডাঙ্গা", Comilla: "কুমিল্লা", Cumilla: "কুমিল্লা",
  Coxsbazar: "কক্সবাজার", "Cox's Bazar": "কক্সবাজার", Dhaka: "ঢাকা", Dinajpur: "দিনাজপুর",
  Faridpur: "ফরিদপুর", Feni: "ফেনী", Gaibandha: "গাইবান্ধা", Gazipur: "গাজীপুর",
  Gopalganj: "গোপালগঞ্জ", Habiganj: "হবিগঞ্জ", Jamalpur: "জামালপুর", Jashore: "যশোর",
  Jessore: "যশোর", Jhalakathi: "ঝালকাঠি", Jhalokati: "ঝালকাঠি", Jhenaidah: "ঝিনাইদহ",
  Joypurhat: "জয়পুরহাট", Khagrachhari: "খাগড়াছড়ি", Khulna: "খুলনা", Kishoreganj: "কিশোরগঞ্জ",
  Kurigram: "কুড়িগ্রাম", Kushtia: "কুষ্টিয়া", Lakshmipur: "লক্ষ্মীপুর", Lalmonirhat: "লালমনিরহাট",
  Madaripur: "মাদারীপুর", Magura: "মাগুরা", Manikganj: "মানিকগঞ্জ", Meherpur: "মেহেরপুর",
  Moulvibazar: "মৌলভীবাজার", Munshiganj: "মুন্সীগঞ্জ", Mymensingh: "ময়মনসিংহ",
  Naogaon: "নওগাঁ", Narail: "নড়াইল", Narayanganj: "নারায়ণগঞ্জ", Narsingdi: "নরসিংদী",
  Natore: "নাটোর", Netrokona: "নেত্রকোণা", Nilphamari: "নীলফামারী", Noakhali: "নোয়াখালী",
  Pabna: "পাবনা", Panchagarh: "পঞ্চগড়", Patuakhali: "পটুয়াখালী", Pirojpur: "পিরোজপুর",
  Rajbari: "রাজবাড়ী", Rajshahi: "রাজশাহী", Rangamati: "রাঙ্গামাটি", Rangpur: "রংপুর",
  Satkhira: "সাতক্ষীরা", Shariatpur: "শরীয়তপুর", Sherpur: "শেরপুর", Sirajganj: "সিরাজগঞ্জ",
  Sunamganj: "সুনামগঞ্জ", Sylhet: "সিলেট", Tangail: "টাঙ্গাইল", Thakurgaon: "ঠাকুরগাঁও",
};

/**
 * Complete Bangla map for every upazila / thana name present in the seeded
 * `upazilas` table (492 unique names as of 2026-07). Keep the keys in sync
 * with the DB; unknown values fall through to English.
 */
const UPAZILAS: Record<string, string> = {
  "Abhaynagar":"অভয়নগর","Adamdighi":"আদমদীঘি","Aditmari":"আদিতমারী","Agailjhara":"আগৈলঝাড়া","Ajmiriganj":"আজমিরীগঞ্জ",
  "Akhaura":"আখাউড়া","Akkelpur":"আক্কেলপুর","Alamdanga":"আলমডাঙ্গা","Alfadanga":"আলফাডাঙ্গা","Alikadam":"আলীকদম",
  "Amtali":"আমতলী","Anwara":"আনোয়ারা","Araihazar":"আড়াইহাজার","Ashuganj":"আশুগঞ্জ","Assasuni":"আশাশুনি",
  "Atghoria":"আটঘরিয়া","Atpara":"আটপাড়া","Atrai":"আত্রাই","Atwari":"আটোয়ারী","Austagram":"অষ্টগ্রাম",
  "Babuganj":"বাবুগঞ্জ","Badalgachi":"বদলগাছী","Badargonj":"বদরগঞ্জ","Bagatipara":"বাগাতিপাড়া","Bagerhat Sadar":"বাগেরহাট সদর",
  "Bagha":"বাঘা","Baghaichari":"বাঘাইছড়ি","Bagherpara":"বাঘারপাড়া","Bagmara":"বাগমারা","Bahubal":"বাহুবল",
  "Bajitpur":"বাজিতপুর","Bakerganj":"বাকেরগঞ্জ","Baksiganj":"বকশীগঞ্জ","Balaganj":"বালাগঞ্জ","Baliadangi":"বালিয়াডাঙ্গী",
  "Baliakandi":"বালিয়াকান্দি","Bamna":"বামনা","Banaripara":"বানারীপাড়া","Bancharampur":"বাঞ্ছারামপুর","Bandar":"বন্দর",
  "Bandarban Sadar":"বান্দরবান সদর","Baniachong":"বানিয়াচং","Banshkhali":"বাঁশখালী","Baraigram":"বড়াইগ্রাম","Barguna Sadar":"বরগুনা সদর",
  "Barhatta":"বারহাট্টা","Barisal Sadar":"বরিশাল সদর","Barkal":"বরকল","Barlekha":"বড়লেখা","Barura":"বরুড়া",
  "Basail":"বাসাইল","Bauphal":"বাউফল","Beanibazar":"বিয়ানীবাজার","Begumganj":"বেগমগঞ্জ","Belabo":"বেলাবো",
  "Belaichari":"বিলাইছড়ি","Belkuchi":"বেলকুচি","Bera":"বেড়া","Betagi":"বেতাগী","Bhairab":"ভৈরব",
  "Bhaluka":"ভালুকা","Bhandaria":"ভান্ডারিয়া","Bhanga":"ভাঙ্গা","Bhangura":"ভাঙ্গুড়া","Bhedarganj":"ভেদরগঞ্জ",
  "Bheramara":"ভেড়ামারা","Bhola Sadar":"ভোলা সদর","Bholahat":"ভোলাহাট","Bhuapur":"ভূঞাপুর","Bhurungamari":"ভুরুঙ্গামারী",
  "Bijoynagar":"বিজয়নগর","Birampur":"বিরামপুর","Birganj":"বীরগঞ্জ","Birol":"বিরল","Bishwambarpur":"বিশ্বম্ভরপুর",
  "Bishwanath":"বিশ্বনাথ","Boalkhali":"বোয়ালখালী","Boalmari":"বোয়ালমারী","Bochaganj":"বোচাগঞ্জ","Boda":"বোদা",
  "Bogra Sadar":"বগুড়া সদর","Bokshiganj":"বকশীগঞ্জ","Borhan Sddin":"বোরহানউদ্দিন","Borhan Uddin":"বোরহানউদ্দিন","Botiaghata":"বটিয়াঘাটা",
  "Brahmanbaria Sadar":"ব্রাহ্মণবাড়িয়া সদর","Brahmanpara":"ব্রাহ্মণপাড়া","Burichang":"বুড়িচং","Chakaria":"চকরিয়া","Chandanaish":"চন্দনাইশ",
  "Chandina":"চান্দিনা","Chandpur Sadar":"চাঁদপুর সদর","Chapainawabganj Sadar":"চাঁপাইনবাবগঞ্জ সদর","Charbhadrasan":"চরভদ্রাসন","Charfesson":"চরফ্যাশন",
  "Charghat":"চারঘাট","Charrajibpur":"চর রাজিবপুর","Chatkhil":"চাটখিল","Chatmohar":"চাটমোহর","Chauddagram":"চৌদ্দগ্রাম",
  "Chauhali":"চৌহালী","Chhagalnaiya":"ছাগলনাইয়া","Chhatak":"ছাতক","Chilmari":"চিলমারী","Chirirbandar":"চিরিরবন্দর",
  "Chitalmari":"চিতলমারী","Chittagong City":"চট্টগ্রাম সিটি","Chougachha":"চৌগাছা","Chuadanga Sadar":"চুয়াডাঙ্গা সদর","Chunarughat":"চুনারুঘাট",
  "Comilla Sadar":"কুমিল্লা সদর","Companiganj":"কোম্পানীগঞ্জ","Coxsbazar Sadar":"কক্সবাজার সদর","Daganbhuiyan":"দাগনভূঞা","Dakop":"ডাকোপ",
  "Dakshinsurma":"দক্ষিণ সুরমা","Damudya":"ডামুড্যা","Damurhuda":"দামুড়হুদা","Dasar":"ডাসার","Dashmina":"দশমিনা",
  "Daudkandi":"দাউদকান্দি","Daulatpur":"দৌলতপুর","Debhata":"দেবহাটা","Debidwar":"দেবিদ্বার","Debiganj":"দেবীগঞ্জ",
  "Delduar":"দেলদুয়ার","Derai":"দিরাই","Dewangonj":"দেওয়ানগঞ্জ","Dhaka City":"ঢাকা সিটি","Dhamoirhat":"ধামইরহাট",
  "Dhamrai":"ধামরাই","Dhanbari":"ধনবাড়ী","Dharmapasha":"ধর্মপাশা","Dhobaura":"ধোবাউড়া","Dhunot":"ধুনট",
  "Dighinala":"দিঘীনালা","Digholia":"দিঘলিয়া","Dimla":"ডিমলা","Dinajpur Sadar":"দিনাজপুর সদর","Dohar":"দোহার",
  "Domar":"ডোমার","Doulatkhan":"দৌলতখান","Doulatpur":"দৌলতপুর","Dowarabazar":"দোয়ারাবাজার","Dumki":"দুমকি",
  "Dumuria":"ডুমুরিয়া","Dupchanchia":"দুপচাঁচিয়া","Durgapur":"দুর্গাপুর","Eidgaon":"ঈদগাঁও","Fakirhat":"ফকিরহাট",
  "Faridgonj":"ফরিদগঞ্জ","Faridpur":"ফরিদপুর","Faridpur Sadar":"ফরিদপুর সদর","Fatikchhari":"ফটিকছড়ি","Fenchuganj":"ফেঞ্চুগঞ্জ",
  "Feni Sadar":"ফেনী সদর","Fulbari":"ফুলবাড়ী","Fulbaria":"ফুলবাড়িয়া","Fulgazi":"ফুলগাজী","Fultola":"ফুলতলা",
  "Gabtali":"গাবতলী","Gafargaon":"গফরগাঁও","Gaibandha Sadar":"গাইবান্ধা সদর","Gajaria":"গজারিয়া","Galachipa":"গলাচিপা",
  "Gangachara":"গংগাচড়া","Gangni":"গাংনী","Gazipur Sadar":"গাজীপুর সদর","Ghatail":"ঘাটাইল","Ghoraghat":"ঘোড়াঘাট",
  "Gior":"ঘিওর","Goalanda":"গোয়ালন্দ","Gobindaganj":"গোবিন্দগঞ্জ","Godagari":"গোদাগাড়ী","Golapganj":"গোলাপগঞ্জ",
  "Gomostapur":"গোমস্তাপুর","Gopalganj Sadar":"গোপালগঞ্জ সদর","Gopalpur":"গোপালপুর","Gosairhat":"গোসাইরহাট","Gouripur":"গৌরীপুর",
  "Gournadi":"গৌরনদী","Gowainghat":"গোয়াইনঘাট","Guimara":"গুইমারা","Gurudaspur":"গুরুদাসপুর","Habiganj Sadar":"হবিগঞ্জ সদর",
  "Haimchar":"হাইমচর","Hajiganj":"হাজীগঞ্জ","Hakimpur":"হাকিমপুর","Haluaghat":"হালুয়াঘাট","Harinakundu":"হরিণাকুণ্ডু",
  "Haripur":"হরিপুর","Harirampur":"হরিরামপুর","Hathazari":"হাটহাজারী","Hatia":"হাতিয়া","Hatibandha":"হাতীবান্ধা",
  "Hizla":"হিজলা","Homna":"হোমনা","Hossainpur":"হোসেনপুর","Ishurdi":"ঈশ্বরদী","Islampur":"ইসলামপুর",
  "Iswarganj":"ঈশ্বরগঞ্জ","Itna":"ইটনা","Jagannathpur":"জগন্নাথপুর","Jaintiapur":"জৈন্তাপুর","Jaldhaka":"জলঢাকা",
  "Jamalganj":"জামালগঞ্জ","Jamalpur Sadar":"জামালপুর সদর","Jessore Sadar":"যশোর সদর","Jhalakathi Sadar":"ঝালকাঠি সদর","Jhenaidah Sadar":"ঝিনাইদহ সদর",
  "Jhenaigati":"ঝিনাইগাতী","Jhikargacha":"ঝিকরগাছা","Jibannagar":"জীবননগর","Joypurhat Sadar":"জয়পুরহাট সদর","Juraichari":"জুরাছড়ি",
  "Juri":"জুড়ী","Kabirhat":"কবিরহাট","Kachua":"কচুয়া","Kahaloo":"কাহালু","Kaharol":"কাহারোল",
  "Kalai":"কালাই","Kalapara":"কলাপাড়া","Kalaroa":"কলারোয়া","Kalia":"কালিয়া","Kaliakair":"কালিয়াকৈর",
  "Kaliganj":"কালীগঞ্জ","Kalihati":"কালিহাতী","Kalkini":"কালকিনি","Kalmakanda":"কলমাকান্দা","Kalukhali":"কালুখালী",
  "Kamalganj":"কমলগঞ্জ","Kamalnagar":"কমলনগর","Kamarkhand":"কামারখন্দ","Kamolganj":"কমলগঞ্জ","Kanaighat":"কানাইঘাট",
  "Kapasia":"কাপাসিয়া","Kaptai":"কাপ্তাই","Karimgonj":"করিমগঞ্জ","Karnafuli":"কর্ণফুলী","Kasba":"কসবা",
  "Kashiani":"কাশিয়ানী","Kathalia":"কাঠালিয়া","Katiadi":"কটিয়াদী","Kaunia":"কাউনিয়া","Kawkhali":"কাউখালী",
  "Kazipur":"কাজীপুর","Kendua":"কেন্দুয়া","Keraniganj":"কেরানীগঞ্জ","Keshabpur":"কেশবপুর","Khagrachhari Sadar":"খাগড়াছড়ি সদর",
  "Khaliajuri":"খালিয়াজুরী","Khansama":"খানসামা","Khetlal":"খেতলাল","Khoksa":"খোকসা","Khulna Sadar":"খুলনা সদর",
  "Kishoreganj Sadar":"কিশোরগঞ্জ সদর","Kishorganj":"কিশোরগঞ্জ","Kotalipara":"কোটালীপাড়া","Kotchandpur":"কোটচাঁদপুর","Koyra":"কয়রা",
  "Kulaura":"কুলাউড়া","Kuliarchar":"কুলিয়ারচর","Kumarkhali":"কুমারখালী","Kurigram Sadar":"কুড়িগ্রাম সদর","Kushtia Sadar":"কুষ্টিয়া সদর",
  "Kutubdia":"কুতুবদিয়া","Lakhai":"লাখাই","Laksam":"লাকসাম","Lakshmipur Sadar":"লক্ষ্মীপুর সদর","Lalmai":"লালমাই",
  "Lalmohan":"লালমোহন","Lalmonirhat Sadar":"লালমনিরহাট সদর","Lalpur":"লালপুর","Lama":"লামা","Langadu":"লংগদু",
  "Laxmichhari":"লক্ষ্মীছড়ি","Lohagara":"লোহাগড়া","Louhajanj":"লৌহজং","Madan":"মদন","Madarganj":"মাদারগঞ্জ",
  "Madaripur Sadar":"মাদারীপুর সদর","Madhabpur":"মাধবপুর","Madhukhali":"মধুখালী","Madhupur":"মধুপুর","Madhyanagar":"মধ্যনগর",
  "Magura Sadar":"মাগুরা সদর","Manda":"মান্দা","Manikchari":"মানিকছড়ি","Manikganj Sadar":"মানিকগঞ্জ সদর","Manirampur":"মণিরামপুর",
  "Mathbaria":"মঠবাড়িয়া","Matiranga":"মাটিরাঙ্গা","Matlab North":"মতলব উত্তর","Matlab South":"মতলব দক্ষিণ","Meghna":"মেঘনা",
  "Mehendiganj":"মেহেন্দিগঞ্জ","Meherpur Sadar":"মেহেরপুর সদর","Melandah":"মেলান্দহ","Mirpur":"মিরপুর","Mirsharai":"মীরসরাই",
  "Mirzaganj":"মির্জাগঞ্জ","Mirzapur":"মির্জাপুর","Mithamoin":"মিঠামইন","Mithapukur":"মিঠাপুকুর","Mohadevpur":"মহাদেবপুর",
  "Mohalchari":"মহালছড়ি","Mohammadpur":"মহম্মদপুর","Moheshkhali":"মহেশখালী","Moheshpur":"মহেশপুর","Mohongonj":"মোহনগঞ্জ",
  "Mohonpur":"মোহনপুর","Mollahat":"মোল্লাহাট","Mongla":"মোংলা","Monohardi":"মনোহরদী","Monohargonj":"মনোহরগঞ্জ",
  "Monpura":"মনপুরা","Morrelganj":"মোরেলগঞ্জ","Moulvibazar Sadar":"মৌলভীবাজার সদর","Mujibnagar":"মুজিবনগর","Muksudpur":"মুকসুদপুর",
  "Muktagacha":"মুক্তাগাছা","Muladi":"মুলাদী","Munshiganj Sadar":"মুন্সীগঞ্জ সদর","Muradnagar":"মুরাদনগর","Mymensingh Sadar":"ময়মনসিংহ সদর",
  "Nabiganj":"নবীগঞ্জ","Nabinagar":"নবীনগর","Nachol":"নাচোল","Nagarkanda":"নগরকান্দা","Nagarpur":"নাগরপুর",
  "Nageshwari":"নাগেশ্বরী","Naikhongchhari":"নাইক্ষ্যংছড়ি","Nalchity":"নলছিটি","Naldanga":"নলডাঙ্গা","Nalitabari":"নালিতাবাড়ী",
  "Nandail":"নান্দাইল","Nangalkot":"নাঙ্গলকোট","Naniarchar":"নানিয়ারচর","Naogaon Sadar":"নওগাঁ সদর","Narail Sadar":"নড়াইল সদর",
  "Narayanganj Sadar":"নারায়ণগঞ্জ সদর","Naria":"নড়িয়া","Narsingdi Sadar":"নরসিংদী সদর","Narundi":"নরুন্দী","Nasirnagar":"নাসিরনগর",
  "Natore Sadar":"নাটোর সদর","Nawabganj":"নবাবগঞ্জ","Nazirpur":"নাজিরপুর","Nesarabad":"নেছারাবাদ","Netrokona Sadar":"নেত্রকোণা সদর",
  "Niamatpur":"নিয়ামতপুর","Nikli":"নিকলী","Nilphamari Sadar":"নীলফামারী সদর","Noakhali Sadar":"নোয়াখালী সদর","Nokla":"নকলা",
  "Nondigram":"নন্দীগ্রাম","Osmaninagar":"ওসমানীনগর","Paba":"পবা","Pabna Sadar":"পাবনা সদর","Paikgasa":"পাইকগাছা",
  "Pakundia":"পাকুন্দিয়া","Palash":"পলাশ","Palashbari":"পলাশবাড়ী","Panchagarh Sadar":"পঞ্চগড় সদর","Panchari":"পানছড়ি",
  "Panchbibi":"পাঁচবিবি","Pangsa":"পাংশা","Parbatipur":"পার্বতীপুর","Parshuram":"পরশুরাম","Patgram":"পাটগ্রাম",
  "Pathorghata":"পাথরঘাটা","Patiya":"পটিয়া","Patnitala":"পত্নীতলা","Patuakhali Sadar":"পটুয়াখালী সদর","Pekua":"পেকুয়া",
  "Phulbari":"ফুলবাড়ী","Phulchari":"ফুলছড়ি","Phulpur":"ফুলপুর","Pirgacha":"পীরগাছা","Pirganj":"পীরগঞ্জ",
  "Pirgonj":"পীরগঞ্জ","Pirojpur Sadar":"পিরোজপুর সদর","Porsha":"পোরশা","Purbadhala":"পূর্বধলা","Puthia":"পুঠিয়া",
  "Raigonj":"রায়গঞ্জ","Raipur":"রায়পুর","Raipura":"রায়পুরা","Rajapur":"রাজাপুর","Rajarhat":"রাজারহাট",
  "Rajasthali":"রাজস্থলী","Rajbari Sadar":"রাজবাড়ী সদর","Rajnagar":"রাজনগর","Rajoir":"রাজৈর","Rajshahi City":"রাজশাহী সিটি",
  "Ramganj":"রামগঞ্জ","Ramgarh":"রামগড়","Ramgati":"রামগতি","Rampal":"রামপাল","Ramu":"রামু",
  "Rangabali":"রাঙ্গাবালী","Rangamati Sadar":"রাঙ্গামাটি সদর","Rangpur Sadar":"রংপুর সদর","Rangunia":"রাঙ্গুনিয়া","Raninagar":"রাণীনগর",
  "Ranisankail":"রাণীশংকৈল","Raozan":"রাউজান","Rowangchhari":"রোয়াংছড়ি","Rowmari":"রৌমারী","Ruma":"রুমা",
  "Rupganj":"রূপগঞ্জ","Rupsha":"রূপসা","Sadarpur":"সদরপুর","Sadarsouth":"সদর দক্ষিণ","Sadullapur":"সাদুল্লাপুর",
  "Saghata":"সাঘাটা","Sakhipur":"সখিপুর","Saltha":"সালথা","Sandwip":"সন্দ্বীপ","Santhia":"সাঁথিয়া",
  "Sapahar":"সাপাহার","Sarail":"সরাইল","Sarankhola":"শরণখোলা","Sarishabari":"সরিষাবাড়ী","Satkania":"সাতকানিয়া",
  "Satkhira Sadar":"সাতক্ষীরা সদর","Saturia":"সাটুরিয়া","Savar":"সাভার","Senbug":"সেনবাগ","Shahjadpur":"শাহজাদপুর",
  "Shahrasti":"শাহরাস্তি","Shailkupa":"শৈলকুপা","Shajahanpur":"শাজাহানপুর","Shalikha":"শালিখা","Shalla":"শাল্লা",
  "Shariakandi":"সারিয়াকান্দি","Shariatpur Sadar":"শরীয়তপুর সদর","Sharsha":"শার্শা","Sherpur":"শেরপুর","Sherpur Sadar":"শেরপুর সদর",
  "Shibaloy":"শিবালয়","Shibchar":"শিবচর","Shibganj":"শিবগঞ্জ","Shibpur":"শিবপুর","Shyamnagar":"শ্যামনগর",
  "Singiar":"সিঙ্গাইর","Singra":"সিংড়া","Sirajdikhan":"সিরাজদিখান","Sirajganj Sadar":"সিরাজগঞ্জ সদর","Sitakunda":"সীতাকুণ্ড",
  "Sonagazi":"সোনাগাজী","Sonaimori":"সোনাইমুড়ী","Sonargaon":"সোনারগাঁও","Sonatala":"সোনাতলা","South Sunamganj":"দক্ষিণ সুনামগঞ্জ",
  "Sreebardi":"শ্রীবরদী","Sreebordi":"শ্রীবরদী","Sreemangal":"শ্রীমঙ্গল","Sreenagar":"শ্রীনগর","Sreepur":"শ্রীপুর",
  "Subarnachar":"সুবর্ণচর","Sujanagar":"সুজানগর","Sunamganj Sadar":"সুনামগঞ্জ সদর","Sundarganj":"সুন্দরগঞ্জ","Syedpur":"সৈয়দপুর",
  "Sylhet Sadar":"সিলেট সদর","Tahirpur":"তাহিরপুর","Tala":"তালা","Taltali":"তালতলী","Tangail Sadar":"টাঙ্গাইল সদর",
  "Tanore":"তানোর","Taragonj":"তারাগঞ্জ","Tarail":"তাড়াইল","Tarakanda":"তারাকান্দা","Tarash":"তাড়াশ",
  "Tazumuddin":"তজুমদ্দিন","Teknaf":"টেকনাফ","Terokhada":"তেরখাদা","Tetulia":"তেঁতুলিয়া","Thakurgaon Sadar":"ঠাকুরগাঁও সদর",
  "Thanchi":"থানচি","Titas":"তিতাস","Tongibari":"টঙ্গীবাড়ী","Trishal":"ত্রিশাল","Tungipara":"টুঙ্গিপাড়া",
  "Ukhiya":"উখিয়া","Ulipur":"উলিপুর","Ullapara":"উল্লাপাড়া","Wazirpur":"উজিরপুর","Zajira":"জাজিরা",
  "Zakiganj":"জকিগঞ্জ","Zianagar":"জিয়ানগর",
};

export function bnDivision(name: string | null | undefined): string {
  if (!name) return "";
  return DIVISIONS[name] ?? name;
}

export function bnDistrict(name: string | null | undefined): string {
  if (!name) return "";
  return DISTRICTS[name] ?? name;
}

export function bnUpazila(name: string | null | undefined): string {
  if (!name) return "";
  return UPAZILAS[name] ?? name;
}

/**
 * Best-effort translation for a union / powrashava / city-corp name. The
 * `unions` table has ~854 unique names; translating them exhaustively would
 * bloat the bundle, so we handle the two structural patterns that cover
 * roughly two-thirds of the list and fall back to the English name for the
 * long tail (unknown values render in English, never blank).
 *
 *   1. "<Upazila> Powrashava"      → "<bn upazila> পৌরসভা"
 *   2. "<Upazila> Sadar"           → "<bn upazila> সদর"
 *   3. Exact upazila-name match    → the mapped Bangla upazila spelling
 */
export function bnUnion(
  name: string | null | undefined,
  nameBn?: string | null,
): string {
  if (!name) return "";
  // Prefer a Bangla name coming from the DB if the row has one seeded.
  if (nameBn && nameBn.trim()) return nameBn.trim();
  // Direct hit if a union happens to share an upazila's name.
  if (UPAZILAS[name]) return UPAZILAS[name];

  const powr = name.match(/^(.*)\s+Powrashava$/i);
  if (powr) {
    const base = powr[1].trim();
    return `${UPAZILAS[base] ?? base} পৌরসভা`;
  }
  const sadar = name.match(/^(.*)\s+Sadar$/i);
  if (sadar) {
    const base = sadar[1].trim();
    return `${UPAZILAS[base] ?? base} সদর`;
  }
  const city = name.match(/^(.*)\s+City(?:\s+Corporation)?$/i);
  if (city) {
    const base = city[1].trim();
    return `${UPAZILAS[base] ?? DISTRICTS[base] ?? base} সিটি কর্পোরেশন`;
  }
  return name;
}

/**
 * Best-effort translation for any location value in any tier. Falls through
 * to the English name if unmapped — safer than rendering nothing.
 */
export function bnLocation(name: string | null | undefined): string {
  if (!name) return "";
  return DIVISIONS[name] ?? DISTRICTS[name] ?? UPAZILAS[name] ?? name;
}

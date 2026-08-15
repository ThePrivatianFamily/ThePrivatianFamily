/**
 * THE PRIVATIAN FAMILY — Bilingual Core (English & Bengali)
 * Language state manager, dictionaries, numeral converters, and formatters.
 */

(function(window) {
  'use strict';

  var STORAGE_KEY = 'privatian_site_lang';

  // ── 1. DICTIONARIES ──────────────────────────────────────────
  var DICTIONARY = {
    en: {
      langName: 'English',
      menu: 'Menu',
      search: 'Search',
      searchPlaceholder: 'Search articles, topics, sections…',
      searchClear: 'Clear',
      searchClose: 'Close',
      noSearchResults: 'No articles found matching your search.',
      searchResults: 'Search Results',
      sections: 'Sections',
      featuredSeries: 'Featured series',
      explorePrivatian: 'Explore the Privatian',
      readLatest: 'Read the latest',
      events: 'Events',
      upcomingEvents: 'Upcoming Events',
      seeAllEvents: 'See all events',
      allNews: 'All News',
      by: 'By',
      minRead: 'min read',
      publishedOn: 'Published on',
      updatedOn: 'Updated on',
      shareArticle: 'Share',
      copiedLink: 'Link copied to clipboard',
      relatedArticles: 'Related Articles',
      home: 'Home',
      followUs: 'Follow us on',
      recentSeries: 'Our recent series',
      forMedia: 'For Media & Journalists',
      familyArchives: 'Family News & Archives',
      accessibility: 'Digital Accessibility',
      privacyPolicy: 'Privacy Policy',
      trademark: 'Trademark',
      rightsReserved: 'All rights reserved.',
      draft: 'Draft',
      published: 'Published',
      selectSection: 'Select Section',
      comments: 'Discussion',
      readMore: 'Read More',
      newsletterTitle: 'Subscribe to The Privatian Gazette',
      newsletterSub: 'Receive weekly dispatches and thoughtful reflections directly in your inbox.',
      subscribe: 'Subscribe',
      emailPlaceholder: 'Enter your email address…',
      topStories: 'Top Stories'
    },
    bn: {
      langName: 'বাংলা',
      menu: 'মেনু',
      search: 'অনুসন্ধান',
      searchPlaceholder: 'প্রতিবেদন, বিষয় ও বিভাগ অনুসন্ধান করুন…',
      searchClear: 'মুছুন',
      searchClose: 'বন্ধ করুন',
      noSearchResults: 'আপনার অনুসন্ধানের সাথে মেলে এমন কোনো প্রতিবেদন পাওয়া যায়নি।',
      searchResults: 'অনুসন্ধানের ফলাফল',
      sections: 'বিভাগসমূহ',
      featuredSeries: 'নির্বাচিত সিরিজ',
      explorePrivatian: 'প্রাইভেসিয়ান পরিবার এক্সপ্লোর করুন',
      readLatest: 'সাম্প্রতিক প্রতিবেদনসমূহ',
      events: 'অনুষ্ঠানসমূহ',
      upcomingEvents: 'আসন্ন অনুষ্ঠানসমূহ',
      seeAllEvents: 'সকল অনুষ্ঠান দেখুন',
      allNews: 'সকল খবর',
      by: 'লিখেছেন',
      minRead: 'মিনিট পঠন',
      publishedOn: 'প্রকাশের সময়',
      updatedOn: 'হালনাগাদের সময়',
      shareArticle: 'শেয়ার করুন',
      copiedLink: 'লিংক ক্লিপবোর্ডে কপি করা হয়েছে',
      relatedArticles: 'সম্পর্কিত প্রতিবেদন',
      home: 'মূল পাতা',
      followUs: 'অনুসরণ করুন',
      recentSeries: 'আমাদের সাম্প্রতিক সিরিজ',
      forMedia: 'গণমাধ্যম ও সাংবাদিকদের জন্য',
      familyArchives: 'পারিবারিক খবর ও আর্কাইভ',
      accessibility: 'ডিজিটাল প্রবেশগম্যতা',
      privacyPolicy: 'গোপনীয়তা নীতি',
      trademark: 'ট্রেডমার্ক',
      rightsReserved: 'সর্বস্বত্ব সংরক্ষিত।',
      draft: 'খসড়া',
      published: 'প্রকাশিত',
      selectSection: 'বিভাগ নির্বাচন করুন',
      comments: 'মতামত ও আলোচনা',
      readMore: 'আরও পড়ুন',
      newsletterTitle: 'দ্য প্রাইভেসিয়ান গেজেট সাবস্ক্রাইব করুন',
      newsletterSub: 'সাপ্তাহিক গভীর অন্তর্দৃষ্টি ও পারিবারিক ঐতিহ্য সরাসরি আপনার ইনবক্সে পেতে সাবস্ক্রাইব করুন।',
      subscribe: 'সাবস্ক্রাইব',
      emailPlaceholder: 'আপনার ইমেইল ঠিকানা লিখুন…',
      topStories: 'প্রধান খবর'
    }
  };

  // English to Bengali digits map
  var BN_DIGITS = { '0':'০', '1':'১', '2':'২', '3':'৩', '4':'৪', '5':'৫', '6':'৬', '7':'৭', '8':'৮', '9':'৯' };
  var BN_MONTHS = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];
  var EN_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // ── 2. STATE MANAGEMENT ──────────────────────────────────────
  var _currentLang = 'en';

  function initLang() {
    try {
      // Priority: URL query param (?lang=bn or ?lang=en) -> localStorage -> default 'en'
      var urlParam = new URLSearchParams(window.location.search).get('lang');
      if (urlParam && (urlParam === 'en' || urlParam === 'bn')) {
        _currentLang = urlParam;
        localStorage.setItem(STORAGE_KEY, _currentLang);
      } else {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'en' || saved === 'bn') {
          _currentLang = saved;
        }
      }
    } catch(e) {}

    applyDocumentLangAttr();
    return _currentLang;
  }

  function getLang() {
    return _currentLang || 'en';
  }

  function setLang(newLang) {
    if (newLang !== 'en' && newLang !== 'bn') return;
    if (_currentLang === newLang) return;
    _currentLang = newLang;
    try {
      localStorage.setItem(STORAGE_KEY, _currentLang);
    } catch(e) {}

    applyDocumentLangAttr();

    // Dispatch global event for all listeners
    var ev = new CustomEvent('privatian:language-changed', {
      detail: { lang: _currentLang, isBn: _currentLang === 'bn' }
    });
    document.dispatchEvent(ev);
  }

  function toggleLang() {
    setLang(_currentLang === 'en' ? 'bn' : 'en');
  }

  function applyDocumentLangAttr() {
    if (document.documentElement) {
      document.documentElement.lang = _currentLang;
      document.documentElement.setAttribute('data-lang', _currentLang);
      if (_currentLang === 'bn') {
        document.documentElement.classList.add('lang-bn');
        document.documentElement.classList.remove('lang-en');
      } else {
        document.documentElement.classList.add('lang-en');
        document.documentElement.classList.remove('lang-bn');
      }
    }
  }

  // ── 3. TRANSLATION HELPERS & FALLBACK MAP ────────────────────
  var STATIC_TEXT_MAP_BN = {
    // Section Names & Titles
    "Findings": "অনুসন্ধান",
    "Community & Heritage": "সমাজ ও ঐতিহ্য",
    "Community": "সমাজ ও ঐতিহ্য",
    "Culture": "সংস্কৃতি",
    "Privacy & Values": "গোপনীয়তা ও মূল্যবোধ",
    "Privacy": "গোপনীয়তা",
    "Nation & World": "দেশ ও বিশ্ব",
    "Arts & Legacy": "শিল্প ও উত্তরাধিকার",
    "Arts": "শিল্প ও উত্তরাধিকার",
    "Work & Economy": "কর্ম ও অর্থনীতি",
    "Economy": "কর্ম ও অর্থনীতি",
    "Students": "শিক্ষার্থীবৃন্দ",
    "Science": "বিজ্ঞান",
    "Society": "সমাজ",
    "All": "সকল",
    "All Articles": "সকল প্রতিবেদন",
    "All News": "সকল খবর",

    // Sub-header tabs
    "FAMILY LEGACY": "পারিবারিক ঐতিহ্য",
    "EXPERIENCE": "অভিজ্ঞতা ও সংস্কৃতি",
    "THE PRIVATIAN READS": "প্রাইভেসিয়ান পঠন",
    "EVENTS": "অনুষ্ঠানসমূহ",

    // Footer & Menu navigation
    "Events": "অনুষ্ঠানসমূহ",
    "Article archive": "আর্কাইভ ও প্রতিবেদন",
    "About us": "আমাদের পরিচিতি",
    "News+": "সংবাদ+",
    "Podcast": "পডকাস্ট",
    "Our recent series": "আমাদের সাম্প্রতিক সিরিজ",
    "Explore the Privatian": "প্রাইভেসিয়ান পরিবার এক্সপ্লোর করুন",
    "Read the latest": "সাম্প্রতিক প্রতিবেদনসমূহ",
    "Featured series": "নির্বাচিত সিরিজ",
    "Sections": "বিভাগসমূহ",
    "Follow us on": "অনুসরণ করুন",
    "Instagram": "ইনস্টাগ্রাম",
    "LinkedIn": "লিঙ্কডইন",
    "Facebook": "ফেসবুক",
    "YouTube": "ইউটিউব",
    "Email": "ইমেইল",
    "TikTok": "টিকটক",
    "For Media & Journalists": "গণমাধ্যম ও সাংবাদিকদের জন্য",
    "Family News & Archives": "পারিবারিক খবর ও আর্কাইভ",
    "Digital Accessibility": "ডিজিটাল প্রবেশগম্যতা",
    "Privacy Policy": "গোপনীয়তা নীতি",
    "Trademark": "ট্রেডমার্ক",
    "Terms of Use": "ব্যবহারের শর্তাবলী",
    "Terms & Conditions": "শর্তাবলী",
    "The Official Publication of The Privatian Society — Cambridge, Massachusetts": "দ্য প্রাইভেসিয়ান সোসাইটির আনুষ্ঠানিক প্রকাশনা — কেমব্রিজ, ম্যাসাচুসেটস",
    "© 2026 The Privatian Family. All rights reserved.": "© ২০২৬ দ্য প্রাইভেসিয়ান পরিবার। সর্বস্বত্ব সংরক্ষিত।",
    "A series of profound questions explored by The Privatian Family experts.": "প্রাইভেসিয়ান গবেষকদের আলোচিত গভীর ও তাৎপর্যপূর্ণ চিন্তাধারার এক অনন্য সিরিজ।",
    "A series focused on the personal side of Privatian family research and tradition.": "পারিবারিক গবেষণা ও ঐতিহ্যের ব্যক্তিগত দিক নিয়ে বিশেষ সিরিজ।",

    // Page UI strings
    "Discussion": "মতামত ও আলোচনা",
    "Related Articles": "সম্পর্কিত প্রতিবেদন",
    "Related Stories": "সম্পর্কিত প্রতিবেদন",
    "TOP 5": "শীর্ষ ৫",
    "Latest in This Section": "এই বিভাগের সাম্প্রতিক খবর",
    "Selected Stories": "নির্বাচিত প্রতিবেদন",
    "Editor's Picks": "সম্পাদকের পছন্দ",
    "All Articles in This Section": "এই বিভাগের সকল প্রতিবেদন",
    "Back to Home": "মূল পাতায় ফিরুন",
    "Article not available": "প্রতিবেদনটি পাওয়া যায়নি",
    "This article may not be published yet, or the link may be incorrect.": "এই প্রতিবেদনটি হয়তো এখনো প্রকাশিত হয়নি, অথবা লিংকটি সঠিক নয়।",
    "← Back to Home": "← মূল পাতায় ফিরুন",
    "Showing": "প্রদর্শিত হচ্ছে",
    "Scheduled Events": "নির্ধারিত অনুষ্ঠান",
    "Event Details →": "অনুষ্ঠানের বিবরণী →",
    "No upcoming events currently scheduled.": "বর্তমানে কোনো নির্ধারিত অনুষ্ঠান নেই।",
    "Please check back soon for our latest forum discussions and intellectual gatherings.": "আমাদের সাম্প্রতিক সেমিনার ও আলোচনার জন্য শীঘ্রই আবার দেখুন।",
    "Start typing to search…": "অনুসন্ধান করতে টাইপ করুন…",
    "No results for": "কোনো ফলাফল পাওয়া যায়নি",
    "Clear": "মুছুন",
    "Close": "বন্ধ করুন",
    "Menu": "মেনু",

    // Homepage Articles & Headlines
    "The art of private wisdom: how Privatian families shape culture and legacy.": "ব্যক্তিগত প্রজ্ঞার শিল্প: কীভাবে প্রাইভেসিয়ান পরিবারগুলো সংস্কৃতি ও ঐতিহ্য গড়ে তোলে।",
    "An exclusive exploration of family heritage, intellectual tradition, and the enduring power of private knowledge.": "পারিবারিক ঐতিহ্য, বুদ্ধিবৃত্তিক পরম্পরা এবং নিজস্ব জ্ঞানের চিরস্থায়ী ক্ষমতার এক অনন্য অনুসন্ধান।",
    "Part legacy, part field study: the Privatian story across generations": "অর্ধেক ঐতিহ্য, অর্ধেক পর্যবেক্ষণ: প্রজন্ম থেকে প্রজন্মে প্রাইভেসিয়ানদের পথচলা",
    "From a family archive, the Privatian tradition sees pathways forged through private endeavors": "পারিবারিক সংরক্ষণাগার থেকে, প্রাইভেসিয়ান ঐতিহ্য ব্যক্তিগত প্রচেষ্টার মাধ্যমে নতুন পথ তৈরি করে",
    "How the Privatian legacy helped define an era of private excellence": "কীভাবে প্রাইভেসিয়ান ঐতিহ্য ব্যক্তিগত উৎকর্ষের এক নতুন যুগকে সংজ্ঞায়িত করেছে",
    "The family's influence on culture, art, and intellectual discourse runs deeper than most realize": "সংস্কৃতি, শিল্পকলা এবং বুদ্ধিবৃত্তিক চিন্তাধারায় পরিবারের প্রভাব সাধারণ ধারণার চেয়েও গভীর",
    "When Privatians meet: the quiet power of community": "যখন প্রাইভেসিয়ানরা মিলিত হয়: সম্প্রদায়ের নিভৃত শক্তি",
    "Why handwritten correspondence is making a private comeback": "কেন হাতে লেখা চিঠিপত্র আবার ব্যক্তিগত জগতে ফিরে আসছে",
    "Inside the Cambridge reading rooms: preservation, memory, and intellect": "কেমব্রিজের পাঠাগারের অন্তরালে: সংরক্ষণ, স্মৃতি ও মনন",
    "Upcoming Events": "আসন্ন অনুষ্ঠানসমূহ",
    "See all events": "সকল অনুষ্ঠান দেখুন",
    "Spring Symposium: The Future of Family Archives": "বসন্তকালীন সম্মেলন: পারিবারিক সংরক্ষণাগারের ভবিষ্যৎ",
    "Annual Heritage Lecture & Discussion": "বার্ষিক ঐতিহ্য বক্তৃতা ও মুক্ত আলোচনা",
    "Annual Gathering: 120 Years of Privatian Fellowship": "বার্ষিক মিলনমেলা: প্রাইভেসিয়ান ফেলোশিপের ১২০ বছর",
    "Join scholars, members, and alumni as we celebrate over a century of private wisdom and cultural contribution.": "এক শতাব্দীরও বেশি সময় ধরে গড়ে ওঠা ব্যক্তিগত প্রজ্ঞা ও সাংস্কৃতিক অবদান উদযাপনে গবেষক ও সদস্যদের সাথে যোগ দিন।",
    "The unwritten rules of family heritage: what archives tell us": "পারিবারিক ঐতিহ্যের অলিখিত নিয়মাবলী: সংরক্ষণাগার আমাদের কী বার্তা দেয়",
    "Archaeology of the self: new findings on identity": "আত্মানুসন্ধান: পরিচয়ের ওপর নতুন গবেষণা ও অনুসন্ধান",
    "What 19th-century ledgers reveal about trust": "১৯ শতকের হিসাবের খাতা বিশ্বাস সম্পর্কে কী প্রকাশ করে",
    "Private institutions and the preservation of truth": "ব্যক্তিগত প্রতিষ্ঠান এবং সত্যের সুরক্ষা",
    "The culture of quiet excellence: why discreet mastery matters": "নীরব উৎকর্ষের সংস্কৃতি: কেন সংযত পারদর্শিতা মূল্যবান",
    "AI use surging for creative writing among young Privatian members": "তরুণ প্রাইভেসিয়ান সদস্যদের মাঝে সৃজনশীল লেখায় কৃত্রিম বুদ্ধিমত্তার বিস্তার",
    "Pen refill? Go for it, says the Privatian Calligraphy Society": "কলমের কালি রিফিল? এগিয়ে চলুন, বলছে ক্যালিগ্রাফি সোসাইটি",
    "Music residency, says Privatian Arts & Culture Society, is about connection": "সঙ্গীত রেসিডেন্সি মূলত আন্তরিক সংযোগের মাধ্যম",
    "Do you have a private AI secret?": "আপনার কি কোনো ব্যক্তিগত এআই গোপন তথ্য আছে?",
    "Families alone, yes. But watching the community is another thing.": "পরিবার একা হতে পারে, তবে সমাজকে পর্যবেক্ষণ করা ভিন্ন বিষয়",
    "Is that family member a Privatian or not — and who decides the rules?": "তিনি কি আসলেই পরিবারের সদস্য—এবং এই নিয়ম কারা নির্ধারণ করে?",
    "Bowling alone, yes. But the Privatian family still gathers.": "একাকী কাটানো সময় নয়, বরং পরিবার এখনও নিয়মিত মিলিত হয়",
    "How the Privatian diaspora is keeping tradition alive in a globalized world": "বিশ্বায়নের যুগে কীভাবে প্রাইভেসিয়ান প্রবাসী সম্প্রদায় ঐতিহ্য বাঁচিয়ে রেখেছে",
    "Bearing down on global secrecy: what the Privatian model teaches us": "গোপনীয়তার বৈশ্বিক পাঠ: প্রাইভেসিয়ান মডেল আমাদের কী শেখায়",
    "Currency of trust: how the Privatian family built international networks": "বিশ্বাসের ভিত্তি: যেভাবে গড়ে উঠেছে আন্তর্জাতিক নেটওয়ার্ক",
    "New research shows writing by hand preserves memory and sharpens intellect": "নতুন গবেষণায় দেখা গেছে: হাতে লেখার অভ্যাস স্মৃতিশক্তি ও বুদ্ধি প্রখর করে",
    "Rowing, dance: yes. But the Privatian pen holds a special place of honor.": "খেলাধুলা ও শিল্পকলার পাশাপাশি কলমের গুরুত্ব অনন্য",
    "Novelist argues the world needs more well-written letters, not fewer": "ঔপন্যাসিকদের মতে বিশ্বের আরও সুচিন্তিত চিঠিপত্র প্রয়োজন",
    "Turnover at The Privatian Society demands that cultural legacy must be paid.": "সোসাইটির প্রতিটি পর্যায়ে সাংস্কৃতিক উত্তরাধিকার বজায় রাখা জরুরি",
    "Go-to Privatian professionals redefine private practices in modern economy": "আধুনিক অর্থনীতিতে শীর্ষ পেশাজীবীরা নতুন মাত্রা যোগ করছেন",
    "Rural flower power: the Privatian family's investment in private land": "গ্রামীণ অর্থনীতি: ব্যক্তিগত জমিতে পরিবারের যুগান্তকারী বিনিয়োগ",
    "The Privatian economy advisor talks to the state of family wealth": "অর্থনৈতিক উপদেষ্টার সঙ্গে পারিবারিক সম্পদের বর্তমান অবস্থা নিয়ে আলোচনা",
    "Letters of the law: the Privatian legal scholars improve upon family statutes": "আইনের ধারা: পরিবারের নীতিমালা সংস্কারে আইনজ্ঞদের ভূমিকা",
    "Heritage Archive": "ঐতিহ্য সংরক্ষণাগার",
    "Wondering": "ভাবনা ও জিজ্ঞাসা",
    "Life | Heritage": "জীবন ও ঐতিহ্য",
    "For families in transition, 'not all traditions are equal'": "পরিবর্তনশীল পরিবারের ক্ষেত্রে, 'সব ঐতিহ্য সমান নয়'",
    "The art of the pen: How writing shapes cultural identity": "কলমের শিল্প: যেভাবে লেখালেখি সাংস্কৃতিক পরিচয় গড়ে তোলে",
    "Mar 28": "২৮ মার্চ",
    "Apr 14": "১৪ এপ্রিল",
    "Cambridge, MA · 6:00 PM": "কেমব্রিজ, এমএ · সন্ধ্যা ৬:০০",
    "Boston, MA · 4:30 PM": "বোস্টন, এমএ · বিকাল ৪:৩০"
  };

  function translateStatic(text) {
    if (!text || typeof text !== 'string') return text;
    var trimmed = text.trim();
    if (_currentLang === 'bn' && STATIC_TEXT_MAP_BN[trimmed]) {
      return STATIC_TEXT_MAP_BN[trimmed];
    }
    return text;
  }

  function t(key, defaultText) {
    var dict = DICTIONARY[_currentLang] || DICTIONARY.en;
    if (dict && dict[key]) return dict[key];
    var fallback = DICTIONARY.en[key];
    return fallback !== undefined ? fallback : (defaultText || key);
  }

  function toBengaliNumber(num) {
    if (num === null || num === undefined) return '';
    return String(num).replace(/[0-9]/g, function(d) { return BN_DIGITS[d] || d; });
  }

  function formatDisplayDate(dateInput) {
    if (!dateInput) return '';
    var date = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);

    if (_currentLang === 'bn') {
      var dayBn = toBengaliNumber(date.getDate());
      var monthBn = BN_MONTHS[date.getMonth()] || '';
      var yearBn = toBengaliNumber(date.getFullYear());
      return dayBn + ' ' + monthBn + ' ' + yearBn;
    } else {
      var dayEn = date.getDate();
      var monthEn = EN_MONTHS[date.getMonth()] || '';
      var yearEn = date.getFullYear();
      return monthEn + ' ' + dayEn + ', ' + yearEn;
    }
  }

  function formatReadTime(minutes) {
    var m = parseInt(minutes, 10) || 1;
    if (_currentLang === 'bn') {
      return toBengaliNumber(m) + ' ' + t('minRead');
    }
    return m + ' ' + t('minRead');
  }

  // Pick language string with fallback: (enVal, bnVal)
  function pickLang(enVal, bnVal) {
    if (_currentLang === 'bn') {
      if (bnVal !== undefined && bnVal !== null && String(bnVal).trim() !== '') {
        return bnVal;
      }
      return translateStatic(enVal);
    }
    return (enVal !== undefined && enVal !== null && String(enVal).trim() !== '') ? enVal : bnVal;
  }

  // Auto initialize on load
  initLang();

  // Expose on window
  window.PrivatianLang = {
    getLang: getLang,
    setLang: setLang,
    toggleLang: toggleLang,
    t: t,
    translateStatic: translateStatic,
    toBengaliNumber: toBengaliNumber,
    formatDisplayDate: formatDisplayDate,
    formatReadTime: formatReadTime,
    pickLang: pickLang,
    DICTIONARY: DICTIONARY,
    STATIC_TEXT_MAP_BN: STATIC_TEXT_MAP_BN
  };

})(window);

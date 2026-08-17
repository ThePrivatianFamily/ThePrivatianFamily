/**
 * THE PRIVATIAN FAMILY — Bilingual Core (English & Bengali)
 * Language state manager, comprehensive dictionaries, numeral converters, formatters, and synchronous DOM translation engine.
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
  var EN_DIGITS = { '০':'0', '১':'1', '২':'2', '৩':'3', '৪':'4', '৫':'5', '৬':'6', '৭':'7', '৮':'8', '৯':'9' };

  var BN_MONTHS = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];
  var EN_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // ── 2. STATIC TEXT TRANSLATIONS (BIDIRECTIONAL) ──────────────
  var STATIC_TEXT_MAP_BN = {
    // Section Names & All News Category Labels
    "FINDINGS": "অনুসন্ধিৎসু",
    "Findings": "অনুসন্ধিৎসু",
    "COMMUNITY & HERITAGE": "সমাজ ও ঐতিহ্য",
    "Community & Heritage": "সমাজ ও ঐতিহ্য",
    "CULTURE": "সংস্কৃতি",
    "Culture": "সংস্কৃতি",
    "PRIVACY & VALUES": "মূল্যবোধ",
    "Privacy & Values": "মূল্যবোধ",
    "NATION & WORLD": "দেশ ও বিশ্ব",
    "Nation & World": "দেশ ও বিশ্ব",
    "ARTS & LEGACY": "শিল্প ও উত্তরাধিকার",
    "Arts & Legacy": "শিল্প ও উত্তরাধিকার",
    "WORK & ECONOMY": "কর্ম ও অর্থনীতি",
    "Work & Economy": "কর্ম ও অর্থনীতি",
    "STUDENTS": "শিক্ষার্থীবৃন্দ",
    "Students": "শিক্ষার্থীবৃন্দ",
    "SCIENCE": "বিজ্ঞান",
    "Science": "বিজ্ঞান",
    "SOCIETY": "সমাজ",
    "Society": "সমাজ",
    "ALL": "সব খবর",
    "All": "সব খবর",
    "All News": "সকল খবর",
    "ALL NEWS": "সকল খবর",

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

    // Page UI strings & Section Headings
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
    "Upcoming Events": "আসন্ন অনুষ্ঠানসমূহ",
    "See all events": "সকল অনুষ্ঠান দেখুন",
    "Heritage Archive": "ঐতিহ্য সংরক্ষণাগার",
    "Wondering": "ভাবনা ও জিজ্ঞাসা",
    "Life | Heritage": "জীবন ও ঐতিহ্য",

    // Homepage Hero & Sidebar Articles
    "The art of private wisdom: how Privatian families shape culture and legacy.": "ব্যক্তিগত প্রজ্ঞার শিল্প: কীভাবে প্রাইভেসিয়ান পরিবারগুলো সংস্কৃতি ও ঐতিহ্য গড়ে তোলে।",
    "An exclusive exploration of family heritage, intellectual tradition, and the enduring power of private knowledge.": "পারিবারিক ঐতিহ্য, বুদ্ধিবৃত্তিক পরম্পরা এবং নিজস্ব জ্ঞানের চিরস্থায়ী ক্ষমতার এক অনন্য অনুসন্ধান।",
    "Part legacy, part field study: the Privatian story across generations": "অর্ধেক ঐতিহ্য, অর্ধেক পর্যবেক্ষণ: প্রজন্ম থেকে প্রজন্মে প্রাইভেসিয়ানদের পথচলা",
    "From a family archive, the Privatian tradition sees pathways forged through private endeavors": "পারিবারিক সংরক্ষণাগার থেকে, প্রাইভেসিয়ান ঐতিহ্য ব্যক্তিগত প্রচেষ্টার মাধ্যমে নতুন পথ তৈরি করে",
    "How the Privatian legacy helped define an era of private excellence": "কীভাবে প্রাইভেসিয়ান ঐতিহ্য ব্যক্তিগত উৎকর্ষের এক নতুন যুগকে সংজ্ঞায়িত করেছে",
    "The family's influence on culture, art, and intellectual discourse runs deeper than most realize": "সংস্কৃতি, শিল্পকলা এবং বুদ্ধিবৃত্তিক চিন্তাধারায় পরিবারের প্রভাব সাধারণ ধারণার চেয়েও গভীর",
    
    // Small Articles
    "When Privatians meet: the quiet power of community": "যখন প্রাইভেসিয়ানরা মিলিত হয়: সম্প্রদায়ের নিভৃত শক্তি",
    "Why handwritten correspondence is making a private comeback": "কেন হাতে লেখা চিঠিপত্র আবার ব্যক্তিগত জগতে ফিরে আসছে",
    "Liberal tradition in the modern age: how the Privatian family stays ahead": "আধুনিক যুগে উদারনৈতিক ঐতিহ্য: কীভাবে প্রাইভেসিয়ান পরিবার যুগের চেয়ে এগিয়ে থাকে",

    // Events section
    "Debate, Debrief, and Dissect: The Role of Privacy in the Modern Family and American Life": "বিতর্ক ও বিশ্লেষণ: আধুনিক পরিবার ও সমাজজীবনে গোপনীয়তার ভূমিকা",
    "4 p.m. Thursday ■ Privatian Forum, Main Hall, Private Campus; via livestream": "বৃহস্পতিবার বিকাল ৪:০০ ■ প্রাইভেসিয়ান ফোরাম, মূল মিলনায়তন; লাইভস্ট্রিম সহ",
    "America at 250 and Beyond: A Well-Informed Privatian Citizenry": "আমেরিকার ২৫০ বছর ও আগামী: সুনাগরিক হিসেবে প্রাইভেসিয়ান সমাজ",
    "4 p.m. Friday ■ Privatian Institute, 79 Heritage Ave., Cambridge": "শুক্রবার বিকাল ৪:০০ ■ প্রাইভেসিয়ান ইনস্টিটিউট, ৭৯ হেরিটেজ অ্যাভিনিউ, কেমব্রিজ",
    "Sep. 22, 2026": "২২ সেপ্টেম্বর, ২০২৬",
    "Oct. 16, 2026": "১৬ অক্টোবর, ২০২৬",
    "Rubies decoded: 'Heritage is just one piece of the puzzle'": "রত্নপাথরের ইতিহাস উন্মোচন: 'ঐতিহ্য কেবল একটি অংশ মাত্র'",
    "Rare family gems shine in new Privatian retrospective": "নতুন রেট্রোস্পেক্টিভে ফুটে উঠেছে বিরল পারিবারিক মণিমুক্তা",

    // All News Lead & Sub-Articles
    "Don't hold back, the Privatian elders told scholars. It worked.": "পিছু হটবেন না, গবেষকদের স্পষ্ট নির্দেশ দিয়েছিলেন পরিবারের জ্যেষ্ঠরা। যা ফলপ্রসূ হয়েছে।",
    "Elena Voss named curator of The Privatian Foundation for Letters": "দ্য প্রাইভেসিয়ান ফাউন্ডেশন ফর লেটারসের কিউরেটর নিযুক্ত হলেন এলেনা ভস",
    "Family council opposes changes to federal heritage-protection programs": "ঐতিহ্য সুরক্ষা কর্মসূচির নীতিমালার পরিবর্তনে আপত্তি জানাল পারিবারিক কাউন্সিল",
    "Henry's remarkable legacy of giving: what it means to the family today": "দানশীলতার অনন্য ঐতিহ্য: আজকের পারিবারিক প্রেক্ষাপটে এর তাৎপর্য",
    "Letters to the archive: understanding the Privatian correspondence collection": "সংরক্ষণাগারের চিঠি: পারিবারিক পত্রাবলির গভীর অন্তর্দৃষ্টি",
    "For Privatian women in arts, 'not all cultural diets are equal'": "শিল্পকলায় নারীদের অবস্থান: 'সকল সাংস্কৃতিক পরিবেশ এক নয়'",
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
    "For families in transition, 'not all traditions are equal'": "পরিবর্তনশীল পরিবারের ক্ষেত্রে, 'সব ঐতিহ্য সমান নয়'",
    "The art of the pen: How writing shapes cultural identity": "কলমের শিল্প: যেভাবে লেখালেখি সাংস্কৃতিক পরিচয় গড়ে তোলে",
    "Inside the Cambridge reading rooms: preservation, memory, and intellect": "কেমব্রিজের পাঠাগারের অন্তরালে: সংরক্ষণ, স্মৃতি ও মনন",
    "Spring Symposium: The Future of Family Archives": "বসন্তকালীন সম্মেলন: পারিবারিক সংরক্ষণাগারের ভবিষ্যৎ",
    "Annual Heritage Lecture & Discussion": "বার্ষিক ঐতিহ্য বক্তৃতা ও মুক্ত আলোচনা",
    "Annual Gathering: 120 Years of Privatian Fellowship": "বার্ষিক মিলনমেলা: প্রাইভেসিয়ান ফেলোশিপের ১২০ বছর",
    "Join scholars, members, and alumni as we celebrate over a century of private wisdom and cultural contribution.": "এক শতাব্দীরও বেশি সময় ধরে গড়ে ওঠা ব্যক্তিগত প্রজ্ঞা ও সাংস্কৃতিক অবদান উদযাপনে গবেষক ও সদস্যদের সাথে যোগ দিন।",
    "The unwritten rules of family heritage: what archives tell us": "পারিবারিক ঐতিহ্যের অলিখিত নিয়মাবলী: সংরক্ষণাগার আমাদের কী বার্তা দেয়",
    "Archaeology of the self: new findings on identity": "আত্মানুসন্ধান: পরিচয়ের ওপর নতুন গবেষণা ও অনুসন্ধান",
    "What 19th-century ledgers reveal about trust": "১৯ শতকের হিসাবের খাতা বিশ্বাস সম্পর্কে কী প্রকাশ করে",
    "Private institutions and the preservation of truth": "ব্যক্তিগত প্রতিষ্ঠান এবং সত্যের সুরক্ষা",
    "The culture of quiet excellence: why discreet mastery matters": "নীরব উৎকর্ষের সংস্কৃতি: কেন সংযত পারদর্শিতা মূল্যবান",
    "Mar 28": "২৮ মার্চ",
    "Apr 14": "১৪ এপ্রিল",
    "Cambridge, MA · 6:00 PM": "কেমব্রিজ, এমএ · সন্ধ্যা ৬:০০",
    "Boston, MA · 4:30 PM": "বোস্টন, এমএ · বিকাল ৪:৩০"
  };

  // Build Reverse Map (BN -> EN) for 100% accurate rollback without refresh
  var STATIC_TEXT_MAP_EN = {};
  for (var k in STATIC_TEXT_MAP_BN) {
    if (STATIC_TEXT_MAP_BN.hasOwnProperty(k)) {
      var bnVal = STATIC_TEXT_MAP_BN[k];
      if (bnVal) {
        STATIC_TEXT_MAP_EN[bnVal.trim()] = k;
      }
    }
  }

  function translateStatic(text, targetLang) {
    if (!text || typeof text !== 'string') return text;
    var lang = targetLang || _currentLang;
    var trimmed = text.trim();

    if (lang === 'bn') {
      if (STATIC_TEXT_MAP_BN[trimmed]) return STATIC_TEXT_MAP_BN[trimmed];
      // Case-insensitive lookup for uppercase headings
      var upper = trimmed.toUpperCase();
      if (STATIC_TEXT_MAP_BN[upper]) return STATIC_TEXT_MAP_BN[upper];
      return text;
    } else {
      if (STATIC_TEXT_MAP_EN[trimmed]) return STATIC_TEXT_MAP_EN[trimmed];
      return text;
    }
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

  function toEnglishNumber(num) {
    if (num === null || num === undefined) return '';
    return String(num).replace(/[০-৯]/g, function(d) { return EN_DIGITS[d] || d; });
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

  function pickLang(enVal, bnVal) {
    if (_currentLang === 'bn') {
      if (bnVal !== undefined && bnVal !== null && String(bnVal).trim() !== '') {
        return bnVal;
      }
      return translateStatic(enVal, 'bn');
    }
    return (enVal !== undefined && enVal !== null && String(enVal).trim() !== '') ? enVal : (translateStatic(bnVal, 'en') || bnVal);
  }

  // ── 3. INSTANT SYNCHRONOUS DOM TRANSLATION ENGINE ────────────
  var SELECTORS_TO_TRANSLATE = [
    '.hero-headline a',
    '.hero-subtitle',
    '.hero-sidebar-title',
    '.hero-sidebar-desc',
    '.hero-sidebar-tag',
    '.small-article-title',
    '.section-heading-label',
    '.see-all-link',
    '.event-date',
    '.event-title',
    '.event-meta',
    '.all-news-heading',
    '.news-col-label',
    '.news-main-title',
    '.news-sub-item a',
    '.events-featured-title',
    '.events-featured-desc',
    '.menu-btn-text',
    '.menu-section-title',
    '.menu-explore-title',
    '.footer-col-title',
    '.footer-series-name a',
    '.footer-series-desc',
    '.footer-brand p',
    '.footer-copyright',
    '.footer-bottom-links a',
    '[data-t]',
    '[data-translate]'
  ];

  function translatePageDOM(targetLang) {
    var lang = targetLang || _currentLang;
    var isBn = (lang === 'bn');

    // 1. Elements with explicit data-t attribute
    document.querySelectorAll('[data-t]').forEach(function(el) {
      var key = el.getAttribute('data-t');
      if (key) {
        el.textContent = t(key);
      }
    });

    // 2. Traversal of all content nodes
    SELECTORS_TO_TRANSLATE.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        // Skip elements that contain other nested complex structures unless it's pure text
        if (el.children.length > 0 && !el.querySelector('svg')) {
          // If element only has an svg + text child
          var hasSvg = !!el.querySelector('svg');
          if (hasSvg && el.childNodes.length <= 3) {
            // translate text node only
            el.childNodes.forEach(function(n) {
              if (n.nodeType === 3 /* Node.TEXT_NODE */) {
                var txt = n.nodeValue.trim();
                if (txt) {
                  if (isBn) {
                    if (!el.getAttribute('data-orig-en')) el.setAttribute('data-orig-en', txt);
                    var tr = STATIC_TEXT_MAP_BN[txt] || STATIC_TEXT_MAP_BN[txt.toUpperCase()];
                    if (tr) n.nodeValue = ' ' + tr;
                  } else {
                    var orig = el.getAttribute('data-orig-en') || STATIC_TEXT_MAP_EN[txt];
                    if (orig) n.nodeValue = ' ' + orig;
                  }
                }
              }
            });
          }
          return;
        }

        var currentText = el.textContent.trim();
        if (!currentText) return;

        if (isBn) {
          // Store original English text if not already stored
          if (!el.getAttribute('data-orig-en') && !STATIC_TEXT_MAP_EN[currentText]) {
            el.setAttribute('data-orig-en', currentText);
          }
          var origEn = el.getAttribute('data-orig-en') || currentText;
          var translated = STATIC_TEXT_MAP_BN[origEn] || STATIC_TEXT_MAP_BN[origEn.toUpperCase()] || STATIC_TEXT_MAP_BN[currentText];
          if (translated) {
            el.textContent = translated;
          }
        } else {
          // Restore English
          var orig = el.getAttribute('data-orig-en') || STATIC_TEXT_MAP_EN[currentText];
          if (orig) {
            el.textContent = orig;
          }
        }
      });
    });
  }

  // ── 4. STATE MANAGEMENT ──────────────────────────────────────
  var _currentLang = 'en';

  function initLang() {
    try {
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
    
    // If starting in Bengali, run synchronous translation on DOMContentLoaded or immediately
    if (_currentLang === 'bn') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          translatePageDOM('bn');
        });
      } else {
        translatePageDOM('bn');
      }
    }

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

    // Smooth subtle transition
    if (document.body) {
      document.body.classList.add('lang-transitioning');
    }

    // 1. Synchronously translate all page text in memory (0ms delay)
    translatePageDOM(_currentLang);

    // 2. Dispatch global event for components and scripts
    var ev = new CustomEvent('privatian:language-changed', {
      detail: { lang: _currentLang, isBn: _currentLang === 'bn' }
    });
    document.dispatchEvent(ev);

    // 3. Remove transition class smoothly after DOM sync
    setTimeout(function() {
      if (document.body) {
        document.body.classList.remove('lang-transitioning');
      }
    }, 140);
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

  // Auto initialize on load
  initLang();

  // Expose on window
  window.PrivatianLang = {
    getLang: getLang,
    setLang: setLang,
    toggleLang: toggleLang,
    t: t,
    translateStatic: translateStatic,
    translatePageDOM: translatePageDOM,
    toBengaliNumber: toBengaliNumber,
    toEnglishNumber: toEnglishNumber,
    formatDisplayDate: formatDisplayDate,
    formatReadTime: formatReadTime,
    pickLang: pickLang,
    DICTIONARY: DICTIONARY,
    STATIC_TEXT_MAP_BN: STATIC_TEXT_MAP_BN,
    STATIC_TEXT_MAP_EN: STATIC_TEXT_MAP_EN
  };

})(window);

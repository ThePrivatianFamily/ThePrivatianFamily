// THE PRIVATIAN FAMILY — Main Page Script (index.html)
//
// 100% Database-Driven & Synchronous Bilingual Homepage Engine:
// 1. Instantaneous 0ms synchronous switching using client-memory bilingual trees
// 2. Pre-cached English and Bengali homepage datasets (no network delay on toggle)
// 3. Silent background synchronization with Supabase and /api/sections

var DEFAULT_HOMEPAGE_CONFIG_EN = {
  hero: {
    main: {
      articleId: null,
      title: 'The art of private wisdom: how Privatian families shape culture and legacy.',
      subtitle: 'An exclusive exploration of family heritage, intellectual tradition, and the enduring power of private knowledge.',
      imageUrl: 'img1.png',
      href: '/section/findings',
      enabled: true
    },
    sidebar: [
      {
        id: 'h-side-1',
        articleId: null,
        title: 'Part legacy, part field study: the Privatian story across generations',
        description: 'From a family archive, the Privatian tradition sees pathways forged through private endeavors',
        imageUrl: 'img5.png',
        tag: '',
        href: '/section/community-heritage',
        enabled: true
      },
      {
        id: 'h-side-2',
        articleId: null,
        title: 'How the Privatian legacy helped define an era of private excellence',
        description: "The family's influence on culture, art, and intellectual discourse runs deeper than most realize",
        imageUrl: 'img6.png',
        tag: '',
        href: '/section/culture',
        enabled: true
      }
    ]
  },
  smallArticles: [
    {
      id: 'sm-1',
      articleId: null,
      title: 'When Privatians meet: the quiet power of community',
      imageUrl: 'img2.png',
      href: '/section/community-heritage',
      enabled: true
    },
    {
      id: 'sm-2',
      articleId: null,
      title: 'Why handwritten correspondence is making a private comeback',
      imageUrl: 'img3.png',
      href: '/section/culture',
      enabled: true
    },
    {
      id: 'sm-3',
      articleId: null,
      title: 'Liberal tradition in the modern age: how the Privatian family stays ahead',
      imageUrl: 'img4.png',
      href: '/section/privacy-values',
      enabled: true
    }
  ],
  eventsSection: {
    eventsHeading: 'Upcoming Events',
    seeAllText: 'See all events',
    seeAllHref: '/events',
    events: [
      {
        id: 'ev-1',
        date: 'Sep. 22, 2026',
        title: 'Debate, Debrief, and Dissect: The Role of Privacy in the Modern Family and American Life',
        meta: '4 p.m. Thursday ■ Privatian Forum, Main Hall, Private Campus; via livestream',
        href: '/events',
        enabled: true
      },
      {
        id: 'ev-2',
        date: 'Oct. 16, 2026',
        title: 'America at 250 and Beyond: A Well-Informed Privatian Citizenry',
        meta: '4 p.m. Friday ■ Privatian Institute, 79 Heritage Ave., Cambridge',
        href: '/events',
        enabled: true
      }
    ],
    featured: {
      articleId: null,
      title: "Rubies decoded: 'Heritage is just one piece of the puzzle'",
      description: 'Rare family gems shine in new Privatian retrospective',
      imageUrl: 'img5.png',
      href: '/section/community-heritage',
      enabled: true
    }
  },
  allNews: {
    heading: 'All News',
    columns: [
      {
        id: 'col-1',
        label: 'COMMUNITY & HERITAGE',
        sectionSlug: 'community-heritage',
        lead: {
          articleId: null,
          title: "Don't hold back, the Privatian elders told scholars. It worked.",
          imageUrl: 'img2.png',
          href: '/section/community-heritage',
          enabled: true
        },
        subArticles: [
          { id: 'sub-1-1', title: 'Elena Voss named curator of The Privatian Foundation for Letters', href: '/section/community-heritage', enabled: true },
          { id: 'sub-1-2', title: 'Family council opposes changes to federal heritage-protection programs', href: '/section/community-heritage', enabled: true },
          { id: 'sub-1-3', title: "Henry's remarkable legacy of giving: what it means to the family today", href: '/section/community-heritage', enabled: true },
          { id: 'sub-1-4', title: 'Letters to the archive: understanding the Privatian correspondence collection', href: '/section/community-heritage', enabled: true }
        ]
      },
      {
        id: 'col-2',
        label: 'CULTURE',
        sectionSlug: 'culture',
        lead: {
          articleId: null,
          title: "For Privatian women in arts, 'not all cultural diets are equal'",
          imageUrl: 'img1.png',
          href: '/section/culture',
          enabled: true
        },
        subArticles: [
          { id: 'sub-2-1', title: 'AI use surging for creative writing among young Privatian members', href: '/section/culture', enabled: true },
          { id: 'sub-2-2', title: 'Pen refill? Go for it, says the Privatian Calligraphy Society', href: '/section/culture', enabled: true },
          { id: 'sub-2-3', title: 'Music residency, says Privatian Arts & Culture Society, is about connection', href: '/section/culture', enabled: true }
        ]
      },
      {
        id: 'col-3',
        label: 'PRIVACY & VALUES',
        sectionSlug: 'privacy-values',
        lead: {
          articleId: null,
          title: 'Do you have a private AI secret?',
          imageUrl: 'img4.png',
          href: '/section/privacy-values',
          enabled: true
        },
        subArticles: [
          { id: 'sub-3-1', title: 'Families alone, yes. But watching the community is another thing.', href: '/section/privacy-values', enabled: true },
          { id: 'sub-3-2', title: 'Is that family member a Privatian or not — and who decides the rules?', href: '/section/privacy-values', enabled: true },
          { id: 'sub-3-3', title: 'Bowling alone, yes. But the Privatian family still gathers.', href: '/section/privacy-values', enabled: true }
        ]
      },
      {
        id: 'col-4',
        label: 'NATION & WORLD',
        sectionSlug: 'nation-world',
        lead: {
          articleId: null,
          title: 'How the Privatian diaspora is keeping tradition alive in a globalized world',
          imageUrl: 'img6.png',
          href: '/section/nation-world',
          enabled: true
        },
        subArticles: [
          { id: 'sub-4-1', title: 'Bearing down on global secrecy: what the Privatian model teaches us', href: '/section/nation-world', enabled: true },
          { id: 'sub-4-2', title: 'Currency of trust: how the Privatian family built international networks', href: '/section/nation-world', enabled: true }
        ]
      },
      {
        id: 'col-5',
        label: 'ARTS & LEGACY',
        sectionSlug: 'arts-legacy',
        lead: {
          articleId: null,
          title: 'New research shows writing by hand preserves memory and sharpens intellect',
          imageUrl: 'img3.png',
          href: '/section/arts-legacy',
          enabled: true
        },
        subArticles: [
          { id: 'sub-5-1', title: 'Rowing, dance: yes. But the Privatian pen holds a special place of honor.', href: '/section/arts-legacy', enabled: true },
          { id: 'sub-5-2', title: 'Novelist argues the world needs more well-written letters, not fewer', href: '/section/arts-legacy', enabled: true },
          { id: 'sub-5-3', title: 'Turnover at The Privatian Society demands that cultural legacy must be paid.', href: '/section/arts-legacy', enabled: true }
        ]
      },
      {
        id: 'col-6',
        label: 'WORK & ECONOMY',
        sectionSlug: 'work-economy',
        lead: {
          articleId: null,
          title: 'Go-to Privatian professionals redefine private practices in modern economy',
          imageUrl: 'img5.png',
          href: '/section/work-economy',
          enabled: true
        },
        subArticles: [
          { id: 'sub-6-1', title: "Rural flower power: the Privatian family's investment in private land", href: '/section/work-economy', enabled: true },
          { id: 'sub-6-2', title: 'The Privatian economy advisor talks to the state of family wealth', href: '/section/work-economy', enabled: true },
          { id: 'sub-6-3', title: 'Letters of the law: the Privatian legal scholars improve upon family statutes', href: '/section/work-economy', enabled: true }
        ]
      }
    ]
  }
};

var DEFAULT_HOMEPAGE_CONFIG_BN = {
  hero: {
    main: {
      articleId: null,
      title: 'ব্যক্তিগত প্রজ্ঞার শিল্প: কীভাবে প্রাইভেসিয়ান পরিবারগুলো সংস্কৃতি ও ঐতিহ্য গড়ে তোলে।',
      subtitle: 'পারিবারিক ঐতিহ্য, বুদ্ধিবৃত্তিক পরম্পরা এবং নিজস্ব জ্ঞানের চিরস্থায়ী ক্ষমতার এক অনন্য অনুসন্ধান।',
      imageUrl: 'img1.png',
      href: '/section/findings',
      enabled: true
    },
    sidebar: [
      {
        id: 'h-side-1',
        articleId: null,
        title: 'অর্ধেক ঐতিহ্য, অর্ধেক পর্যবেক্ষণ: প্রজন্ম থেকে প্রজন্মে প্রাইভেসিয়ানদের পথচলা',
        description: 'পারিবারিক সংরক্ষণাগার থেকে, প্রাইভেসিয়ান ঐতিহ্য ব্যক্তিগত প্রচেষ্টার মাধ্যমে নতুন পথ তৈরি করে',
        imageUrl: 'img5.png',
        tag: '',
        href: '/section/community-heritage',
        enabled: true
      },
      {
        id: 'h-side-2',
        articleId: null,
        title: 'কীভাবে প্রাইভেসিয়ান ঐতিহ্য ব্যক্তিগত উৎকর্ষের এক নতুন যুগকে সংজ্ঞায়িত করেছে',
        description: 'সংস্কৃতি, শিল্পকলা এবং বুদ্ধিবৃত্তিক চিন্তাধারায় পরিবারের প্রভাব সাধারণ ধারণার চেয়েও গভীর',
        imageUrl: 'img6.png',
        tag: '',
        href: '/section/culture',
        enabled: true
      }
    ]
  },
  smallArticles: [
    {
      id: 'sm-1',
      articleId: null,
      title: 'যখন প্রাইভেসিয়ানরা মিলিত হয়: সম্প্রদায়ের নিভৃত শক্তি',
      imageUrl: 'img2.png',
      href: '/section/community-heritage',
      enabled: true
    },
    {
      id: 'sm-2',
      articleId: null,
      title: 'কেন হাতে লেখা চিঠিপত্র আবার ব্যক্তিগত জগতে ফিরে আসছে',
      imageUrl: 'img3.png',
      href: '/section/culture',
      enabled: true
    },
    {
      id: 'sm-3',
      articleId: null,
      title: 'আধুনিক যুগে উদারনৈতিক ঐতিহ্য: কীভাবে প্রাইভেসিয়ান পরিবার যুগের চেয়ে এগিয়ে থাকে',
      imageUrl: 'img4.png',
      href: '/section/privacy-values',
      enabled: true
    }
  ],
  eventsSection: {
    eventsHeading: 'আসন্ন ইভেন্ট ও আয়োজন',
    seeAllText: 'সকল ইভেন্ট দেখুন',
    seeAllHref: '/events',
    events: [
      {
        id: 'ev-1',
        date: '২২ সেপ্টেম্বর, ২০২৬',
        title: 'বিতর্ক ও বিশ্লেষণ: আধুনিক পরিবার ও সমাজজীবনে গোপনীয়তার ভূমিকা',
        meta: 'বৃহস্পতিবার বিকাল ৪:০০ ■ প্রাইভেসিয়ান ফোরাম, মূল মিলনায়তন; লাইভস্ট্রিম সহ',
        href: '/events',
        enabled: true
      },
      {
        id: 'ev-2',
        date: '১৬ অক্টোবর, ২০২৬',
        title: 'আমেরিকার ২৫০ বছর ও আগামী: সুনাগরিক হিসেবে প্রাইভেসিয়ান সমাজ',
        meta: 'শুক্রবার বিকাল ৪:০০ ■ প্রাইভেসিয়ান ইনস্টিটিউট, ৭৯ হেরিটেজ অ্যাভিনিউ, কেমব্রিজ',
        href: '/events',
        enabled: true
      }
    ],
    featured: {
      articleId: null,
      title: "রুবির রহস্য উন্মোচন: 'ঐতিহ্য হলো সামগ্রিক পরিচয়ের একটি অংশ'",
      description: 'নতুন প্রাইভেসিয়ান প্রদর্শনীতে দুর্লভ পারিবারিক স্মারক ও ঐতিহাসিক উত্তরাধিকার',
      imageUrl: 'img5.png',
      href: '/section/community-heritage',
      enabled: true
    }
  },
  allNews: {
    heading: 'সকল খবর',
    columns: [
      {
        id: 'col-1',
        label: 'সমাজ ও ঐতিহ্য',
        sectionSlug: 'community-heritage',
        lead: {
          articleId: null,
          title: "পারিবারিক সংরক্ষণাগার থেকে গবেষকদের নতুন দৃষ্টিভঙ্গি ও সাফল্য",
          imageUrl: 'img2.png',
          href: '/section/community-heritage',
          enabled: true
        },
        subArticles: [
          { id: 'sub-1-1', title: 'পারিবারিক ঐতিহ্যের অলিখিত নিয়মাবলী: সংরক্ষণাগার আমাদের কী বার্তা দেয়', href: '/section/community-heritage', enabled: true },
          { id: 'sub-1-2', title: 'আত্মানুসন্ধান: পরিচয়ের ওপর নতুন গবেষণা ও অনুসন্ধান', href: '/section/community-heritage', enabled: true },
          { id: 'sub-1-3', title: '১৯ শতকের হিসাবের খাতা বিশ্বাস সম্পর্কে কী প্রকাশ করে', href: '/section/community-heritage', enabled: true },
          { id: 'sub-1-4', title: 'ব্যক্তিগত প্রতিষ্ঠান এবং সত্যের সুরক্ষা', href: '/section/community-heritage', enabled: true }
        ]
      },
      {
        id: 'col-2',
        label: 'সংস্কৃতি',
        sectionSlug: 'culture',
        lead: {
          articleId: null,
          title: "নীরব উৎকর্ষের সংস্কৃতি: কেন সংযত পারদর্শিতা মূল্যবান",
          imageUrl: 'img1.png',
          href: '/section/culture',
          enabled: true
        },
        subArticles: [
          { id: 'sub-2-1', title: 'তরুণ প্রাইভেসিয়ান সদস্যদের মাঝে সৃজনশীল লেখায় কৃত্রিম বুদ্ধিমত্তার বিস্তার', href: '/section/culture', enabled: true },
          { id: 'sub-2-2', title: 'কলমের কালি রিফিল? এগিয়ে চলুন, বলছে ক্যালিগ্রাফি সোসাইটি', href: '/section/culture', enabled: true },
          { id: 'sub-2-3', title: 'সঙ্গীত রেসিডেন্সি মূলত আন্তরিক সংযোগের মাধ্যম', href: '/section/culture', enabled: true }
        ]
      },
      {
        id: 'col-3',
        label: 'মূল্যবোধ',
        sectionSlug: 'privacy-values',
        lead: {
          articleId: null,
          title: 'আপনার কি কোনো ব্যক্তিগত এআই গোপন তথ্য আছে?',
          imageUrl: 'img4.png',
          href: '/section/privacy-values',
          enabled: true
        },
        subArticles: [
          { id: 'sub-3-1', title: 'পরিবার একা হতে পারে, তবে সমাজকে পর্যবেক্ষণ করা ভিন্ন বিষয়', href: '/section/privacy-values', enabled: true },
          { id: 'sub-3-2', title: 'তিনি কি আসলেই পরিবারের সদস্য—এবং এই নিয়ম কারা নির্ধারণ করে?', href: '/section/privacy-values', enabled: true },
          { id: 'sub-3-3', title: 'একাকী কাটানো সময় নয়, বরং পরিবার এখনও নিয়মিত মিলিত হয়', href: '/section/privacy-values', enabled: true }
        ]
      },
      {
        id: 'col-4',
        label: 'দেশ ও বিশ্ব',
        sectionSlug: 'nation-world',
        lead: {
          articleId: null,
          title: 'বিশ্বায়নের যুগে কীভাবে প্রাইভেসিয়ান প্রবাসী সম্প্রদায় ঐতিহ্য বাঁচিয়ে রেখেছে',
          imageUrl: 'img6.png',
          href: '/section/nation-world',
          enabled: true
        },
        subArticles: [
          { id: 'sub-4-1', title: 'গোপনীয়তার বৈশ্বিক পাঠ: প্রাইভেসিয়ান মডেল আমাদের কী শেখায়', href: '/section/nation-world', enabled: true },
          { id: 'sub-4-2', title: 'বিশ্বাসের ভিত্তি: যেভাবে গড়ে উঠেছে আন্তর্জাতিক নেটওয়ার্ক', href: '/section/nation-world', enabled: true }
        ]
      },
      {
        id: 'col-5',
        label: 'শিল্প ও উত্তরাধিকার',
        sectionSlug: 'arts-legacy',
        lead: {
          articleId: null,
          title: 'নতুন গবেষণায় দেখা গেছে: হাতে লেখার অভ্যাস স্মৃতিশক্তি ও বুদ্ধি প্রখর করে',
          imageUrl: 'img3.png',
          href: '/section/arts-legacy',
          enabled: true
        },
        subArticles: [
          { id: 'sub-5-1', title: 'খেলাধুলা ও শিল্পকলার পাশাপাশি কলমের গুরুত্ব অনন্য', href: '/section/arts-legacy', enabled: true },
          { id: 'sub-5-2', title: 'ঔপন্যাসিকদের মতে বিশ্বের আরও সুচিন্তিত চিঠিপত্র প্রয়োজন', href: '/section/arts-legacy', enabled: true },
          { id: 'sub-5-3', title: 'সোসাইটির প্রতিটি পর্যায়ে সাংস্কৃতিক উত্তরাধিকার বজায় রাখা জরুরি', href: '/section/arts-legacy', enabled: true }
        ]
      },
      {
        id: 'col-6',
        label: 'কর্ম ও অর্থনীতি',
        sectionSlug: 'work-economy',
        lead: {
          articleId: null,
          title: 'আধুনিক অর্থনীতিতে শীর্ষ পেশাজীবীরা নতুন মাত্রা যোগ করছেন',
          imageUrl: 'img5.png',
          href: '/section/work-economy',
          enabled: true
        },
        subArticles: [
          { id: 'sub-6-1', title: "গ্রামীণ অর্থনীতি: ব্যক্তিগত জমিতে পরিবারের যুগান্তকারী বিনিয়োগ", href: '/section/work-economy', enabled: true },
          { id: 'sub-6-2', title: 'অর্থনৈতিক উপদেষ্টার সঙ্গে পারিবারিক সম্পদের বর্তমান অবস্থা নিয়ে আলোচনা', href: '/section/work-economy', enabled: true },
          { id: 'sub-6-3', title: 'আইনের ধারা: পরিবারের নীতিমালা সংস্কারে আইনজ্ঞদের ভূমিকা', href: '/section/work-economy', enabled: true }
        ]
      }
    ]
  }
};

var _cachedHomepageConfigEN = null;
var _cachedHomepageConfigBN = null;

try {
  var sBN = localStorage.getItem('privatian_hp_config_bn');
  if (sBN) _cachedHomepageConfigBN = JSON.parse(sBN);
  var sEN = localStorage.getItem('privatian_hp_config_en');
  if (sEN) _cachedHomepageConfigEN = JSON.parse(sEN);
} catch(e) {}

function getActiveHomepageConfig() {
  var isBn = window.PrivatianLang && window.PrivatianLang.getLang() === 'bn';
  if (isBn) {
    return _cachedHomepageConfigBN || DEFAULT_HOMEPAGE_CONFIG_BN;
  }
  return _cachedHomepageConfigEN || DEFAULT_HOMEPAGE_CONFIG_EN;
}

function initHomepage() {
  var cfg = getActiveHomepageConfig();
  applyHomepageConfig(cfg);
  if (window.PrivatianLang && window.PrivatianLang.getLang() === 'bn') {
    window.PrivatianLang.translatePageDOM('bn');
  }
}

// 1. Instant synchronous render right as script tag executes
initHomepage();

// 2. DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function () {
  initHomepage();
  fetchHomepageConfigFromAPI();

  // Listen for sections-loaded event for column slugs
  document.addEventListener('privatian:sections-loaded', function(e) {
    var sections = e && e.detail && e.detail.sections;
    if (sections) updateAllNewsLabels(sections);
  });

  // Instant synchronous language change handler (0ms latency)
  document.addEventListener('privatian:language-changed', function() {
    initHomepage();
  });
});

/**
 * Fetch persistent homepage configurations from API silently in the background.
 */
async function fetchHomepageConfigFromAPI() {
  try {
    const [resEN, resBN] = await Promise.all([
      fetch('/api/sections?action=homepage&lang=en'),
      fetch('/api/sections?action=homepage&lang=bn')
    ]);

    if (resEN && resEN.ok) {
      const dataEN = await resEN.json();
      if (dataEN && typeof dataEN === 'object') {
        _cachedHomepageConfigEN = dataEN;
        try { localStorage.setItem('privatian_hp_config_en', JSON.stringify(dataEN)); } catch(e){}
      }
    }
    if (resBN && resBN.ok) {
      const dataBN = await resBN.json();
      if (dataBN && typeof dataBN === 'object') {
        _cachedHomepageConfigBN = dataBN;
        try { localStorage.setItem('privatian_hp_config_bn', JSON.stringify(dataBN)); } catch(e){}
      }
    }
  } catch(err) {}

  // Apply the latest synced database tree
  var active = getActiveHomepageConfig();
  if (active) applyHomepageConfig(active);
}

/**
 * Apply homepage configuration to DOM elements on index.html with atomic synchronous updates.
 */
function applyHomepageConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return;
  var isBn = window.PrivatianLang && window.PrivatianLang.getLang() === 'bn';

  // 1. Hero Section
  if (cfg.hero) {
    var main = cfg.hero.main;
    if (main) {
      var heroMainEl = document.querySelector('.hero-main');
      if (heroMainEl) {
        if (main.enabled === false) {
          heroMainEl.style.display = 'none';
        } else {
          heroMainEl.style.display = '';
          var heroImg = heroMainEl.querySelector('.hero-main-img');
          if (heroImg && main.imageUrl) heroImg.src = main.imageUrl;

          var heroLink = document.getElementById('hero-headline-link');
          if (heroLink && main.title) heroLink.textContent = main.title;
          if (heroLink && main.href) heroLink.href = main.href;

          var heroWrapLink = document.getElementById('hero-main-article-link');
          if (heroWrapLink && main.href) heroWrapLink.href = main.href;

          var heroSub = heroMainEl.querySelector('.hero-subtitle');
          if (heroSub && main.subtitle !== undefined) heroSub.textContent = main.subtitle;
        }
      }
    }

    var sidebar = cfg.hero.sidebar;
    if (Array.isArray(sidebar)) {
      sidebar.forEach(function(s, idx) {
        var sideEl = document.getElementById('hero-sidebar-' + (idx + 1));
        if (sideEl) {
          if (s.enabled === false) {
            sideEl.style.display = 'none';
          } else {
            sideEl.style.display = '';
            var sImg = sideEl.querySelector('.hero-sidebar-img');
            if (sImg && s.imageUrl) sImg.src = s.imageUrl;

            var sTitle = sideEl.querySelector('.hero-sidebar-title');
            if (sTitle && s.title) sTitle.textContent = s.title;

            var sDesc = sideEl.querySelector('.hero-sidebar-desc');
            if (sDesc && s.description !== undefined) sDesc.textContent = s.description;

            var sLink = document.getElementById('hero-sidebar-link-' + (idx + 1));
            if (sLink && s.href) sLink.href = s.href;

            var sTag = sideEl.querySelector('.hero-sidebar-tag');
            if (sTag) {
              var sTagVal = (s.tag || '').trim();
              if (sTagVal.toLowerCase() === 'heritage archive' || sTagVal === 'ঐতিহ্য সংরক্ষণাগার' || sTagVal === 'ঐতিহ্য সংগ্রহশালা') {
                sTagVal = '';
              }
              if (sTagVal) {
                sTag.style.display = '';
                sTag.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> ` + escapeHtmlText(sTagVal);
              } else {
                sTag.style.display = 'none';
              }
            }
          }
        }
      });
    }
  }

  // 2. Small Articles (3 Cards)
  if (Array.isArray(cfg.smallArticles)) {
    cfg.smallArticles.forEach(function(card, idx) {
      var cardEl = document.getElementById('small-article-' + (idx + 1));
      if (cardEl) {
        if (card.enabled === false) {
          cardEl.style.display = 'none';
        } else {
          cardEl.style.display = '';
          var cImg = cardEl.querySelector('.small-article-img');
          if (cImg && card.imageUrl) cImg.src = card.imageUrl;

          var cTitle = cardEl.querySelector('.small-article-title');
          if (cTitle && card.title) cTitle.textContent = card.title;

          var cLink = document.getElementById('small-article-link-' + (idx + 1));
          if (cLink && card.href) cLink.href = card.href;
        }
      }
    });
  }

  // 3. Events Panel & Featured Spotlight
  if (cfg.eventsSection) {
    var evSec = cfg.eventsSection;
    var evPanel = document.getElementById('events-panel');
    if (evPanel) {
      var headingEl = evPanel.querySelector('.section-heading-label');
      var eventsHeading = evSec.eventsHeading || (isBn ? 'আসন্ন ইভেন্ট ও আয়োজন' : 'Upcoming Events');
      if (headingEl && eventsHeading) headingEl.textContent = eventsHeading;

      var seeAllEl = document.getElementById('see-all-events-link');
      var seeAllText = evSec.seeAllText || (isBn ? 'সকল ইভেন্ট দেখুন' : 'See all events');
      if (seeAllEl) {
        seeAllEl.textContent = seeAllText;
        seeAllEl.href = evSec.seeAllHref || '/events';
      }

      var events = evSec.events;
      if (Array.isArray(events)) {
        var activeEvents = events.filter(function(ev) { return ev && ev.enabled !== false; });
        var top2Events = activeEvents.slice(0, 2);
        var eventsListHtml = '';
        top2Events.forEach(function(ev, idx) {
          if (idx > 0 && eventsListHtml) eventsListHtml += '<hr class="event-divider" />';
          var eDate = ev.date || '';
          var eTitle = ev.title || '';
          var eMeta = ev.meta || '';
          eventsListHtml += `
            <div class="event-item" id="event-item-${idx + 1}">
              <div class="event-date">${escapeHtmlText(eDate)}</div>
              <div class="event-body">
                <h3 class="event-title">${escapeHtmlText(eTitle)}</h3>
                <p class="event-meta">${escapeHtmlText(eMeta)}</p>
              </div>
            </div>
          `;
        });
        if (eventsListHtml) {
          var oldItems = evPanel.querySelectorAll('.event-item, .event-divider');
          oldItems.forEach(function(el) { el.remove(); });
          if (seeAllEl) {
            seeAllEl.href = evSec.seeAllHref || '/events';
            seeAllEl.textContent = seeAllText;
            seeAllEl.insertAdjacentHTML('beforebegin', eventsListHtml);
          }
        }
      }
    }

    var feat = evSec.featured;
    var featEl = document.getElementById('events-featured-article');
    if (featEl && feat) {
      if (feat.enabled === false) {
        featEl.style.display = 'none';
      } else {
        featEl.style.display = '';
        var fImg = featEl.querySelector('.events-featured-img');
        if (fImg && feat.imageUrl) fImg.src = feat.imageUrl;

        var fTitle = featEl.querySelector('.events-featured-title');
        if (fTitle && feat.title) fTitle.textContent = feat.title;

        var fDesc = featEl.querySelector('.events-featured-desc');
        if (fDesc && feat.description !== undefined) fDesc.textContent = feat.description;

        var fLink = document.getElementById('events-featured-link');
        if (fLink && feat.href) fLink.href = feat.href;
      }
    }
  }

  // 4. All News Sections (6 Columns)
  if (cfg.allNews) {
    var allNewsHeadingEl = document.querySelector('.all-news-heading');
    if (allNewsHeadingEl) {
      var allNewsH = cfg.allNews.heading || (isBn ? 'সকল খবর' : 'All News');
      allNewsHeadingEl.textContent = allNewsH;
    }

    var cols = cfg.allNews.columns;
    if (Array.isArray(cols)) {
      var allColEls = document.querySelectorAll('.news-column');
      cols.forEach(function(col, idx) {
        var colEl = allColEls[idx];
        if (!colEl) return;

        // Label
        var lbl = colEl.querySelector('.news-col-label');
        if (lbl && col.label) lbl.textContent = col.label.toUpperCase();
        if (col.sectionSlug) colEl.setAttribute('data-section-slug', col.sectionSlug);

        // Lead story
        if (col.lead) {
          var lead = col.lead;
          var leadImg = colEl.querySelector('.news-main-img');
          if (leadImg && lead.imageUrl) leadImg.src = lead.imageUrl;

          var leadTitle = colEl.querySelector('.news-main-title');
          if (leadTitle && lead.title) leadTitle.textContent = lead.title;

          var leadLink = colEl.querySelector('.news-main-article a');
          if (leadLink && lead.href) leadLink.href = lead.href;
        }

        // Sub articles
        if (Array.isArray(col.subArticles)) {
          var subListEl = colEl.querySelector('.news-sub-list');
          if (subListEl) {
            var subHtml = '';
            col.subArticles.forEach(function(sub, sIdx) {
              if (sub.enabled === false) return;
              if (sIdx > 0) subHtml += '<hr class="news-divider" />';
              subHtml += `<article class="news-sub-item"><a href="${escapeHtmlText(sub.href || '#')}">${escapeHtmlText(sub.title || '')}</a></article>`;
            });
            if (subHtml) subListEl.innerHTML = subHtml;
          }
        }
      });
    }
  }
}

function escapeHtmlText(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Update All News column labels and visibility from a sections array with bilingual support.
 */
function updateAllNewsLabels(sections) {
  if (!Array.isArray(sections)) return;
  var cols = document.querySelectorAll('.news-column[data-section-slug]');
  if (!cols.length) return;
  var isBn = window.PrivatianLang && window.PrivatianLang.getLang() === 'bn';

  cols.forEach(function(col) {
    var slug = col.getAttribute('data-section-slug');
    if (!slug) return;

    var sec = null;
    for (var i = 0; i < sections.length; i++) {
      if ((sections[i].slug || sections[i].id) === slug) { sec = sections[i]; break; }
    }

    var labelEl = col.querySelector('.news-col-label');

    if (!sec) {
      col.hidden = true;
      col.setAttribute('aria-hidden', 'true');
      return;
    }

    col.hidden = false;
    col.removeAttribute('aria-hidden');

    if (labelEl) {
      var name = isBn ? (sec.name_bn || sec.name) : sec.name;
      labelEl.textContent = (name || '').toUpperCase();
    }

    col.querySelectorAll('a.news-section-link').forEach(function(a) {
      a.href = '/section/' + sec.slug;
    });
  });
}
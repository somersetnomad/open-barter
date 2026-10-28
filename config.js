// =====================================================================
//  Your community's settings. This is the only file most groups need
//  to edit. See README.md for the full setup guide.
// =====================================================================
export default {
  // --- Database -------------------------------------------------------
  // Leave both blank to run in demo mode (sample data, stored only in
  // the visitor's browser). Fill them in from Supabase → Project
  // Settings → API to go live. The anon key is meant to be public.
  supabaseUrl: '',
  supabaseAnonKey: '',

  // --- Identity -------------------------------------------------------
  name: 'Riverside Swap',
  tagline: 'Swap things and skills with your neighbours. No money needed.',
  heroTitle: 'Trade what you have for what you need',
  moderatorEmail: '', // shown on the rules page so people can reach a human
  // Full public address of the site, used in QR codes and share links. Leave blank to use
  // whatever address the site is opened from. Set it if you move to your own domain.
  siteUrl: '',
  sourceUrl: 'https://github.com/somersetnomad/open-barter', // link to your copy of the code

  // --- Credits --------------------------------------------------------
  // Shown in the interface. The limits themselves are set in the
  // database (the settings table) so nobody can bypass them.
  creditName: 'credits',
  creditNameSingular: 'credit',
  creditHint: 'Roughly, 1 credit ≈ 10 minutes of someone\'s time.',

  // --- Places ---------------------------------------------------------
  // Areas people can pick. Local-only listings are matched within the
  // same area. Leave the list empty to let people type their own.
  areas: ['Riverside', 'Old Town', 'Hillside'],

  // --- Categories -----------------------------------------------------
  categories: [
    'Food & drink', 'Home & garden', 'Clothing', 'Kids & baby', 'Books & media',
    'Tools & equipment', 'Electronics', 'Furniture', 'Bikes & outdoors', 'Repairs & DIY',
    'Lessons & tutoring', 'Tech help', 'Care & wellbeing', 'Creative & crafts',
    'Transport & lifts', 'Other'
  ],

  // --- Community rules (members must accept these before trading) -----
  rules: [
    'Describe things honestly, including faults and condition.',
    'Only agree to trades you intend to complete. Confirm on the site once it has happened.',
    'Meet in public places, or bring a friend, for first-time swaps.',
    'Be kind. No harassment, discrimination or pressure.',
    'Credits have no cash value and cannot be bought or sold.',
    'If something goes wrong, raise a dispute on the trade so a moderator can help.'
  ],
  prohibited: [
    'Weapons, drugs, alcohol, tobacco or prescription medicines',
    'Stolen, counterfeit or recalled goods',
    'Live animals',
    'Anything illegal to sell or give away where you live',
    'Adult content or services'
  ]
};

const RULES: [RegExp, string][] = [
  [/north indian|mughlai|punjabi|awadhi|hyderabadi|kebabs/i, "🍛"],
  [/healthy|salads|vegan|bowls/i, "🥗"],
  [/italian/i, "🍝"],
  [/american|bbq|fast food/i, "🍔"],
  [/street food|chaat|snacks/i, "🥙"],
  [/south indian/i, "🥞"],
  [/bakery/i, "🧁"],
  [/cafe|beverages/i, "☕"],
  [/tibetan|momos/i, "🥟"],
  [/asian|japanese|chinese/i, "🥡"],
  [/maharashtrian|gujarati|home food/i, "🍱"],
  [/malvani|konkan|goan/i, "🦐"],
  [/pizza|margherita|pepperoni|formaggi|diavola/i, "🍕"],
  [/burger|slider/i, "🍔"],
  [/biryani|pulao|rice|bhaat/i, "🍛"],
  [/dosa|uttapam|idli|vada|upma|pongal/i, "🥞"],
  [/momo|dumpling|bao|sui mai/i, "🥟"],
  [/noodle|hakka|ramen|thukpa|pad thai|chow/i, "🍜"],
  [/roll|wrap|kathi|frankie/i, "🌯"],
  [/salad|bowl|quinoa|sprouts/i, "🥗"],
  [/cake|pastry|brownie|cheesecake|tiramisu/i, "🍰"],
  [/ice cream|sundae|kulfi|scoop/i, "🍨"],
  [/shake|smoothie|lassi|cooler|mojito|lagoon|mastani|sharbat|chaas|solkadhi/i, "🥤"],
  [/coffee|cappuccino|cold brew|frappe|chai|tea/i, "☕"],
  [/kebab|tikka|tandoori|seekh|grill|wings|chop|steak/i, "🍢"],
  [/fish|prawn|bombil|surmai|clam|kolambi|tisrya|seafood/i, "🦐"],
  [/thali/i, "🍱"],
  [/fries|chips/i, "🍟"],
  [/pav|vada pav|dabeli|misal|bhaji|chaat|puri|samosa/i, "🥙"],
  [/pasta|spaghetti|penne|fettuccine|lasagne|ravioli|risotto|alfredo/i, "🍝"],
  [/sandwich|toast|croissant|panini/i, "🥪"],
  [/pancake|waffle|egg|omelette|benedict|breakfast/i, "🍳"],
  [/soup/i, "🍲"],
  [/naan|roti|paratha|bhakri|kulcha|sheermal/i, "🫓"],
  [/curry|masala|paneer|dal|korma|nihari|rogan|kolhapuri|butter chicken/i, "🍲"],
  [/gulab|jamun|rasmalai|shrikhand|modak|meetha|phirni|tukda|dessert|sweet|cookie/i, "🍮"],
];

/** Emoji used on the gradient fallback when a food photo is missing or fails to load. */
export function dishEmoji(name: string, fallback = "🍽️"): string {
  for (const [re, e] of RULES) if (re.test(name)) return e;
  return fallback;
}

const GRADIENTS = [
  "from-orange-200 to-amber-100 dark:from-orange-900 dark:to-amber-950",
  "from-rose-200 to-orange-100 dark:from-rose-900 dark:to-orange-950",
  "from-amber-200 to-yellow-100 dark:from-amber-900 dark:to-yellow-950",
  "from-emerald-200 to-lime-100 dark:from-emerald-900 dark:to-lime-950",
  "from-red-200 to-orange-100 dark:from-red-900 dark:to-orange-950",
];

export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length]!;
}

import type { ImgKey } from "./images";

/** [calories, protein g, carbs g, fat g, grams] */
export type Nutrition = [number, number, number, number, number];

export type ItemDef = {
  n: string;
  p: number; // rupees
  v: boolean; // veg
  d: string;
  i: ImgKey;
  b?: boolean; // bestseller
  t?: string[];
  variant?: VariantPreset;
  addons?: AddonPreset[];
  nut?: Nutrition;
  temp?: boolean; // temperature sensitive (not eligible for Food Rescue)
  egg?: boolean;
};

export type CategoryDef = { name: string; from?: string; to?: string; items: ItemDef[] };
export type MenuTemplate = CategoryDef[];

export type VariantPreset = "pizza" | "biryani" | "thali" | "burger" | "cake" | "shake" | "bowl" | "dosa";
export type AddonPreset = "toppings" | "dips" | "biryaniSides" | "burgerExtras" | "thaliExtras" | "breads" | "drinks" | "boost" | "cakeMessage" | "spice";

/** Variant name + multiplier on base price. First entry is the default. */
export const variantPresets: Record<VariantPreset, { group: string; options: [string, number][] }> = {
  pizza: { group: "Size", options: [["Regular (7\")", 1], ["Medium (10\")", 1.65], ["Large (13\")", 2.25]] },
  biryani: { group: "Portion", options: [["Half (serves 1)", 1], ["Full (serves 2)", 1.75], ["Family pack (serves 4)", 3.2]] },
  thali: { group: "Thali size", options: [["Regular", 1], ["Royal (unlimited rotis)", 1.4]] },
  burger: { group: "Make it", options: [["Single", 1], ["Double patty", 1.45]] },
  cake: { group: "Weight", options: [["Half kg", 1], ["1 kg", 1.85]] },
  shake: { group: "Size", options: [["Regular (300 ml)", 1], ["Large (450 ml)", 1.35]] },
  bowl: { group: "Bowl size", options: [["Regular", 1], ["Large", 1.3]] },
  dosa: { group: "Style", options: [["Plain", 1], ["Butter", 1.2], ["Ghee roast", 1.35]] },
};

/** Add-on group presets: name, min, max, options [name, rupees, veg]. */
export const addonPresets: Record<AddonPreset, { name: string; min: number; max: number; options: [string, number, boolean][] }> = {
  toppings: { name: "Add toppings", min: 0, max: 4, options: [["Extra cheese", 59, true], ["Jalapeños", 39, true], ["Olives", 39, true], ["Mushrooms", 49, true], ["Paneer tikka", 69, true], ["Chicken tikka", 89, false]] },
  dips: { name: "Dips", min: 0, max: 2, options: [["Cheesy dip", 29, true], ["Peri peri dip", 29, true], ["Garlic mayo", 25, true]] },
  biryaniSides: { name: "Add sides", min: 0, max: 3, options: [["Burani raita", 49, true], ["Mirchi ka salan", 59, true], ["Boiled egg", 25, false], ["Double masala", 39, true]] },
  burgerExtras: { name: "Make it a meal", min: 0, max: 3, options: [["Cheese slice", 29, true], ["Fries (regular)", 79, true], ["Coke 300 ml", 49, true], ["Extra patty", 79, true]] },
  thaliExtras: { name: "Extras", min: 0, max: 3, options: [["Extra roti", 15, true], ["Papad", 15, true], ["Gulab jamun (2 pc)", 49, true], ["Buttermilk", 35, true]] },
  breads: { name: "Choose bread", min: 1, max: 1, options: [["Butter roti", 0, true], ["Butter naan", 20, true], ["Garlic naan", 35, true], ["Laccha paratha", 30, true]] },
  drinks: { name: "Add a drink", min: 0, max: 2, options: [["Masala chaas", 45, true], ["Fresh lime soda", 59, true], ["Iced tea", 69, true]] },
  boost: { name: "Protein boost", min: 0, max: 2, options: [["Extra grilled paneer", 79, true], ["Extra tofu", 69, true], ["Grilled chicken (100 g)", 99, false], ["Boiled eggs (2)", 49, false]] },
  cakeMessage: { name: "Message on cake", min: 0, max: 1, options: [["Happy Birthday", 0, true], ["Happy Anniversary", 0, true], ["Congratulations", 0, true]] },
  spice: { name: "Spice level", min: 1, max: 1, options: [["Mild", 0, true], ["Medium", 0, true], ["Spicy", 0, true]] },
};

export const menus: Record<string, MenuTemplate> = {
  northIndian: [
    { name: "Starters", items: [
      { n: "Paneer Tikka", p: 289, v: true, d: "Cottage cheese cubes marinated in hung curd and spices, char-grilled in the tandoor.", i: "kebab", b: true },
      { n: "Hara Bhara Kebab", p: 229, v: true, d: "Spinach, peas and potato patties with a crisp crust.", i: "kebab" },
      { n: "Tandoori Chicken (Half)", p: 339, v: false, d: "Bone-in chicken in a smoky red marinade, served with mint chutney.", i: "kebab", b: true },
      { n: "Chicken Malai Tikka", p: 359, v: false, d: "Creamy, mildly spiced boneless chicken with cheese and cardamom.", i: "kebab" },
      { n: "Dahi Ke Kebab", p: 249, v: true, d: "Melt-in-the-mouth hung curd kebabs.", i: "kebab" },
    ]},
    { name: "Main Course", items: [
      { n: "Paneer Butter Masala", p: 299, v: true, d: "Soft paneer in a rich tomato-butter gravy.", i: "curry", b: true, addons: ["breads"] },
      { n: "Dal Makhani", p: 259, v: true, d: "Black lentils slow-cooked overnight with butter and cream.", i: "curry", b: true, addons: ["breads"] },
      { n: "Kadai Paneer", p: 289, v: true, d: "Paneer tossed with capsicum, onions and freshly ground kadai masala.", i: "curry" },
      { n: "Butter Chicken", p: 369, v: false, d: "Tandoori chicken simmered in a velvety makhani gravy.", i: "curry", b: true, addons: ["breads"] },
      { n: "Chicken Tikka Masala", p: 359, v: false, d: "Grilled chicken tikka in a spiced onion-tomato masala.", i: "curry" },
      { n: "Mutton Rogan Josh", p: 449, v: false, d: "Kashmiri-style mutton curry with a deep red gravy.", i: "curry" },
      { n: "Chana Masala", p: 219, v: true, d: "Punjabi chickpeas with tangy spices.", i: "curry" },
      { n: "Mix Veg Kolhapuri", p: 239, v: true, d: "Seasonal vegetables in a fiery Kolhapuri masala.", i: "curry", t: ["spicy"] },
    ]},
    { name: "Breads", items: [
      { n: "Butter Naan", p: 59, v: true, d: "Leavened bread from the tandoor, brushed with butter.", i: "curry" },
      { n: "Garlic Naan", p: 79, v: true, d: "Naan topped with garlic and coriander.", i: "curry", b: true },
      { n: "Tandoori Roti", p: 35, v: true, d: "Whole wheat roti from the clay oven.", i: "curry" },
      { n: "Laccha Paratha", p: 69, v: true, d: "Flaky, layered whole wheat paratha.", i: "curry" },
    ]},
    { name: "Rice", items: [
      { n: "Jeera Rice", p: 159, v: true, d: "Basmati rice tempered with cumin.", i: "biryani" },
      { n: "Veg Pulao", p: 199, v: true, d: "Fragrant basmati with seasonal vegetables.", i: "biryani" },
    ]},
    { name: "Desserts", items: [
      { n: "Gulab Jamun (2 pc)", p: 89, v: true, d: "Warm milk dumplings in rose-cardamom syrup.", i: "dessert" },
      { n: "Rasmalai (2 pc)", p: 119, v: true, d: "Soft cheese patties in saffron milk.", i: "dessert", temp: true },
    ]},
  ],
  mughlai: [
    { name: "Kebabs", items: [
      { n: "Galouti Kebab", p: 399, v: false, d: "Lucknow's famous minced mutton kebab on mini parathas.", i: "kebab", b: true },
      { n: "Seekh Kebab", p: 349, v: false, d: "Spiced minced chicken skewers from the tandoor.", i: "kebab" },
      { n: "Chicken Tangdi Kebab", p: 329, v: false, d: "Drumsticks in a creamy spiced marinade.", i: "kebab" },
      { n: "Paneer Shashlik", p: 299, v: true, d: "Paneer, peppers and onions grilled on skewers.", i: "kebab" },
      { n: "Soya Chaap Tikka", p: 249, v: true, d: "Smoky soya chaap in malai marinade.", i: "kebab" },
    ]},
    { name: "Biryani", items: [
      { n: "Lucknowi Chicken Biryani", p: 329, v: false, d: "Awadhi dum biryani, delicately spiced with kewra and saffron.", i: "biryani", b: true, variant: "biryani", addons: ["biryaniSides"] },
      { n: "Mutton Dum Biryani", p: 429, v: false, d: "Tender mutton layered with aged basmati and sealed in dum.", i: "biryani", variant: "biryani", addons: ["biryaniSides"] },
      { n: "Subz Dum Biryani", p: 259, v: true, d: "Garden vegetables and basmati with Awadhi spices.", i: "biryani", variant: "biryani", addons: ["biryaniSides"] },
    ]},
    { name: "Curries", items: [
      { n: "Mutton Nihari", p: 449, v: false, d: "Slow-braised mutton shank in a silky, spiced gravy.", i: "curry", b: true },
      { n: "Chicken Korma", p: 369, v: false, d: "Chicken in a mild cashew-and-yoghurt gravy.", i: "curry" },
      { n: "Paneer Lababdar", p: 299, v: true, d: "Paneer in a creamy onion-tomato gravy.", i: "curry" },
      { n: "Dal Sultani", p: 249, v: true, d: "Yellow lentils finished with cream and ghee.", i: "curry" },
    ]},
    { name: "Breads", items: [
      { n: "Sheermal", p: 79, v: true, d: "Saffron-scented sweet bread.", i: "curry" },
      { n: "Roomali Roti", p: 39, v: true, d: "Paper-thin handkerchief bread.", i: "curry" },
      { n: "Butter Naan", p: 59, v: true, d: "Classic tandoori naan with butter.", i: "curry" },
    ]},
    { name: "Desserts", items: [
      { n: "Shahi Tukda", p: 149, v: true, d: "Fried bread soaked in saffron rabdi.", i: "dessert", b: true },
      { n: "Phirni", p: 109, v: true, d: "Chilled ground-rice pudding set in a clay pot.", i: "dessert", temp: true },
    ]},
  ],
  biryani: [
    { name: "Biryani", items: [
      { n: "Hyderabadi Chicken Dum Biryani", p: 289, v: false, d: "Kacchi-style biryani with juicy chicken, fried onions and mint.", i: "biryani", b: true, variant: "biryani", addons: ["biryaniSides"] },
      { n: "Mutton Biryani", p: 389, v: false, d: "Slow-cooked mutton with long-grain basmati.", i: "biryani", b: true, variant: "biryani", addons: ["biryaniSides"] },
      { n: "Chicken 65 Biryani", p: 309, v: false, d: "Biryani topped with crispy Chicken 65.", i: "biryani", variant: "biryani", addons: ["biryaniSides"], t: ["spicy"] },
      { n: "Egg Biryani", p: 229, v: false, egg: true, d: "Masala-roasted eggs layered with fragrant rice.", i: "biryani", variant: "biryani", addons: ["biryaniSides"] },
      { n: "Paneer Tikka Biryani", p: 259, v: true, d: "Smoky paneer tikka with saffron rice.", i: "biryani", variant: "biryani", addons: ["biryaniSides"] },
      { n: "Veg Dum Biryani", p: 219, v: true, d: "Vegetables and basmati, sealed and slow cooked.", i: "biryani", variant: "biryani", addons: ["biryaniSides"] },
      { n: "Prawns Biryani", p: 429, v: false, d: "Coastal-style biryani with juicy prawns.", i: "biryani", variant: "biryani" },
    ]},
    { name: "Starters", items: [
      { n: "Chicken 65", p: 249, v: false, d: "Crispy, spicy fried chicken tossed with curry leaves.", i: "kebab", b: true, t: ["spicy"] },
      { n: "Apollo Fish", p: 299, v: false, d: "Hyderabadi spicy fried fish.", i: "seafood" },
      { n: "Paneer 65", p: 229, v: true, d: "Paneer fried in a tangy, spicy coating.", i: "kebab" },
      { n: "Gobi Manchurian Dry", p: 189, v: true, d: "Crispy cauliflower in Indo-Chinese sauce.", i: "chinese" },
    ]},
    { name: "Curries", items: [
      { n: "Chicken Kurma", p: 279, v: false, d: "Mildly spiced chicken in coconut-cashew gravy.", i: "curry" },
      { n: "Mirchi Ka Salan", p: 129, v: true, d: "Green chillies in a peanut-sesame gravy. Best with biryani.", i: "curry" },
      { n: "Dalcha", p: 149, v: true, d: "Lentils cooked with bottle gourd and tamarind.", i: "curry" },
    ]},
    { name: "Sides & Desserts", items: [
      { n: "Burani Raita", p: 59, v: true, d: "Yoghurt with roasted garlic.", i: "dessert" },
      { n: "Double Ka Meetha", p: 119, v: true, d: "Hyderabadi bread pudding with dry fruits.", i: "dessert", b: true },
      { n: "Qubani Ka Meetha", p: 139, v: true, d: "Stewed apricots with cream.", i: "dessert", temp: true },
      { n: "Thums Up 300 ml", p: 45, v: true, d: "Chilled soft drink.", i: "shake", temp: true },
    ]},
  ],
  pizza: [
    { name: "Classic Pizzas", items: [
      { n: "Margherita", p: 199, v: true, d: "San Marzano tomato, fior di latte and fresh basil.", i: "pizza", b: true, variant: "pizza", addons: ["toppings", "dips"] },
      { n: "Farmhouse", p: 279, v: true, d: "Onion, capsicum, tomato and mushroom.", i: "pizza", variant: "pizza", addons: ["toppings", "dips"] },
      { n: "Paneer Tikka Pizza", p: 319, v: true, d: "Tandoori paneer, onions and mint mayo drizzle.", i: "pizza", b: true, variant: "pizza", addons: ["toppings", "dips"] },
      { n: "Pepperoni", p: 379, v: false, d: "Chicken pepperoni and mozzarella.", i: "pizza", b: true, variant: "pizza", addons: ["toppings", "dips"] },
      { n: "BBQ Chicken", p: 359, v: false, d: "Smoky BBQ chicken, red onion and coriander.", i: "pizza", variant: "pizza", addons: ["toppings", "dips"] },
      { n: "Veggie Supreme", p: 329, v: true, d: "Loaded with seven garden toppings.", i: "pizza", variant: "pizza", addons: ["toppings", "dips"] },
      { n: "Diavola", p: 399, v: false, d: "Spicy chicken salami, chilli oil and olives.", i: "pizza", variant: "pizza", addons: ["toppings"], t: ["spicy"] },
    ]},
    { name: "Sides", items: [
      { n: "Garlic Breadsticks", p: 129, v: true, d: "Freshly baked with garlic butter.", i: "pizza", b: true, addons: ["dips"] },
      { n: "Stuffed Garlic Bread", p: 169, v: true, d: "Cheese, corn and jalapeño filled.", i: "pizza" },
      { n: "Peri Peri Fries", p: 139, v: true, d: "Crispy fries with peri peri dust.", i: "burger" },
      { n: "Chicken Wings (6 pc)", p: 249, v: false, d: "Tossed in hot honey glaze.", i: "grill" },
    ]},
    { name: "Pasta", items: [
      { n: "Penne Arrabbiata", p: 249, v: true, d: "Spicy tomato and garlic sauce.", i: "pasta" },
      { n: "Spaghetti Aglio Olio", p: 269, v: true, d: "Garlic, chilli flakes and olive oil.", i: "pasta" },
      { n: "Chicken Alfredo", p: 319, v: false, d: "Creamy parmesan sauce with grilled chicken.", i: "pasta" },
    ]},
    { name: "Desserts & Drinks", items: [
      { n: "Choco Lava Cake", p: 109, v: true, egg: true, d: "Warm chocolate cake with a molten centre.", i: "dessert", b: true },
      { n: "Tiramisu Jar", p: 179, v: true, egg: true, d: "Coffee-soaked layers with mascarpone.", i: "dessert", temp: true },
      { n: "Cold Coffee", p: 129, v: true, d: "Blended iced coffee.", i: "coffee", temp: true },
    ]},
  ],
  italian: [
    { name: "Antipasti", items: [
      { n: "Bruschetta Pomodoro", p: 229, v: true, d: "Toasted sourdough, tomato, basil and olive oil.", i: "pasta", b: true },
      { n: "Burrata & Heirloom Tomatoes", p: 449, v: true, d: "Creamy burrata with pesto.", i: "salad" },
      { n: "Arancini (4 pc)", p: 289, v: true, d: "Fried risotto balls with mozzarella centre.", i: "pasta" },
    ]},
    { name: "Pasta", items: [
      { n: "Spaghetti Carbonara", p: 389, v: false, egg: true, d: "Guanciale-style chicken bacon, egg yolk and pecorino.", i: "pasta", b: true },
      { n: "Penne Pesto", p: 329, v: true, d: "Basil pesto, pine nuts and parmesan.", i: "pasta" },
      { n: "Fettuccine Alfredo", p: 349, v: true, d: "Classic cream and parmesan sauce.", i: "pasta", b: true },
      { n: "Lasagne alla Bolognese", p: 429, v: false, d: "Layered pasta with slow-cooked chicken ragù.", i: "pasta" },
      { n: "Mushroom Risotto", p: 399, v: true, d: "Arborio rice with porcini and truffle oil.", i: "pasta" },
      { n: "Ravioli di Ricotta", p: 379, v: true, d: "Spinach and ricotta ravioli in sage butter.", i: "pasta" },
    ]},
    { name: "Wood-fired Pizza", items: [
      { n: "Margherita Classica", p: 349, v: true, d: "Tomato, mozzarella, basil.", i: "pizza", b: true, variant: "pizza", addons: ["toppings"] },
      { n: "Quattro Formaggi", p: 449, v: true, d: "Four cheeses with honey drizzle.", i: "pizza", variant: "pizza" },
      { n: "Pollo Pesto", p: 449, v: false, d: "Pesto, grilled chicken and sun-dried tomato.", i: "pizza", variant: "pizza" },
    ]},
    { name: "Dolci", items: [
      { n: "Tiramisu", p: 249, v: true, egg: true, d: "House-made with espresso and mascarpone.", i: "dessert", b: true, temp: true },
      { n: "Panna Cotta", p: 219, v: true, d: "Vanilla bean panna cotta with berry compote.", i: "dessert", temp: true },
    ]},
  ],
  burger: [
    { name: "Burgers", items: [
      { n: "Classic Veg Burger", p: 129, v: true, d: "Crispy veg patty, lettuce, tomato and house mayo.", i: "burger", variant: "burger", addons: ["burgerExtras"] },
      { n: "Crispy Paneer Burger", p: 179, v: true, d: "Spiced paneer slab, slaw and chipotle sauce.", i: "burger", b: true, variant: "burger", addons: ["burgerExtras"] },
      { n: "Smash Chicken Burger", p: 229, v: false, d: "Double-smashed chicken patty, cheese and pickles.", i: "burger", b: true, variant: "burger", addons: ["burgerExtras"] },
      { n: "Fried Chicken Burger", p: 219, v: false, d: "Buttermilk fried chicken, honey mustard.", i: "burger", variant: "burger", addons: ["burgerExtras"] },
      { n: "Lamb Burger", p: 299, v: false, d: "Juicy lamb patty, caramelised onions, feta.", i: "burger", variant: "burger", addons: ["burgerExtras"] },
      { n: "Aloo Tikki Burger", p: 99, v: true, d: "The desi favourite with tamarind chutney.", i: "burger", addons: ["burgerExtras"] },
      { n: "Mushroom Swiss Burger", p: 239, v: true, d: "Sautéed mushrooms and melted cheese.", i: "burger", variant: "burger", addons: ["burgerExtras"] },
    ]},
    { name: "Sides", items: [
      { n: "Salted Fries", p: 99, v: true, d: "Golden and crispy.", i: "burger", addons: ["dips"] },
      { n: "Cheesy Loaded Fries", p: 169, v: true, d: "Fries with cheese sauce and jalapeños.", i: "burger", b: true },
      { n: "Chicken Nuggets (6 pc)", p: 179, v: false, d: "With BBQ dip.", i: "grill" },
      { n: "Onion Rings", p: 129, v: true, d: "Beer-batter style, eggless.", i: "burger" },
    ]},
    { name: "Shakes", items: [
      { n: "Oreo Shake", p: 169, v: true, d: "Thick shake with crushed cookies.", i: "shake", b: true, variant: "shake", temp: true },
      { n: "Salted Caramel Shake", p: 179, v: true, d: "Rich and creamy.", i: "shake", variant: "shake", temp: true },
      { n: "Cold Coffee", p: 139, v: true, d: "Iced and frothy.", i: "coffee", temp: true },
    ]},
  ],
  bbq: [
    { name: "Smokehouse Platters", items: [
      { n: "Smoked BBQ Chicken Wings", p: 399, v: false, d: "12-hour smoked wings with bourbon glaze.", i: "grill", b: true },
      { n: "Pulled Pork Sliders (3)", p: 499, v: false, d: "Slow-smoked pulled pork, slaw, brioche.", i: "burger" },
      { n: "Grilled Cottage Cheese Steak", p: 449, v: true, d: "Paneer steak with peppercorn sauce and mash.", i: "grill" },
      { n: "BBQ Chicken Steak", p: 549, v: false, d: "Chargrilled chicken breast, smoked BBQ jus.", i: "grill", b: true },
      { n: "Lamb Chops", p: 899, v: false, d: "Rosemary lamb chops with roast veggies.", i: "grill" },
    ]},
    { name: "Burgers", items: [
      { n: "Smokehouse Beef-style Burger", p: 499, v: false, d: "Chicken & lamb blend patty, smoked cheddar.", i: "burger", variant: "burger", addons: ["burgerExtras"] },
      { n: "Portobello Burger", p: 429, v: true, d: "Grilled portobello, garlic aioli.", i: "burger", addons: ["burgerExtras"] },
    ]},
    { name: "Sides", items: [
      { n: "Truffle Fries", p: 299, v: true, d: "Parmesan and truffle oil.", i: "burger", b: true },
      { n: "Mac & Cheese", p: 329, v: true, d: "Baked with three cheeses.", i: "pasta" },
      { n: "Corn on the Cob", p: 199, v: true, d: "Chipotle butter and lime.", i: "grill" },
    ]},
    { name: "Desserts", items: [
      { n: "Pecan Pie", p: 299, v: true, egg: true, d: "With vanilla ice cream.", i: "dessert", temp: true },
      { n: "Brownie Sundae", p: 279, v: true, egg: true, d: "Warm brownie, ice cream, fudge.", i: "dessert", b: true, temp: true },
    ]},
  ],
  chinese: [
    { name: "Soups", items: [
      { n: "Hot & Sour Soup (Veg)", p: 139, v: true, d: "Spicy, tangy and warming.", i: "chinese" },
      { n: "Manchow Soup (Chicken)", p: 159, v: false, d: "With crispy noodles on top.", i: "chinese" },
      { n: "Lemon Coriander Soup", p: 139, v: true, d: "Light and refreshing.", i: "chinese" },
    ]},
    { name: "Starters", items: [
      { n: "Chilli Paneer Dry", p: 249, v: true, d: "Crispy paneer with peppers in chilli-soy.", i: "chinese", b: true, t: ["spicy"] },
      { n: "Crispy Honey Chilli Potato", p: 199, v: true, d: "Sweet, spicy and crunchy.", i: "chinese", b: true },
      { n: "Chilli Chicken Dry", p: 279, v: false, d: "Indo-Chinese classic.", i: "chinese", b: true, t: ["spicy"] },
      { n: "Dragon Chicken", p: 299, v: false, d: "Fiery, tossed with cashews.", i: "chinese", t: ["spicy"] },
      { n: "Veg Spring Rolls", p: 179, v: true, d: "Crispy rolls with sweet chilli dip.", i: "chinese" },
      { n: "Salt & Pepper Prawns", p: 369, v: false, d: "Wok-tossed with garlic and chilli.", i: "seafood" },
    ]},
    { name: "Noodles & Rice", items: [
      { n: "Veg Hakka Noodles", p: 199, v: true, d: "Wok-tossed noodles with vegetables.", i: "chinese", b: true, addons: ["spice"] },
      { n: "Chicken Schezwan Noodles", p: 249, v: false, d: "Spicy Schezwan sauce.", i: "chinese", addons: ["spice"] },
      { n: "Veg Fried Rice", p: 189, v: true, d: "Classic wok-fried rice.", i: "chinese" },
      { n: "Egg Fried Rice", p: 209, v: false, egg: true, d: "With scrambled egg and spring onion.", i: "chinese" },
      { n: "Chicken Triple Schezwan Rice", p: 289, v: false, d: "Rice, noodles and gravy in one.", i: "chinese", b: true },
    ]},
    { name: "Main Course", items: [
      { n: "Veg Manchurian Gravy", p: 219, v: true, d: "Veg balls in garlicky gravy.", i: "chinese" },
      { n: "Kung Pao Chicken", p: 299, v: false, d: "With peanuts and dried chillies.", i: "chinese" },
    ]},
  ],
  asian: [
    { name: "Bao & Dim Sum", items: [
      { n: "Crispy Tofu Bao (2)", p: 279, v: true, d: "Fluffy bao with sriracha mayo.", i: "momo", b: true },
      { n: "Pork-style Chicken Belly Bao (2)", p: 329, v: false, d: "Braised chicken thigh, pickled cucumber.", i: "momo" },
      { n: "Edamame Truffle Dumplings (6)", p: 299, v: true, d: "Steamed, with chilli oil.", i: "momo", b: true },
      { n: "Chicken Sui Mai (6)", p: 319, v: false, d: "Open-topped steamed dumplings.", i: "momo" },
    ]},
    { name: "Bowls", items: [
      { n: "Thai Green Curry Bowl", p: 349, v: true, d: "With jasmine rice.", i: "bowl", variant: "bowl" },
      { n: "Chicken Katsu Curry", p: 399, v: false, d: "Panko chicken, Japanese curry, rice.", i: "bowl", b: true, variant: "bowl" },
      { n: "Pad Thai Noodles", p: 329, v: true, d: "Tamarind, peanuts, bean sprouts.", i: "chinese" },
      { n: "Chicken Ramen", p: 399, v: false, d: "Rich broth, soft egg, nori.", i: "chinese", egg: true },
      { n: "Korean Bibimbap", p: 369, v: true, d: "Rice, veggies, gochujang, sesame.", i: "bowl" },
    ]},
    { name: "Desserts", items: [
      { n: "Mango Sticky Rice", p: 249, v: true, d: "Coconut sticky rice with fresh mango.", i: "dessert" },
      { n: "Matcha Ice Cream", p: 199, v: true, d: "Two scoops.", i: "icecream", temp: true },
    ]},
  ],
  momo: [
    { name: "Momos", items: [
      { n: "Veg Steamed Momos (8)", p: 119, v: true, d: "With fiery red chutney.", i: "momo", b: true },
      { n: "Chicken Steamed Momos (8)", p: 149, v: false, d: "Juicy chicken filling.", i: "momo", b: true },
      { n: "Paneer Fried Momos (8)", p: 149, v: true, d: "Golden fried.", i: "momo" },
      { n: "Chicken Kurkure Momos (8)", p: 179, v: false, d: "Crunchy cornflake coating.", i: "momo", b: true },
      { n: "Tandoori Momos (8)", p: 189, v: false, d: "Marinated and grilled.", i: "momo" },
      { n: "Jhol Momos (8)", p: 169, v: true, d: "Nepali style, in a spicy sesame broth.", i: "momo" },
    ]},
    { name: "Thukpa & Noodles", items: [
      { n: "Veg Thukpa", p: 159, v: true, d: "Tibetan noodle soup.", i: "chinese" },
      { n: "Chicken Thukpa", p: 189, v: false, d: "Hearty noodle soup.", i: "chinese" },
      { n: "Chilli Garlic Noodles", p: 169, v: true, d: "Wok-tossed.", i: "chinese" },
    ]},
    { name: "Sides", items: [
      { n: "Chilli Potato", p: 139, v: true, d: "Crispy and saucy.", i: "chinese" },
      { n: "Lemon Iced Tea", p: 79, v: true, d: "House brewed.", i: "shake", temp: true },
    ]},
  ],
  southIndian: [
    { name: "Breakfast", from: "07:00", to: "11:30", items: [
      { n: "Idli Sambar (2 pc)", p: 69, v: true, d: "Steamed rice cakes with sambar and chutneys.", i: "dosa", b: true },
      { n: "Medu Vada (2 pc)", p: 79, v: true, d: "Crispy lentil doughnuts.", i: "dosa" },
      { n: "Upma", p: 69, v: true, d: "Semolina with veggies and curry leaves.", i: "dosa" },
      { n: "Pongal", p: 89, v: true, d: "Rice and moong dal with pepper and ghee.", i: "dosa" },
    ]},
    { name: "Dosas", items: [
      { n: "Masala Dosa", p: 109, v: true, d: "Crisp dosa with potato masala.", i: "dosa", b: true, variant: "dosa" },
      { n: "Mysore Masala Dosa", p: 129, v: true, d: "With spicy red chutney spread.", i: "dosa", b: true, variant: "dosa", t: ["spicy"] },
      { n: "Rava Onion Dosa", p: 129, v: true, d: "Lacy semolina dosa with onions.", i: "dosa", variant: "dosa" },
      { n: "Paper Plain Dosa", p: 99, v: true, d: "Extra long and crisp.", i: "dosa", variant: "dosa" },
      { n: "Cheese Chilli Dosa", p: 149, v: true, d: "Loaded with cheese and green chillies.", i: "dosa" },
      { n: "Set Dosa (3 pc)", p: 109, v: true, d: "Soft, spongy dosas with sagu.", i: "dosa" },
    ]},
    { name: "Uttapam & More", items: [
      { n: "Onion Tomato Uttapam", p: 119, v: true, d: "Thick pancake with toppings.", i: "dosa" },
      { n: "Lemon Rice", p: 99, v: true, d: "Tangy tempered rice.", i: "dosa" },
      { n: "Curd Rice", p: 99, v: true, d: "Cooling, with pomegranate.", i: "dosa" },
      { n: "Mini Meals", p: 169, v: true, d: "Rice, sambar, rasam, poriyal, curd and papad.", i: "thali", b: true },
    ]},
    { name: "Beverages", items: [
      { n: "Filter Coffee", p: 49, v: true, d: "Strong decoction with frothy milk.", i: "coffee", b: true },
      { n: "Masala Chaas", p: 45, v: true, d: "Spiced buttermilk.", i: "shake" },
    ]},
  ],
  thali: [
    { name: "Thalis", items: [
      { n: "Maharashtrian Thali", p: 249, v: true, d: "Bhakri, pithla, bharli vangi, varan bhaat, koshimbir and shrikhand.", i: "thali", b: true, variant: "thali", addons: ["thaliExtras"] },
      { n: "Gujarati Thali", p: 279, v: true, d: "Rotli, dal, kadhi, two shaaks, farsan, rice and sweet.", i: "thali", b: true, variant: "thali", addons: ["thaliExtras"] },
      { n: "Punjabi Thali", p: 269, v: true, d: "Paneer, dal makhani, two rotis, rice and gulab jamun.", i: "thali", variant: "thali", addons: ["thaliExtras"] },
      { n: "Mini Thali", p: 169, v: true, d: "Dal, sabzi, 3 chapatis and rice.", i: "thali", addons: ["thaliExtras"] },
      { n: "Jain Thali", p: 259, v: true, d: "No onion, no garlic, no root vegetables.", i: "thali", variant: "thali" },
    ]},
    { name: "Maharashtrian Specials", items: [
      { n: "Puran Poli (2 pc)", p: 129, v: true, d: "Sweet lentil-stuffed flatbread with ghee.", i: "thali", b: true },
      { n: "Pithla Bhakri", p: 149, v: true, d: "Gram flour curry with jowar bhakri.", i: "thali" },
      { n: "Sabudana Khichdi", p: 99, v: true, d: "Sago with peanuts. A Pune favourite.", i: "street" },
      { n: "Kothimbir Vadi", p: 109, v: true, d: "Crispy coriander fritters.", i: "street" },
      { n: "Masale Bhaat", p: 149, v: true, d: "Spiced rice with goda masala.", i: "biryani" },
    ]},
    { name: "Sweets", items: [
      { n: "Shrikhand", p: 89, v: true, d: "Saffron-cardamom strained yoghurt.", i: "dessert", temp: true },
      { n: "Aamras (seasonal)", p: 129, v: true, d: "Fresh alphonso mango pulp.", i: "dessert", temp: true },
      { n: "Modak (2 pc)", p: 99, v: true, d: "Steamed coconut-jaggery dumplings.", i: "dessert" },
    ]},
  ],
  street: [
    { name: "Pav Specials", items: [
      { n: "Pav Bhaji", p: 149, v: true, d: "Buttery mashed vegetable curry with soft pav.", i: "street", b: true },
      { n: "Vada Pav (2 pc)", p: 59, v: true, d: "Mumbai's favourite, with garlic chutney.", i: "street", b: true },
      { n: "Misal Pav", p: 119, v: true, d: "Spicy sprouts curry topped with farsan. Pune style.", i: "street", b: true, t: ["spicy"] },
      { n: "Dabeli", p: 69, v: true, d: "Kutchi spiced potato in pav with peanuts.", i: "street" },
      { n: "Cheese Pav Bhaji", p: 179, v: true, d: "Topped with grated cheese.", i: "street" },
    ]},
    { name: "Chaat", items: [
      { n: "Pani Puri (8 pc)", p: 69, v: true, d: "Tangy, spicy water with crisp puris.", i: "street" },
      { n: "Sev Puri", p: 79, v: true, d: "Topped with chutneys and sev.", i: "street" },
      { n: "Dahi Puri", p: 89, v: true, d: "Sweet curd and chutneys.", i: "street" },
      { n: "Samosa Chaat", p: 99, v: true, d: "Crushed samosa with chole and chutneys.", i: "street", b: true },
      { n: "Ragda Pattice", p: 99, v: true, d: "Potato patties with white pea curry.", i: "street" },
    ]},
    { name: "Snacks", items: [
      { n: "Samosa (2 pc)", p: 49, v: true, d: "Crisp pastry with spiced potato.", i: "street" },
      { n: "Kanda Bhaji", p: 79, v: true, d: "Onion fritters. Perfect with chai.", i: "street" },
      { n: "Bombay Sandwich", p: 99, v: true, d: "Grilled with veggies and green chutney.", i: "street" },
    ]},
    { name: "Beverages", items: [
      { n: "Cutting Chai", p: 25, v: true, d: "Strong, sweet and gingery.", i: "coffee", b: true },
      { n: "Kokum Sharbat", p: 49, v: true, d: "Cooling Konkan drink.", i: "shake" },
      { n: "Mango Lassi", p: 89, v: true, d: "Thick and sweet.", i: "shake", temp: true },
    ]},
  ],
  rolls: [
    { name: "Rolls", items: [
      { n: "Chicken Tikka Roll", p: 159, v: false, d: "Tandoori chicken, onions, mint mayo in a paratha.", i: "rolls", b: true, addons: ["dips"] },
      { n: "Paneer Tikka Roll", p: 149, v: true, d: "Grilled paneer with tangy chutney.", i: "rolls", b: true, addons: ["dips"] },
      { n: "Egg Roll", p: 99, v: false, egg: true, d: "Kolkata-style egg-coated paratha.", i: "rolls" },
      { n: "Double Egg Chicken Roll", p: 179, v: false, egg: true, d: "Best of both.", i: "rolls" },
      { n: "Mutton Seekh Roll", p: 199, v: false, d: "Smoky seekh kebab wrapped up.", i: "rolls" },
      { n: "Aloo Masala Roll", p: 99, v: true, d: "Spiced potato with onions.", i: "rolls" },
      { n: "Mushroom Cheese Roll", p: 149, v: true, d: "Sautéed mushrooms and cheese.", i: "rolls" },
      { n: "Falafel Wrap", p: 169, v: true, d: "Falafel, hummus, pickled veggies.", i: "rolls" },
    ]},
    { name: "Combos", items: [
      { n: "Roll + Fries + Drink", p: 249, v: false, d: "Any chicken roll with fries and a drink.", i: "rolls", b: true },
      { n: "Veg Roll Combo", p: 219, v: true, d: "Any veg roll with fries and a drink.", i: "rolls" },
    ]},
    { name: "Sides", items: [
      { n: "Masala Fries", p: 99, v: true, d: "Tossed in chaat masala.", i: "burger" },
      { n: "Lime Soda", p: 59, v: true, d: "Sweet or salted.", i: "shake" },
    ]},
  ],
  healthy: [
    { name: "Power Bowls", items: [
      { n: "Grilled Paneer Protein Bowl", p: 329, v: true, d: "Brown rice, grilled paneer, chickpeas, greens and tahini.", i: "bowl", b: true, variant: "bowl", addons: ["boost"], nut: [520, 34, 48, 20, 420] },
      { n: "Chicken Quinoa Bowl", p: 369, v: false, d: "Herb chicken, quinoa, roasted veggies, lemon dressing.", i: "bowl", b: true, variant: "bowl", addons: ["boost"], nut: [480, 42, 40, 14, 400] },
      { n: "Tofu Teriyaki Bowl", p: 319, v: true, d: "Teriyaki tofu, edamame, red rice, sesame.", i: "bowl", variant: "bowl", addons: ["boost"], nut: [460, 26, 52, 15, 380] },
      { n: "Egg White Burrito Bowl", p: 299, v: false, egg: true, d: "Egg whites, black beans, corn salsa, brown rice.", i: "bowl", addons: ["boost"], nut: [430, 30, 50, 9, 380] },
      { n: "Millet Khichdi Bowl", p: 249, v: true, d: "Foxtail millet, moong dal, ghee tadka.", i: "bowl", nut: [390, 15, 58, 10, 350] },
    ]},
    { name: "Salads", items: [
      { n: "Greek Salad", p: 279, v: true, d: "Feta, olives, cucumber, tomato and oregano.", i: "salad", nut: [290, 11, 14, 21, 280] },
      { n: "Grilled Chicken Caesar", p: 329, v: false, d: "Romaine, parmesan, light Caesar dressing.", i: "salad", b: true, addons: ["boost"], nut: [360, 36, 12, 18, 320] },
      { n: "Sprouts & Pomegranate Salad", p: 219, v: true, d: "Moong sprouts, pomegranate, lime.", i: "salad", nut: [210, 13, 30, 4, 260] },
      { n: "Quinoa Avocado Salad", p: 349, v: true, d: "Quinoa, avocado, cherry tomatoes, seeds.", i: "salad", nut: [410, 12, 38, 24, 300] },
    ]},
    { name: "Wraps & Sandwiches", items: [
      { n: "Multigrain Chicken Wrap", p: 249, v: false, d: "Grilled chicken, hummus and greens.", i: "rolls", nut: [420, 33, 38, 14, 280] },
      { n: "Paneer Bhurji Sandwich", p: 219, v: true, d: "On multigrain bread.", i: "breakfast", nut: [380, 22, 36, 16, 240] },
    ]},
    { name: "Smoothies", items: [
      { n: "Peanut Butter Banana Smoothie", p: 199, v: true, d: "With oats and whey protein.", i: "shake", b: true, nut: [340, 24, 40, 10, 400], temp: true },
      { n: "Green Detox Smoothie", p: 179, v: true, d: "Spinach, apple, cucumber, ginger.", i: "shake", nut: [150, 3, 32, 1, 350], temp: true },
      { n: "Berry Blast Smoothie", p: 199, v: true, d: "Mixed berries and Greek yoghurt.", i: "shake", nut: [220, 12, 34, 3, 350], temp: true },
    ]},
  ],
  desserts: [
    { name: "Cakes", items: [
      { n: "Belgian Chocolate Truffle Cake", p: 549, v: true, egg: true, d: "Dense chocolate layers with ganache.", i: "cake", b: true, variant: "cake", addons: ["cakeMessage"] },
      { n: "Red Velvet Cake", p: 599, v: true, egg: true, d: "With cream cheese frosting.", i: "cake", b: true, variant: "cake", addons: ["cakeMessage"] },
      { n: "Eggless Pineapple Cake", p: 449, v: true, d: "Light sponge with pineapple and cream.", i: "cake", variant: "cake", addons: ["cakeMessage"] },
      { n: "Blueberry Cheesecake", p: 649, v: true, egg: true, d: "Baked New York style.", i: "cake", variant: "cake", temp: true },
      { n: "Rasmalai Cake", p: 699, v: true, d: "Fusion cake with saffron milk and pistachios.", i: "cake", variant: "cake", addons: ["cakeMessage"], temp: true },
    ]},
    { name: "Pastries & Brownies", items: [
      { n: "Choco Fudge Brownie", p: 119, v: true, egg: true, d: "Gooey centre, crackly top.", i: "dessert", b: true },
      { n: "Walnut Brownie", p: 129, v: true, egg: true, d: "Loaded with walnuts.", i: "dessert" },
      { n: "Black Forest Pastry", p: 109, v: true, egg: true, d: "Cherries and cream.", i: "cake", temp: true },
      { n: "Tiramisu Pastry", p: 149, v: true, egg: true, d: "Coffee and mascarpone.", i: "cake", temp: true },
      { n: "Chocolate Chip Cookies (4)", p: 149, v: true, d: "Eggless, baked fresh.", i: "dessert" },
    ]},
    { name: "Desserts", items: [
      { n: "Sizzling Brownie", p: 229, v: true, egg: true, d: "With vanilla ice cream and hot fudge.", i: "dessert", temp: true },
      { n: "Gulab Jamun Cheesecake Jar", p: 199, v: true, d: "Indian-fusion dessert jar.", i: "dessert", temp: true },
      { n: "Nutella Waffle", p: 219, v: true, egg: true, d: "Belgian waffle with Nutella and banana.", i: "breakfast" },
    ]},
  ],
  icecream: [
    { name: "Scoops", items: [
      { n: "Belgian Chocolate (2 scoops)", p: 179, v: true, d: "Dark and rich.", i: "icecream", b: true, temp: true },
      { n: "Alphonso Mango (2 scoops)", p: 169, v: true, d: "Made with real Ratnagiri mangoes.", i: "icecream", b: true, temp: true },
      { n: "Tender Coconut (2 scoops)", p: 169, v: true, d: "Light and refreshing.", i: "icecream", temp: true },
      { n: "Salted Caramel (2 scoops)", p: 179, v: true, d: "Sweet and salty.", i: "icecream", temp: true },
      { n: "Sitaphal (2 scoops)", p: 179, v: true, d: "Seasonal custard apple.", i: "icecream", temp: true },
    ]},
    { name: "Sundaes", items: [
      { n: "Death by Chocolate", p: 299, v: true, egg: true, d: "Brownie, chocolate ice cream, fudge, nuts.", i: "icecream", b: true, temp: true },
      { n: "Banana Split", p: 269, v: true, d: "Three scoops, banana, cherries.", i: "icecream", temp: true },
      { n: "Falooda Sundae", p: 229, v: true, d: "Rose syrup, vermicelli, basil seeds, kulfi.", i: "icecream", temp: true },
    ]},
    { name: "Kulfi", items: [
      { n: "Malai Kulfi", p: 89, v: true, d: "Traditional slow-reduced milk kulfi.", i: "icecream", temp: true },
      { n: "Pista Kulfi", p: 99, v: true, d: "With crushed pistachios.", i: "icecream", temp: true },
    ]},
    { name: "Shakes", items: [
      { n: "Thick Chocolate Shake", p: 199, v: true, d: "Made with ice cream.", i: "shake", variant: "shake", temp: true },
      { n: "Strawberry Shake", p: 189, v: true, d: "Mahabaleshwar strawberries.", i: "shake", variant: "shake", temp: true },
    ]},
  ],
  cafe: [
    { name: "All-day Breakfast", items: [
      { n: "Classic Pancake Stack", p: 249, v: true, egg: true, d: "Maple syrup and berries.", i: "breakfast", b: true },
      { n: "Eggs Benedict", p: 329, v: false, egg: true, d: "Poached eggs, hollandaise, English muffin.", i: "breakfast" },
      { n: "Avocado Toast", p: 299, v: true, d: "Sourdough, smashed avocado, chilli flakes.", i: "breakfast", b: true },
      { n: "Masala Omelette", p: 179, v: false, egg: true, d: "Three eggs with onions and chillies.", i: "breakfast" },
      { n: "Granola Yoghurt Bowl", p: 229, v: true, d: "House granola, honey, fruit.", i: "bowl", nut: [330, 14, 44, 11, 280] },
      { n: "Big Breakfast Platter", p: 449, v: false, egg: true, d: "Eggs, sausages, hash brown, beans, toast.", i: "breakfast" },
    ]},
    { name: "Sandwiches", items: [
      { n: "Grilled Cheese Sandwich", p: 199, v: true, d: "Three cheeses on sourdough.", i: "breakfast" },
      { n: "Chicken Club Sandwich", p: 279, v: false, egg: true, d: "Triple-decker with fries.", i: "breakfast", b: true },
      { n: "Pesto Veg Panini", p: 249, v: true, d: "Grilled veggies and pesto.", i: "breakfast" },
    ]},
    { name: "Coffee & Tea", items: [
      { n: "Cappuccino", p: 159, v: true, d: "Double shot, velvety milk.", i: "coffee", b: true },
      { n: "Cold Brew", p: 189, v: true, d: "Steeped for 18 hours.", i: "coffee", temp: true },
      { n: "Masala Chai", p: 79, v: true, d: "With ginger and cardamom.", i: "coffee" },
      { n: "Hazelnut Frappe", p: 219, v: true, d: "Blended with ice.", i: "coffee", temp: true },
    ]},
    { name: "Bakes", items: [
      { n: "Butter Croissant", p: 129, v: true, d: "Flaky and buttery.", i: "breakfast" },
      { n: "Banana Walnut Cake Slice", p: 119, v: true, egg: true, d: "Moist tea cake.", i: "cake" },
    ]},
  ],
  shakes: [
    { name: "Thick Shakes", items: [
      { n: "Oreo Overload", p: 189, v: true, d: "Crushed cookies and vanilla ice cream.", i: "shake", b: true, variant: "shake", temp: true },
      { n: "KitKat Shake", p: 199, v: true, d: "Wafer chocolate goodness.", i: "shake", variant: "shake", temp: true },
      { n: "Nutella Shake", p: 219, v: true, d: "Hazelnut chocolate.", i: "shake", b: true, variant: "shake", temp: true },
      { n: "Mango Mastani", p: 179, v: true, d: "Pune's own mango shake with ice cream and dry fruits.", i: "shake", b: true, variant: "shake", temp: true },
      { n: "Butterscotch Shake", p: 169, v: true, d: "Crunchy praline bits.", i: "shake", variant: "shake", temp: true },
    ]},
    { name: "Coolers", items: [
      { n: "Watermelon Mint Cooler", p: 129, v: true, d: "Fresh and light.", i: "shake", temp: true },
      { n: "Virgin Mojito", p: 139, v: true, d: "Lime, mint and soda.", i: "shake" },
      { n: "Blue Lagoon", p: 139, v: true, d: "Citrusy blue curaçao mocktail.", i: "shake" },
    ]},
    { name: "Snacks", items: [
      { n: "Peri Peri Fries", p: 129, v: true, d: "Spicy and crispy.", i: "burger" },
      { n: "Cheese Corn Sandwich", p: 149, v: true, d: "Grilled.", i: "breakfast" },
      { n: "Waffle Bites", p: 149, v: true, egg: true, d: "With chocolate dip.", i: "breakfast" },
    ]},
  ],
  seafood: [
    { name: "Starters", items: [
      { n: "Bombil Fry", p: 299, v: false, d: "Crispy Bombay duck in rava coating.", i: "seafood", b: true },
      { n: "Surmai Rava Fry", p: 449, v: false, d: "King fish steak, semolina crusted.", i: "seafood", b: true },
      { n: "Prawns Koliwada", p: 399, v: false, d: "Batter-fried prawns, Koli style.", i: "seafood" },
      { n: "Tisrya Sukka", p: 349, v: false, d: "Clams with dry coconut masala.", i: "seafood" },
      { n: "Kolambi Fry", p: 379, v: false, d: "Pan-fried prawns.", i: "seafood" },
    ]},
    { name: "Thalis & Curries", items: [
      { n: "Malvani Fish Thali", p: 449, v: false, d: "Fish fry, fish curry, solkadhi, rice and bhakri.", i: "thali", b: true, variant: "thali" },
      { n: "Prawns Curry", p: 429, v: false, d: "Coconut-kokum gravy.", i: "seafood" },
      { n: "Chicken Malvani", p: 349, v: false, d: "Fiery Malvani masala.", i: "curry", t: ["spicy"] },
      { n: "Goan Fish Curry", p: 399, v: false, d: "Tangy, with kokum and coconut.", i: "seafood" },
      { n: "Veg Kolhapuri", p: 229, v: true, d: "For the vegetarians at the table.", i: "curry" },
    ]},
    { name: "Rice & Breads", items: [
      { n: "Steamed Rice", p: 99, v: true, d: "", i: "biryani" },
      { n: "Tandlachi Bhakri", p: 39, v: true, d: "Rice flour flatbread.", i: "thali" },
      { n: "Amboli", p: 49, v: true, d: "Malvani pancake.", i: "dosa" },
    ]},
    { name: "Drinks", items: [
      { n: "Solkadhi", p: 69, v: true, d: "Kokum and coconut milk digestive.", i: "shake", b: true },
    ]},
  ],
};

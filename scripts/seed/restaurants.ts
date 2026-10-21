export type Area = "Koregaon Park" | "Baner" | "Kothrud" | "Viman Nagar" | "Hinjewadi";

export const areas: Record<Area, { lat: number; lng: number; pincode: string; road: string }> = {
  "Koregaon Park": { lat: 18.5362, lng: 73.894, pincode: "411001", road: "North Main Road" },
  Baner: { lat: 18.559, lng: 73.7868, pincode: "411045", road: "Baner Road" },
  Kothrud: { lat: 18.5074, lng: 73.8077, pincode: "411038", road: "Karve Road" },
  "Viman Nagar": { lat: 18.5679, lng: 73.9143, pincode: "411014", road: "Nagar Road" },
  Hinjewadi: { lat: 18.5912, lng: 73.7389, pincode: "411057", road: "Phase 1 Main Road" },
};

export type RestaurantDef = {
  name: string;
  area: Area;
  menus: string[];
  cuisines: string[];
  cft: number; // cost for two, rupees
  rating: number;
  veg?: boolean;
  gold?: boolean;
  dining?: boolean;
  outdoor?: boolean;
  alcohol?: boolean;
  healthy?: boolean;
  owner?: string; // demo owner email
  offline?: boolean;
  isNew?: boolean;
  featured?: boolean;
  prep?: number;
  description: string;
};

export const restaurants: RestaurantDef[] = [
  // Koregaon Park
  { name: "Saffron Courtyard", area: "Koregaon Park", menus: ["northIndian", "mughlai"], cuisines: ["North Indian", "Mughlai", "Kebabs"], cft: 900, rating: 4.4, gold: true, dining: true, outdoor: true, alcohol: true, owner: "owner@demo.in", featured: true, prep: 20, description: "Courtyard dining with slow-cooked curries, tandoor specials and live ghazals on weekends." },
  { name: "The Bombay Bowl", area: "Koregaon Park", menus: ["healthy", "cafe"], cuisines: ["Healthy", "Salads", "Continental"], cft: 600, rating: 4.5, healthy: true, gold: true, prep: 12, description: "Macro-balanced bowls and salads made fresh to order." },
  { name: "Napoli Fire Oven", area: "Koregaon Park", menus: ["pizza", "italian"], cuisines: ["Pizza", "Italian", "Pasta"], cft: 800, rating: 4.3, dining: true, alcohol: true, owner: "owner@demo.in", prep: 18, description: "Neapolitan pies from a 450°C wood-fired oven." },
  { name: "Burger Republic", area: "Koregaon Park", menus: ["burger", "shakes"], cuisines: ["Burger", "American", "Fast Food"], cft: 500, rating: 4.1, prep: 12, description: "Smash burgers, loaded fries and thick shakes." },
  { name: "Dragon Wok", area: "Koregaon Park", menus: ["chinese"], cuisines: ["Chinese", "Asian"], cft: 600, rating: 4.0, prep: 15, description: "Indo-Chinese favourites, wok-tossed on high flame." },
  { name: "Sweet Tooth Patisserie", area: "Koregaon Park", menus: ["desserts", "icecream"], cuisines: ["Desserts", "Cake", "Bakery"], cft: 450, rating: 4.6, gold: true, prep: 10, description: "Celebration cakes, brownies and French-style pastries." },
  { name: "Malvan Tadka", area: "Koregaon Park", menus: ["seafood", "northIndian"], cuisines: ["Seafood", "Malvani", "Konkan"], cft: 750, rating: 3.9, dining: true, prep: 22, description: "Coastal Konkan flavours with fresh catch every morning." },
  { name: "Chai & Bun Co.", area: "Koregaon Park", menus: ["cafe", "street"], cuisines: ["Cafe", "Street Food", "Beverages"], cft: 300, rating: 4.2, offline: true, prep: 8, description: "Irani-café nostalgia: bun maska, chai and snacks." },
  // Baner
  { name: "Baner Biryani House", area: "Baner", menus: ["biryani"], cuisines: ["Biryani", "Hyderabadi", "North Indian"], cft: 550, rating: 4.3, gold: true, owner: "owner2@demo.in", featured: true, prep: 18, description: "Hyderabadi kacchi dum biryani, cooked in copper handis." },
  { name: "Annapurna Thali", area: "Baner", menus: ["thali", "southIndian"], cuisines: ["Thali", "Maharashtrian", "Gujarati"], cft: 400, rating: 4.5, veg: true, dining: true, prep: 12, description: "Wholesome home-style thalis, pure vegetarian." },
  { name: "Roll Street", area: "Baner", menus: ["rolls", "street"], cuisines: ["Rolls", "Street Food", "Fast Food"], cft: 250, rating: 4.0, prep: 10, description: "Kolkata-style kathi rolls, wrapped hot." },
  { name: "Pasta La Vista", area: "Baner", menus: ["italian", "pizza"], cuisines: ["Italian", "Pasta", "Continental"], cft: 700, rating: 4.2, dining: true, prep: 16, description: "Fresh pasta, risotto and classic Italian desserts." },
  { name: "Udupi Upahar", area: "Baner", menus: ["southIndian"], cuisines: ["South Indian", "Breakfast"], cft: 250, rating: 4.4, veg: true, prep: 10, description: "Crisp dosas and strong filter coffee since 1998." },
  { name: "Kebab Junction", area: "Baner", menus: ["mughlai"], cuisines: ["Mughlai", "Kebabs", "Biryani"], cft: 650, rating: 4.1, prep: 20, description: "Charcoal-grilled kebabs and Awadhi curries." },
  { name: "Momo Mantra", area: "Baner", menus: ["momo", "chinese"], cuisines: ["Tibetan", "Momos", "Chinese"], cft: 300, rating: 4.0, prep: 12, description: "Steamed, fried, kurkure and jhol momos." },
  { name: "Frozen Spoon", area: "Baner", menus: ["icecream", "shakes"], cuisines: ["Ice Cream", "Desserts"], cft: 250, rating: 4.3, veg: true, prep: 5, description: "Small-batch ice creams with seasonal Indian fruits." },
  // Kothrud
  { name: "Shree Krishna Bhojanalay", area: "Kothrud", menus: ["thali", "street"], cuisines: ["Thali", "Maharashtrian"], cft: 350, rating: 4.6, veg: true, dining: true, featured: true, prep: 10, description: "A Kothrud institution for unlimited Maharashtrian thalis." },
  { name: "Punjabi Tadka", area: "Kothrud", menus: ["northIndian"], cuisines: ["North Indian", "Punjabi"], cft: 500, rating: 4.0, prep: 18, description: "Dhaba-style dal, paneer and tandoori rotis." },
  { name: "Misal Junction", area: "Kothrud", menus: ["street"], cuisines: ["Street Food", "Maharashtrian", "Snacks"], cft: 200, rating: 4.5, veg: true, prep: 8, description: "Fiery Puneri misal and buttery pav bhaji." },
  { name: "Pizza Pronto", area: "Kothrud", menus: ["pizza"], cuisines: ["Pizza", "Fast Food"], cft: 450, rating: 3.8, prep: 15, description: "Quick, cheesy pizzas at friendly prices." },
  { name: "Biryani Badshah", area: "Kothrud", menus: ["biryani"], cuisines: ["Biryani", "Mughlai"], cft: 500, rating: 4.2, gold: true, prep: 18, description: "Royal dum biryanis and kebabs." },
  { name: "Green Leaf Kitchen", area: "Kothrud", menus: ["healthy", "cafe"], cuisines: ["Healthy", "Vegan", "Salads"], cft: 550, rating: 4.4, veg: true, healthy: true, prep: 12, description: "Plant-forward bowls, salads and smoothies." },
  { name: "Dakshin Dosa Corner", area: "Kothrud", menus: ["southIndian"], cuisines: ["South Indian", "Dosa"], cft: 250, rating: 4.3, veg: true, prep: 10, description: "Twenty-two kinds of dosa, one perfect sambar." },
  { name: "Cake Studio", area: "Kothrud", menus: ["desserts", "shakes"], cuisines: ["Cake", "Desserts", "Bakery"], cft: 500, rating: 4.4, prep: 12, description: "Custom cakes for every celebration." },
  // Viman Nagar
  { name: "Green Bowl Co.", area: "Viman Nagar", menus: ["healthy", "cafe"], cuisines: ["Healthy", "Salads", "Bowls"], cft: 650, rating: 4.6, healthy: true, gold: true, owner: "owner3@demo.in", featured: true, prep: 12, description: "High-protein bowls with calorie counts on every dish." },
  { name: "Smokehouse Grill", area: "Viman Nagar", menus: ["bbq", "burger"], cuisines: ["American", "BBQ", "Burger"], cft: 1200, rating: 4.3, dining: true, alcohol: true, outdoor: true, prep: 22, description: "Low-and-slow smoked meats and craft burgers." },
  { name: "Lucknowi Dastarkhwan", area: "Viman Nagar", menus: ["mughlai"], cuisines: ["Mughlai", "Biryani", "Awadhi"], cft: 800, rating: 4.4, dining: true, gold: true, prep: 20, description: "Galouti, nihari and Awadhi biryani, the Lucknow way." },
  { name: "Bao & Bowl", area: "Viman Nagar", menus: ["asian", "chinese"], cuisines: ["Asian", "Japanese", "Chinese"], cft: 700, rating: 4.1, prep: 15, description: "Bao, dumplings and comforting Asian bowls." },
  { name: "Mumbai Pav Co.", area: "Viman Nagar", menus: ["street"], cuisines: ["Street Food", "Pav Bhaji", "Chaat"], cft: 200, rating: 4.2, veg: true, prep: 8, description: "Mumbai street food, cooked clean." },
  { name: "The Breakfast Club", area: "Viman Nagar", menus: ["cafe"], cuisines: ["Cafe", "Breakfast", "Continental"], cft: 600, rating: 4.3, dining: true, outdoor: true, prep: 12, description: "All-day breakfast and specialty coffee." },
  { name: "Konkan Kinara", area: "Viman Nagar", menus: ["seafood", "northIndian"], cuisines: ["Seafood", "Goan", "Konkan"], cft: 900, rating: 4.0, offline: true, dining: true, alcohol: true, prep: 22, description: "Goan and Konkan seafood with a coastal vibe." },
  { name: "Shake It Off", area: "Viman Nagar", menus: ["shakes", "icecream"], cuisines: ["Beverages", "Shakes", "Desserts"], cft: 300, rating: 4.1, veg: true, prep: 6, description: "Thick shakes and Pune's famous Mango Mastani." },
  // Hinjewadi
  { name: "Techie's Tiffin", area: "Hinjewadi", menus: ["thali", "northIndian"], cuisines: ["North Indian", "Thali", "Home Food"], cft: 300, rating: 3.9, prep: 12, description: "Ghar-jaisa khana for long workdays." },
  { name: "Hinjewadi Biryani Co.", area: "Hinjewadi", menus: ["biryani"], cuisines: ["Biryani", "Hyderabadi"], cft: 450, rating: 4.0, prep: 18, description: "Big portions of spicy dum biryani." },
  { name: "Slice of Italy", area: "Hinjewadi", menus: ["pizza"], cuisines: ["Pizza", "Italian"], cft: 600, rating: 4.2, gold: true, prep: 15, description: "Thin-crust pizzas and garlic bread." },
  { name: "Wrap It Up", area: "Hinjewadi", menus: ["rolls", "burger"], cuisines: ["Rolls", "Wraps", "Fast Food"], cft: 300, rating: 3.8, prep: 10, description: "Wraps and rolls for lunch on the go." },
  { name: "Protein Pantry", area: "Hinjewadi", menus: ["healthy", "cafe"], cuisines: ["Healthy", "Salads", "Bowls"], cft: 500, rating: 4.3, healthy: true, prep: 12, description: "Gym-friendly meals with full macros." },
  { name: "Chinese Junction", area: "Hinjewadi", menus: ["chinese"], cuisines: ["Chinese", "Asian"], cft: 400, rating: 3.7, prep: 14, description: "Spicy Indo-Chinese for the late-night crowd." },
  { name: "Idli Factory", area: "Hinjewadi", menus: ["southIndian"], cuisines: ["South Indian", "Breakfast"], cft: 200, rating: 4.1, veg: true, prep: 8, description: "Soft idlis and crisp vadas, fast." },
  { name: "Desi Burger Adda", area: "Hinjewadi", menus: ["burger", "rolls"], cuisines: ["Burger", "Fast Food", "Street Food"], cft: 350, rating: 3.9, isNew: true, prep: 10, description: "Indian-style burgers with bold chutneys." },
];

/** Pending application for the admin approval demo. */
export const pendingRestaurant: RestaurantDef = {
  name: "Kolkata Kathi Co.", area: "Koregaon Park", menus: ["rolls", "street"], cuisines: ["Rolls", "Bengali", "Street Food"], cft: 300, rating: 0,
  owner: "newpartner@demo.in", prep: 10, description: "Authentic Kolkata kathi rolls with egg-coated parathas.",
};

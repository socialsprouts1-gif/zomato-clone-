/** Offline fallback for address search / reverse geocoding when OpenStreetMap is unreachable. */
export const puneLocalities: { name: string; lat: number; lng: number; pincode: string }[] = [
  { name: "Koregaon Park", lat: 18.5362, lng: 73.894, pincode: "411001" },
  { name: "Kalyani Nagar", lat: 18.5463, lng: 73.9033, pincode: "411006" },
  { name: "Viman Nagar", lat: 18.5679, lng: 73.9143, pincode: "411014" },
  { name: "Kharadi", lat: 18.5515, lng: 73.9476, pincode: "411014" },
  { name: "Baner", lat: 18.559, lng: 73.7868, pincode: "411045" },
  { name: "Balewadi", lat: 18.5763, lng: 73.7792, pincode: "411045" },
  { name: "Aundh", lat: 18.5603, lng: 73.8074, pincode: "411007" },
  { name: "Pashan", lat: 18.5384, lng: 73.7929, pincode: "411021" },
  { name: "Kothrud", lat: 18.5074, lng: 73.8077, pincode: "411038" },
  { name: "Karve Nagar", lat: 18.4884, lng: 73.8203, pincode: "411052" },
  { name: "Deccan Gymkhana", lat: 18.5167, lng: 73.8411, pincode: "411004" },
  { name: "Shivajinagar", lat: 18.5308, lng: 73.8475, pincode: "411005" },
  { name: "FC Road", lat: 18.5236, lng: 73.8414, pincode: "411004" },
  { name: "Camp", lat: 18.5143, lng: 73.8784, pincode: "411001" },
  { name: "Hadapsar", lat: 18.5089, lng: 73.926, pincode: "411028" },
  { name: "Magarpatta", lat: 18.5157, lng: 73.9271, pincode: "411013" },
  { name: "Wakad", lat: 18.5987, lng: 73.7653, pincode: "411057" },
  { name: "Hinjewadi", lat: 18.5912, lng: 73.7389, pincode: "411057" },
  { name: "Pimple Saudagar", lat: 18.5987, lng: 73.7999, pincode: "411027" },
  { name: "Wanowrie", lat: 18.4886, lng: 73.9004, pincode: "411040" },
  { name: "Kondhwa", lat: 18.4637, lng: 73.8867, pincode: "411048" },
  { name: "Bavdhan", lat: 18.5135, lng: 73.7786, pincode: "411021" },
  { name: "Sinhagad Road", lat: 18.4757, lng: 73.8163, pincode: "411041" },
  { name: "Yerawada", lat: 18.5529, lng: 73.8854, pincode: "411006" },
  { name: "Swargate", lat: 18.5018, lng: 73.8636, pincode: "411042" },
];

export function nearestLocality(lat: number, lng: number) {
  let best = puneLocalities[0]!;
  let bestD = Infinity;
  for (const l of puneLocalities) {
    const d = (l.lat - lat) ** 2 + (l.lng - lng) ** 2;
    if (d < bestD) {
      best = l;
      bestD = d;
    }
  }
  return best;
}

import type { Enums } from "@/lib/supabase/database.types";

export const ROLE_LABEL: Record<Enums<"user_role">, string> = {
  customer: "Customer",
  restaurant_owner: "Restaurant owner",
  restaurant_staff: "Restaurant staff",
  rider: "Rider",
  admin: "Admin",
};

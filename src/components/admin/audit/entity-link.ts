/** Admin page for an audited entity, when there is one. */
export function auditEntityHref(entityType: string, entityId: string | null, details: unknown): string | null {
  // Config entities live on one admin page each.
  if (entityType === "banner" || entityType === "collection") return "/admin/content";
  if (entityType === "gold_plan") return "/admin/gold";
  if (entityType === "delivery_zone" || entityType === "platform_settings" || entityType === "fee_slab") return "/admin/settings";
  if (!entityId) return null;
  const id = encodeURIComponent(entityId);
  switch (entityType) {
    case "order":
      return `/admin/orders/${id}`;
    case "restaurant":
      return `/admin/restaurants/${id}`;
    case "rider":
      return `/admin/riders/${id}`;
    case "user":
    case "profile":
    case "customer":
      return `/admin/users/${id}`;
    case "coupon":
      return `/admin/coupons/${id}`;
    case "support_ticket":
      return `/admin/support/${id}`;
    case "payout":
      return `/admin/payouts/${id}`;
    case "payout_week":
      return `/admin/payouts?week=${id}`;
    case "event":
      return "/admin/rescue?tab=events";
    default: {
      const d = details as { payout_id?: unknown } | null;
      return typeof d?.payout_id === "string" ? `/admin/payouts/${d.payout_id}` : null;
    }
  }
}

export const auditEntityLabel = (entityType: string) => entityType.replaceAll("_", " ");

export const TICKET_STATUSES = ["open", "pending", "resolved"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const ticketStatusBadge: Record<TicketStatus, { label: string; hint: string; variant: "default" | "secondary" | "outline" | "success" | "destructive" }> = {
  open: { label: "Open", hint: "Waiting on support", variant: "default" },
  pending: { label: "Awaiting customer", hint: "Support replied", variant: "secondary" },
  resolved: { label: "Resolved", hint: "Closed", variant: "success" },
};

export const ticketCategoryLabel: Record<string, string> = {
  order: "Order",
  payment: "Payment",
  account: "Account",
  rider: "Delivery partner",
  restaurant: "Restaurant",
  other: "Other",
};

export const shortTicketId = (id: string) => `#${id.slice(0, 6).toUpperCase()}`;

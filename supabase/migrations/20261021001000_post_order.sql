-- Reorder needs the exact variant and add-on ids of each line.
alter table public.order_items add column if not exists variant_id uuid references public.item_variants (id) on delete set null;
create index if not exists order_items_variant_id_idx on public.order_items (variant_id);
comment on column public.order_items.addons is '[{id, name, price_paise}]';

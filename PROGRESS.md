# Progress

Ticked only when verified working (tests or manual check).

## 0. Foundation
- [x] Next.js 15 + TypeScript strict + pnpm
- [x] Tailwind + shadcn/ui theme (saffron, charcoal, off-white)
- [x] Brand config in `src/config/brand.ts`
- [x] Supabase clients (server, browser, middleware session refresh)
- [x] Layouts for customer, partner, rider and admin apps
- [x] Bottom tab bar on phones (customer, rider)
- [x] Demo Switcher shell
- [x] PWA manifest + icons
- [x] Playwright set up

## 3.1 Onboarding & account
- [x] Splash + location permission / map pick / address search
- [x] Phone + OTP login (demo 123456)
- [x] Email magic link
- [ ] Google login (built; needs Google provider enabled in Supabase to verify)
- [x] Profile (name, email, phone, avatar, dietary preference)
- [x] Saved addresses with map pin, flat/landmark, instructions
- [ ] Settings: notifications, dark mode, language, delete account
- [ ] Order history with hide/delete

## 3.2 Home & discovery
- [x] Location header
- [ ] Delivery / Dining Out / Live tabs
- [ ] Admin-managed banner carousel
- [ ] What's on your mind? cuisine carousel
- [ ] Filter chips (sort, rating, pure veg, offers, fast, under ₹300, cuisines, new)
- [ ] Veg Mode (global, persisted)
- [ ] Healthy Mode + Healthy Score
- [ ] Food Rescue card with countdown
- [ ] Recommended / Top rated / Trending / Collections sections
- [ ] Restaurant cards (all badges and states)
- [ ] Recently viewed strip

## 3.3 Search
- [ ] Debounced grouped search
- [ ] Recent + trending searches
- [ ] Dish-level results with add buttons
- [ ] Voice search
- [ ] Typo tolerance (pg_trgm)

## 3.4 Restaurant page
- [ ] Hero gallery + full info
- [ ] Offers strip
- [ ] Sticky category nav + Menu button
- [ ] In-menu search, veg and bestseller filters
- [ ] Menu item row with stepper
- [ ] Customisations bottom sheet (variants, add-ons, live price)
- [ ] Out-of-stock + category time windows
- [ ] Reviews tab with photos + AI summary
- [ ] Photos tab, Info tab with map
- [ ] Favourite + share
- [ ] Replace cart? dialog

## 3.5 Cart & checkout
- [ ] Floating View cart bar
- [ ] Cart page: steppers, edit customisation, cooking instructions, no cutlery
- [ ] Address selector + delivery instructions
- [ ] Schedule order (2h–2d)
- [ ] Rider tip
- [ ] Coupons with validation rules
- [ ] Server-side bill details
- [ ] Group order with live updates
- [ ] Razorpay test / COD / Wallet / split payment
- [ ] Order placed animation

## 3.6 Live tracking
- [ ] Status timeline
- [ ] Live map with moving rider + ETA
- [ ] Rider card, masked call, chat
- [ ] Delivery OTP
- [ ] Cancel rules (refund / Food Rescue)
- [ ] Help chat from tracking

## 3.7 Post-order
- [ ] Rate food and delivery separately
- [ ] Order details + PDF invoice
- [ ] Reorder
- [ ] Refund status

## 3.8 Dining Out
- [ ] Dine-in listing with filters
- [ ] Table booking
- [ ] Dining offers + pay bill with Gold discount

## 3.9 Gold
- [ ] Gold landing + plans (Razorpay test)
- [ ] Active badge, expiry, savings tracker

## 3.10 Healthy Subscriptions
- [ ] 5/10-day plans auto-creating scheduled orders

## 3.11 Money & engagement
- [ ] Wallet: balance, add money, history, refunds
- [ ] Referral codes + credits
- [ ] Favourites + custom shareable collections
- [ ] Notifications center + browser push
- [ ] Help center: FAQ, tickets, support chat
- [ ] Donation round-up at checkout

## 3.12 Live / Events
- [ ] Event cards → ticket booking → QR ticket

## 4. Restaurant partner
- [ ] Onboarding (pending → approved)
- [ ] Live orders with sound + notification, accept/reject/ready/handover, KOT
- [ ] Online/offline, busy, holidays
- [ ] Menu management (categories, items, variants, add-ons, stock, timings)
- [ ] Inventory with low-stock + auto out-of-stock
- [ ] Offers
- [ ] Ads campaigns
- [ ] Reviews + replies + AI summary
- [ ] Table bookings + tables with QR
- [ ] Business reports + CSV
- [ ] Payouts
- [ ] Multi-outlet switcher
- [ ] Staff management
- [ ] Auto-accept toggle

## 5. Rider
- [ ] Onboarding with documents
- [ ] Online/offline + live location
- [ ] Incoming request with 30s countdown
- [ ] Active delivery flow + Google Maps link + OTP + COD collect
- [ ] Masked call + chat
- [ ] Earnings + incentives
- [ ] Trip history, ratings, floating cash deposit
- [ ] SOS button
- [ ] Simulated rider auto-accept

## 6. Admin
- [ ] Overview dashboard with live map + charts
- [ ] Orders: search, detail, reassign, cancel/refund
- [ ] Restaurants: approve, edit, suspend, commission, feature
- [ ] Riders: approve, suspend, live location
- [ ] Users: block, wallet credits
- [ ] Coupons
- [ ] Banners & collections
- [ ] Gold plans + members
- [ ] Zones & fees + surge
- [ ] Support tickets
- [ ] Food Rescue log, donations, events
- [ ] Payouts generation
- [ ] Audit log
- [ ] Run full demo button

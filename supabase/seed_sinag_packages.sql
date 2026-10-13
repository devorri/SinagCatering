-- SINAG package catalog import
-- Paste this whole file into the Supabase SQL Editor and click Run.
-- It is safe to run again: the three package rows are updated in place.

begin;

-- Keep the complete flyer information in the catalog, not just a shortened menu.
alter table public.packages
  add column if not exists details jsonb not null default '{}'::jsonb;

-- Remove only the known placeholder records that were previously shipped with
-- the prototype. This does not touch real bookings or business-entered data.
delete from public.packages
where id in ('PKG-KIDDIE-01', 'PKG-CLASSIC-02', 'PKG-PREMIER-03');

delete from public.package_addons
where id in ('ADD-CANDY-01', 'ADD-HOST-02', 'ADD-DESSERT-03', 'ADD-MAIN-04', 'ADD-PASTA-05', 'ADD-DESSERT-06');

insert into public.packages (
  id, name, ideal_for, included_menu, default_pax, price_per_head,
  currency, base_price, tier_prices, details
)
values
  (
    'budget-basic',
    'Budgetarian Kids Party Package with Freebies',
    'Kids parties within the City of Baliwag area',
    '["4 main dishes", "Dessert and drinks", "Elegant buffet setup", "Food warmer or roll top with serving spoons", "Dinner plates, spoon and fork, glassware and pitcher", "Professional waiter services", "Fully dressed monoblock chairs", "Round tables with floor-length motif table cloth", "Decorated cake, gifts, and giveaways table", "Centerpiece for individual tables", "Ribbon for individual chairs", "Stage decor and backdrop", "Entrance setup"]'::jsonb,
    50, 700, 'PHP', 35000,
    '[{"pax": 50, "price": 35000}, {"pax": 70, "price": 40000}, {"pax": 100, "price": 45000}, {"pax": 150, "price": 65000}, {"pax": 200, "price": 90000}]'::jsonb,
    '{
      "inclusions": ["4 main dishes", "Dessert and drinks", "Elegant buffet setup", "Food warmer or roll top with serving spoons", "Dinner plates, spoon and fork, glassware and pitcher", "Professional waiter services", "Fully dressed monoblock chairs", "Round tables with floor-length motif table cloth", "Decorated cake, gifts, and giveaways table", "Centerpiece for individual tables", "Ribbon for individual chairs", "Stage decor and backdrop", "Entrance setup"],
      "entertainment": [],
      "freebies": ["Candy and sweet corner", "Event coordinator", "Ref magnet souvenir", "Styro name cut outs", "Lighted number standee"],
      "food_buffer_pax": 10,
      "service_area": "Within City of Baliwag area",
      "quotation_note": "Upgrades, downgrades, transport fees, crew meals, additional setup, and other miscellaneous requests require a new quotation.",
      "source_image": "packages/package_budgetarian_freebies_lower.jpg"
    }'::jsonb
  ),
  (
    'budget-entertainment',
    'Budgetarian Kids Party Package with Freebies and Entertainment',
    'Kids parties within the City of Baliwag area that need entertainment and photo coverage',
    '["4 main dishes", "Dessert and drinks", "Elegant buffet setup", "Food warmer or roll top with serving spoons", "Dinner plates, spoon and fork, glassware and pitcher", "Professional waiter services", "Fully dressed monoblock chairs", "Round tables with floor-length motif table cloth", "Decorated cake, gifts, and giveaways table", "Centerpiece for individual tables", "Ribbon for individual chairs", "Stage decor and backdrop", "Entrance setup"]'::jsonb,
    50, 940, 'PHP', 47000,
    '[{"pax": 50, "price": 47000}, {"pax": 70, "price": 52000}, {"pax": 100, "price": 56000}, {"pax": 150, "price": 76000}, {"pax": 200, "price": 102000}]'::jsonb,
    '{
      "inclusions": ["4 main dishes", "Dessert and drinks", "Elegant buffet setup", "Food warmer or roll top with serving spoons", "Dinner plates, spoon and fork, glassware and pitcher", "Professional waiter services", "Fully dressed monoblock chairs", "Round tables with floor-length motif table cloth", "Decorated cake, gifts, and giveaways table", "Centerpiece for individual tables", "Ribbon for individual chairs", "Stage decor and backdrop", "Entrance setup"],
      "entertainment": ["Clown / host", "Magician", "Photo booth", "Photographer", "Lights and sounds"],
      "freebies": ["Candy and sweet corner", "Event coordinator", "Ref magnet souvenir", "Styro name cut outs", "Lighted number standee"],
      "food_buffer_pax": 10,
      "service_area": "Within City of Baliwag area",
      "quotation_note": "Upgrades, downgrades, transport fees, crew meals, additional setup, and other miscellaneous requests require a new quotation.",
      "source_image": "packages/package_budgetarian_freebies.jpg"
    }'::jsonb
  ),
  (
    'full-blast',
    'Full Blast Kids Party Package with Freebies',
    'Premium kids parties within the City of Baliwag area',
    '["4 main dishes", "Dessert and drinks", "Elegant buffet setup", "Food warmer or roll top with serving spoons", "Dinner plates, spoon and fork, glassware and pitcher", "Professional waiter services", "Fully dressed monoblock chairs", "Round tables with floor-length motif table cloth", "Decorated cake, gifts, and giveaways table", "Centerpiece for individual tables", "Ribbon for individual chairs", "Full Blast stage decor and backdrop", "Full Blast entrance setup", "Balloon ceiling"]'::jsonb,
    50, 1100, 'PHP', 55000,
    '[{"pax": 50, "price": 55000}, {"pax": 70, "price": 60000}, {"pax": 100, "price": 63000}, {"pax": 150, "price": 84000}, {"pax": 200, "price": 109000}]'::jsonb,
    '{
      "inclusions": ["4 main dishes", "Dessert and drinks", "Elegant buffet setup", "Food warmer or roll top with serving spoons", "Dinner plates, spoon and fork, glassware and pitcher", "Professional waiter services", "Fully dressed monoblock chairs", "Round tables with floor-length motif table cloth", "Decorated cake, gifts, and giveaways table", "Centerpiece for individual tables", "Ribbon for individual chairs", "Full Blast stage decor and backdrop", "Full Blast entrance setup", "Balloon ceiling"],
      "entertainment": ["Clown / host", "Magician", "Photo booth", "Photographer", "Lights and sounds"],
      "freebies": ["Candy and sweet corner", "Event coordinator", "Ref magnet souvenir", "Styro name cut outs", "Lighted number standee"],
      "food_buffer_pax": 10,
      "service_area": "Within City of Baliwag area",
      "quotation_note": "Upgrades, downgrades, transport fees, crew meals, additional setup, and other miscellaneous requests require a new quotation.",
      "source_image": "packages/package_fullblast_freebies.jpg"
    }'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  ideal_for = excluded.ideal_for,
  included_menu = excluded.included_menu,
  default_pax = excluded.default_pax,
  price_per_head = excluded.price_per_head,
  currency = excluded.currency,
  base_price = excluded.base_price,
  tier_prices = excluded.tier_prices,
  details = excluded.details;

commit;

-- Optional verification (run after the transaction succeeds).
select id, name, base_price, tier_prices, details -> 'entertainment' as entertainment
from public.packages
where id in ('budget-basic', 'budget-entertainment', 'full-blast')
order by base_price;

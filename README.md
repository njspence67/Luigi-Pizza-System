# Hungry Hippo Pizzas

A free ordering and shop-management system for Luigi's pizza shop. It has a customer site for mobile ordering and a staff site for the kitchen, schedule, inventory, and reports.

## Run it

No install, no accounts, no cost.

1. Download or clone this repo.
2. Open `index.html` (customer site) in a browser.
3. Open `staff.html` (staff site) in a second tab of the **same browser**. The two tabs stay in sync, so an order placed on the customer site shows up on the kitchen screen right away.

The first time it opens, the demo creates 6 weeks of sample orders, 12 employees, a schedule, and inventory so the reports have something to show. Use **Reports > Reset all demo data** to start fresh.

| Who | How to sign in |
| --- | --- |
| Demo customer | Rewards tab: phone 931-555-0100, PIN 1234 |
| Luigi (manager, sees everything) | Staff PIN 1234 |
| Ava (staff) | Staff PIN 1111 (other staff: 1112 to 1121) |

Testing at night? The shop is closed after 11 PM, so "as soon as possible" is turned off. Turn on **Reports > Demo settings** to allow it.

## Files

```
index.html        Customer site: order, track order, rewards
staff.html        Staff site: kitchen, time clock, schedule, inventory, recipes, reports
css/styles.css    Shared look (colors, type, buttons)
js/data.js        Menu, prices, business rules, and storage. Shared by both sites.
js/customer.js    Customer site logic
js/staff.js       Staff site logic
```

**To change prices, toppings, drinks, hours, tax, or oven numbers, edit `CONFIG` at the top of `js/data.js`.** Both sites read from it.

## What's built, mapped to Luigi's top 7

| # | Need | Where |
| --- | --- | --- |
| 1 | Accurate orders (pizza, drinks, customer info) | Step-by-step builder with prices shown on every button, required name and phone, kitchen notes, order number |
| 2 | Analytics on when it's busy | Reports: profit by hour, orders by weekday, 7-day forecast heat map |
| 3 | Ingredient costs and inventory | Inventory: stock drops with every order, low-stock alerts, cost per pizza and per topping |
| 4 | Mobile orders | Customer site is built phone-first, with a sticky "Review order" bar |
| 5 | Track the order | Completion meter on the customer side, bump screen on the staff side |
| 6 | Easy for older customers | 18px base text, A/A+/A++ text size buttons, high contrast, large tap targets, labels on every field, screen-reader announcements, no tiny icons |
| 7 | Reliable | No paid services. Works if the pop-up library fails to load. Orders and the cart survive a page refresh. |

Also built: rewards (1 point per $1, 50 points = $5 off), "order this again", pickup times up to tomorrow, dine-in table numbers, bump bar number keys (1 to 9), oven capacity check (12 at a time), time clock, weekly schedule with positions and descriptions, printable recipes and build guide.

## Decisions we made (check these with Luigi)

- **No delivery.** The notes say dine in and pickup only because of the extra cost, so delivery is not built.
- **No online payment.** The notes both ask for and rule out online payment. Card processors (Square, Stripe) have no monthly fee but take about 3% of every sale, so the system is free only if customers pay at the counter. **Never collect or store card numbers in this system.** That breaks card-industry security rules (PCI DSS). If Luigi wants online payment later, add Square or Stripe checkout, which handles the card for us.
- **Recipes and ingredient costs are placeholders.** Replace them with Luigi's real recipes and invoice prices (Recipes tab text is in `js/staff.js`; dough amounts and costs are in `js/data.js`).
- **Portions:** ¼ cup (small), ½ cup (medium), 1 cup (large) of sauce, cheese, and each topping.
- **Oven:** every pizza takes one of the 12 spots, whatever the size. Prep time is assumed to be 4 minutes.
- **"DC" is Diet Coke.** Confirm.
- **Tax rate is 9.75%** (Cookeville / Putnam County). Confirm before going live.
- **No images.** Luigi doesn't want AI-generated art. Take real photos of the pizzas and the shop and add them.

## Going live (still free)

Right now everything is saved in one browser (`localStorage`), which is right for a class demo but means a customer's phone and the kitchen tablet can't see each other. To go live:

- **Hosting:** GitHub Pages or Netlify, both free for a site like this.
- **Shared database and real logins:** Supabase or Firebase. Both have free tiers that cover a shop this size. Only the "Storage" section and the sign-in functions in `js/data.js` need to change.
- The PIN check in this demo is **not real security**. Real sign-ins must go through the database provider's login system.

## Suggested Trello lists and cards

**Backlog / To do / Doing / Review / Done**

- Confirm open questions with Luigi (delivery, payment, Diet Coke, tax)
- Get real recipes and ingredient prices from Luigi
- Take real photos of the pizzas and the shop
- Customer site: test on an older phone and with large text
- Customer site: test with a screen reader (VoiceOver or NVDA)
- Staff site: test the bump screen on a tablet during a mock rush
- Move storage to Supabase or Firebase
- Put the site on GitHub Pages
- Write a one-page "how to use it" guide for staff

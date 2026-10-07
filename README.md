# Luigi's Pizzeria ordering demo

A mobile-first, clickable Phase 1 prototype based on the provided `index2.html` and `app.js` baseline. It includes a customer ordering flow, a kitchen queue, an order tracker, recent-order history, and a manager dashboard with seeded charts.

## Run locally

This project has no package installation, backend, account, or paid service requirement. Python's standard library serves the static files:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000> in a browser. The root page forwards to the provided baseline filename, `index2.html`. Stop the server with `Ctrl+C`.

The Bootstrap stylesheet and SweetAlert2 messages use their public, free jsDelivr CDN URLs. No payment processor, API key, database, or external account is used. The layout and core ordering flow remain usable without SweetAlert2; the browser's built-in alert is used as a fallback.

## What works in this demo

- Choose dine-in or pickup.
- Build a 12-inch Small, 14-inch Medium, or 18-inch Large pizza with New York crust, sauce, cheese, and at least one topping.
- Add drinks, review and edit the cart, and see a demo subtotal.
- Place a mock order using contact details, then follow its progress.
- Advance tickets through Received, Preparing, In Oven, Ready, and Completed in the kitchen view.
- Review recent orders and explore seeded manager charts.
- Keep demo cart and order changes in browser `localStorage`.

## Deliberate demo limits

- Checkout does not collect card information and does not charge money.
- There is no server, database, user account, password, or real-time multi-device sync. Browser-local data is for demonstration only.
- Taxes, pickup estimates, real inventory, recipe costs, labor costs, staffing, and real forecasting are not calculated.
- Menu and sample analytics are illustrative. The topping price rule follows the brief's proposed interpretation: the base includes one topping; each additional topping is charged by size. Drink labels “Dr Q” and “DC” are kept as provided.
- Reset demo orders by clearing this site's local storage in the browser.

## Files

- `index2.html` — semantic screens and content, preserving the uploaded baseline filename.
- `css/styles.css` — responsive layout, high-contrast colors, focus styles, and reduced-motion support.
- `js/app.js` — local demo data, pricing, cart, checkout, tracker, kitchen controls, and sample charts.

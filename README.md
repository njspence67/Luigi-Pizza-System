# Luigi's Pizzeria ordering demo

A free static customer ordering demo with a Firebase Auth and Cloud Firestore backend. Customers can submit orders without creating an account. Active kitchen staff sign in to view the live queue and update statuses. Firestore Security Rules deny customer reads of every order document.

## Firebase setup (Spark plan)

This repository is configured for the Firebase project `luigi-pizza-demo` on the no-cost Spark plan. It uses GitHub Pages for static hosting and has no payment processing. Keep the Firebase project on Spark and do not link a billing account. The project's web app configuration is in `firebase-config.js`; it is public client configuration, not a server secret.

The current Firebase project has Anonymous and Email/Password sign-in enabled, `njspence67.github.io` authorized for Authentication, a Cloud Firestore database in `nam5`, and the access rules from `firestore.rules` published. To configure a separate Firebase project:

1. Create a Firebase project on the Spark plan and register a **Web app** in Project settings.
2. Copy that app's web configuration into `firebase-config.js`. Never put a service account, Admin SDK credential, or private key in this repository.
3. In **Authentication → Sign-in method**, enable **Anonymous** and **Email/Password**. Anonymous sign-in is for customer checkout; staff accounts are created by the project owner in Authentication.
4. In **Authentication → Settings → Authorized domains**, add the site's host if it is not already listed. For this GitHub Pages project URL, add `njspence67.github.io` (the domain only, without the repository path). `localhost` is normally included for local development.
5. Create the Cloud Firestore database using its free/default database. In the **Rules** tab, paste and publish the contents of `firestore.rules` before using the app. Do not start with open/test rules.
6. Create each staff account in **Authentication → Users** and copy its UID. In **Firestore → Data**, create a document at `staff/UID_FROM_AUTH` with these fields:

   ```text
   active: true       (boolean)
   role: "kitchen"    (string)
   ```

   Use `role: "manager"` for an account that may see the sample manager dashboard. Manager accounts cannot read orders. Only active `kitchen` accounts can list, read, or update order records. Staff documents cannot be created or changed by the website.

7. Commit `firebase-config.js` along with the project so the static site receives the same public web config. Firebase access is enforced by Authentication and Firestore Rules, not by hiding the config.

The project owner should keep access to Firebase Console restricted. The demo collects names and phone numbers and stores them in Firestore for the kitchen, so use real customer details only if this is appropriate for your class/demo and retention requirements.

## Run locally

Serve the folder over HTTP (Firebase Auth does not work reliably from a `file://` URL):

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The root page forwards to `index2.html`. Stop the server with `Ctrl+C`.

The Firebase SDK is installed from npm and compiled into `vendor/app.bundle.js`. Bootstrap CSS and SweetAlert2 are also stored locally in `vendor/`; the page makes no CDN requests for these libraries. To rebuild the Firebase bundle after changing `app.js`:

```sh
npm install
npm run build
```

The generated bundle is part of the static site, so visitors do not need Node.js or npm. Commit `vendor/app.bundle.js` when `app.js` changes.

## What works

- Build a pizza, add drinks, edit the cart, and see a demo subtotal.
- Place a demo order with no payment collection. Firebase creates an anonymous customer identity and writes the order to Firestore.
- See the confirmation reference from the submitted information. The customer page does not read the order document or show its status.
- Sign in to the kitchen with an allowlisted email/password staff account. The live queue syncs across devices and kitchen staff can advance statuses.
- View illustrative manager charts. These sample charts are not based on real orders.
- Keep only the cart in browser `localStorage`; customer and kitchen order records live in Firestore.

## Security behavior

- `firestore.rules` allows anonymous customers to create validated order records but denies all customer `get` and `list` requests, including reads of their own records.
- Only a signed-in account whose `staff/{uid}` document has `active: true` and `role: "kitchen"` can read or update orders. The website cannot create or edit staff role documents.
- A Firebase web API key/config is not an authorization secret. The Firestore rules are the access boundary; do not replace them with client-side-only UI checks.
- Order totals are demo values supplied by the browser. There is no payment processing or server-side price calculation.

## Free plan limits

Spark is a no-cost plan with no billing account required. Firestore's free quota is limited; when a paid-tier product reaches its no-cost quota, Firebase can disable that product until the next cycle unless the project is upgraded. Keep an eye on Firebase Console usage. For a class demo with modest traffic, this should fit within the free quota, but it is not an unlimited production service.

## Files

- `index2.html` — ordering, confirmation, kitchen sign-in, and manager screens.
- `app.js` — application source, Firebase Auth, Firestore reads/writes, cart, and UI.
- `vendor/app.bundle.js` — locally bundled app and Firebase web SDK used by the page.
- `firebase-config.js` — public Firebase web app configuration.
- `firestore.rules` — Firestore access control rules to publish in Firebase Console.
- `styles.css` — responsive interface styling.
- `build.mjs`, `package.json`, `package-lock.json` — local SDK bundling setup.

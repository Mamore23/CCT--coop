# Firebase Authentication: Authorized Domains Configuration Guide

## Overview

When authenticating users with Firebase Authentication (e.g., Google Sign-In with popup or redirect), Google's identity servers strictly enforce an **Authorized Domains whitelist** for project:
**`cctcooperative-f558e`** (`cctcooperative-f558e.firebaseapp.com`).

If the application is loaded from an unauthorized host (such as a temporary Google Cloud Run preview URL or new custom production domain), Firebase Authentication throws the error:
```
auth/unauthorized-domain
```

Browser clients and backend servers cannot bypass this whitelist programmatically because it is enforced directly by Google Identity Platform at the project level.

---

## Current Development Preview Hostname

For the CCT Cooperative application:
- **Current Preview Hostname**: `ais-dev-5kff5fnq42p5gbp2h7tvz7-257124932958.asia-east1.run.app`
- **Local Development**: `localhost` (authorized by default in Firebase)
- **Production Domain**: Add your custom production domain (e.g., `coop.yourdomain.ph`) upon production deployment.

---

## Step-by-Step Instructions to Authorize Domains in Firebase Console

1. Navigate to the **[Firebase Console](https://console.firebase.google.com/)**.
2. Select your Firebase project: **`cctcooperative-f558e`**.
3. In the left navigation menu, click **Build** → **Authentication**.
4. In the top tabs, select **Settings**.
5. Scroll down to the **Authorized domains** card.
6. Click **Add domain**.
7. Enter the domain name (hostname only, without `https://` or trailing slashes):
   - Enter: `ais-dev-5kff5fnq42p5gbp2h7tvz7-257124932958.asia-east1.run.app` (add this only if this is your active preview hostname)
   - When deploying to production, click **Add domain** again and add your live production domain.
8. Click **Done** or **Save**.

The domain is typically authorized within 10 to 60 seconds without requiring an application rebuild or redeployment.

---

## In-App Dynamic Error Handling

The cooperative frontend (`LoginView.tsx`) automatically detects the `auth/unauthorized-domain` error during Google Sign-In and dynamically displays `window.location.hostname` with step-by-step instructions. The hostname is not hard-coded in the application logic.

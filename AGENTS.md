# Roxy Apps website

Static site for Roxy Apps (Ulaş Sancak, solo app developer, Bakırköy/İstanbul), served at https://roxyapps.net
behind Cloudflare. No build step. Push to `main` deploys.

## Per-app privacy policy and account deletion

Every app gets two pages, in English and Turkish, driven by one registry file, `apps.json`:

- `https://roxyapps.net/privacy?app=<id>` → `privacy/index.html`
- `https://roxyapps.net/delete-account?app=<id>` → `delete-account/index.html`

Language: `&lang=tr` / `&lang=en`, else the browser language. Both pages have an EN | TR switch.
Without a valid `?app=` they list all apps.

**Adding an app = adding one entry to `apps.json`. Never create per-app HTML.**
The policy text is shared by every app and lives in `privacy/index.html` (EN and TR side by side).
Only the app name, date and feature flags change per app. If you change policy text, change both languages.

The delete page signs the user in with Google (Google Play users only use Google sign-in) against the app's own
Firebase project, deletes every user data path listed in `delete`, then deletes the Firebase Auth user.
An email fallback (admin@roxyapps.net) is always shown.

### `apps.json` entry

```json
"lettermint": {
  "name": "Lettermint",
  "updated": "2026-10-19",
  "features": ["analytics", "crashlytics", "ads", "purchases"],
  "firebase": { "apiKey": "...", "authDomain": "...", "projectId": "...", "storageBucket": "...", "appId": "..." },
  "delete": {
    "docs": ["users/{uid}"],
    "collections": ["users/{uid}/letters"],
    "queries": [{ "collection": "scores", "field": "uid" }]
  }
}
```

- Key = `id`: lowercase app name, no spaces. It is the `?app=` value.
- `updated`: ISO date of the last policy change for this app.
- `features`: only what the app actually uses. The policy's service list is fixed; never add other services.
  Always listed: Google Firebase (Authentication, Cloud Firestore), Apple (Sign in with Apple), Google Play (Google sign-in).
  - `analytics`: Firebase Analytics
  - `crashlytics`: Firebase Crashlytics
  - `ads`: Google AdMob + User Messaging Platform (ad consent form)
  - `purchases`: in-app purchases via RevenueCat, App Store and Google Play
- `firebase`: the web app config from `firebase_get_sdk_config`, copied as is. These values are public; committing them is fine.
- `delete`: every place user data lives. `{uid}` is replaced with the user's uid. All keys optional. Run order:
  - `collections`: every doc in the collection is deleted (use for subcollections under the user doc)
  - `queries`: every doc in `collection` where `field == uid` (use for top-level collections with an owner field)
  - `docs`: single documents
- Firestore can't delete a subcollection by deleting its parent doc, so list every subcollection explicitly.
  Sub-subcollections under docs with unknown ids can't be listed this way; if an app has them, tell the user.

## Workflow: "prepare <app>"

When the user says "prepare Lettermint", "add privacy / delete account for X", "X needs a privacy policy" or similar,
this is the workflow. The pages already exist: never create new files, pages or scripts; only add the app to
`apps.json` (and fix its Firebase setup). Do everything below yourself. Only ask the user what you
cannot find out (usually: ads / analytics / crashlytics). Ask those in one go, never one at a time.

1. **Project.** `firebase_list_projects`, match by display name, ignore `-test` projects. Ambiguous → ask.
   `firebase_update_environment` with `active_project` = that project id.
2. **Web config.** `firebase_list_apps` (platform `web`). None → `firebase_create_app` (platform `web`,
   display name `<App> Web`). `firebase_get_sdk_config` for it → `firebase` field.
3. **Features.**
   - `firebase_list_apps` (all) shows iOS/Android app ids and package names.
   - RevenueCat MCP: `list-projects` / `list-apps`; an app with the same name or bundle id → `purchases`.
   - If the user gives the app's code path, grep it for `firebase_analytics`/`FirebaseAnalytics`, `crashlytics`/`FirebaseCrashlytics`,
     `google_mobile_ads`/`GoogleMobileAds`/`admob`, `purchases_flutter`/`RevenueCat`, `in_app_purchase`/`StoreKit`/`billing`.
   - Anything still unknown → ask the user.
4. **User data map.** `firebase_get_security_rules` for `firestore`. Every path matched with the user's uid
   (`/users/{userId}`, `/users/{uid}/...`, docs with `resource.data.uid == request.auth.uid`) goes into `delete`.
   If the app code is available, grep it for collection
   names too, since rules can be broader than the real paths. Leave nothing out: deletion must remove everything
   linked to the user.
5. **Security rules.** The signed-in user must be allowed to do what the delete page does:
   - `docs`: `allow delete: if request.auth.uid == uid`
   - `collections`: `allow read, delete` for the owner (listing needs `read`)
   - `queries`: `allow read, delete: if resource.data.<field> == request.auth.uid`

   If the rules already allow it, change nothing. Otherwise write the full updated `firestore.rules` to a new scratchpad dir
   with a `firebase.json` (`{"firestore":{"rules":"firestore.rules"}}`). **Show the user the diff and get a yes before
   deploying** (this is production). Then `firebase_update_environment` with `project_dir` = that dir and `firebase_deploy`
   with `only` = `firestore:rules`. CLI fallback: `firebase deploy --only firestore:rules --project <id>` in that dir.
6. **Sign-in setup.** Not in the Firebase MCP; use the Identity Toolkit API with the gcloud login (same Google account):

   ```bash
   P=<projectId>; T=$(gcloud auth print-access-token); API=https://identitytoolkit.googleapis.com/admin/v2/projects/$P
   # Google provider must be enabled ("enabled": true)
   curl -s -H "Authorization: Bearer $T" -H "x-goog-user-project: $P" "$API/defaultSupportedIdpConfigs/google.com"
   # Add roxyapps.net to authorized domains (keeps the existing ones)
   DOMAINS=$(curl -s -H "Authorization: Bearer $T" -H "x-goog-user-project: $P" "$API/config" \
     | python3 -c "import sys,json; d=json.load(sys.stdin)['authorizedDomains']; print(json.dumps({'authorizedDomains': d if 'roxyapps.net' in d else d+['roxyapps.net']}))")
   curl -s -X PATCH -H "Authorization: Bearer $T" -H "x-goog-user-project: $P" -H "Content-Type: application/json" \
     "$API/config?updateMask=authorizedDomains" -d "$DOMAINS"
   ```
   Google disabled → tell the user (the app can't be using Google sign-in then; check with them).
7. **Add the entry** to `apps.json` with `updated` = today.
8. **Check rendering** by serving the repo locally (`python3 -m http.server`) and loading
   `/privacy/?app=<id>&lang=en`, `&lang=tr` and `/delete-account/?app=<id>` in headless Chrome (`--dump-dom`).
9. **Report** to the user: what was found and changed, and the URLs for App Store Connect / Google Play Console:
   - Privacy: `https://roxyapps.net/privacy?app=<id>`
   - Account deletion (Play Console → App content → Data safety / Account deletion): `https://roxyapps.net/delete-account?app=<id>`

   Suggest a real test with a throwaway Google account after pushing. Commit only when the user asks.

## Notes

- Extensionless `.html` URLs don't work on this host, so pages live in folders
  (`/privacy` → 301 → `/privacy/`, query string kept).
- `content/en|tr/*.html` are the website's own legal pages, not app policies.

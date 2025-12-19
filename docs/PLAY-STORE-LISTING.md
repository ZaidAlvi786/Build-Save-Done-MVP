# Play Store listing draft and release checklist

Draft only. Nothing has been submitted or published. Confirm developer identity, package ownership and policy requirements in the actual Console before submission.

App name: **Saved → Done**

Short description: **Save places from screenshots and get reminders when you’re nearby.**

Full description draft:

Turn the places you save into places you visit. Share a screenshot from your gallery or another app, check the detected place and map pin, then keep it in your saved list. If a screenshot or link cannot be identified, enter the name and area yourself.

Browse by category, sort nearby places, mark a visit or open navigation. Enable nearby reminders when you want this phone to alert you close to a saved place. Notifications let you navigate, snooze for a day or mark it visited. You can use the saved list without background location.

An optional Friday digest counts unvisited saves near your last foreground location check. Optional activity and error reporting can be controlled separately in Account and privacy. Your screenshots are private, and you can delete your account and saved data from the app.

Location and notification permissions affect reminders. Battery restrictions and force-stopping the app can delay them. Place identification may require a correction. Availability and the configured privacy policy must be verified before using this copy publicly.

## Owner and assets

- [ ] Confirm owned package ID (currently provisional com.saveddone.app), developer verification, contact email and signing-key custody.
- [ ] Supply final icon, feature graphic, authentic screenshots from a release build, and category/content rating. Do not present mockups as working-device evidence.
- [ ] Configure hosted privacy and deletion-request URLs referencing Saved → Done/developer identity, support workflow and retention periods.
- [ ] Keep store copy consistent with actual permissions, providers and tested behavior. No prices, payments, ads, social sharing or additional use cases.

## Technical and policy evidence

- [ ] Inspect the signed AAB's target SDK against the current requirement for **new apps**, not merely existing-app availability. Verify with [Google's target API guidance](https://support.google.com/googleplay/android-developer/answer/11926878) and [Android requirements](https://developer.android.com/google/play/requirements/target-sdk) at submission.
- [ ] Complete the background-location declaration, prominent disclosure and demonstration video for nearby saved-place reminders. Show the permission request only after explanation and explicit enable. See [background-location policy](https://support.google.com/googleplay/android-developer/answer/9799150).
- [ ] Review foreground-service declarations and manifests, notification permission, photo-picker fallback, Data safety and all active tracks; remove unnecessary permissions from the final artifact.
- [ ] Accurately disclose identity/email, screenshot/link/place storage, optional analytics, diagnostic categories, push identifiers and opted-in nearby IDs implying coarse location. Document encryption, deletion, optional collection and third-party retention; verify actual traffic.
- [ ] Verify in-app and external account deletion. The external resource must work and visibly support the deletion request; see [Google account-deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111).
- [ ] Meet the testing/production-access requirements applicable to this developer account, verify app access instructions for reviewers, and record closed/internal testing feedback.
- [ ] Resolve the security hold, test signed Android builds on mid-range and second phones, inspect crashes/ANRs, scrolling/accessibility and all earlier phase gates. Readiness is tracked by `npm run release:check`.

No store account, URL ownership or service credentials were invented. Public documents/assets, submission and remote deployment remain owner-provided release work.

# Phase 2 device verification

Use an Expo development build, never Expo Go. Configure the app Supabase URL/public key and server secrets locally. Serve all functions and apply migrations; enable email OTP and configure the Supabase email template to contain `{{ .Token }}`. Enable Google Places API (New) and Maps Static API for the server credentials.

1. On a mid-range Android phone, share a screenshot while signed out. Close/reopen the app; confirm the capture persists. Sign in using the email code. Repeat from Gallery, Instagram/TikTok and Google Maps; include a text-only link.
2. Measure from tapping the OS share target to the confirmed place appearing after Looks right. Record phone model, OS, network, warm/cold start, screenshot size and timestamps. Repeat at least ten times; report every duration and failures, including user interaction time. The gate is under ten seconds, not a mocked latency claim.
3. Check Fix it, another candidate, empty/ambiguous extraction, expired OTP, revoked session, provider timeout, map failure/address fallback and denied photo access. Pending originals must survive retries.
4. Turn off network during upload/extraction and terminate the app at each stage. Restore network and retry; ensure one saved item, immutable image and one confirmed place.
5. Share HEIC and an image larger than 5 MiB. Verify native conversion and server signature validation; inspect rotation and readable place text. Conversion failure must retain the original.
6. Switch between two accounts; neither sees the other's pending captures or saved places. Delete one account using DELETE, simulate a failed image deletion and retry. Verify private images, rows and Auth identity are gone and late work cannot restore local captures.
7. Inspect the generated Android manifest for image/text SEND filters and absence of broad media/storage permissions. Compile/install with Android Studio/JDK; native prebuild alone does not prove compilation. On macOS repeat iOS extension and SecureStore checks.

Retain redacted evidence in a private device log. Do not commit screenshots, tokens, email codes or provider keys. A passed local test suite cannot satisfy this physical-device gate.

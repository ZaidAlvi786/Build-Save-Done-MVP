# ADR 007: Durable native capture and confirmation

Status: accepted for Phase 2 local implementation.

Use expo-share-intent for Android/iOS incoming images/text, expo-image-picker for system photo selection, expo-file-system for private originals and recovery journals, expo-sqlite for indexed pending captures, and expo-crypto for stable share digests and upload verification. expo-image-manipulator normalizes unsupported or oversized images while retaining originals. expo-secure-store stores chunked Auth sessions; URL polyfill and Supabase JS support the native client. Zod validates client/server contracts; safe-area-context preserves controls around device insets. expo-linking supports Settings/navigation links.

Persist before acknowledging the OS share, bind captures to an account before networking, and serialize queue changes. JSON journals recover interrupted SQLite indexing and file copies. Repeated delivery resolves to the same active pending item. A deletion tombstone fences late local work. Server confirmation is an atomic authenticated transaction, and map/extraction calls verify user ownership before privileged access.

Google Places is the initial geocoder. A server-only Maps Static API adapter returns transient map images; it avoids a native privileged API key. Keep Google attribution and the complete uncropped map. Provider candidates are not persisted. Save original user/AI text and expiring coordinates/provider place ID. Coordinate refresh is required before Phase 3 geofencing after expiry.

React and react-dom are pinned/overridden to Expo's React 19.2.3. Testing Library 13.3.3 and react-test-renderer 19.2.3 avoid a second incompatible React version introduced by newer test peers. Jest/RNTL verify observable screens and domain recovery; native APIs still require device verification.

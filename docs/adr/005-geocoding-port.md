# Geocoding behind a server interface

Status: accepted for foundations

Define searchPlace(query) returning normalized candidate IDs, name, address and coordinates. Start with Google Places server-side; keep Mapbox substitutable without screen changes. Native map renderer is a separate choice in Phase 2; no privileged geocoding key in the bundle. Require explicit pin confirmation for ambiguous matches.

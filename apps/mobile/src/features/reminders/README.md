# Reminders

Pure nearest-N selection and reminder actions are separate from native location/notification adapters and SQLite persistence. Module-scope TaskManager definitions are imported from the entry point. Settings and lifecycle hooks own service calls; the screen renders explanation, controls and native/debug status. Account-bound offline actions sync through record_reminder. Physical validation is documented in docs/TESTING-PHASE-3.md.

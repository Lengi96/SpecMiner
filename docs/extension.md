# SpecMiner Browser Extension Skeleton

The extension is a V1 starting point for hybrid recording in a user's real Chrome or Edge profile.

Current behavior:

- records click and change events passively
- stores the last 1000 events in `chrome.storage.local`
- does not export to the CLI yet

Planned bridge:

1. Extension exports a JSON event bundle.
2. CLI imports it with a future `specminer import-extension` command.
3. Existing artifact, privacy, evidence, review, and export pipeline stays unchanged.

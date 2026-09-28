# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This project is a fork of
[patrik-csak/auto-terminal-profile](https://github.com/patrik-csak/auto-terminal-profile).
Version `1.0.0` corresponds to upstream `8.1.0` plus the reliability fixes below.

## [1.0.0](https://github.com/dct74/auto-switch-term-theme/releases/tag/v1.0.0) – 2026-09-28

Forked from [`auto-terminal-profile` v8.1.0](https://github.com/patrik-csak/auto-terminal-profile/releases/tag/v8.1.0).

### Fixed

- **Profile now syncs at startup.** `watch` performs an initial sync so login, reboot
  and service restarts apply the correct profile without waiting for an appearance change.
- **A crash no longer leaves the service dead.** The Homebrew formula now uses
  `keep_alive true` instead of `successful_exit: true`, so launchd restarts the job
  after any exit.
- **Missed appearance changes are repaired.** `watch` reconciles every 60 seconds
  (override with `AUTO_SWITCH_TERM_THEME_INTERVAL`), which recovers from notifications
  lost while the Mac was asleep. It only touches Terminal on real drift.

### Changed

- Errors during a profile switch are caught and logged instead of becoming unhandled
  rejections, so a transient failure can't kill the watcher.
- `engines.node` relaxed to `>=22` (upstream: `>=22 <=24`) so Node upgrades are safe.
- Package renamed to `auto-switch-term-theme`; the command is now
  `auto-switch-term-theme`.
- Existing upstream profiles are migrated automatically on first run.

### Added

- `sync` command: apply the correct profile only when it has drifted
  (`--force` to apply unconditionally).
- Homebrew `service` block with `keep_alive true` and service logs under
  `$(brew --prefix)/var/log/`.

### Credits

- Original project and most of the code: [Patrik Csak](https://github.com/patrik-csak),
  [auto-terminal-profile](https://github.com/patrik-csak/auto-terminal-profile) (MIT).

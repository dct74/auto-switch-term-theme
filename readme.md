# auto-switch-term-theme

Automatically switch the macOS [Terminal](https://en.wikipedia.org/wiki/Terminal_%28macOS%29) profile when the system [dark / light appearance](https://support.apple.com/guide/mac-help/use-a-light-or-dark-appearance-mchl52e1c2d2/mac) changes.

> ## Credit: this is a fork
>
> This project is a **fork of [patrik-csak/auto-terminal-profile](https://github.com/patrik-csak/auto-terminal-profile)**, originally written by **[Patrik Csak](https://github.com/patrik-csak)**.
> The CLI design, the use of [`dark-mode`](https://github.com/sindresorhus/node-dark-mode) and [`mac-terminal`](https://github.com/patrik-csak/mac-terminal), and most of the code come straight from upstream — full credit to the original author.
>
> 🔗 **Upstream:** <https://github.com/patrik-csak/auto-terminal-profile>
> 🙏 **Thanks to Patrik Csak for the original tool.** This fork only hardens the background service so it keeps working; see [Why this fork](#why-this-fork). It is MIT-licensed, same as upstream.

---

## Why this fork

The upstream tool is excellent, but its background service has three ways to silently
stop switching profiles. All three were hit in practice; this fork fixes them in the
source and in the Homebrew service definition.

| # | Problem upstream | Fix in this fork |
|---|---|---|
| 1 | **No sync at startup.** The `watch` command only reacts to change notifications, so after login/reboot the profile stays stale until the next appearance change. | `watch` performs an **initial sync** before it starts listening. |
| 2 | **A crash kills the service forever.** The upstream formula declares `keep_alive successful_exit: true`, which tells launchd to restart the job only after a **successful** exit. Any error exits with code 1, and launchd never brings it back. | The formula ships its own `service` block with **`keep_alive true`**, so launchd restarts it after *any* exit. |
| 3 | **Missed notifications.** A theme change that happens while the Mac is asleep can be missed, leaving the profile wrong until the next change. | A **60-second reconcile** re-checks the current appearance and repairs drift. It only touches Terminal when the profile is actually wrong, so your manually chosen per-tab profiles are left alone. |

Two more hardening changes:

- **Errors can't kill the process.** Every profile switch goes through a `sync` action that logs failures (denied macOS Automation, a deleted profile, Terminal being closed, …) instead of throwing an unhandled rejection.
- **Wider Node support.** Upstream pins Node to `>=22 <=24`; this fork accepts `>=22`, so a `brew upgrade node` won't break it.
- **Config migration.** If you used upstream, your existing dark/light profiles are imported automatically the first time this runs (see [Migrating from upstream](#migrating-from-upstream)).

## Install

- [Homebrew](#homebrew) · **recommended**
- [From source](#from-source)

### Homebrew

```shell
brew install dct74/tap/auto-switch-term-theme
```

1. [Import the Terminal profiles](https://support.apple.com/guide/terminal/import-and-export-terminal-profiles-trml4299c696/mac) you want to use, if you haven't already.

2. Set your preferred dark and light mode profiles:

	```shell
	auto-switch-term-theme config set
	```

	Or set them individually:

	```shell
	auto-switch-term-theme config set dark  'GitHub Dark Default'
	auto-switch-term-theme config set light 'GitHub Light High Contrast'
	```

3. Start the background service:

	```shell
	brew services start auto-switch-term-theme
	```

	It runs as a macOS launchd agent and starts automatically at login. Stop it with:

	```shell
	brew services stop auto-switch-term-theme
	```

### From source

```shell
git clone https://github.com/dct74/auto-switch-term-theme.git
cd auto-switch-term-theme
npm install
node source/cli.js config set
node source/cli.js watch
```

## Usage

```shell
auto-switch-term-theme config show              # show the configured profiles
auto-switch-term-theme config set               # pick profiles interactively
auto-switch-term-theme config set dark 'X'      # set one profile
auto-switch-term-theme sync                     # switch now if the profile drifted
auto-switch-term-theme sync --force             # switch now, unconditionally
auto-switch-term-theme update                   # apply the profile for the current mode
auto-switch-term-theme update dark              # apply the dark profile explicitly
auto-switch-term-theme watch                    # run the background watcher in the foreground
```

`watch` runs the three layers described above: an initial sync, the live
appearance watcher, and a periodic reconcile. The reconcile interval defaults to
60 seconds and can be changed with an environment variable:

```shell
AUTO_SWITCH_TERM_THEME_INTERVAL=300 auto-switch-term-theme watch
```

## Migrating from upstream

Nothing to do. On first run, this fork copies the `dark` and `light` profiles from
upstream's config (`auto-terminal-profile` → `auto-switch-term-theme`) exactly once.

To switch from the upstream package, run:

```shell
brew services stop auto-terminal-profile
brew uninstall auto-terminal-profile
brew install dct74/tap/auto-switch-term-theme
brew services start auto-switch-term-theme
```

Your Terminal profiles and preferences are untouched; only the command name and the
background service change.

## Troubleshooting

- **Nothing switches.** Check that the service is running and its log:

	```shell
	brew services list | grep auto-switch-term-theme
	tail -f "$(brew --prefix)/var/log/auto-switch-term-theme.err.log"
	```

- **"Not authorized to send Apple events".** macOS is blocking AppleScript control of
	Terminal. Allow it in **System Settings → Privacy & Security → Automation**, then
	restart the service: `brew services restart auto-switch-term-theme`.
- **Only new windows use the theme.** The tool sets both the open tabs and the default
	profile. If you changed a tab's profile by hand, the next real appearance change
	(or `auto-switch-term-theme sync --force`) will set it back.

## License & acknowledgements

MIT. See [`license.txt`](./license.txt).

Based on **[auto-terminal-profile](https://github.com/patrik-csak/auto-terminal-profile)** by
**[Patrik Csak](https://patrikcsak.com)** — thank you for the original work. This fork keeps
the original copyright notice and adds an entry for the modifications.

Standing on the shoulders of:

- [`patrik-csak/mac-terminal`](https://github.com/patrik-csak/mac-terminal) — Node.js library to control the macOS Terminal app
- [`sindresorhus/dark-mode`](https://github.com/sindresorhus/node-dark-mode) — observe and control the macOS appearance

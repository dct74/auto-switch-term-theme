# Releasing

How to cut a release of `auto-switch-term-theme` and publish it to the Homebrew
tap. Follows the same conventions as [`dct74/release-template`](https://github.com/dct74/release-template):
**tag = version, changelog first, one command.**

## TL;DR

```bash
# 1. add a "## [x.y.z]" entry to changelog.md (see below)
# 2. one command:
make release VERSION=1.0.1
```

Or without `make`:

```bash
scripts/release.sh 1.0.1          # real release
DRY_RUN=1 scripts/release.sh 1.0.1   # print the plan, change nothing
```

## Versioning

- `vX.Y.Z`, [SemVer](https://semver.org). The git tag is the single source of truth;
  `package.json`'s `version` and the tap formula are kept in sync by the script.
- A tag containing `-` (e.g. `v1.1.0-rc1`) is treated as a pre-release and is **not**
  published to the tap, by convention.
- These are **fork-local** versions: `v1.0.0` corresponds to upstream
  `auto-terminal-profile` v8.1.0 plus the fixes in [`changelog.md`](./changelog.md).
  It does not track upstream's version numbers.

## Prerequisites (once per machine)

```bash
brew tap dct74/homebrew-tap     # so the formula exists locally to bump
gh auth status                  # must be authenticated
```

And, in the clone, tell `gh` which repo is "yours":

```bash
gh repo set-default dct74/auto-switch-term-theme
```

> **Why this matters.** `gh` prefers a remote named **`upstream`** when resolving
> the repository (the fork convention). This clone has
> `upstream = patrik-csak/auto-terminal-profile`, so a bare `gh release create`
> targets *that* repo, gets a 403, and reports the misleading error
> **"workflow scope may be required"**. The `release.sh` script avoids this by
> always passing `-R dct74/auto-switch-term-theme`; `gh repo set-default` fixes it
> for any other `gh` command you run by hand.

`gh repo set-default` is stored per-clone (`.git/config`), so after a fresh clone
run it again — or just always use `-R`.

## What `make release` does

1. Bump `package.json` (`npm version --no-git-tag-version`).
2. `npm run lint` + `npm test` — abort on failure.
3. Commit `auto-switch-term-theme X.Y.Z` and create annotated tag `vX.Y.Z`.
4. Push `main` and the tag.
5. Create the GitHub Release, using the matching `## [X.Y.Z]` section of
   `changelog.md` as the notes (via `gh release create -R … --notes-file …`).
6. Update the tap formula's `tag:` and `revision:` to the new tag / commit SHA.
7. Commit and push the tap.

The script refuses to run unless: the tree is clean, you are on `main`, the tag
does not already exist, and `changelog.md` has an entry for the version.

## Changelog entry format

The script extracts exactly this section for the release notes:

```md
## [1.0.1](https://github.com/dct74/auto-switch-term-theme/compare/v1.0.0...v1.0.1) – 2026-10-01

### Fixed

- …
```

Everything between that `## [x.y.z]` heading and the next `## [` heading becomes
the release body.

## How the tap consumes a release

The formula installs the package **from the git tag**, not from a built asset:

```ruby
url "https://github.com/dct74/auto-switch-term-theme.git",
    tag:      "v1.0.0",
    revision: "1c7fc9d4fa69e9f1c5900acbca2862dcecd93ffa"
```

There is no compiled binary and no `sha256`: it is a Node CLI, so `brew install`
clones the tag, runs `npm install`, and symlinks the `bin`. That is why there is
no `.sha256` asset and no `sync-tap` CI workflow here — the "bump" is just the two
lines above, which `release.sh` updates. (This differs from the `.sha256` +
`sync-tap.yml` flow in `release-template`, which is for projects that ship a
built binary or `.app`.)

The important line in the formula is in its `service` block:

```ruby
service do
  run [opt_bin/"auto-switch-term-theme", "watch"]
  keep_alive true                 # NOT `successful_exit: true`
  log_path var/"log/auto-switch-term-theme.log"
  error_log_path var/"log/auto-switch-term-theme.err.log"
end
```

`keep_alive true` is what makes launchd restart the watcher after *any* exit.
Upstream used `keep_alive successful_exit: true`, which only restarts after a
*successful* exit and therefore silently leaves the service dead after a crash.
Do not "simplify" it back.

## Manual release (fallback)

If you'd rather do it by hand:

```bash
npm version 1.0.1 --no-git-tag-version
npm run lint && npm test
git add package.json changelog.md
git commit -m "auto-switch-term-theme 1.0.1"
git tag -a v1.0.1 -m "v1.0.1"
git push origin main && git push origin v1.0.1

# NOTE: -R, or gh will target the "upstream" remote and fail with a bogus
# "workflow scope may be required" error.
gh release create -R dct74/auto-switch-term-theme v1.0.1 \
  --title v1.0.1 --notes-file <(awk '/^## \[1\.0\.1\]/{f=1;next} f&&/^## \[/{exit} f' changelog.md)

REV=$(git rev-parse v1.0.1^{commit})
cd "$(brew --repository)/Library/Taps/dct74/homebrew-tap"
git pull --ff-only
perl -0pi -e 's/(tag:\s+")[^"]*(")/${1}v1.0.1${2}/'   Formula/auto-switch-term-theme.rb
perl -0pi -e "s/(revision:\\s+\")[^\"]*(\")/\${1}$REV\${2}/" Formula/auto-switch-term-theme.rb
git commit -am "auto-switch-term-theme 1.0.1"
git push
```

## A note on the `workflow` scope

The `workflow` scope is only required to create or modify files under
`.github/workflows/*` **via an OAuth token over HTTPS or the API**. This machine
has `git config url.git@github.com:.pushInsteadOf https://github.com/`, so git
pushes go over SSH and workflow files need no extra scope. Release creation does
not need it either. If you ever genuinely need it:

```bash
gh auth refresh -h github.com -s workflow   # interactive, opens the browser
```

## Verifying a release

```bash
brew update
brew upgrade auto-switch-term-theme
auto-switch-term-theme --version
brew services restart auto-switch-term-theme
tail -f "$(brew --prefix)/var/log/auto-switch-term-theme.err.log"
```

## Keeping up with upstream

```bash
git fetch upstream
git merge upstream/main        # or: git rebase upstream/main
```

Resolve conflicts, then release a new fork version.

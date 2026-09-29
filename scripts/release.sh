#!/usr/bin/env bash
#
# One-command release for auto-switch-term-theme.
#
#   make release VERSION=1.0.1
#   scripts/release.sh 1.0.1
#   DRY_RUN=1 scripts/release.sh 1.0.1     # print the plan, change nothing
#
# See RELEASING.md. In short: bump package.json, lint + test, commit, tag, push,
# create the GitHub Release from the changelog, then bump the Homebrew tap.
#
set -euo pipefail

PROJECT="auto-switch-term-theme"
REPO="dct74/auto-switch-term-theme"
TAP_REPO="dct74/homebrew-tap"
TAP_DIR="${TAP_DIR:-$(brew --repository 2>/dev/null || echo /opt/homebrew)/Library/Taps/dct74/homebrew-tap}"
FORMULA="$TAP_DIR/Formula/${PROJECT}.rb"
BRANCH="${BRANCH:-main}"
DRY_RUN="${DRY_RUN:-0}"

die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
note() { printf '\n\033[36m==>\033[0m %s\n' "$*"; }

run() {
	if [ "$DRY_RUN" = 1 ]; then
		printf '    [dry-run] %s\n' "$*"
	else
		"$@"
	fi
}

VERSION="${1:-}"
[ -n "$VERSION" ] || die "usage: scripts/release.sh <version>  (e.g. 1.0.1)"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "version must be X.Y.Z (got '$VERSION')"

cd "$(git rev-parse --show-toplevel)"

# --- preconditions ----------------------------------------------------------
[ "$DRY_RUN" = 1 ] || [ -z "$(git status --porcelain)" ] \
	|| die "working tree is not clean; commit or stash first"
[ "$(git rev-parse --abbrev-ref HEAD)" = "$BRANCH" ] || die "must be on branch '$BRANCH'"
git rev-parse --quiet --verify "refs/tags/v$VERSION" >/dev/null && die "tag v$VERSION already exists"
grep -qE "^## \[$VERSION\]" changelog.md \
	|| die "changelog.md has no '## [$VERSION]' entry — add it first (see RELEASING.md)"
command -v gh >/dev/null || die "gh is required"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated (run: gh auth login)"
[ -f "$FORMULA" ] || die "tap formula not found at $FORMULA (run: brew tap dct74/homebrew-tap)"

# --- release notes from the changelog ---------------------------------------
NOTES_FILE="$(mktemp -t "${PROJECT}-notes")"
trap 'rm -f "$NOTES_FILE"' EXIT
awk -v ver="$VERSION" '
	$0 ~ "^## \\[" ver "\\]" { section = 1; next }
	section && /^## \[/ { exit }
	section { print }
' changelog.md > "$NOTES_FILE"
[ -s "$NOTES_FILE" ] || die "could not extract release notes for $VERSION from changelog.md"

note "release $PROJECT v$VERSION"
printf '    repo:  https://github.com/%s\n' "$REPO"
printf '    tap:   %s\n' "$TAP_REPO"
printf '    notes: %s lines from changelog.md\n' "$(wc -l < "$NOTES_FILE" | tr -d ' ')"

# --- 1. bump + verify -------------------------------------------------------
note "1/7 bump package.json, lint, test"
run npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null
run npm run lint
run npm test

# --- 2. commit + tag --------------------------------------------------------
note "2/7 commit + tag"
run git add package.json changelog.md
run git commit -m "$PROJECT $VERSION"
run git tag -a "v$VERSION" -m "v$VERSION"

# --- 3. push ----------------------------------------------------------------
note "3/7 push branch + tag"
run git push origin "$BRANCH"
run git push origin "v$VERSION"

if [ "$DRY_RUN" = 1 ]; then
	REVISION="<new-commit-sha>"
else
	REVISION="$(git rev-parse "v$VERSION^{commit}")"
fi

# --- 4. GitHub release ------------------------------------------------------
# Always pass -R: gh otherwise resolves the "upstream" remote
# (patrik-csak/auto-terminal-profile) and fails with a misleading
# "workflow scope may be required" error.
note "4/7 create GitHub release"
run gh release create -R "$REPO" "v$VERSION" \
	--title "v$VERSION" --notes-file "$NOTES_FILE" --verify-tag

# --- 5. bump the tap formula ------------------------------------------------
note "5/7 update the Homebrew tap formula (tag + revision)"
run git -C "$TAP_DIR" pull --ff-only --quiet
if [ "$DRY_RUN" = 1 ]; then
	printf '    [dry-run] set tag => v%s and revision => %s in %s\n' "$VERSION" "$REVISION" "$FORMULA"
else
	perl -0pi -e "s/(tag:\\s+\")[^\"]*(\")/\${1}v$VERSION\${2}/" "$FORMULA"
	perl -0pi -e "s/(revision:\\s+\")[^\"]*(\")/\${1}$REVISION\${2}/" "$FORMULA"
	grep -q "tag:      \"v$VERSION\"" "$FORMULA" || die "failed to update tag in $FORMULA"
	grep -q "$REVISION" "$FORMULA" || die "failed to update revision in $FORMULA"
fi

# --- 6. commit + push the tap ----------------------------------------------
note "6/7 commit + push the tap"
run git -C "$TAP_DIR" add "Formula/${PROJECT}.rb"
run git -C "$TAP_DIR" commit -m "$PROJECT $VERSION"
run git -C "$TAP_DIR" push origin HEAD

# --- 7. done ----------------------------------------------------------------
note "7/7 done"
printf '\n  release: https://github.com/%s/releases/tag/v%s\n' "$REPO" "$VERSION"
printf '  verify:  brew update && brew upgrade %s && %s --version\n\n' "$PROJECT" "$PROJECT"

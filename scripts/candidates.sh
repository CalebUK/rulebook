#!/usr/bin/env bash
# Prints rule-like lines from a rulebook text file, each tagged with the nearest heading above it,
# as raw material for writing clues. Usage: scripts/candidates.sh <name> [max_lines] [extra_regex]
# <name> is a file in rulebooks_text/ without the .txt extension.
set -euo pipefail
name=$1; max=${2:-40}; extra=${3:-}
file="$(dirname "$0")/../rulebooks_text/$name.txt"

pattern='may not|must not|shall not|not permitted|not allowed|prohibited|forbidden|is a foul|penal|maximum|minimum|at least|no more than|not more than|not less than|seconds|minutes|[0-9] ?(cm|mm|kg|g|m|metres|meters|feet|ft|inches|ounces|lbs|pounds)\b'
[ -n "$extra" ] && pattern="$pattern|$extra"

awk -v pat="$pattern" '
  /^ *((Rule|RULE|Law|LAW|Article|ARTICLE|Section|SECTION) +)?[0-9]+([.:][0-9]+)*[.:]? +[A-Z]/ { h = $0; sub(/^ +/, "", h); h = substr(h, 1, 40) }
  /\.{5,}/ { next }
  tolower($0) ~ pat && length($0) > 50 { line = $0; gsub(/ +/, " ", line); print NR " [" h "] " substr(line, 1, 150) }
' "$file" | awk -v max="$max" '{ a[NR] = $0 } END { step = NR / max; if (step < 1) step = 1; for (i = 1; i <= NR && n < max; i += step) { print a[int(i)]; n++ } }'

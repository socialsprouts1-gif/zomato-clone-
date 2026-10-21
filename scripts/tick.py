# Usage: python3 scripts/tick.py "item text" ["item text" ...]  — ticks matching PROGRESS.md lines
import sys
p = "PROGRESS.md"
s = open(p).read().splitlines()
for want in sys.argv[1:]:
    hits = [i for i, l in enumerate(s) if l.startswith("- [ ] ") and want.lower() in l.lower()]
    if not hits:
        print("NOT FOUND:", want); continue
    for i in hits:
        s[i] = s[i].replace("- [ ] ", "- [x] ", 1)
open(p, "w").write("\n".join(s) + "\n")

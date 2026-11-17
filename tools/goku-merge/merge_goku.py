#!/usr/bin/env python3
"""
GOKU suit merge tool.  Puts a NEW GOKU suit into the CURRENT GOKU folder without harming what GOKU learned.

  python merge_goku.py --old <current GOKU folder> --new <new suit .zip or folder>            (dry run, changes nothing)
  python merge_goku.py --old <current GOKU folder> --new <new suit .zip or folder> --apply    (really merges, after a backup)

Rules (see goku_merge_policy.json to change them):
  PROTECTED (what makes GOKU improve: memory, knowledge, state, user data, traces, tuned config, logs ...)
      - never overwritten, never deleted
      - .json  : additive merge  (keys/items that are missing are added; existing values are kept)
      - .jsonl : lines that are missing are appended
      - other  : old file kept, the incoming version is saved under _merge_pending/ for you to look at
  CODE (everything else): replaced when different (old copy goes to the backup folder)
  NEW files: added.   DUPLICATES (same content already exists at another path): skipped.
  Files that exist only in the old folder are KEPT (nothing is deleted).
  The new suit is only READ (zip is never executed, zip-slip paths are refused).
"""
import argparse, hashlib, json, os, shutil, sys, time, zipfile, fnmatch, tempfile

DEFAULT_POLICY = {
  "protected": ["memory/**", "knowledge/**", "user-data/**", "state/**", "data/**", "training/data/**", "logs/**",
                "evidence/**", "reports/**", "proposals/**", "config/*.json", "execution_traces.jsonl*",
                "apps_profiles.json", "clusters.json", "ZERO_DEFECT_LEDGER*.json", "ledger_status.json"],
  "skip_incoming": ["backups/**", "_to_delete/**", "scratch/**", "**/__pycache__/**", "**/*.pyc", "*.bak", "**/.git/**"],
  "max_file_mb": 200
}

def match(rel, pats):
    rel = rel.replace("\\", "/")
    for p in pats:
        if fnmatch.fnmatch(rel, p) or (p.endswith("/**") and (rel.startswith(p[:-3] + "/"))) or fnmatch.fnmatch(os.path.basename(rel), p):
            return True
    return False

def sha(path_or_bytes):
    h = hashlib.sha256()
    if isinstance(path_or_bytes, bytes): h.update(path_or_bytes)
    else:
        with open(path_or_bytes, "rb") as f:
            for c in iter(lambda: f.read(1 << 20), b""): h.update(c)
    return h.hexdigest()

def safe_rel(name):
    n = name.replace("\\", "/")
    if n.startswith("/") or ".." in n.split("/") or ":" in n.split("/")[0]: return None
    return n

class Source:
    """Read-only view of the new suit (zip or folder). Strips a single top-level folder (e.g. GOKU/)."""
    def __init__(self, path):
        self.path = path; self.files = {}
        if os.path.isdir(path):
            self.kind = "dir"
            for r, _, fs in os.walk(path):
                for f in fs:
                    full = os.path.join(r, f); rel = os.path.relpath(full, path).replace(os.sep, "/"); self.files[rel] = full
        else:
            self.kind = "zip"; self.z = zipfile.ZipFile(path)
            for i in self.z.infolist():
                if i.is_dir(): continue
                rel = safe_rel(i.filename)
                if rel is None: print("REFUSED unsafe path in zip:", i.filename); continue
                self.files[rel] = i
        tops = {r.split("/")[0] for r in self.files if "/" in r}
        if len(tops) == 1 and not any("/" not in r for r in self.files):
            t = tops.pop() + "/"; self.files = {k[len(t):]: v for k, v in self.files.items()}
    def read(self, rel):
        v = self.files[rel]
        if self.kind == "dir":
            with open(v, "rb") as f: return f.read()
        return self.z.read(v)

def merge_json(old, new):
    """additive: keep every old value, add what is missing. returns (merged, changed)"""
    if isinstance(old, dict) and isinstance(new, dict):
        out, ch = dict(old), False
        for k, v in new.items():
            if k not in out: out[k] = v; ch = True
            else:
                m, c = merge_json(out[k], v)
                if c: out[k] = m; ch = True
        return out, ch
    if isinstance(old, list) and isinstance(new, list):
        out, ch = list(old), False
        seen = {json.dumps(x, sort_keys=True) for x in old}
        for x in new:
            k = json.dumps(x, sort_keys=True)
            if k not in seen: out.append(x); seen.add(k); ch = True
        return out, ch
    return old, False  # scalars / type clash: old wins

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--old", required=True); ap.add_argument("--new", required=True)
    ap.add_argument("--apply", action="store_true"); ap.add_argument("--policy"); ap.add_argument("--report", default="merge_report.json")
    a = ap.parse_args()
    pol = dict(DEFAULT_POLICY)
    if a.policy: pol.update(json.load(open(a.policy)))
    old = os.path.abspath(a.old)
    if not os.path.isfile(os.path.join(old, "main.py")): sys.exit("REFUSED: --old does not look like a GOKU folder (no main.py)")
    src = Source(a.new)
    if "main.py" not in src.files: sys.exit("REFUSED: --new does not look like a GOKU suit (no main.py)")

    # index of old content (for duplicate detection)
    old_hash = {}
    for r, _, fs in os.walk(old):
        if match(os.path.relpath(r, old).replace(os.sep, "/") + "/x", ["backups/**", "_merge_backup*/**", "_merge_pending/**"]): continue
        for f in fs:
            full = os.path.join(r, f); rel = os.path.relpath(full, old).replace(os.sep, "/")
            if os.path.getsize(full) <= pol["max_file_mb"] * 1048576: old_hash.setdefault(sha(full), rel)

    stamp = time.strftime("%Y%m%d-%H%M%S"); bdir = os.path.join(old, "_merge_backup_" + stamp); pend = os.path.join(old, "_merge_pending", stamp)
    acts = []  # (action, rel, note)
    plan = []
    for rel in sorted(src.files):
        if match(rel, pol["skip_incoming"]): acts.append(("skip_junk", rel, "")); continue
        data = src.read(rel)
        if len(data) > pol["max_file_mb"] * 1048576: acts.append(("skip_too_big", rel, "")); continue
        h = sha(data); dst = os.path.join(old, rel); prot = match(rel, pol["protected"])
        if os.path.exists(dst):
            if sha(dst) == h: acts.append(("same", rel, "")); continue
            if not prot:
                acts.append(("replace_code", rel, "old copy -> backup")); plan.append(("replace", rel, data)); continue
            # protected + differs
            low = rel.lower()
            try:
                if low.endswith(".json"):
                    o = json.load(open(dst, encoding="utf-8")); n = json.loads(data.decode("utf-8"))
                    m, ch = merge_json(o, n)
                    if ch: acts.append(("protected_json_additive", rel, "added missing keys/items, kept old values")); plan.append(("write_json", rel, m))
                    else: acts.append(("protected_kept", rel, "nothing new to add")); 
                    continue
                if low.endswith(".jsonl") or ".jsonl." in low and not low.endswith(".gz"):
                    have = {l.strip() for l in open(dst, encoding="utf-8", errors="replace") if l.strip()}
                    add = [l for l in data.decode("utf-8", "replace").splitlines() if l.strip() and l.strip() not in have]
                    if add: acts.append(("protected_jsonl_append", rel, f"+{len(add)} lines")); plan.append(("append_lines", rel, add))
                    else: acts.append(("protected_kept", rel, "no new lines"))
                    continue
            except Exception as e:
                acts.append(("protected_kept", rel, "could not parse for merge: " + str(e)[:60])); plan.append(("pending", rel, data)); continue
            acts.append(("protected_kept_new_saved_to_pending", rel, "old kept, incoming saved for review")); plan.append(("pending", rel, data))
        else:
            if h in old_hash and len(data) >= 256 and os.path.basename(rel) != "__init__.py": acts.append(("duplicate_skipped", rel, "same content already at " + old_hash[h])); continue
            acts.append(("add_new", rel, "protected folder" if prot else "")); plan.append(("add", rel, data))
    only_old = []
    new_set = set(src.files)
    for r, _, fs in os.walk(old):
        rr = os.path.relpath(r, old).replace(os.sep, "/")
        if rr.startswith(("_merge_backup", "_merge_pending", "backups", ".git")): continue
        for f in fs:
            rel = (rr + "/" + f if rr != "." else f)
            if rel not in new_set and not match(rel, pol["skip_incoming"]): only_old.append(rel)

    summary = {}
    for k, _, _ in acts: summary[k] = summary.get(k, 0) + 1
    report = {"mode": "APPLIED" if a.apply else "DRY_RUN (nothing changed)", "old": old, "new": a.new, "summary": summary,
              "kept_only_in_old": len(only_old), "actions": [{"action": k, "file": r, "note": n} for k, r, n in acts if k not in ("same", "skip_junk")]}
    if a.apply:
        for kind, rel, payload in plan:
            dst = os.path.join(old, rel); os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
            if kind in ("replace", "write_json", "append_lines") and os.path.exists(dst):
                b = os.path.join(bdir, rel); os.makedirs(os.path.dirname(b), exist_ok=True); shutil.copy2(dst, b)
            if kind in ("replace", "add"): open(dst, "wb").write(payload)
            elif kind == "write_json": json.dump(payload, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            elif kind == "append_lines":
                with open(dst, "a", encoding="utf-8") as f:
                    f.write("\n".join(payload) + "\n")
            elif kind == "pending":
                p = os.path.join(pend, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "wb").write(payload)
        report["backup_folder"] = bdir if os.path.isdir(bdir) else None
        report["pending_folder"] = pend if os.path.isdir(pend) else None
    json.dump(report, open(a.report, "w", encoding="utf-8"), indent=1)
    print(json.dumps({"mode": report["mode"], "summary": summary, "kept_only_in_old": len(only_old), "report": a.report}, indent=1))

if __name__ == "__main__":
    main()

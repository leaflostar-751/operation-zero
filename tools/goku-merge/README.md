# GOKU merge tool

Puts a NEW GOKU suit into your CURRENT GOKU folder. The old GOKU keeps everything it learned; new code and new files are added; duplicates are not created.

```
python tools/goku-merge/merge_goku.py --old C:\GOKU --new C:\Downloads\GOKU_new.zip            # dry run: shows what would change, changes nothing
python tools/goku-merge/merge_goku.py --old C:\GOKU --new C:\Downloads\GOKU_new.zip --apply    # does it (backup first)
```
| What | Rule |
|---|---|
| Protected (memory, knowledge, user-data, state, data, logs, traces, tuned config...) | never overwritten or deleted. `.json`: missing keys/items are added, old values kept. `.jsonl`: missing lines appended. Other types: old kept, new copy saved in `_merge_pending/` |
| Code (everything else) | replaced when different; the old copy goes to `_merge_backup_<time>/` |
| New files | added |
| Same content already at another path | skipped (no duplicates). Tiny files and `__init__.py` are never treated as duplicates |
| Files only in the old folder | kept (nothing is deleted) |
| `backups/`, `_to_delete/`, `scratch/`, `__pycache__`, `*.pyc` from the new suit | ignored |

Safety: the new suit is only read (never executed), zip paths that try to leave the folder are refused, both folders must contain `main.py`, running it twice changes nothing the second time. To change which paths are protected, copy the `protected` list into a JSON file and pass `--policy file.json`.
Tested (SIMULATED, on a copy of GOKU_StageF24b): 11/11 checks passed.

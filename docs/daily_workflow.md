# Git Workflow — Solo Developer (Rebase-Centric)

This workflow keeps your Git history **clean, linear, and easy to read**.
It’s optimized for solo development (no pull requests, no shared dev branch).
You’ll work from short-lived feature branches, rebase them regularly, and merge them fast-forward into `main`.

---

## 🧭 0. One-Time Setup

```bash
git config pull.ff only                 # disallow accidental merge commits on pull
git config push.autoSetupRemote true    # automatically set remote tracking on first push
```

---

## 🪜 1. Make Sure Local Main Is Up to Date

```bash
git switch main
git pull --ff-only origin main
```

**Use this when:**

* Starting your day or beginning new work.
* Before creating a new feature branch.
* Before merging a branch into `main`.

---

## 🌱 2. Start a New Feature Branch

```bash
git switch -c feat/<short_description>
git push -u origin HEAD
```

**Use this when:**

* Starting a new self-contained feature, fix, or refactor.
* You expect to work for more than a few commits.

**Examples:**

* `feat/heat-system`
* `fix/ui-blink`
* `refactor/reelhandler-state`

---

## 🛠️ 3. Work Loop

```bash
git add -A
git commit -m "feat: implement heat system logic"
git push
```

**Use this when:**

* You’ve reached a stable point or logical checkpoint.
* You want a backup or to sync your work across machines.

> 💡 Use **Conventional Commits** for messages (`feat:`, `fix:`, `refactor:`)
> This makes changelogs and versioning much easier later.

---

## 🔄 4. Keep Feature Branch Current with Main

```bash
git fetch origin
git rebase origin/main
# (If conflicts occur: fix files → git add . → git rebase --continue)
git push --force-with-lease
```

**Use this when:**

* The branch has existed for more than one day.
* Before starting new work on a branch after a break.
* Before merging into `main`.
* When you see “branch is behind main” messages from GitHub or CI.

**Skip this when:**

* You just created the branch and main hasn’t moved.
* You’re about to merge immediately.

> 🧠 **Why rebase?**
> Rebasing replays your commits on top of the latest `main`, creating a clean, linear history.
> Always use `--force-with-lease` (not `--force`) to safely update the remote after rebasing.

---

## 🧩 5. Merge Finished Feature into Main

```bash
git switch main
git pull --ff-only origin main
git merge --ff-only feat/<short_description>
```

**Use this when:**

* Your feature is complete and tested.
* You’ve rebased recently and a fast-forward is possible.

> 💡 If fast-forward fails:
>
> 1. Go back to your feature branch (`git switch feat/...`)
> 2. Re-run Step 4 (rebase on latest main)
> 3. Then retry this merge.

---

## 🚀 6. Push Updated Main to Remote

```bash
git push origin main
```

**Use this when:**

* You’ve merged a feature into main locally.
* You want the remote `main` (e.g., on GitHub) to match your local state.

---

## 🧹 7. Clean Up Feature Branches

```bash
git branch -d feat/<short_description>
git push origin --delete feat/<short_description>
```

**Use this when:**

* The branch is merged into `main`.
* You want to keep your workspace tidy.

---

## 💡 Optional: Tag Releases

```bash
git tag -a v0.1.0 -m "Vertical Slice 0.1.0"
git push origin --tags
```

**Use this when:**

* You’ve hit a stable milestone or vertical slice.
* You want to create rollback points for builds or demos.

---

## 🧭 Quick “When to Do Step 4” Cheatsheet

| Situation                            | Should You Rebase? | Notes                         |
| ------------------------------------ | ------------------ | ----------------------------- |
| Long-running feature branch          | ✅ Yes              | Do daily or before pushing    |
| Resuming work after a break          | ✅ Yes              | Keeps diffs small             |
| Right before merging                 | ✅ Yes              | Ensures fast-forward possible |
| Same-day branch with no main updates | 🚫 No              | Not needed                    |
| Hotfix directly on main              | 🚫 No              | Commit directly to main       |

---

## 🧪 Variants & Special Cases

### A) Squash Merge (for messy commit histories)

```bash
git switch main
git pull --ff-only origin main
git merge --squash feat/<short_description>
git commit -m "feat(<area>): concise summary"
git push origin main
```

**Use this when:**
Your feature branch has a bunch of noisy WIP commits you want to collapse into one.

---

### B) Tiny Hotfix Directly on Main

```bash
git switch main
git pull --ff-only origin main
# make changes
git add -A
git commit -m "fix: urgent hotfix"
git push origin main
```

**Use this when:**
The fix is urgent, obvious, and low-risk.

---

### C) Abandoning a Feature

```bash
git switch main
git pull --ff-only origin main
git push origin --delete feat/<short_description>
git branch -D feat/<short_description>
```

**Use this when:**
You want to delete an unfinished or abandoned feature branch safely.

---

### D) Experimental Branch Workflow (Risky Systems or Refactors)

Use this when you’re making major changes that might break your current feature branch but still want to experiment safely.

```bash
# 1. Commit & push your current feature branch
git add -A
git commit -m "checkpoint: stable before experiment"
git push

# 2. Create an experimental sub-branch from your current feature
git switch -c exp/<short_description>
git push -u origin HEAD    # optional backup on remote

# 3. Work normally on the experimental branch
git add -A
git commit -m "WIP: experiment with new system"
git push

# 4. Merge experiment back into feature branch when stable
git switch feat/<feature_branch>
git pull --ff-only origin feat/<feature_branch>
git merge --ff-only exp/<short_description>
git push origin feat/<feature_branch>

# 5. Clean up
git branch -d exp/<short_description>
git push origin --delete exp/<short_description>
```

**Use this when:**

* You want to test a large or risky refactor safely.
* You’re experimenting on a core system (e.g., combat, round flow, heat, reel logic).
* You might need to discard the experiment entirely if it fails.

---

## 🧩 Commands-Only Reference

```bash
# Update main
git switch main
git pull --ff-only origin main

# New feature
git switch -c feat/<short_description>
git push -u origin HEAD

# Work loop
git add -A
git commit -m "feat: short description"
git push

# Sync with main
git fetch origin
git rebase origin/main
# fix → git add . → git rebase --continue
git push --force-with-lease

# Merge into main
git switch main
git pull --ff-only origin main
git merge --ff-only feat/<short_description>

# Push updated main
git push origin main

# Cleanup
git branch -d feat/<short_description>
git push origin --delete feat/<short_description>

# Tag milestone
git tag -a v0.1.0 -m "Vertical Slice 0.1.0"
git push origin --tags
```

---

## 🧠 Pro Tips

* Use `git status` constantly. It’s your best friend for sanity.
* Run `git log --oneline --graph --decorate --all` to visualize your branches.
* Alias common commands in your `.gitconfig` for speed:

  ```bash
  [alias]
    st = status
    co = checkout
    sw = switch
    br = branch
    lg = log --oneline --graph --decorate --all
  ```
* If you get stuck mid-rebase:

  ```bash
  git rebase --abort
  ```

  to safely go back to your last clean state.

---

**Author:** Jess Rivera
**Last updated:** October 2025
**Purpose:** Canonical workflow for Classic Cassie development

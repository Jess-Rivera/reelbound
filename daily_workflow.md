# Slotspire Daily Workflow

## 🎯 Overview
A repeatable loop for daily and weekly development in Slotspire. Keeps design, code, and planning synced across your GitHub repo, Projects board, and local environment.

---

## 🕓 Before You Start Coding
1. **Sync your repo**
   ```bash
   git checkout dev
   git pull origin dev
   ```
2. **Open your Project board**  
   - Filter to **Ready to Build** and **In Progress**.
   - Pick one clear task for today.
3. **If creating a new feature/idea**
   - Add a draft card in **Concept / Design**.
   - Flesh out notes or link to `/docs/design/...md`.
   - When ready to implement:
     - Convert to Issue → repo: `Jess-Rivera/reelbound`
     - Label: `feature`, `system`, etc.
     - Set fields: Status = Ready to Build, Stage = Spec’d, Version Target = v0.1
4. **Create a local branch**
   ```bash
   git checkout -b feature/<short-description>
   ```
   Example: `feature/runmanager-heat`

---

## 🧠 During Your Session
1. **Write small, focused commits**
   ```bash
   git add .
   git commit -m "feat(run): add heat persistence (#23)"
   ```
2. **Test frequently**  
   - `npm run dev` → confirm reels, heat, and UI work correctly.
   - Add quick TODOs or observations in the card’s comments.
3. **Keep your Project updated**  
   - Change **Status** → In Progress.
   - Add context to the card thread (mini dev log).

---

## 🧪 After Testing
1. **Commit and push**
   ```bash
   git push -u origin feature/<branch>
   ```
2. **Open a Pull Request**  
   - Base = `dev`
   - Title = same as issue (`feat(run): …`)
   - Description = short summary + “Closes #23”
3. **Review and merge**  
   - Run `npm run build` locally once.
   - Merge when stable.
   - Card auto-moves to **Playtest / Review**.

---

## 🕹️ Playtesting & Review
1. Switch to **Playtest / Review** column.
2. Play a full run; note bugs or balance tweaks.
3. When satisfied:
   - Stage → Tested
   - Status → Done
   - Version Target = v0.1

---

## 🧾 End of Day / Session Wrap-Up
1. **Push everything**
   ```bash
   git add .
   git commit -m "chore: save WIP"
   git push
   ```
2. **Update docs**  
   - Append notes to `/docs/DEVLOG.md` or `/CONTEXT_SUMMARY.md`.
3. **Clean your Project board**  
   - Finished → Done  
   - Half-done → In Progress  
   - New ideas → Concept / Design

---

## 🪩 Weekly & Milestone Habits
| Cadence | Task |
|----------|------|
| Weekly | Review Playtest column → promote stable cards to Done. |
| Milestone | Tag a release:  
`git checkout main && git merge dev && git tag -a v0.x.0 -m "Milestone notes"`  
`git push origin main --tags` |
| Monthly | `npm run changelog` → update `docs/CHANGELOG.md`. |

---

## 🧩 Visual Summary
| Phase | What you do | Where |
|--------|--------------|-------|
| Concept | Draft → convert to Issue | Project “Concept / Design” |
| Build | Branch, code, commit | Local + GitHub Issues |
| Test | Merge PR, playtest | Project “Playtest / Review” |
| Release | Tag, changelog, deploy | GitHub main branch |

---

## 🧭 Quick Command Reference
```bash
# Sync latest dev work
git checkout dev && git pull

# Create feature branch
git checkout -b feature/<name>

# Stage + commit
git add . && git commit -m "feat(scope): summary (#issue)"

# Push + open PR
git push -u origin feature/<name>

# Merge + tag release
git checkout main && git merge dev && git tag -a v0.x.0 -m "notes"
git push origin main --tags
```


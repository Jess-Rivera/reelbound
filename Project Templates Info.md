

## 🧱 **Project Board Template: “Slotspire Development Flow”**

### 🔷 Columns / Views (Kanban layout)

| Column                   | Purpose                                 | Typical Cards                                      |
| ------------------------ | --------------------------------------- | -------------------------------------------------- |
| 🧩 **Concept / Design**  | Raw ideas, mechanics, balance thoughts  | “Heat escalation stages,” “Ticket economy scaling” |
| 📘 **Ready to Build**    | Design finalized, ready for coding      | “Implement RunManager heat persistence”            |
| 🔧 **In Progress**       | Feature currently being coded           | “RunManager save/load hooks”                       |
| 🧪 **Playtest / Review** | Implemented but needs balancing or test | “Boss node reward tuning”                          |
| ✅ **Done**               | Fully integrated & stable               | —                                                  |

---

### 🏷️ **Labels**

Create these under *Settings → Labels* in your repo:

| Label           | Color         | Description             |
| --------------- | ------------- | ----------------------- |
| `concept`       | 🟪 violet     | Design idea or mechanic |
| `feature`       | 🟩 green      | Code feature            |
| `bug`           | 🟥 red        | Bug or regression       |
| `ui`            | 🟦 blue       | Interface / visual work |
| `system`        | 🟧 orange     | Core game systems       |
| `balance`       | 🟨 yellow     | Gameplay tuning         |
| `priority:high` | 🔴 bright red | Needs attention soon    |
| `priority:low`  | ⚪ gray        | Back-burner             |

---

### ⚙️ **Custom Fields (Projects → Fields → + New Field)**

| Field              | Type          | Example Values                                      | Use                              |
| ------------------ | ------------- | --------------------------------------------------- | -------------------------------- |
| **Stage**          | Single select | Idea / Spec’d / In Progress / Coded / Tested / Done | Tracks lifecycle inside a column |
| **System Area**    | Single select | Core / Combat / Meta / UI                           | Helps filtering                  |
| **Priority**       | Single select | High / Medium / Low                                 | Quick triage                     |
| **Estimate (hrs)** | Number        | 2 → 8 → 16                                          | Optional self-planning           |
| **Version Target** | Text          | v0.1, v0.2                                          | Tie to roadmap milestone         |

---

### 🔗 **Linking conventions**

When creating issues or PRs:

**Issue title**

```
feat(run): add heat persistence
```

**Description**

```
Relates to concept: #12 (Heat Carry-Over System)
Design doc: [docs/design/heat_system.md](docs/design/heat_system.md)
```

**Commit message**

```
feat(run): add heat persistence (#34)
```

→ closes the issue & updates Project card automatically.

---

### 🔍 **Saved Views / Filters**

Create these saved filters at the top of your Project board:

| View Name                   | Filter Query                       | Purpose                          |
| --------------------------- | ---------------------------------- | -------------------------------- |
| 🧠 **Concepts Only**        | `label:concept`                    | See design ideas waiting to spec |
| 🔧 **Features In Progress** | `label:feature status:In Progress` | Active dev work                  |
| 🧪 **Playtest Queue**       | `status:Playtest / Review`         | What to test this week           |
| 🕹️ **v0.1 Vertical Slice** | `Version Target=v0.1`              | Milestone filter                 |
| 🐞 **Bugs / Polish**        | `label:bug OR label:balance`       | QA and tuning backlog            |

---

### 🚀 **Usage Routine**

1. **Design idea:** add card → label `concept` → Stage = Idea
2. Flesh out design in `/docs/design/` → link it → Stage = Spec’d
3. Move to **Ready to Build** → create implementation issues
4. While coding, link commits/PRs to the issue → Stage = In Progress
5. Merge → move to **Playtest / Review** → Stage = Tested
6. Once stable → move to **Done** & tag roadmap milestone (`v0.1`)

---

### 🧩 Optional JSON Template (ready to import)

If you’d like, I can generate a JSON file (`slotspire-project-template.json`) that you can import directly into GitHub Projects to pre-create:

* Columns
* Fields
* Labels
* Default views

Would you like me to create that importable JSON next?

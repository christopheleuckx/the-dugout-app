---
name: backlog
description: Show or add to the feature backlog of The Dugout (BACKLOG.md). Use when Christophe types /backlog, asks what is on the backlog, or wants to park an idea for later.
argument-hint: "[add <idea> | question]"
---

The feature backlog of The Dugout is `BACKLOG.md` in the root of the-dugout-app (`/Users/christopheleuckx/Desktop/Q3 2026/the-dugout-app/BACKLOG.md`). Read it first.

- **No arguments:** give a short overview grouped by section. Per item: the title, its status (idea / ready / planned) and one line on what it is. End with a count per status.
- **`add <idea>`:** add the idea to the section it fits (make a new section if none fits) with status **idea**, today's date and a one-line "What", in the same format as the other items. Commit and push BACKLOG.md in the-dugout-app, then show the updated overview.
- **Anything else:** treat it as a question about the backlog (for example "what is ready?") and answer from the file.

Answer in the language he writes in (usually Dutch); keep the item titles as they are in the file. Do not build anything from the backlog unless he asks for it. When an item gets built, remove it from the file.

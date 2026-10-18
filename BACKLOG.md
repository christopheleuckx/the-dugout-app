# Feature backlog – The Dugout

Ideas that are agreed but not yet built. Newest at the bottom of each section.
Status: **idea** (not yet worked out) · **ready** (clear what to build) · **planned** (next up).

## Club and teams

### Team name and colour per age group
- **Status:** ready
- **Added:** 18 Oct 2026
- **What:** an admin can rename the teams of an age group (for example "Blue" and "Red" become "Dender A" and "Dender B") and choose their colour.
- **Where:** Club management → club → age group.
- **Notes:** the names and colours already live in the database (`teams.name`, `teams.color`); only the screen to change them is missing. The jersey colour in line-ups and the labels on games follow automatically.

### Admin per club
- **Status:** idea
- **Added:** 18 Oct 2026
- **What:** next to the lead admin (everything), an admin who manages only their own club: its age groups, coaches, logo and video setting.
- **Notes:** needs a change to the live database access rules, so a dry run first. Only useful once there is a second club.

## Players

### Photo upload on the player page
- **Status:** ready
- **Added:** 17 Oct 2026
- **What:** a button on the player page to take or choose a photo; 8 players still have no photo.
- **Notes:** photos stay in the private bucket `player-photos`.

## Later

### Web app rebuilt from the app
- **Status:** idea
- **What:** rebuild the Football Hub web app from the same Expo codebase as The Dugout. First an inventory of what the web app does that the app does not.

### Separate backend for club setup
- **Status:** idea
- **What:** creating clubs, age groups and coaches in a small separate admin backend instead of inside the app.

### Export to ProSoccerData
- **Status:** idea
- **What:** export players and games in the structure ProSoccerData expects.
- **Notes:** only once their import format is known, and with the club's consent (children's data).

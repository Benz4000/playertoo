# Player Too

Match with people who play what you play. Swipe on players who share your games, rank, platform and schedule, and match for a **date**, a **duo**, or both.

It's a static site hosted on GitHub Pages, with [Supabase](https://supabase.com) as the whole backend (login, database, photo storage and live chat). There's no server code to run.

## Try it

With `js/config.js` left empty, the app runs in **demo mode**: a dozen made-up players, all stored in your browser. Open the GitHub Pages link, tap **Try the demo**, set up a profile and start swiping.

To run it locally:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Go live with real users (free)

1. Create a free project at [supabase.com](https://supabase.com).
2. In Supabase, open **SQL Editor**, paste in [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. In **Authentication → URL Configuration**, set **Site URL** to your GitHub Pages address (for example `https://benz4000.github.io/player-too/`).
4. In **Project Settings → API**, copy the **Project URL** and the **anon public** key into `js/config.js`, then commit.

The anon key is meant to be public. Row level security in the schema makes sure people can only change their own profile, only see their own swipes, and only read chats they're part of. Other players' birthdays are never exposed, just their age.

## How matching works

- Players only see people whose preferences line up: both want a date (and are into each other's gender), or both want a duo.
- Cards are ranked by what you have in common: +10 per shared game, +4 more if your ranks are within one tier, +5 per shared platform, +8 for the same region and +3 per overlapping play time. See `js/matching.js`.
- When two people like each other, the database creates the match automatically and chat opens up.

## Safety

- 18+ only, enforced by the database.
- Block and report from any card or chat. Blocking removes the match and hides both players from each other.
- Reports land in the `reports` table in Supabase for review.

## Project layout

```
index.html              app shell
css/style.css           styles
js/app.js               screens: sign in, profile, discover, matches, chat
js/matching.js          compatibility + scoring
js/games.js             game list and rank ladders
js/backend-supabase.js  real backend
js/backend-demo.js      in-browser demo backend
supabase/schema.sql     tables, security rules, match trigger, functions
```

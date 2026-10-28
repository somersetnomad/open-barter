# Open Barter

**Wincanton Open Barter** is the first community running on Open Barter. Starting one for your own town? Copy this repository and change "Wincanton" to your town's name: see [Make it your town's](#make-it-your-towns) below.

**Live site:** https://somersetnomad.github.io/open-barter/

> **Forking?** `config.js` in this repository points at the live database. Blank out `supabaseUrl` and `supabaseAnonKey` in your copy to start in demo mode, then connect your own Supabase project.

A free, open-source barter website any community can run: a neighbourhood, a village, a club, a skills-swap group. It's a static site hosted on **GitHub Pages**, with a free **Supabase** database behind it.

People list what they **offer** and what they **want**. The site finds direct swaps and **trade circles**, and community **credits** fill the gaps. Everyone has to agree before anything happens. Contact details stay private until then, and both sides confirm once the swap has taken place.

It runs in **demo mode** straight after you fork it, with sample members and data kept in the visitor's browser. That lets you try everything before connecting a database.

---

## The problems with barter, and what this site does about them

| Problem | What goes wrong | How Open Barter handles it |
|---|---|---|
| **Double coincidence of wants** | You have bread and want a bike fixed. The mechanic doesn't want bread. | **Trade circles.** The site searches for loops of up to 5 people (A→B→C→A) where everyone gets something they asked for. Direct two-person swaps are found too. |
| **No common measure of value** | Is a haircut worth a lamp? | Listings can show a rough value in credits. The proposal screen shows the difference and suggests credits to balance it. |
| **Indivisibility** | You can't trade a third of a bicycle. | **Mutual credit.** Anyone can pay for things, or be paid, in credits. Everyone starts at 0, and credits are only created when a trade completes (your +5 is someone else's −5), so all balances always add up to zero. Nobody can mint or buy them. |
| **Freeloading** | Someone takes and never gives. | Balances have a floor: new members can only go to −20, established members to −100 (you can change these). An optional ceiling stops hoarding. Balances are shown on profiles. |
| **Trust and no-shows** | Scams, misdescribed items, people who vanish. | Every party must accept, and every party must confirm completion. Feedback can only be left after a completed trade. Profiles show completed trades and feedback. Cancelling isn't allowed once someone has confirmed; a dispute goes to a moderator instead. |
| **Privacy and safety** | Sharing phone numbers and addresses with strangers. | Contact details are revealed only to people in a trade after everyone accepts. Email addresses are never shown. Every trade has its own message thread. Safety guidance is built in. |
| **Things traded twice** | Two people both agree to take the same chair. | One-off items become "traded" when a trade completes. Other open proposals for that item are cancelled automatically. Skills and services can be marked repeatable. |
| **Spam and abuse** | Junk listings, bad actors. | Members must accept the community rules first. There are limits on listings, proposals per day and message rates. Anyone can report a listing, member or trade, and moderators can remove listings, suspend members and settle disputes. |
| **Stale offers** | Old proposals that nobody answered. | Unanswered proposals expire after 14 days. |
| **Cheating the rules** | Someone edits the website code in their browser to give themselves credits. | All rules run **inside the database**, not in the browser. The site can only call a fixed set of functions, and the tables can't be read or written directly. |
| **Tax** | Barter can count as income for businesses. | The rules page carries a short, general note. It isn't legal advice. |

---

## Make it your town's

This copy is set up for **Wincanton**. To run one for your own town:

1. **Fork** this repository (or download it and upload it to a new one).
2. In `config.js`:
   - change `name: 'Wincanton Open Barter'` to your town, for example `'Frome Open Barter'`
   - blank out `supabaseUrl` and `supabaseAnonKey`, so your copy starts in demo mode instead of using Wincanton's database
   - list your own neighbourhoods or nearby villages in `areas` (or leave it empty to let people type their own)
3. In `index.html`, change "Wincanton" and the web address in the link-preview (`og:`) tags.
4. Follow **Go live** below to connect your own free database. Then make your own link-preview picture on the site's **For organisers** page and save it as `assets/social-card.png`.

## Try the demo

1. Fork this repository on GitHub.
2. Go to **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, then **Save**.
3. After a minute your site is live at `https://YOUR-NAME.github.io/REPO-NAME/`.

It opens in demo mode. Use **Viewing as** in the yellow bar to switch between sample members. Alice, Bob and Chidi form a three-way circle: as Alice, open **Matches** and propose it, then switch to Bob and Chidi to accept and confirm. Alice is also a moderator, so you can see the moderation page.

Demo data lives only in each visitor's browser (it runs the real database code with [PGlite](https://pglite.dev)). **Reset demo data** puts it back to the start.

---

## Go live (about 20 minutes, no coding)

### 1. Create the database

1. Sign up at [supabase.com](https://supabase.com) and create a new project. The free plan is enough for a community site. Choose a region near your members.
2. Open **SQL Editor → New query**. Paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. Optional, for photos on listings: run [`supabase/storage.sql`](supabase/storage.sql) the same way.

### 2. Set up sign-in

Members sign in with a link sent to their email, so there are no passwords to manage.

1. In Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your GitHub Pages address, for example `https://your-name.github.io/open-barter/`.
3. Add the same address under **Redirect URLs**.
4. Supabase's built-in email sender is only meant for testing and has a low hourly limit. For a real community, connect your own email provider under **Authentication → SMTP Settings** (for example Resend, Brevo or Postmark; most have free tiers).

### 3. Connect the site

1. In Supabase, open **Project Settings → API** (or **API Keys**). Copy the **Project URL** and the **anon / publishable** key.
2. In your GitHub repository, edit [`config.js`](config.js) and paste them into `supabaseUrl` and `supabaseAnonKey`.
   - These are meant to be public. The database rules protect your data.
   - Never paste the `service_role` or secret key anywhere in this repository.
3. While you're in `config.js`, set your community's name, tagline, areas, categories and rules.
4. Commit the change. GitHub Pages republishes within a minute or two.

### 4. Make yourself a moderator

Sign in on your site once so your account exists. Then run this in the SQL Editor, using the display name you chose:

```sql
update profiles set is_moderator = true where display_name = 'Your Name';
```

Moderators see a **Moderation** link in the footer. It lists reports and disputes. Moderators can also suspend members from their profile page.

---

## Promote your swap

The site has a built-in guide at **For organisers** (link in the footer, or `#/organisers`). It covers:

- **Launching:** seed 30 or more listings with founding members before going public, so newcomers never see an empty site.
- **Free grassroots tactics:** noticeboards, newsletters, local online groups, swap meets, partner groups and local media.
- **Ready-made posts:** a WhatsApp message, a group post, a newsletter blurb, an email to a library or café, and a press release. They fill in your name and address automatically and have a copy button.
- **A printable A4 poster** (`#/poster`) with a QR code, current offers and tear-off strips.
- **Pictures for social media:** a square post image and the link-preview image.
- **Doing it the right way:** asking permission, no flyposting, respecting people's data.

Every listing also has share buttons (WhatsApp, Facebook, X, email, copy link, and the phone's own share menu). Members can also download a picture of the listing as a swing tag, with a QR code that opens it. Shared links use `?l=<id>`, so they survive apps that strip the `#` part of a web address.

### Link previews

When someone pastes your address into Facebook, WhatsApp or X, those apps read the tags at the top of `index.html`. They can't run the site's code, so every link (including listing links) shows the same community preview. To make it yours:

1. On **For organisers → Posters and pictures**, click **Download link preview**.
2. Save it in your repository as `assets/social-card.png`, replacing the sample.
3. In `index.html`, change the `og:` tags to your community's name, description and web address.

## Use your own web address

Your site works for free at `your-name.github.io/repo-name`. A domain of your own (for example `yourtownbarter.org`) is easier to say and to print. The organisers' guide has the full walkthrough; in short:

1. Buy a domain from any registrar, and turn on auto-renew. Or, for free, ask a local group that already has a website to give you a sub-address such as `swap.their-domain.org`.
2. Verify the domain on GitHub: **your profile picture → Settings → Pages → Add a domain**. This stops anyone else claiming it.
3. In your repository: **Settings → Pages → Custom domain**, enter it and save.
4. At your registrar, add DNS records. For a sub-address, add a `CNAME` pointing to `your-name.github.io`. For a main address, add four `A` records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`, plus a `CNAME` for `www`. Never use wildcard (`*`) records.
5. When GitHub shows the domain is working (DNS can take up to a day), tick **Enforce HTTPS**.
6. Update Supabase **Authentication → URL Configuration** (Site URL and Redirect URLs), set `siteUrl` in `config.js`, update the `og:` tags in `index.html`, and reprint posters.

See GitHub's guide to [managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) for details.

---

## Customise it

**Everything in `config.js`:** name, tagline, web address (`siteUrl`), what credits are called, areas, categories, rules, the list of things not allowed, a moderator contact email, and the link to your copy of the code.

**Credit limits and other rules** live in the database, so nobody can get round them. Change them in the SQL Editor:

```sql
update settings set
  credit_limit = 100,             -- how far below zero established members can go
  new_member_credit_limit = 20,   -- how far below zero new members can go
  established_after_trades = 3,   -- completed trades before someone is "established"
  max_balance = null,             -- e.g. 300 to stop hoarding; null for no ceiling
  public_balances = true,         -- show balances on public profiles
  max_trade_parties = 5,          -- biggest trade circle
  max_active_listings = 30,
  new_member_max_listings = 6,
  max_proposals_per_day = 15,
  proposal_expiry_days = 14
where id = 1;
```

**Colours and fonts:** edit the tokens at the top of [`assets/style.css`](assets/style.css). Offers use the blue `--offer` colour, wants use the mustard `--want-string` colour. Dark mode follows the visitor's device.

**Time-bank style:** to run it as a time bank, set `creditName: 'hours'` and `creditNameSingular: 'hour'` in `config.js` and value everything in hours.

---

## How matching works

When someone opens **Matches**, the database:

1. Pairs each active offer with each active want in the **same category**, from a different person.
2. Keeps pairs that share **keywords** (from titles, descriptions and the keywords field; filler words are ignored) and that are **reachable**: posted, online, or in the same area.
3. Treats each pair as an arrow "A can give B something B wants", and searches for loops that start and end with you, up to the circle size limit.

Better titles and keywords give better matches. With thousands of active listings the search will slow down. At that point, add a full-text index, or split into several community sites.

---

## What's in the repository

```
index.html            the page shell
config.js             your community's settings
assets/app.js         the interface (no build step, no framework)
assets/api.js         talks to Supabase, or to the in-browser demo database
assets/share.js       share links, QR codes and downloadable pictures
assets/organisers.js  the organisers' guide and printable poster
assets/vendor/        QR code generator (MIT, Kazuhiko Arase)
assets/social-card.png  the link-preview picture
assets/style.css      look and feel
supabase/schema.sql   tables, rules and all the functions the site calls
supabase/storage.sql  optional photo uploads
demo/                 sample data and stand-ins used by demo mode
tests/                automated tests of the database rules
```

There is no build step. Edit a file, commit, and GitHub Pages publishes it.

### Security model

- Row Level Security is on for every table, with no policies, so the website can't read or write tables directly.
- The site can only call the functions listed at the end of `schema.sql`. Each one checks who is signed in and applies the rules.
- Contact details, email addresses and other people's trades are never returned to anyone who shouldn't see them.
- Everything shown on the page is escaped, so listings can't inject code.

### Running the tests

```bash
npm install
npm test
```

The tests load the real `schema.sql` into an in-memory Postgres (PGlite) and check trade circles, credit limits, contact privacy, double-trading, disputes, bans and listing limits. A GitHub Action runs them on every push.

To preview locally, run `npm start` and open `http://localhost:8000`.

---

## Known limits

- **No email notifications yet.** Members see a badge on **Trades** when something needs their answer. Supabase Database Webhooks or an Edge Function could send emails; contributions welcome.
- **Free hosting has limits.** Check Supabase's current free-plan terms. Free projects may be paused after a period of inactivity.
- **Moderation needs people.** The tools are here, but a community needs at least one active moderator.
- **Not legal or tax advice.** In some countries, including the UK, bartering as part of a business can count as taxable income. Check what applies to your group.

## Licence

MIT. Use it, change it, run it for your community. See [LICENSE](LICENSE).

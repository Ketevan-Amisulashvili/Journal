# Palimpsest: a bilingual literary journal

A Georgian–English journal for philosophical essays, criticism, prose and poetry, with a built-in reader discussion under every piece. It runs entirely on free services and you never need to touch code.

- **Readers** get a front page, an archive with filters, every piece in Georgian and English (or side by side, line by line for poems), margin footnotes, light/dark mode, adjustable text size, a "text only" mode, and a discussion with replies. No reader account needed to comment.
- **You** write in a browser editor at `yoursite/admin/`, moderate comments at `yoursite/moderate/`, and every save goes live about a minute later.

Everything is free: GitHub (stores your writing), Cloudflare Pages (publishes the site and runs the discussion), Cloudflare D1 (stores comments). No credit card.

---

## One-time setup (about 30 minutes)

### 1. Put the files on GitHub

1. Create a free account at **github.com** if you don't have one.
2. Click **+** (top right) → **New repository**. Name it, for example, `journal`. Choose **Public** or **Private** (both work). Don't tick any of the "Add a README" boxes. Click **Create repository**.
3. On the next page click the link **uploading an existing file**.
4. Unzip `journal.zip` on your computer. Open the `journal` folder, select **everything inside it** (not the folder itself), and drag it onto the GitHub page. Wait for all files to finish, then click **Commit changes**.

### 2. Tell the editor where your files are

1. In your repository on GitHub, open `public` → `admin` → `config.yml`, then click the pencil icon (Edit).
2. Change the line
   `repo: YOUR-GITHUB-USERNAME/YOUR-REPOSITORY-NAME`
   to your own, e.g. `repo: your-username/journal`.
3. Click **Commit changes**.

### 3. Publish the site on Cloudflare Pages

1. Create a free account at **dash.cloudflare.com**.
2. Go to **Workers & Pages** → **Create** → choose the **Pages** tab → **Connect to Git** (Cloudflare may also show this as "Import an existing Git repository"). Connect your GitHub account and pick your `journal` repository.
3. On the build settings screen enter exactly:
   - **Framework preset:** None
   - **Build command:** `node build.mjs`
   - **Build output directory:** `dist`
4. Click **Save and Deploy**. After a minute you get an address like `https://journal-abc.pages.dev`. The site is live.

### 4. Switch on the discussion

1. In Cloudflare, go to **Storage & Databases** → **D1 SQL Database** → **Create**. Name it `journal-comments` and create it. (The tables set themselves up automatically.)
2. Go back to **Workers & Pages** → your project → **Settings** → **Bindings** → **Add** → **D1 database**. Variable name: `DB` (capital letters). Database: `journal-comments`. Save.
3. Still in **Settings**, open **Variables and Secrets** → **Add**. Type: **Secret**. Name: `ADMIN_PASSWORD`. Value: a long password only you know (at least 8 characters). Save.
4. Open **Deployments**, click the **⋯** next to the latest one → **Retry deployment**. Settings only take effect on a new deployment.

Open any piece on your site and scroll down: you can now post a comment.

### 5. Sign in to the editor

1. Go to `https://your-address.pages.dev/admin/`.
2. Click **Sign In with Token**. The dialog links to GitHub's token page with the right permissions already selected. If you create the token yourself, choose a **fine-grained token**, give it access to **only** your journal repository, and set **Contents** to **Read and write**.
3. Copy the token, paste it into the dialog, and you're in. Your browser remembers it. When the token expires (you choose how long), make a new one the same way.

### 6. Make it yours

In the editor, open **Site settings** and fill in the journal's name in both languages, the tagline, your name, and your site address (e.g. `https://journal-abc.pages.dev`). Then edit **Pages → About the journal**, and delete or replace the three sample pieces.

A custom domain (e.g. `palimpsest.ge`) can be added later under your Pages project → **Custom domains**. The domain itself costs money; everything else stays free.

---

## Everyday writing

- **New essay:** Editor → **Essays & criticism** → **New**. Write the Georgian version, then switch the language menu at the top of the editor to **en** and write the English. Fields marked as shared (date, section, web address) are copied automatically.
- **No translation yet?** Leave English empty or turn the English locale off for that entry. The English site shows the Georgian original with a note saying it isn't translated yet.
- **Web address:** short Latin letters and hyphens, e.g. `on-silence`. Don't change it after publishing, or links (and the discussion) will break.
- **Footnotes:** type `[^1]` where the note belongs. At the very end, add a new paragraph: `[^1]: The text of the note.` They appear in the margin on wide screens and as tap-to-open notes on phones.
- **Poems:** use **Poems**. Every line break is kept exactly. An empty line starts a new stanza. Start a line with two spaces to indent it.
- **Side by side:** stanzas (poems) and paragraphs (essays) line up in order. Keep the same number in both languages for a clean match.
- **Drafts:** tick **Draft** to save without publishing.
- **Front page:** tick **Feature on the front page** on the essay you want at the top.
- **Images:** use the image button in the editor; files are stored in `public/images/uploads`.

Each time you save, the site rebuilds automatically. Changes appear within about a minute.

## Moderating the discussion

Go to `https://your-address.pages.dev/moderate/` and enter your `ADMIN_PASSWORD`. You can:

- **Hide** or **Delete** comments (deleting a comment also deletes its replies),
- **Reply as author**: your reply is marked with an "Author" badge,
- **Approve** comments, if you've turned on **Hold new comments until I approve them** in Site settings.

Spam protection is built in: a hidden trap field, a minimum time on the page, a limit of five comments per ten minutes per visitor, at most three links per comment, and comments only on pieces that exist. Comments are shared between the Georgian and English versions of a piece.

## Free-tier limits (generous for a journal)

- Cloudflare Pages: unlimited visitors for the pages themselves, 500 site rebuilds a month (one per save).
- Discussion: 100,000 comment requests a day on the free Workers plan, plus daily database read and write limits that a journal won't come near.
- GitHub: free.

## What's in this folder (for anyone helping you later)

| Path | What it is |
|---|---|
| `content/` | All writing: `essays/`, `poems/`, `pages/`, `settings.json`. Each piece is `name.ka.md` + `name.en.md`. |
| `build.mjs`, `src/` | The site builder. Plain Node.js, no packages to install. |
| `assets/` | Design (`site.css`), reader features (`site.js`), discussion (`comments.js`). |
| `functions/api/` | The discussion server (`comments.js`) and moderation API (`moderate.js`). |
| `shared/discussion.js` | Database setup and spam checks used by both. |
| `public/admin/` | The writing editor (Sveltia CMS) and its settings. |
| `public/moderate/` | The moderation page. |
| `dev.mjs` | Optional local preview: `node build.mjs && node dev.mjs`, then open http://localhost:8788 (needs Node 22+). |

Colours and fonts are set at the top of `assets/site.css`. Interface wording in both languages is in `src/i18n.mjs`.

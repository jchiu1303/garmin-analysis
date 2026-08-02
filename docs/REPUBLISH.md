# Fix live site (404 / paddlereplay redirect)

## What is wrong right now

1. **Site unpublished** → `https://jchiu1303.github.io/garmin-analysis/` returns **404**
2. Earlier **custom domain** `paddlereplay.com` was set without working DNS → browsers may still try that dead name

The app code on `main` is fine (`docs/` folder). Pages just needs to be turned back on **without** a custom domain.

---

## Do this exactly

### A. Open Pages settings

https://github.com/jchiu1303/garmin-analysis/settings/pages

### B. Clear custom domain (critical)

1. Find **Custom domain**
2. **Delete all text** in the box (must be empty — no `paddlereplay.com`)
3. Click **Save**
4. Uncheck **Enforce HTTPS** if it is stuck on a bad domain (you can re-enable later on github.io)

### C. Publish again from branch

Under **Build and deployment**:

| Field | Value |
|--------|--------|
| Source | **Deploy from a branch** |
| Branch | **main** |
| Folder | **/docs** |

Click **Save**.

Wait 1–3 minutes. The page should say something like:

> Your site is live at **https://jchiu1303.github.io/garmin-analysis/**

### D. Open in a private window

**https://jchiu1303.github.io/garmin-analysis/**

Use **File → New Private Window** (or Incognito) so old redirects to paddlereplay.com are not reused.

---

## If it still goes to paddlereplay.com

Then the custom domain is **still saved** on GitHub (step B). Check again:

Settings → Pages → Custom domain must be **blank**.

Also clear browser data for:

- `jchiu1303.github.io`
- `paddlereplay.com`

Or try another browser / phone on cellular data.

---

## If it is still 404 after 5 minutes

1. Confirm `docs/index.html` exists on main (it does in the repo)
2. Settings → Pages → Source is **main** / **docs** (not “None”)
3. Open the **Actions** tab only if you see failed workflows; branch deploy does not need Actions
4. Try: https://jchiu1303.github.io/garmin-analysis/index.html

---

## Do not

- Do not set Custom domain until you **buy** a domain and configure DNS
- Do not only “unpublish” without re-selecting branch/folder — that leaves 404
- Do not rely on paddlereplay.com until DNS exists

---

## After it works

Bookmark: https://jchiu1303.github.io/garmin-analysis/

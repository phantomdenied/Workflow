# Region 4 Work Hub — GitHub Pages Setup

## Step 1: Create a GitHub account
1. Go to https://github.com
2. Click "Sign up" — use any email, it's free
3. Verify your email

## Step 2: Create a new repository
1. Click the "+" icon (top right) → "New repository"
2. Repository name: `region4-hub`  ← exact name matters for your URL
3. Set to **Public**
4. Check "Add a README file"
5. Click "Create repository"

## Step 3: Upload your files
1. In your new repository, click "Add file" → "Upload files"
2. Upload BOTH files:
   - `region4-workhub.html`  → rename this to  `index.html`  before uploading
   - `manifest.json`
3. Scroll down, click "Commit changes"

## Step 4: Enable GitHub Pages
1. Click "Settings" tab (in your repository)
2. Click "Pages" in the left sidebar
3. Under "Branch" → select `main` → click Save
4. Wait ~60 seconds, refresh the page
5. You'll see: "Your site is live at https://YOURUSERNAME.github.io/region4-hub"

## Step 5: Add to your iPhone home screen
1. Open that URL in Safari on your iPhone
2. Tap the Share button (box with arrow pointing up)
3. Tap "Add to Home Screen"
4. Tap "Add"
5. It now works like an app — full screen, no browser bar

## Step 6: Add your Outlook calendar URL
1. On a computer, go to outlook.office365.com
2. Settings (gear icon) → View all Outlook settings
3. Calendar → Shared calendars
4. Under "Publish a calendar" → select your calendar → Publish
5. Copy the ICS link
6. **Change "webcal://" to "https://"** at the start of the URL
7. In the app → Settings → paste into "Calendar ICS URL"
8. Check "Auto-sync on open"
9. Tap "Sync Calendar Now" to test it

## Updating the app later
When I send you a new version of the app:
1. Go to your repository on github.com
2. Click on `index.html`
3. Click the pencil (edit) icon
4. Delete all the content, paste the new content
5. Click "Commit changes"
The live app updates automatically within seconds.

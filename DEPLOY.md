# Deploying TSF Supermarket Code to Hostinger via GitHub

This guide helps you deploy your Next.js application to Hostinger using GitHub.

## Prerequisites
1.  A GitHub Account.
2.  A Hostinger Hosting Plan (Business Web Hosting or VPS highly recommended for Node.js).
3.  Git installed on your computer.

## Step 1: Push Code to GitHub

First, you need to turn this folder into a Git repository and push it to GitHub.

1.  **Initialize Git**:
    ```bash
    git init
    git add .
    git commit -m "Initial commit of TSF Supermarket"
    ```
2.  **Create a Repository on GitHub**:
    - Go to GitHub.com and create a new repository (e.g., `tsf-supermarket`).
3.  **Link and Push**:
    ```bash
    git remote add origin https://github.com/YOUR_USERNAME/tsf-supermarket.git
    git branch -M main
    git push -u origin main
    ```

## Step 2: Configure Hostinger

### Option A: Hostinger VPS / Cloud (Recommended)
If you have a VPS (Ubuntu/Debian), you can clone the repo and run it directly.
1.  Access your VPS via SSH.
2.  Install Node.js (v18+).
3.  Clone your repo: `git clone ...`
4.  Run `npm install`.
5.  Run `npm run build`.
6.  Start the app: `npm start`.

### Option B: Hostinger Shared Hosting (Node.js Selector)
If you are using shared hosting with the "Node.js" feature:

1.  Log in to **hPanel** -> **Websites** -> **Manage**.
2.  Search for **Node.js** in the sidebar or Advanced section.
3.  **Create Application**:
    - **Node.js Version**: Choose v18 or later (LTS).
    - **Application Mode**: Production.
    - **Application Root**: `public_html` (or a subfolder if you prefer).
    - **Startup File**: `server.js` (We created this file for you to ensure compatibility).
4.  **Click Create**.
5.  **Git Deployment**:
    - Go to **Git** section in hPanel.
    - Add your Repository URL.
    - Select the branch `main`.
    - Deploy to the folder you chose in Step 3.
6.  **Install Dependencies**:
    - In the Node.js section, click **NPM Install**.
7.  **Build the Project**:
    - You might need to run the build command. On shared hosting, it's often better to **build locally** and push the `.next` folder, OR add a "Build" script in `package.json`.
    - Note: Building Next.js on shared hosting limits can fail due to memory.
    - **Pro Tip**: If build fails on Hostinger, run `npm run build` locally, remove `.next` from `.gitignore`, commit it, and push it. (Not standard practice but helps on shared hosting).

## Step 3: Access Your Store
Once the Node.js server is started in hPanel, your URL (e.g., `tsf-market.com`) should show the site.

## Troubleshooting
- **"403 Forbidden" or "Index of"**: Ensure the Node.js server is actually RUNNING in hPanel.
- **Styles missing**: Ensure `npm run build` ran successfully.

# Nội san khối Lý

Web reader for media of **Nội san khối Lý Project**

Live at **https://noisankhoily.ngthinh.com**, deployed from `client/` by GitHub Pages on every push to `main`.

## Step 1: Install Node.js

Node.js is required to run the website locally.

1. Go to [https://nodejs.org/en/download](https://nodejs.org/en/download)
2. Scroll down, near the bottom of the site, under "Or get a prebuilt Node.js"
3. Select most suitable options for your system, and click macOS Installer or Windows Installer
4. Run the install file and follow instructions

To verify the installation worked:
- **On Mac**: Open the **Terminal** app (search for "Terminal" in Spotlight)
- **On Windows**: Open **Command Prompt** (search for "cmd" in the Start menu)

Type the following and press Enter:
```
node --version
```

If you see a version number (like `v20.x.x`), the installation was successful.

## Step 2: Download the Project

Download the project folder and save it somewhere you can easily find (e.g., your Desktop or Documents folder).

**If using Git:**
```
git clone https://github.com/TheNgith/noi-san-khoi-ly.git
```

## Step 3: Run the Website

1. Open **Terminal** (Mac) or **Command Prompt** (Windows)

2. Navigate to the project's server folder. Replace the path below with where you saved the project:

   **Mac:**
   ```
   cd ~/Desktop/noisan_web_new/server
   ```

   **Windows:**
   ```
   cd C:\Users\YourName\Desktop\noisan_web_new\server
   ```

3. Install the required packages (only needed the first time):
   ```
   npm install
   ```

4. Start the website:
   ```
   npm start
   ```

5. Open your web browser and go to: **http://localhost:3300**

The website should now be running.

## Step 4: Let Your Browser Through App Check

The database only answers the real website, so on your computer the passcode box says it can't check the code. To let your browser through:

1. Open the website as in Step 3, then open the browser's developer console (**F12**, then the **Console** tab)
2. Find the line `App Check debug token: ...` and copy the token
3. In the [Firebase console](https://console.firebase.google.com/project/noisankhoily/appcheck), open the web app's **⋮** menu › **Manage debug tokens** and add it

Each browser needs its own token. Never commit or share one: it works like a key to the database.

## Stopping the Website

To stop the website, go back to Terminal/Command Prompt and press **Ctrl + C**.
# Nội san khối Lý

Web reader for media of **Nội san khối Lý Project**

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

5. Open your web browser and go to: **http://localhost:3000**

The website should now be running.

## Stopping the Website

To stop the website, go back to Terminal/Command Prompt and press **Ctrl + C**.
# GoGuesser

This is a small Node.js app for reviewing Go problems with real-time voting and chat.

Vote counts are broadcast every 100 ms so the A/B/C buttons update
continuously without needing to press an update button.

## Running

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   node app.js
   ```
3. Open `http://localhost:3000` in your browser.

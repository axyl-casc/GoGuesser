# GoGuesser

This is a small Node.js app for playing through Go problems with real-time voting and chat.

Messages in the chat are rate limited to **one per second** per user.

Vote counts are broadcast every 100 ms so the A/B/C buttons update
continuously without needing to press an update button.

## Running

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set a session secret (recommended in production):
   ```bash
   export SESSION_SECRET=your_secret_here
   ```
3. Start the server:
   ```bash
   node app.js
   ```
4. Open `http://localhost:3000` in your browser.
   
## Voting (A,B,C order may change)

Each problem lets you choose between answers **A**, **B** and **C**:

- **A** – the move recommended by AI as the best play.
- **B** – a strong professional move, though not the top AI choice.
- **C** – a mistake or clearly suboptimal move.

Click a button to vote. You can change your vote while the timer is running.

## SGF Puzzles

Problem files are loaded from the `sgf` directory. You can drop additional `.sgf` files there to use your own set of puzzles. The app will rotate through these files automatically every 30 seconds.

## Contributing

This project is launched from a separate Go playing application which passes the user's rank in the URL as `rank`. The login page stores this value and displays it with chat messages. An **Exit** button is available so the host app can close the session by calling `exitApp()`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Third-party Licenses

The in-browser Go board comes from [WGo.js](http://wgo.waltheri.net/) and is
released under the MIT license.

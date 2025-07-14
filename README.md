# GoGuesser

This is a small Node.js app for reviewing Go problems with real-time voting and chat.

Messages in the chat are rate limited to **one per second** per user.

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
   
## Voting (A,B,C order may change)

Each problem lets you choose between answers **A**, **B** and **C**:

- **A** – the move recommended by AI as the best play.
- **B** – a strong professional move, though not the top AI choice.
- **C** – a mistake or clearly suboptimal move.

Click a button to vote. You can change your vote while the timer is running.

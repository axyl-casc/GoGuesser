# Contributing to GoGuesser

This project extends an external Go playing application. The parent app launches GoGuesser and passes the user's rank through the `rank` URL parameter. The login page stores this value in `localStorage` so it can be sent with chat messages.

An **Exit** button is required so the host app can close the session quickly. The button is defined in `public/index.html` and uses the `exitApp()` function in `public/main.js` which simply calls `window.close()`.

## Getting Started

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   node app.js
   ```
4. Open `http://localhost:3000?rank=your_rank` to verify rank handling.

## Coding Guidelines

- Keep dependencies minimal and use idiomatic Node.js/JavaScript.
- Make sure `npm test` runs without errors before submitting a pull request. (No tests are defined yet, but the command must succeed.)
- Describe your changes clearly in the pull request body.

## Additional Notes

Feel free to propose new features or improvements. All contributions are welcome!

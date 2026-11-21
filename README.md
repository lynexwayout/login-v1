# Orb Login

An animated login form with a liquid orb mascot that reacts to what you type. Plain HTML, CSS and JavaScript. No frameworks, no build step, no dependencies.

<!-- Add a screenshot or GIF here: ![Orb Login preview](preview.gif) -->

## Features

- **Liquid orb mascot** drawn in SVG. Its droplets stretch and merge like liquid, thanks to an SVG "goo" filter.
- **Eye tracking.** The eye follows your mouse. While you type your email, it follows the position of the text cursor, including when you move it with the arrow keys.
- **Password privacy.** When you focus the password field, droplets fly in and cover the eye. Click the eye icon to show the password and the orb peeks out.
- **Blinking, bouncing and wandering.** The orb blinks, squashes and stretches, and looks around on its own when you are idle.
- **Form feedback.** It has floating-label inputs, a password strength meter, email and password validation, and an error message with a shake.
- **Success state.** The orb bursts with joy and an animated checkmark appears.
- **Polished details.** A frosted-glass card, a rotating rainbow glow, letters that slide up on the heading, a "Keep me signed in" switch, and a responsive layout.
- Respects `prefers-reduced-motion`.

## Getting started

No installation needed.

1. Download or clone the repository.
2. Open `index.html` in your browser.

```bash
git clone https://github.com/your-username/orb-login.git
cd orb-login
# then open index.html
```

An internet connection is needed for the Google Fonts (Bricolage Grotesque and DM Sans). Without it, the page falls back to system fonts.

## Project structure

```
orb-login/
├── index.html   # page structure and the orb SVG
├── style.css    # all styles and animations
└── script.js    # orb animation, eye tracking and form logic
```

## Connecting it to your backend

The form currently simulates a sign-in with a 1.5 second delay. To connect a real API, open `script.js`, find the `TODO` comment in the submit handler and replace the fake delay with your request:

```js
fetch("/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password })
})
  .then(function (response) { /* handle the response */ });
```

There is also a commented-out `window.location.href = "/dashboard";` line for redirecting after a successful sign-in.

## Customizing

- **Colors:** change the CSS variables at the top of `style.css` (`--accent-1`, `--accent-2`, `--accent-3`, `--rainbow`, and so on). The orb's colors are the gradients in the `<defs>` section of the SVG in `index.html`.
- **Heading text:** change `"Hi again."` in the start-up section of `script.js`.
- **Orb behaviour:** the moods (idle, email, password, success) are set in the `setMode` function in `script.js`.
- **Validation rules:** edit the checks inside the submit handler in `script.js`.

## Browser support

Works in current versions of Chrome, Edge, Safari and Firefox. The rotating glow around the card uses CSS `@property`. In browsers that don't support it, the glow stays still, and everything else works the same.

## License

Add the license you prefer, for example MIT.

/* ==========================================================================
   Orb Login – script
   --------------------------------------------------------------------------
   1. Helpers
   2. Page elements
   3. Orb (liquid body, droplets, eye) + animation loop
   4. Orb "moods" (idle / email / password / success)
   5. Eye tracking (mouse + typing position)
   6. Form behaviour (password peek, strength meter, validation, submit)
   7. Start-up
   ========================================================================== */


/* --------------------------------------------------------------------------
   1. Helpers
   -------------------------------------------------------------------------- */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Splits a sentence into words and letters. Each letter is wrapped in a mask
// so it can slide up into view (see .mask / .letter in style.css).
function splitLetters(element, text) {
  let letterIndex = 0;

  element.innerHTML = text
    .split(" ")
    .map(function (word) {
      const letters = [...word]
        .map(function (char) {
          const delay = letterIndex * 38; // each letter starts a bit later
          letterIndex++;
          return (
            '<span class="mask">' +
              '<span class="letter" style="transition-delay:' + delay + 'ms">' + char + "</span>" +
            "</span>"
          );
        })
        .join("");

      return '<span class="word">' + letters + "</span>";
    })
    .join(" ");
}


/* --------------------------------------------------------------------------
   2. Page elements
   -------------------------------------------------------------------------- */

const stage = document.querySelector("#stage");
const orbSvg = document.querySelector("#orb");
const card = document.querySelector(".card");
const title = document.querySelector("#title");

const form = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const togglePasswordButton = document.querySelector("#toggle-password");
const strengthBar = document.querySelector("#strength-bar");
const errorMessage = document.querySelector("#error-message");

// Parts of the orb SVG
const bodyGroup = document.querySelector("#body-group");
const mainBlob = document.querySelector("#main-blob");
const dropletGroup = document.querySelector("#droplet-group");
const eyePosition = document.querySelector("#eye-position");
const eyeShape = document.querySelector("#eye-shape");
const iris = document.querySelector("#iris");
const pupil = document.querySelector("#pupil");
const eyeHighlights = document.querySelector("#eye-highlights");


/* --------------------------------------------------------------------------
   3. Orb
   -------------------------------------------------------------------------- */

/*
  The orb keeps a "current" value and a "target" value for everything that
  moves. Every frame the current value eases a little towards the target,
  which makes all movement smooth.

  x / y            where the orb looks (-1 to 1)
  eyeOpen          0 = closed, 1 = fully open
  pupilScale       1 = normal, bigger = wider pupil
  squash           squash-and-stretch amount (springs back to 0)
  blink            0 -> 1 is one blink; 1 means "not blinking"
*/
const orb = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,

  eyeOpen: 0,        // starts closed, opens when the page is ready
  targetEyeOpen: 0,

  pupilScale: 1,
  targetPupilScale: 1,

  squash: 0,
  squashVelocity: 0,

  blink: 1
};

// idle = nothing focused | email = typing email | password = typing password | success = signed in
let mode = "idle";

let lastPointerMoveTime = 0;   // used so the eye only wanders when the mouse is still
let peeking = false;           // true while "show password" is on
let burstUntil = 0;            // droplets fly outward until this time (success effect)

const SVG_NS = "http://www.w3.org/2000/svg";

function createCircle(parent, radius) {
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("r", radius);
  parent.appendChild(circle);
  return circle;
}

// Extra circles inside the body. They move around and make the outline wobble.
const bumps = [0, 1, 2, 3].map(function () {
  return createCircle(bodyGroup, 44);
});

// Small droplets that orbit the orb. Because of the "goo" filter they stretch
// and merge with each other like liquid.
const DROPLET_COUNT = 7;
const droplets = [];

for (let i = 0; i < DROPLET_COUNT; i++) {
  droplets.push({
    element: createCircle(dropletGroup, 0),
    x: 150,
    y: 140,
    r: 0,                              // current radius
    vx: 0,                             // velocities used by the spring
    vy: 0,
    vr: 0,
    phase: (i * Math.PI * 2) / DROPLET_COUNT, // where on the orbit it starts
    speed: 0.0004 + 0.00013 * (i % 3),
    orbitRadius: 104 + (i % 3) * 9
  });
}

// When a password is focused, the first 5 droplets move in front of the eye.
// Each entry is [offsetX, offsetY, radius] relative to the orb centre.
const VEIL_POSITIONS = [
  [-24, -14, 27],
  [24, -14, 27],
  [-24, 17, 27],
  [24, 17, 27],
  [0, 2, 29]
];

// Runs on every frame (about 60 times per second)
function animateOrb(time) {
  // 1) Ease every current value towards its target
  orb.x += (orb.targetX - orb.x) * 0.13;
  orb.y += (orb.targetY - orb.y) * 0.13;
  orb.eyeOpen += (orb.targetEyeOpen - orb.eyeOpen) * 0.14;
  orb.pupilScale += (orb.targetPupilScale - orb.pupilScale) * 0.08;

  // squash is a spring: it is pushed away from 0 and bounces back
  orb.squashVelocity += (0 - orb.squash) * 0.12;
  orb.squashVelocity *= 0.86;
  orb.squash += orb.squashVelocity;

  if (orb.blink < 1) {
    orb.blink += 0.1;
  }

  // 2) Orb centre (it leans a little in the direction it is looking)
  const centerX = 150 + orb.x * 7;
  const centerY = 140 + orb.y * 5;
  const isCoveringEye = mode === "password";
  const now = performance.now();

  // 3) Main body + wobbling bumps
  mainBlob.setAttribute("cx", centerX);
  mainBlob.setAttribute("cy", centerY);
  mainBlob.setAttribute("r", 66 + 2 * Math.sin(time / 600));

  bumps.forEach(function (bump, i) {
    const angle = i * 1.9 + time * 0.0009 * (1 + i * 0.3);
    bump.setAttribute("cx", centerX + Math.cos(angle) * 42);
    bump.setAttribute("cy", centerY + Math.sin(angle) * 40);
    bump.setAttribute("r", 44 + 7 * Math.sin(time / 700 + i * 2));
  });

  // squash & stretch, anchored at the bottom of the body
  bodyGroup.setAttribute(
    "transform",
    "translate(" + centerX + " " + (centerY + 66) + ") " +
    "scale(" + (1 + orb.squash) + "," + (1 - orb.squash) + ") " +
    "translate(" + -centerX + " " + (-centerY - 66) + ")"
  );

  // 4) Droplets: pick a target for each one, then move it there with a spring
  droplets.forEach(function (droplet, i) {
    let targetX;
    let targetY;
    let targetR;

    if (burstUntil > now) {
      // success: fly outward in a ring
      const angle = (i / DROPLET_COUNT) * Math.PI * 2 + time * 0.003;
      targetX = centerX + Math.cos(angle) * (125 + 18 * Math.sin(i));
      targetY = centerY + Math.sin(angle) * 104;
      targetR = 9;

    } else if (isCoveringEye && i < 5) {
      // password: move in front of the eye
      const position = VEIL_POSITIONS[i];
      targetX = centerX + position[0];
      targetY = centerY + position[1];
      targetR = position[2];

      // "show password": the left side opens so the orb can peek
      if (peeking && (i === 0 || i === 2 || i === 4)) {
        targetX -= i === 4 ? 34 : 46;
        targetR *= 0.78;
      }

    } else {
      // normal: orbit around the body
      const slowdown = isCoveringEye ? 0.4 : 1;
      const angle = droplet.phase + time * droplet.speed * slowdown;
      const radius = droplet.orbitRadius + 8 * Math.sin(time / 800 + i);
      targetX = centerX + Math.cos(angle) * radius * 1.15;
      targetY = centerY + Math.sin(angle) * radius * 0.82;
      targetR = 7 + 3.5 * Math.sin(time / 500 + i * 1.7);
    }

    // spring towards the target (this gives the bouncy, liquid feel)
    droplet.vx += (targetX - droplet.x) * 0.085;
    droplet.vy += (targetY - droplet.y) * 0.085;
    droplet.vr += (targetR - droplet.r) * 0.1;
    droplet.vx *= 0.76;
    droplet.vy *= 0.76;
    droplet.vr *= 0.7;

    droplet.x += droplet.vx;
    droplet.y += droplet.vy;
    droplet.r = Math.max(0, droplet.r + droplet.vr);

    droplet.element.setAttribute("cx", droplet.x.toFixed(1));
    droplet.element.setAttribute("cy", droplet.y.toFixed(1));
    droplet.element.setAttribute("r", droplet.r.toFixed(1));
  });

  // 5) Eye: blinking closes it quickly, otherwise it follows eyeOpen
  const blinkAmount = orb.blink < 1 ? 1 - Math.abs(orb.blink * 2 - 1) : 0;
  const eyeOpen = Math.max(0.05, Math.min(orb.eyeOpen, 1 - blinkAmount));

  eyePosition.setAttribute("transform", "translate(" + (centerX - 150) + " " + (centerY - 140) + ")");
  eyeShape.setAttribute("transform", "translate(150 140) scale(1 " + eyeOpen + ") translate(-150 -140)");

  // the iris moves further than the highlights, which makes the eye look round
  iris.style.transform = "translate(" + orb.x * 16 + "px," + orb.y * 11 + "px)";
  eyeHighlights.style.transform = "translate(" + orb.x * 5 + "px," + orb.y * 3 + "px)";
  pupil.style.transform = "scale(" + orb.pupilScale + ")";

  requestAnimationFrame(animateOrb);
}

requestAnimationFrame(animateOrb);

// Blink every ~2.7 seconds
setInterval(function () {
  if (Math.random() < 0.85) {
    orb.blink = 0;
  }
}, 2700);

// When nothing is happening, the eye wanders around by itself
setInterval(function () {
  const mouseIsStill = Date.now() - lastPointerMoveTime > 2200;

  if (mode === "idle" && mouseIsStill) {
    orb.targetX = (Math.random() - 0.5) * 1.2;
    orb.targetY = (Math.random() - 0.5) * 0.9;
  }
}, 1500);


/* --------------------------------------------------------------------------
   4. Orb "moods"
   -------------------------------------------------------------------------- */

function setMode(newMode) {
  mode = newMode;

  // pupil: a little wider while typing the email, widest when happy
  if (newMode === "email") {
    orb.targetPupilScale = 1.2;
  } else if (newMode === "success") {
    orb.targetPupilScale = 1.45;
  } else {
    orb.targetPupilScale = 1;
  }

  if (newMode === "idle") {
    orb.targetEyeOpen = 1;
  }

  if (newMode === "email") {
    orb.targetEyeOpen = 1;
    updateEyeFromCaret();
    orb.squashVelocity = 0.05;       // small bounce
  }

  if (newMode === "password") {
    orb.targetEyeOpen = 0.1;         // eye hides behind the droplets
    orb.targetX = 0;
    orb.targetY = 0.2;
    orb.squashVelocity = -0.06;
  }

  if (newMode === "success") {
    orb.targetEyeOpen = 0.5;         // happy squint
    orb.targetX = 0;
    orb.targetY = -0.1;
    orb.squashVelocity = 0.16;       // big bounce
    burstUntil = performance.now() + 900;   // droplets burst outward
  }
}


/* --------------------------------------------------------------------------
   5. Eye tracking
   -------------------------------------------------------------------------- */

// Mouse: look towards the pointer (only while nothing is focused).
// The same event also moves the soft light in the page background.
window.addEventListener("pointermove", function (event) {
  document.body.style.setProperty("--mx", event.clientX + "px");
  document.body.style.setProperty("--my", event.clientY + "px");

  lastPointerMoveTime = Date.now();

  if (mode !== "idle") {
    return;
  }

  const box = orbSvg.getBoundingClientRect();
  const orbCenterX = box.left + box.width / 2;
  const orbCenterY = box.top + box.height * 0.5;

  orb.targetX = clamp((event.clientX - orbCenterX) / (window.innerWidth * 0.35), -1, 1);
  orb.targetY = clamp((event.clientY - orbCenterY) / (window.innerHeight * 0.35), -1, 1);
});

// Typing: look at the position of the text cursor inside the email field.
// A hidden canvas is used only to measure how wide the typed text is.
const measureContext = document.createElement("canvas").getContext("2d");

function updateEyeFromCaret() {
  if (document.activeElement !== emailInput) {
    return;
  }

  const style = getComputedStyle(emailInput);
  measureContext.font = style.fontSize + " " + style.fontFamily;

  const textBeforeCaret = emailInput.value.slice(0, emailInput.selectionStart || 0);
  const textWidth = measureContext.measureText(textBeforeCaret).width;

  // 0 = caret at the start, 1 = caret at the end of the visible field
  const visibleWidth = Math.max(60, emailInput.clientWidth - 120);
  const progress = clamp(textWidth / visibleWidth, 0, 1);

  orb.targetX = (progress * 2 - 1) * 0.95;   // -0.95 (left) ... +0.95 (right)
  orb.targetY = 0.6;                         // looking slightly down at the field
}

// Update on typing, arrow keys, clicking and selecting text
["input", "keyup", "click", "select"].forEach(function (eventName) {
  emailInput.addEventListener(eventName, updateEyeFromCaret);
});
document.addEventListener("selectionchange", updateEyeFromCaret);


/* --------------------------------------------------------------------------
   6. Form behaviour
   -------------------------------------------------------------------------- */

// --- Focus: change the orb's mood ---

emailInput.addEventListener("focus", function () {
  setMode("email");
});

emailInput.addEventListener("blur", function () {
  if (mode === "email") {
    setMode("idle");
  }
});

passwordInput.addEventListener("focus", function () {
  setMode("password");
});

passwordInput.addEventListener("blur", function () {
  if (mode === "password") {
    setMode("idle");
  }
});

// --- Show / hide password (the orb peeks while the password is visible) ---

// Stops the button from stealing focus from the password field
togglePasswordButton.addEventListener("mousedown", function (event) {
  event.preventDefault();
});

togglePasswordButton.addEventListener("click", function () {
  const willShow = passwordInput.type === "password";

  passwordInput.type = willShow ? "text" : "password";
  peeking = willShow;

  if (willShow) {
    orb.targetEyeOpen = 0.75;
    orb.targetX = 0.8;
    orb.targetY = 0.2;
  } else {
    orb.targetEyeOpen = 0.1;
    orb.targetX = 0;
    orb.targetY = 0.2;
  }

  passwordInput.focus();
});

// --- Password strength meter (0 - 100 %) ---

function updateStrength() {
  const value = passwordInput.value;
  let score = 0;

  if (value.length >= 6) score += 25;
  if (value.length >= 9) score += 25;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 25;   // upper + lower case
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 25; // number + symbol

  strengthBar.style.width = score + "%";
}

passwordInput.addEventListener("input", updateStrength);

// --- Validation error: show a message and shake ---

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add("show");

  // remove + re-add the class so the shake can play again
  stage.classList.remove("shake");
  void stage.offsetWidth;
  stage.classList.add("shake");

  orb.targetEyeOpen = 0.7;
  orb.squashVelocity = -0.1;
  setTimeout(function () {
    orb.targetEyeOpen = 1;
  }, 900);
}

// --- Submit ---

form.addEventListener("submit", function (event) {
  event.preventDefault();
  errorMessage.classList.remove("show");

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

  if (!emailLooksValid) {
    showError("Enter a valid email address.");
    return;
  }

  if (password.length < 6) {
    showError("Password must be at least 6 characters.");
    return;
  }

  // Input is valid: show the loading state and let the orb look happy
  passwordInput.blur();
  emailInput.blur();
  peeking = false;
  form.classList.add("is-loading");
  setMode("success");

  // TODO: replace this fake 1.5 second delay with your real sign-in request,
  // for example:  fetch("/api/login", { method: "POST", body: JSON.stringify({ email, password }) })
  setTimeout(function () {
    form.classList.remove("is-loading");
    card.classList.add("is-done");   // shows the "You're in." message

    // window.location.href = "/dashboard";
  }, 1500);
});


/* --------------------------------------------------------------------------
   7. Start-up
   -------------------------------------------------------------------------- */

splitLetters(title, "Hi again.");

// Wait one frame, then start the entrance animations
requestAnimationFrame(function () {
  setTimeout(function () {
    document.body.classList.add("ready");   // orb + card slide in (see style.css)
    title.classList.add("reveal");          // heading letters slide up
    orb.targetEyeOpen = 1;                  // the eye opens
  }, 80);
});

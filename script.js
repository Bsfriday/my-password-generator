/**
 * PASSFORGE — script.js
 * Password Generator Logic
 * ─────────────────────────────────────────────────────────
 * Features:
 *   • Secure crypto-random generation (window.crypto)
 *   • Length slider with live track fill
 *   • Uppercase / Lowercase / Numbers / Symbols toggles
 *   • Copy-to-clipboard with visual feedback
 *   • Entropy-based strength indicator (Weak / Fair / Good / Strong)
 *   • Auto-generate on page load & option change
 *   • Guard against "no character types selected"
 */

'use strict';

// ── Character pools ──────────────────────────────────────
const CHARS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers:   '0123456789',
  symbols:   '!@#$%^&*()-_=+[]{}|;:,.<>?'
};

// ── DOM references ───────────────────────────────────────
const outputEl       = document.getElementById('passwordOutput');
const copyBtn        = document.getElementById('copyBtn');
const copyLabel      = copyBtn.querySelector('.copy-label');
const generateBtn    = document.getElementById('generateBtn');
const lengthSlider   = document.getElementById('lengthSlider');
const lengthValue    = document.getElementById('lengthValue');
const strengthBar    = document.querySelector('.strength-bar-wrapper');
const strengthLabel  = document.getElementById('strengthLabel');
const yearEl         = document.getElementById('year');

const toggles = {
  uppercase: document.getElementById('uppercaseToggle'),
  lowercase: document.getElementById('lowercaseToggle'),
  numbers:   document.getElementById('numbersToggle'),
  symbols:   document.getElementById('symbolsToggle'),
};

// ── Footer year ──────────────────────────────────────────
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ── Crypto-random integer in [0, max) ────────────────────
function cryptoRandInt(max) {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  // Use rejection sampling to avoid modulo bias
  const limit = 2 ** 32 - (2 ** 32 % max);
  if (array[0] >= limit) return cryptoRandInt(max); // retry (extremely rare)
  return array[0] % max;
}

// ── Build the active character pool ──────────────────────
function buildPool() {
  let pool = '';
  for (const [key, input] of Object.entries(toggles)) {
    if (input.checked) pool += CHARS[key];
  }
  return pool;
}

// ── Generate a random password ───────────────────────────
function generatePassword(length, pool) {
  let password = '';

  // Guarantee at least one character from each active type (if length allows)
  const activeTypes = Object.entries(toggles)
    .filter(([, input]) => input.checked)
    .map(([key]) => CHARS[key]);

  const guaranteed = activeTypes
    .slice(0, length) // don't exceed requested length
    .map(chars => chars[cryptoRandInt(chars.length)]);

  // Fill the rest randomly from the full pool
  const remainder = length - guaranteed.length;
  const randomChars = Array.from({ length: remainder }, () => pool[cryptoRandInt(pool.length)]);

  // Combine and shuffle using Fisher-Yates
  const all = [...guaranteed, ...randomChars];
  for (let i = all.length - 1; i > 0; i--) {
    const j = cryptoRandInt(i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }

  password = all.join('');
  return password;
}

// ── Calculate password entropy (bits) ────────────────────
function calcEntropy(length, poolSize) {
  if (poolSize === 0 || length === 0) return 0;
  return length * Math.log2(poolSize);
}

// ── Map entropy to strength tier ─────────────────────────
// Entropy thresholds (bits):
//   < 40  → Weak
//   < 60  → Fair
//   < 80  → Good
//   ≥ 80  → Strong
function getStrength(entropy) {
  if (entropy < 40) return { key: 'weak',   label: 'Weak'   };
  if (entropy < 60) return { key: 'fair',   label: 'Fair'   };
  if (entropy < 80) return { key: 'good',   label: 'Good'   };
  return              { key: 'strong', label: 'Strong' };
}

// ── Update the strength indicator UI ─────────────────────
function updateStrength(password, pool) {
  const entropy  = calcEntropy(password.length, pool.length);
  const strength = getStrength(entropy);

  strengthBar.setAttribute('data-strength', strength.key);
  strengthLabel.textContent = strength.label;
}

// ── Update the slider track fill ─────────────────────────
function updateSliderTrack(slider) {
  const min  = Number(slider.min);
  const max  = Number(slider.max);
  const val  = Number(slider.value);
  const pct  = ((val - min) / (max - min)) * 100;

  slider.style.background = `
    linear-gradient(
      to right,
      var(--accent) 0%,
      var(--accent) ${pct}%,
      var(--border) ${pct}%,
      var(--border) 100%
    )
  `;
  slider.setAttribute('aria-valuenow', val);
}

// ── Main: run the generator ───────────────────────────────
function runGenerate() {
  const pool = buildPool();

  // Guard: at least one type must be selected
  if (pool.length === 0) {
    outputEl.textContent = 'Select at least one type!';
    outputEl.style.color = 'var(--weak)';
    strengthBar.removeAttribute('data-strength');
    strengthLabel.textContent = '—';
    // Shake the controls card for tactile feedback
    const card = document.querySelector('.controls-card');
    card.classList.remove('shake');
    void card.offsetWidth; // reflow to restart animation
    card.classList.add('shake');
    setTimeout(() => card.classList.remove('shake'), 500);
    return;
  }

  outputEl.style.color = ''; // reset to CSS var
  const length   = Number(lengthSlider.value);
  const password = generatePassword(length, pool);

  // Animate the password output with a brief flicker
  outputEl.style.opacity = '0';
  outputEl.style.transform = 'translateY(4px)';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      outputEl.textContent = password;
      outputEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      outputEl.style.opacity = '1';
      outputEl.style.transform = 'translateY(0)';
      updateStrength(password, pool);
    });
  });
}

// ── Copy to clipboard ────────────────────────────────────
async function copyPassword() {
  const pwd = outputEl.textContent;
  if (!pwd || pwd === 'Click Generate' || pwd.includes('Select')) return;

  try {
    await navigator.clipboard.writeText(pwd);
    // Visual success state
    copyBtn.classList.add('copied');
    copyLabel.textContent = 'Copied!';

    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyLabel.textContent = 'Copy';
    }, 2000);
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = pwd;
    textArea.style.position = 'fixed';
    textArea.style.opacity  = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    copyLabel.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyLabel.textContent = 'Copy';
    }, 2000);
  }
}

// ── Slider input handler ──────────────────────────────────
lengthSlider.addEventListener('input', () => {
  lengthValue.textContent = lengthSlider.value;
  updateSliderTrack(lengthSlider);
  runGenerate();
});

// ── Toggle change handler (auto-regenerate) ───────────────
for (const input of Object.values(toggles)) {
  input.addEventListener('change', runGenerate);
}

// ── Button handlers ───────────────────────────────────────
generateBtn.addEventListener('click', runGenerate);
copyBtn.addEventListener('click', copyPassword);

// ── Keyboard shortcut: Space / Enter on output → copy ────
outputEl.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') copyPassword();
});

// ── Init on page load ─────────────────────────────────────
updateSliderTrack(lengthSlider);
runGenerate();

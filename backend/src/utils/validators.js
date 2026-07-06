// Small, dependency-free validation helpers used by the auth controller.

const USERNAME_REGEX = /^[a-zA-Z0-9_]{4,20}$/; // 4-20 chars, letters/numbers/underscore
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9]{10}$/; // 10 digit phone number

function validateRegistration({ username, password, confirmPassword, email, phone }) {
  const errors = [];

  if (!username || !USERNAME_REGEX.test(username)) {
    errors.push("Username must be 4-20 characters: letters, numbers, or underscore only.");
  }
  if (!password || password.length < 6) {
    errors.push("Password must be at least 6 characters long.");
  }
  if (password !== confirmPassword) {
    errors.push("Password and confirm password do not match.");
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    errors.push("Please provide a valid email address.");
  }
  if (!phone || !PHONE_REGEX.test(phone)) {
    errors.push("Phone number must be exactly 10 digits.");
  }

  return errors;
}

function validateLogin({ username, password }) {
  const errors = [];
  if (!username) errors.push("Username is required.");
  if (!password) errors.push("Password is required.");
  return errors;
}

module.exports = { validateRegistration, validateLogin };

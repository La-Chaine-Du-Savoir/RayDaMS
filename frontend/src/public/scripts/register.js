import { apiService } from "/services/apiService.js";

const registerForm = document.getElementById("registerForm");
const username_input = document.getElementById("username");
const email_input = document.getElementById("email");
const password_input = document.getElementById("password");
const confirm_password_input = document.getElementById("confirm-password");
const errorContainer = document.getElementById("errorContainer");

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  errorContainer.style.display = "none";
  errorContainer.textContent = "";

  const username = username_input.value.trim();
  const email = email_input.value.trim();
  const password = password_input.value;
  const confirmPassword = confirm_password_input.value;

  if (password !== confirmPassword) {
    showError("Les mots de passe ne correspondent pas.");
    return;
  }

  const response = await apiService.createResource("auth/register", {
    username: username,
    email: email,
    password: password,
  }, false);

  if (response.success) {
    alert(
      "Inscription réussie ! Vous allez être redirigé vers la page de connexion.",
    );
    globalThis.location.href = "/login";
  } else {
    showError(response.error);
  }
});

function showError(message) {
  errorContainer.textContent = message;
  errorContainer.style.display = "block";
}

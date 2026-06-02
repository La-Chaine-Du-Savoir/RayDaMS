import { apiService } from "/services/apiService.js";

globalThis.addEventListener("auth-change", () => {
  if (apiService.isAuthenticated) {
    globalThis.location.href = "/";
  }
});

const loginForm = document.getElementById("loginForm");
const username_input = document.getElementById("username");
const password_input = document.getElementById("password");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (username_input.value === "" || password_input.value === "") {
    alert("Veuillez remplir tous les champs");
    return;
  }

  const response = await apiService.login(
    username_input.value,
    password_input.value,
  );

  if (!response.success) {
    const errorContainer = document.getElementById("errorContainer");
    errorContainer.textContent = "Connexion échouée : " + response.error;
    errorContainer.style.display = "block";
  }
});

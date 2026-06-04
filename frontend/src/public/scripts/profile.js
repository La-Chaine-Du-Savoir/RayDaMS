import { apiService } from "../services/apiService.js";
import "../components/app-avatar.js";
import "../components/group-widget.js";

document.addEventListener("DOMContentLoaded", () => {
  // si pas co, on le renvoie à l'accueil ou au login
  if (!apiService.isAuthenticated) {
    globalThis.location.href = "/login";
    return;
  }

  const form = document.getElementById("profile-form");
  const emailInput = document.getElementById("email");
  const usernameInput = document.getElementById("username");
  const messageContainer = document.getElementById("profile-message");

  const avatarInput = document.getElementById("avatar-input");
  const avatarPreview = document.getElementById("avatar-preview");

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo

  // Préremplir les champs avec les données actuelles
  const user = apiService.connectedUser;
  usernameInput.value = user.username;
  emailInput.value = user.email;

  avatarPreview.username = user.username;
  if (user.url_profil_picture) {
    avatarPreview.url = user.url_profil_picture;
  }

  // Prévisualisation immédiate de l'image et vérif de la taille
  avatarInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check de la taille
      if (file.size > MAX_FILE_SIZE) {
        showMessage(
          "Le fichier est trop volumineux. La taille maximum est de 5 Mo.",
          "error-message",
        );
        avatarInput.value = "";

        // On remet l'image par défaut ou l'ancienne photo
        avatarPreview.url = user.url_profil_picture
          ? user.url_profil_picture
          : "";
        return;
      }
      messageContainer.textContent = "";
      messageContainer.className = "";
      avatarPreview.url = URL.createObjectURL(file);
    }
  });

  // Gestion de la soumission du formulaire
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Réinitialiser les messages
    messageContainer.className = "";
    messageContainer.textContent = "";

    const newEmail = emailInput.value.trim();
    const file = avatarInput.files[0];

    // Si l'email n'a pas changé, on ne fait rien
    if (newEmail === user.email && !file) {
      showMessage("Aucune modification détectée.", "success-message");
      return;
    }

    // Création du FormData
    const formData = new FormData();

    // On ajoute l'email uniquement s'il a changé
    if (newEmail !== user.email) {
      formData.append("email", newEmail);
    }

    // On ajoute le fichier si l'utilisateur en a sélectionné un
    if (file) {
      formData.append("avatar", file);
    }

    // Appel à l'API. apiService détectera le FormData et gere les headers
    const response = await apiService.updateResource("users", "me", formData);

    if (response.success) {
      showMessage("Profil mis à jour avec succès !", "success-message");

      // On met à jour l'utilisateur dans le service et le sessionStorage
      apiService.connectedUser = response.data.user;
      sessionStorage.setItem("user", JSON.stringify(response.data.user));

      // On met à jour l'aperçu avec la vraie URL générée par Deno
      if (response.data.user.url_profil_picture) {
        avatarPreview.url = response.data.user.url_profil_picture;
      }

      // On prévient les autres composants que l'utilisateur a changé
      globalThis.dispatchEvent(
        new CustomEvent("auth-change", { detail: apiService.connectedUser }),
      );
    } else {
      showMessage(response.error, "error-message");
    }
  });

  function showMessage(text, className) {
    messageContainer.textContent = text;
    messageContainer.className = className;
  }

  const groupsContainer = document.getElementById("groups-container");

  async function loadUserGroups() {
    try {
      // Afficher un message de chargement
      groupsContainer.innerHTML = "<p>Chargement de vos groupes...</p>";

      const res = await apiService.getAll(`users/${user.id}/groups`);
      if (res.success) {
        groupsContainer.innerHTML = "";

        const groups = res.data;

        if (groups.length === 0) {
          groupsContainer.innerHTML =
            '<p class="empty-state" style="width: 100%;">Vous n\'êtes membre d\'aucun groupe.</p>';
          return;
        }

        // Pour chaque groupe, on crée dynamiquement le widget
        groups.forEach((groupObj) => {
          const widget = document.createElement("group-widget");

          widget.group = groupObj;

          groupsContainer.appendChild(widget);
        });
      } else {
        console.warn(
          "Erreur API lors de la récupération des groupes:",
          res.error,
        );
        groupsContainer.innerHTML =
          '<p class="error-message">Impossible de charger vos groupes.</p>';
      }
    } catch (e) {
      console.error("Erreur inattendue lors du chargement des groupes :", e);
      groupsContainer.innerHTML =
        '<p class="error-message">Une erreur inattendue est survenue.</p>';
    }
  }

  // Gestion du changement de mot de passe
  const pwdForm = document.getElementById("password-form");
  const pwdMessage = document.getElementById("password-message");
  const togglePasswordLink = document.getElementById("toggle-password-link");
  const passwordSection = document.getElementById("password-section");

  // affichage/masquage du formulaire
  if (togglePasswordLink && passwordSection) {
    togglePasswordLink.addEventListener("click", (e) => {
      e.preventDefault(); // Évite que la page ne remonte tout en haut

      if (passwordSection.style.display === "none") {
        passwordSection.style.display = "";
        togglePasswordLink.textContent =
          "Masquer le formulaire de mot de passe";
        passwordSection.scrollIntoView({ behavior: "smooth" }); // défilement
      } else {
        passwordSection.style.display = "none";
        togglePasswordLink.textContent = "Changer de mot de passe ?";
      }
    });
  }

  pwdForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    pwdMessage.className = "";
    pwdMessage.textContent = "";

    const oldPassword = document.getElementById("old-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (newPassword !== confirmPassword) {
      pwdMessage.textContent =
        "Les nouveaux mots de passe ne correspondent pas.";
      pwdMessage.className = "error-message";
      return;
    }

    // Appel à l'API (PATCH sur /users/me/password)
    const response = await apiService.updateResource("users", "me/password", {
      oldPassword: oldPassword,
      newPassword: newPassword,
    });

    if (response.success) {
      pwdMessage.textContent = "Mot de passe modifié avec succès !";
      pwdMessage.className = "success-message";
      pwdForm.reset();

      // cacher le formulaire automatiquement après 2 secondes de succès
      setTimeout(() => {
        passwordSection.style.display = "none";
        togglePasswordLink.textContent = "Changer de mot de passe ?";
        pwdMessage.textContent = "";
        pwdMessage.className = "";
      }, 2000);
    } else {
      pwdMessage.textContent = response.error ||
        "Erreur lors de la modification.";
      pwdMessage.className = "error-message";
    }
  });

  // On lance le chargement des groupes au démarrage de la page
  loadUserGroups();
});

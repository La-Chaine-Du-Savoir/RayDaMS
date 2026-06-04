import "/components/app-navbar.js";
import "/components/app-footer.js";
import { apiService } from "../services/apiService.js";
import "../components/app-avatar.js";

// --- FONCTIONS UTILITAIRES ---

/**
 * Affiche un message d'erreur et masque le contenu du groupe.
 * @param {string} message Le message d'erreur à afficher.
 */
function showError(message) {
  const groupNameEl = document.getElementById("group-name");
  const groupDescEl = document.getElementById("group-description");
  const errorContainer = document.getElementById("error-container");
  const errorMessageEl = document.getElementById("error-message");

  if (groupNameEl) groupNameEl.textContent = "Erreur";
  if (groupDescEl) groupDescEl.style.display = "none";
  if (errorMessageEl) errorMessageEl.textContent = message;
  if (errorContainer) errorContainer.style.display = "block";
}

/**
 * Gère l'affichage et la logique d'invitation pour les administrateurs.
 * @param {Object} group L'objet groupe contenant le code d'invitation.
 */
function setupAdminInvitation(group) {
  // Vérification backend du rôle admin
  if (!group.code) return;

  const userStr = sessionStorage.getItem("user");
  if (!userStr) return;

  const user = JSON.parse(userStr);
  if (!user.roles || !user.roles.includes("admin")) return;

  const btnPlaceholder = document.getElementById(
    "admin-invite-btn-placeholder",
  );
  const zonePlaceholder = document.getElementById(
    "admin-invite-zone-placeholder",
  );

  if (btnPlaceholder) {
    btnPlaceholder.innerHTML =
      `<button id="invite-btn" class="btn-primary" title="Générer le lien d'invitation">+</button>`;
  }

  if (zonePlaceholder) {
    zonePlaceholder.innerHTML = `
      <div id="invite-link-zone" style="display: none;">
        <span id="invite-url-text" title="Cliquez pour copier à nouveau"></span>
        <span id="invite-success-check" title="Lien copié !">✓</span>
      </div>
    `;
  }

  const inviteBtn = document.getElementById("invite-btn");
  const inviteLinkZone = document.getElementById("invite-link-zone");
  const inviteUrlText = document.getElementById("invite-url-text");
  const inviteSuccessCheck = document.getElementById("invite-success-check");

  if (!inviteBtn || !inviteLinkZone || !inviteUrlText || !inviteSuccessCheck) {
    return;
  }

  inviteBtn.style.display = "inline-flex";

  const joinUrl = `${globalThis.location.origin}/join/${group.code}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(joinUrl).then(() => {
      inviteSuccessCheck.style.transform = "scale(1.3)";
      inviteSuccessCheck.style.transition = "transform 0.1s ease";
      setTimeout(() => {
        inviteSuccessCheck.style.transform = "scale(1)";
      }, 100);
    }).catch((err) => {
      console.error("Erreur lors de la copie du lien:", err);
    });
  };

  inviteBtn.addEventListener("click", () => {
    inviteBtn.style.display = "none";
    inviteUrlText.textContent = joinUrl;
    inviteLinkZone.style.display = "flex";
    copyToClipboard();
  });

  inviteUrlText.addEventListener("click", copyToClipboard);
  inviteSuccessCheck.addEventListener("click", copyToClipboard);
}

/**
 * Gère les actions d'édition et de suppression pour les administrateurs.
 * @param {Object} group L'objet groupe.
 * @param {string} groupId L'identifiant du groupe.
 */
function setupAdminActions(group, groupId) {
  const userStr = sessionStorage.getItem("user");
  if (!userStr) return;

  const user = JSON.parse(userStr);
  if (!user.roles || !user.roles.includes("admin")) return;

  const adminActions = document.getElementById("admin-actions");
  if (!adminActions) return;

  // L'utilisateur est admin : on injecte les boutons dans le DOM
  if (adminActions) {
    adminActions.innerHTML = `
    <button id="toggle-edit-btn" class="admin-action-btn" title="Modifier le nom">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"></polygon></svg>
    </button>
    <button id="delete-group-btn" class="admin-action-btn" title="Supprimer le groupe">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
    </button>
  `;
    adminActions.style.display = "flex";
  }

  // Injection du formulaire d'édition dans le DOM
  const formPlaceholder = document.getElementById("admin-form-placeholder");
  if (formPlaceholder) {
    formPlaceholder.innerHTML = `
      <div class="action-section" style="margin-top: 1rem; margin-bottom: 2rem;">
        <div id="edit-group-container" class="auth-container hidden-collapse">
          <form id="edit-group-form" class="auth-form horizontal-form">
            <div id="edit-message" style="width: 100%; text-align: center; margin-bottom: 10px"></div>
            <div class="form-group-horizontal">
              <label for="edit-group-name">Nouveau nom</label>
              <div class="form-row">
                <input type="text" id="edit-group-name" name="edit-group-name" required minlength="3" maxlength="50">
                <button type="submit" class="btn-form">Valider</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  const toggleEditBtn = document.getElementById("toggle-edit-btn");
  const deleteBtn = document.getElementById("delete-group-btn");
  const editContainer = document.getElementById("edit-group-container");
  const editForm = document.getElementById("edit-group-form");
  const editInput = document.getElementById("edit-group-name");
  const editMessage = document.getElementById("edit-message");

  //  LOGIQUE DE BASCULE (TOGGLE)
  toggleEditBtn.addEventListener("click", () => {
    const isHidden = editContainer.classList.contains("hidden-collapse");

    if (isHidden) {
      // Ouvrir le formulaire
      editContainer.classList.remove("hidden-collapse");
      toggleEditBtn.style.backgroundColor = "white";
      toggleEditBtn.style.color = "#007bff";

      editInput.value = group.name; // Pré-remplir
      editInput.focus();
    } else {
      // Fermer le formulaire (Annuler)
      editContainer.classList.add("hidden-collapse");
      toggleEditBtn.style.backgroundColor = "#007bff";
      toggleEditBtn.style.color = "white";

      editForm.reset();
      editMessage.textContent = "";
    }
  });

  // LOGIQUE DE PATCH
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    editMessage.className = "";
    editMessage.textContent = "Modification en cours...";

    const newName = editInput.value.trim();

    try {
      const response = await apiService.updateResource("groups", groupId, {
        name: newName,
      });

      if (response.success) {
        group.name = newName;
        const groupNameEl = document.getElementById("group-name");
        if (groupNameEl) {
          groupNameEl.textContent = group.name;
        }

        // Fermer le formulaire et réinitialiser le bouton
        editContainer.classList.add("hidden-collapse");
        toggleEditBtn.style.backgroundColor = "#007bff";
        toggleEditBtn.style.color = "white";
        editMessage.textContent = "";
      } else {
        editMessage.className = "error-message";
        editMessage.textContent = response.error || response.message ||
          "Erreur de modification.";
      }
    } catch (err) {
      console.error(err);
      editMessage.className = "error-message";
      editMessage.textContent = "Erreur de connexion au serveur.";
    }
  });

  //  LOGIQUE DE DELETE
  deleteBtn.addEventListener("click", async () => {
    if (
      confirm(
        `Es-tu sûr de vouloir supprimer le groupe "${group.name}" ? Cette action est irréversible.`,
      )
    ) {
      try {
        const response = await apiService.deleteResource("groups", groupId);

        if (response.success) {
          globalThis.location.href = "/groups";
        } else {
          alert(response.message || "Erreur lors de la suppression.");
        }
      } catch (err) {
        console.error(err);
        alert("Erreur de connexion au serveur.");
      }
    }
  });
}

// --- FONCTIONS DE CHARGEMENT ---

/**
 * Charge et affiche les membres d'un groupe.
 * @param {Array} members La liste des membres du groupe.
 */
function loadGroupMembers(members) {
  const membersContainer = document.getElementById("members-container");
  if (!membersContainer) return;

  membersContainer.innerHTML = "<p>Chargement des membres...</p>";

  try {
    if (members.length === 0) {
      membersContainer.innerHTML =
        '<p class="empty-state" style="width: 100%;">Il n\'y a aucun membre dans ce groupe.</p>';
      return;
    }
    membersContainer.innerHTML = "";

    members.forEach((member) => {
      const card = document.createElement("div");
      card.className = "member-card";

      const avatar = document.createElement("app-avatar");
      avatar.setAttribute("size", "large");
      avatar.username = member.username;
      if (member.url_profil_picture) {
        avatar.url = member.url_profil_picture;
      }

      const nameDiv = document.createElement("div");
      nameDiv.className = "member-card-username";
      nameDiv.textContent = member.username;

      const emailDiv = document.createElement("div");
      emailDiv.className = "member-card-email";
      emailDiv.textContent = member.email;

      card.appendChild(avatar);
      card.appendChild(nameDiv);
      card.appendChild(emailDiv);

      membersContainer.appendChild(card);
    });
  } catch (e) {
    console.error("Erreur inattendue lors du chargement des membres :", e);
    membersContainer.innerHTML =
      '<p class="error-message">Erreur lors du chargement des membres.</p>';
  }
}

/**
 * Charge et affiche les jeux du groupe via le composant app-game-row.
 * @param {Object} group L'objet groupe complet renvoyé par l'API.
 */
function loadGroupGames(group) {
  const gamesContainer = document.getElementById("games-container");
  if (!gamesContainer) return;

  gamesContainer.innerHTML = ""; // Réinitialise le conteneur

  // Détermine si l'utilisateur courant peut éditer (admin ou membre du groupe)
  let canEdit = false;
  const userStr = sessionStorage.getItem("user");
  if (userStr) {
    const user = JSON.parse(userStr);
    const isAdmin = user.roles && user.roles.includes("admin");
    const isMember = group.users && group.users.some((u) => u.id === user.id);
    canEdit = isAdmin || isMember;
  }

  // Préparation des données pour le composant Lit
  const rowGroupData = {
    name: "Jeux du groupe",
    canEdit: canEdit,
    games: group.games || [],
  };

  // Création et injection du composant app-game-row
  const row = document.createElement("app-game-row");
  row.group = rowGroupData;

  gamesContainer.appendChild(row);
}

/**
 * Charge les données principales du groupe depuis l'API.
 * @param {string} groupId L'identifiant du groupe à charger.
 */
async function loadGroupData(groupId) {
  const groupNameEl = document.getElementById("group-name");
  const groupContentEl = document.getElementById("group-content");

  try {
    const groupRes = await apiService.getById(`groups`, groupId);

    if (!groupRes.success) {
      showError(
        groupRes.error || "Impossible de charger les informations du groupe.",
      );
      return;
    }

    const group = groupRes.data?.group || groupRes.data;

    if (groupNameEl) {
      groupNameEl.textContent = group.name;
    }

    if (groupContentEl) {
      groupContentEl.style.display = "block";
    }

    loadGroupMembers(groupRes.data.group.users);
    loadGroupGames(group);
    setupAdminInvitation(group);
    setupAdminActions(group, groupId);
  } catch (e) {
    console.error("Erreur inattendue lors du chargement du groupe :", e);
    showError("Une erreur inattendue est survenue.");
  }
}

// --- INITIALISATION ---

document.addEventListener("DOMContentLoaded", () => {
  if (!apiService.isAuthenticated) {
    globalThis.location.href = "/login";
    return;
  }

  const segments = globalThis.location.pathname.split("/").filter(Boolean);
  const groupId = segments[segments.length - 1];

  if (!groupId) {
    showError("Aucun identifiant de groupe n'a été spécifié dans l'URL.");
    return;
  }

  // On lance le processus
  loadGroupData(groupId);
});

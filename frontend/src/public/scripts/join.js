import "/components/app-navbar.js";
import "/components/app-footer.js";
import { apiService } from "../services/apiService.js";

document.addEventListener("DOMContentLoaded", async () => {
  const statusTitle = document.getElementById("status-title");
  const statusMessage = document.getElementById("status-message");

  if (!apiService.isAuthenticated) {
    globalThis.location.href = "/login";
    return;
  }

  const segments = globalThis.location.pathname.split("/").filter(Boolean);
  const code = segments[segments.length - 1];

  if (!code || code === "join") {
    statusTitle.textContent = "Lien invalide";
    statusMessage.textContent =
      "Aucun code d'invitation n'a été trouvé dans l'URL.";
    return;
  }

  const res = await apiService.createResource("groups/join", { code });

  if (res.success) {
    statusTitle.textContent = "Succès !";
    statusMessage.textContent = "Redirection vers le groupe...";

    const groupId = res.data.group.id;
    globalThis.location.href = `/groups/${groupId}`;
  } else {
    statusTitle.textContent = "Erreur";
    statusMessage.textContent = res.error ||
      "Impossible de rejoindre ce groupe.";
    document.getElementById("back-btn").style.display = "block";
  }
});

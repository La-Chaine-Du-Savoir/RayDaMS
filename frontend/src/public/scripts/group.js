import { apiService } from '../services/apiService.js';
import '../components/app-avatar.js';

document.addEventListener('DOMContentLoaded', () => {
    if (!apiService.isAuthenticated) {
        window.location.href = '/login';
        return;
    }

    const groupNameEl = document.getElementById('group-name');
    const groupDescEl = document.getElementById('group-description');
    const groupContentEl = document.getElementById('group-content');
    const membersContainer = document.getElementById('members-container');
    const errorContainer = document.getElementById('error-container');
    const errorMessageEl = document.getElementById('error-message');

    const segments = window.location.pathname.split('/').filter(Boolean);
    const groupId = segments[segments.length - 1];

    if (!groupId) {
        showError("Aucun identifiant de groupe n'a été spécifié dans l'URL.");
        return;
    }

    function showError(message) {
        groupNameEl.textContent = "Erreur";
        groupDescEl.style.display = 'none';
        errorMessageEl.textContent = message;
        errorContainer.style.display = 'block';
    }

    // Fonction principale de chargement
    async function loadGroupData() {
        try {
            // Fetch des informations générales du groupe
            const groupRes = await apiService.getById(`groups`,groupId);

            if (!groupRes.success) {
                showError(groupRes.error || "Impossible de charger les informations du groupe.");
                return;
            }

            const group = groupRes.data?.group || groupRes.data;

            // Mise à jour de l'en-tête
            // Remplace l'ancienne ligne par celle-ci :
            groupNameEl.innerHTML = `
                <span class="group-label">Groupe</span>
                <span class="highlight">${group.name}</span>
            `;

            // Affichage de la section
            groupContentEl.style.display = 'block';
            console.log(groupRes);
            loadGroupMembers(groupRes.data.group.users);

        } catch (e) {
            console.error('Erreur inattendue lors du chargement du groupe :', e);
            showError("Une erreur inattendue est survenue.");
        }
    }

    // 6. Fonction pour charger les membres
    async function loadGroupMembers(members) {
        membersContainer.innerHTML = '<p>Chargement des membres...</p>';

        try {
            if (members.length === 0) {
                membersContainer.innerHTML = '<p class="empty-state" style="width: 100%;">Il n\'y a aucun membre dans ce groupe.</p>';
                return;
            }
            membersContainer.innerHTML = '';

            // Génération des cartes pour chaque membre
            members.forEach(member => {
                const card = document.createElement('div');
                card.className = 'member-card';

                const avatar = document.createElement('app-avatar');
                avatar.setAttribute('size', 'large'); // Taille plus grande pour s'adapter au design centré
                avatar.username = member.username;
                if (member.url_profil_picture) {
                    avatar.url = member.url_profil_picture;
                }

                const nameDiv = document.createElement('div');
                nameDiv.className = 'member-card-username';
                nameDiv.textContent = member.username;

                const emailDiv = document.createElement('div');
                emailDiv.className = 'member-card-email';
                emailDiv.textContent = member.email;

                card.appendChild(avatar);
                card.appendChild(nameDiv);
                card.appendChild(emailDiv);

                membersContainer.appendChild(card);
            });

        } catch (e) {
            console.error('Erreur inattendue lors du chargement des membres :', e);
            membersContainer.innerHTML = '<p class="error-message">Erreur lors du chargement des membres.</p>';
        }
    }

    // On lance le processus
    loadGroupData();
});
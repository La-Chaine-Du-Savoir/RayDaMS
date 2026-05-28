import "/components/app-navbar.js";
import "/components/app-footer.js";
import { apiService } from '../services/apiService.js';
import '../components/app-avatar.js';

// --- FONCTIONS UTILITAIRES ---

/**
 * Affiche un message d'erreur et masque le contenu du groupe.
 * @param {string} message Le message d'erreur à afficher.
 */
function showError(message) {
    const groupNameEl = document.getElementById('group-name');
    const groupDescEl = document.getElementById('group-description');
    const errorContainer = document.getElementById('error-container');
    const errorMessageEl = document.getElementById('error-message');

    if (groupNameEl) groupNameEl.textContent = "Erreur";
    if (groupDescEl) groupDescEl.style.display = 'none';
    if (errorMessageEl) errorMessageEl.textContent = message;
    if (errorContainer) errorContainer.style.display = 'block';
}

/**
 * Gère l'affichage et la logique d'invitation pour les administrateurs.
 * @param {Object} group L'objet groupe contenant le code d'invitation.
 */
function setupAdminInvitation(group) {
    // Vérification backend du rôle admin
    if (!group.code) return;

    const userStr = sessionStorage.getItem('user');
    if (!userStr) return;

    const user = JSON.parse(userStr);
    if (!user.roles || !user.roles.includes('admin')) return;

    const inviteBtn = document.getElementById('invite-btn');
    const inviteLinkZone = document.getElementById('invite-link-zone');
    const inviteUrlText = document.getElementById('invite-url-text');
    const inviteSuccessCheck = document.getElementById('invite-success-check');

    if (!inviteBtn || !inviteLinkZone || !inviteUrlText || !inviteSuccessCheck) return;

    inviteBtn.style.display = 'inline-flex';

    const joinUrl = `${window.location.origin}/join/${group.code}`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(joinUrl).then(() => {
            inviteSuccessCheck.style.transform = 'scale(1.3)';
            inviteSuccessCheck.style.transition = 'transform 0.1s ease';
            setTimeout(() => { inviteSuccessCheck.style.transform = 'scale(1)'; }, 100);
        }).catch(err => {
            console.error('Erreur lors de la copie du lien:', err);
        });
    };

    inviteBtn.addEventListener('click', () => {
        inviteBtn.style.display = 'none';
        inviteUrlText.textContent = joinUrl;
        inviteLinkZone.style.display = 'flex';
        copyToClipboard();
    });

    inviteUrlText.addEventListener('click', copyToClipboard);
    inviteSuccessCheck.addEventListener('click', copyToClipboard);
}


// --- FONCTIONS DE CHARGEMENT ---

/**
 * Charge et affiche les membres d'un groupe.
 * @param {Array} members La liste des membres du groupe.
 */
function loadGroupMembers(members) {
    const membersContainer = document.getElementById('members-container');
    if (!membersContainer) return;

    membersContainer.innerHTML = '<p>Chargement des membres...</p>';

    try {
        if (members.length === 0) {
            membersContainer.innerHTML = '<p class="empty-state" style="width: 100%;">Il n\'y a aucun membre dans ce groupe.</p>';
            return;
        }
        membersContainer.innerHTML = '';

        members.forEach(member => {
            const card = document.createElement('div');
            card.className = 'member-card';

            const avatar = document.createElement('app-avatar');
            avatar.setAttribute('size', 'large');
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

/**
 * Charge les données principales du groupe depuis l'API.
 * @param {string} groupId L'identifiant du groupe à charger.
 */
async function loadGroupData(groupId) {
    const groupNameEl = document.getElementById('group-name');
    const groupContentEl = document.getElementById('group-content');

    try {
        const groupRes = await apiService.getById(`groups`, groupId);
        console.log(groupRes);

        if (!groupRes.success) {
            showError(groupRes.error || "Impossible de charger les informations du groupe.");
            return;
        }

        const group = groupRes.data?.group || groupRes.data;

        if (groupNameEl) {
            groupNameEl.innerHTML = `
                <span class="group-label">Groupe</span>
                <span class="highlight">${group.name}</span>
            `;
        }

        if (groupContentEl) {
            groupContentEl.style.display = 'block';
        }

        loadGroupMembers(groupRes.data.group.users);
        setupAdminInvitation(group);

    } catch (e) {
        console.error('Erreur inattendue lors du chargement du groupe :', e);
        showError("Une erreur inattendue est survenue.");
    }
}


// --- INITIALISATION ---

document.addEventListener('DOMContentLoaded', () => {
    if (!apiService.isAuthenticated) {
        window.location.href = '/login';
        return;
    }

    const segments = window.location.pathname.split('/').filter(Boolean);
    const groupId = segments[segments.length - 1];

    if (!groupId) {
        showError("Aucun identifiant de groupe n'a été spécifié dans l'URL.");
        return;
    }

    // On lance le processus
    loadGroupData(groupId);
});
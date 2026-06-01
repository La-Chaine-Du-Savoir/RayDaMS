import { apiService } from '../services/apiService.js';
import '../components/group-widget.js';

document.addEventListener('DOMContentLoaded', async () => {


    // Vérification de la connexion et des droits Admin
    if (!apiService.isAuthenticated) {
        window.location.href = '/login';
        return;
    }

    const user = apiService.connectedUser;
    if (user) {
        if (!user.roles || !user.roles.includes('admin')) {
            alert("Accès refusé : cette page est réservée aux administrateurs. Vous allez être redirigé vers votre profil.");
            await apiService.refresh().catch(() => {});
            // Si pas admin, on redirige vers le profil
            window.location.href = '/profile';
            return;
        }
    } else {
        window.location.href = '/login';
        return;
    }

    // Gestion de l'interface (Bouton et Formulaire)
    const toggleBtn = document.getElementById('toggle-create-btn');
    const formContainer = document.getElementById('create-group-container');
    const createForm = document.getElementById('create-group-form');
    const groupNameInput = document.getElementById('group-name');
    const messageContainer = document.getElementById('create-message');
    const groupsContainer = document.getElementById('all-groups-container');

    // Afficher/Masquer le formulaire
    toggleBtn.addEventListener('click', () => {
        const isHidden = formContainer.classList.contains('hidden-collapse');
        if (isHidden) {
            formContainer.classList.remove('hidden-collapse');
            toggleBtn.textContent = 'Annuler';
            toggleBtn.style.backgroundColor = 'white';
            toggleBtn.style.color = 'var(--dams-pink)';
            groupNameInput.focus();
        } else {
            formContainer.classList.add('hidden-collapse');
            toggleBtn.textContent = 'Créer un groupe';
            toggleBtn.style.backgroundColor = 'var(--dams-pink)';
            toggleBtn.style.color = 'white';

            // Réinitialiser le form
            createForm.reset();
            messageContainer.textContent = '';
        }
    });

    // Soumission du formulaire (Création)
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        messageContainer.className = '';
        messageContainer.textContent = 'Création en cours...';

        const groupName = groupNameInput.value.trim();

        try {
            // Appel à la route POST /groups
            const response = await apiService.createResource('groups', { name: groupName });

            if (response.success) {
                messageContainer.className = 'success-message';
                messageContainer.textContent = 'Groupe créé ! Redirection...';

                // Récupération de l'ID du groupe créé
                const newGroup = response.data?.group || response.group;

                // Redirection vers la page du groupe
                if (newGroup && newGroup.id) {
                    setTimeout(() => {
                        window.location.href = `/groups/${newGroup.id}`;
                    }, 500);
                } else {
                    // Fallback si l'ID n'est pas trouvé
                    loadAllGroups();
                    formContainer.classList.add('hidden-collapse');
                }
            } else {
                messageContainer.className = 'error-message';
                messageContainer.textContent = response.error || response.message || "Erreur lors de la création.";
            }
        } catch (err) {
            console.error("Erreur API :", err);
            messageContainer.className = 'error-message';
            messageContainer.textContent = "Erreur de connexion au serveur.";
        }
    });

    // Chargement et affichage de tous les groupes
    async function loadAllGroups() {
        try {
            const res = await apiService.getAll('groups');

            if (res.success) {
                groupsContainer.innerHTML = '';


                if (res.data.length === 0) {
                    groupsContainer.innerHTML = '<p class="empty-state" style="width: 100%;">Aucun groupe n\'existe sur la plateforme.</p>';
                    return;
                }

                // Génération des widgets
                res.data.forEach(groupObj => {
                    const widget = document.createElement('group-widget');
                    widget.group = groupObj;
                    widget.showGroupLink = true;
                    groupsContainer.appendChild(widget);
                });

            } else {
                groupsContainer.innerHTML = `<p class="error-message">Impossible de charger les groupes: ${res.message}</p>`;
            }
        } catch (e) {
            console.error('Erreur lors du chargement des groupes :', e);
            groupsContainer.innerHTML = '<p class="error-message">Une erreur inattendue est survenue.</p>';
        }
    }

    // Initialisation
    loadAllGroups();
});
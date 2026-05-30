import { apiService } from '../services/apiService.js';
import '../components/app-navbar.js';
import '../components/app-footer.js';

document.addEventListener('DOMContentLoaded', async () => {
    // check de la co
    if (!apiService.isAuthenticated) {
        window.location.href = '/login';
        return;
    }

    const dashboard = document.getElementById('games-dashboard');
    if (!dashboard) return;

    try {
        const response = await apiService.getAll('groups/with-games');
        
        // On va chercher les groupes dans .data si Axios a encapsulé la réponse
        const groups = response.data?.groups || response.groups;

        if (response.success && groups) {
            dashboard.innerHTML = ''; // On retire le loader

            if (groups.length === 0) {
                dashboard.innerHTML = '<div class="loader">Aucun groupe trouvé sur la plateforme.</div>';
                return;
            }

            // On filtre pour ne garder que les groupes qui ont au moins 1 jeu
            const activeGroups = groups.filter(g => g.games && g.games.length > 0);

            if (activeGroups.length === 0) {
                dashboard.innerHTML = '<div class="loader">Aucun jeu n\'a encore été publié.</div>';
                return;
            }

            activeGroups.forEach(group => {
                // Création de l'élément HTML 
                const row = document.createElement('app-game-row');
                // On attache l'objet group complet à la propriété du composant Lit
                row.group = group; 
                dashboard.appendChild(row);
            });

        } else {
            dashboard.innerHTML = `<div class="error-msg">Erreur : ${response.message || response.error || "Impossible de charger les jeux."}</div>`;
        }
    } catch (error) {
        console.error("Erreur de chargement de la bibliothèque :", error);
        dashboard.innerHTML = '<div class="error-msg">Erreur de connexion au serveur Deno.</div>';
    }
});
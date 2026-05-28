import { apiService } from '../services/apiService.js';
import '../components/app-navbar.js';
import '../components/app-footer.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!apiService.isAuthenticated) {
        window.location.href = '/login';
        return;
    }

    // Récupération de l'ID depuis l'URL
    const pathParts = window.location.pathname.split('/');
    const gameId = pathParts[pathParts.length - 1];

    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const wrapper = document.getElementById('game-detail-wrapper');

    if (!gameId || isNaN(gameId)) {
        showError("ID de jeu invalide.");
        return;
    }

    try {
        // Appel à l'API
        const response = await apiService.getAll(`games/${gameId}`);
        console.log("RÉPONSE DU BACKEND POUR CE JEU :", response);

        // Comme pour les groupes, on vérifie où sont les données
        const game = response.data?.data?.game || response.data?.game || response.game;

        if (response.success && game) {

            // Remplissage des données
            document.title = `${game.name} - RayDaMS`;
            document.getElementById('ui-title').textContent = game.name;
            document.getElementById('ui-description').textContent = game.description || "Aucune description fournie pour ce jeu.";
            
            // ID de l'auteur
            document.getElementById('ui-author').textContent = `Utilisateur #${game.author}`;

            // Bouton Jouer
            const playBtn = document.getElementById('ui-play-btn');
            playBtn.href = `/games/${game.id}/play`;

            // Statut de compilation
            const statusDiv = document.getElementById('ui-status');
            statusDiv.textContent = `Compilation : ${game.status}`;
            if (game.status === 'success') statusDiv.style.color = '#27c93f';
            else if (game.status === 'failed') statusDiv.style.color = '#ff5f56';
            else statusDiv.style.color = '#ffbd2e';

            // Miniature
            const thumbImg = document.getElementById('ui-thumbnail');
            if (game.url_thumbnail) {
                thumbImg.src = game.url_thumbnail;
            } else {
                thumbImg.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23ddd"/><text x="50" y="50" dominant-baseline="middle" text-anchor="middle" font-family="monospace" fill="%23888">Sans image</text></svg>';
            }

            // Gestion du média principal (trailer sinon screen)
            const mediaContainer = document.getElementById('ui-media-container');
            if (game.url_trailer && game.url_trailer.includes('youtube.com/watch?v=')) {
                // Conversion de l'URL youtube standard en URL embed
                const videoId = game.url_trailer.split('v=')[1].split('&')[0];
                mediaContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
            } else if (game.url_screenshot) {
                // Si on ajoute un jour des URLs pour les screenshots
                mediaContainer.innerHTML = `<img src="${game.url_screenshot}" style="width:100%; height:100%; object-fit:cover;">`;
            } else {
                mediaContainer.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100%; color:#555; font-family:monospace;">Aperçu non disponible</div>`;
            }

            // Affichage de la page
            loadingState.style.display = 'none';
            wrapper.style.display = 'flex';

        } else {
            showError(response.error || response.message || "Jeu introuvable ou accès refusé.");
        }
    } catch (error) {
        console.error("Erreur détaillée:", error);
        
        if (error.response && error.response.data) {
            const serverError = error.response.data.error || error.response.data.message || "Accès refusé au jeu.";
            showError("Erreur : " + serverError);
        } else {
            showError("Impossible de se connecter au serveur.");
        }
    }

    function showError(msg) {
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
        document.getElementById('error-message').textContent = msg;
    }
});
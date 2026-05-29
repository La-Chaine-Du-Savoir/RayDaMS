import { apiService } from '../services/apiService.js';
import '../components/app-navbar.js';
import '../components/app-footer.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!apiService.isAuthenticated) {
        window.location.href = '/login';
        return;
    }

    const pathParts = window.location.pathname.split('/');
    const gameId = pathParts[pathParts.length - 2]; 

    const container = document.getElementById('player-container');
    const titleUi = document.getElementById('ui-game-title');
    const backBtn = document.getElementById('ui-back-btn');

    if (!gameId || isNaN(gameId)) {
        showError("ID de jeu invalide.");
        return;
    }

    try {
        const response = await apiService.getAll(`games/${gameId}`);
        const game = response.data?.data?.game || response.data?.game || response.game;

        if (response.success && game) {
            
            // Mise à jour de l'UI
            document.title = `Jouer : ${game.name} - RayDaMS`;
            titleUi.textContent = game.name;
            backBtn.href = `/games/${game.id}`;

            if (game.status !== 'success' || !game.url_js || !game.url_wasm) {
                showError("Les fichiers du jeu ne sont pas disponibles. Le jeu n'a pas encore été compilé avec succès.");
                return;
            }

            // Création dynamique du composant de votre collègue
            const playerElement = document.createElement('game-player');
            
            // On lui passe les URLs signées fournies par minio
            playerElement.setAttribute('js-url', game.url_js);
            playerElement.setAttribute('wasm-url', game.url_wasm);
            
            // Si le jeu a un fichier .data, on le passe, sinon on met une chaîne vide
            if (game.url_data) {
                playerElement.setAttribute('data-url', game.url_data);
            }

            // On vide le conteneur et on injecte le composant
            container.innerHTML = '';
            container.appendChild(playerElement);

        } else {
            showError("Jeu introuvable ou accès refusé.");
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
        titleUi.textContent = "Erreur";
        container.innerHTML = `<div class="error-box">${msg}</div>`;
    }
});
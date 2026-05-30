import { apiService } from '../services/apiService.js';
import '../components/app-navbar.js';
import '../components/app-footer.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!apiService.isAuthenticated) {
        window.location.href = '/login';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('id');

    const form = document.getElementById('edit-form');
    const submitBtn = document.getElementById('submit-btn');
    const backLink = document.getElementById('back-link');
    const messageContainer = document.getElementById('upload-message');
    const logsWrapper = document.getElementById('build-logs-wrapper');

    if (!gameId) {
        showMessage("Aucun jeu spécifié.", "error-message");
        form.style.display = 'none';
        return;
    }

    backLink.href = `/games/${gameId}`;

    function showMessage(text, className) {
        messageContainer.textContent = text;
        messageContainer.className = className;
    }

    // Dropzones
    function setupImagePreview(inputId, dropzoneId, imgId) {
        const input = document.getElementById(inputId);
        const dropzone = document.getElementById(dropzoneId);
        const img = document.getElementById(imgId);

        if (!input || !dropzone || !img) return;

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                img.src = URL.createObjectURL(file);
                img.style.display = 'block';
                dropzone.classList.add('has-image');
                dropzone.querySelector('.dropzone-text').innerHTML = "Image modifiée";
            }
        });
    }

    const zipInput = document.getElementById('source');
    const zipText = document.getElementById('zip-text');
    if (zipInput && zipText) {
        zipInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                zipText.innerHTML = `<b>${file.name}</b><br><small>Sera uploadé</small>`;
            } else {
                zipText.innerHTML = `<span>Garder l'ancien jeu</span><br><small>Ou cliquer pour remplacer</small>`;
            }
        });
    }

    setupImagePreview('thumbnail', 'dropzone-thumbnail', 'thumbnail-preview-img');
    setupImagePreview('screenshot', 'dropzone-screenshot', 'screenshot-preview-img');

    // Chargement des données déjà existantes du jeu
    try {
        const response = await apiService.getAll(`games/${gameId}`);
        const game = response.data?.data?.game || response.data?.game || response.game;

        if (response.success && game) {
            

            // On vérifie qui est connecté et on le compare avec l'auteur du jeu
            const currentUser = apiService.connectedUser;
            const isAuthor = currentUser && game.author === currentUser.id;
            const isAdmin = currentUser && currentUser.roles && currentUser.roles.includes('admin');

            // Si ce n'est ni l'auteur, ni un admin blocage
            if (!isAuthor && !isAdmin) {
                showMessage("Accès refusé. Redirection en cours...", "error-message");
                form.style.display = 'none'; // On cache le formulaire
                
                // Redirection automatique vers la fiche du jeu
                setTimeout(() => {
                    window.location.href = `/games/${gameId}`;
                }, 300);
                
                return;
            }

            document.getElementById('name').value = game.name || '';
            document.getElementById('description').value = game.description || '';
            document.getElementById('url_trailer').value = game.url_trailer || '';

            // Injection des images existantes dans les dropzones
            if (game.url_thumbnail) {
                const img = document.getElementById('thumbnail-preview-img');
                img.src = game.url_thumbnail;
                img.style.display = 'block';
                document.getElementById('dropzone-thumbnail').classList.add('has-image');
            }
            if (game.url_screenshot) {
                const img = document.getElementById('screenshot-preview-img');
                img.src = game.url_screenshot;
                img.style.display = 'block';
                document.getElementById('dropzone-screenshot').classList.add('has-image');
            }
        } else {
            showMessage("Impossible de charger le jeu.", "error-message");
            form.style.display = 'none';
        }
    } catch (err) {
        console.error(err);
        showMessage("Erreur de connexion.", "error-message");
        form.style.display = 'none';
    }

    // Soumission du form
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        messageContainer.className = '';
        messageContainer.textContent = '';
        submitBtn.disabled = true;

        const formData = new FormData(form);
        const zipFile = document.getElementById('source').files[0];

        // Nettoyage des fichiers vides
        if (formData.get('thumbnail').size === 0) formData.delete('thumbnail');
        if (formData.get('screenshot').size === 0) formData.delete('screenshot');
        formData.delete('source'); // On gère le ZIP séparément pour MinIO

        try {
            showMessage("Étape 1 : Mise à jour des informations...", "success-message");

            // Mise à jour des textes et images
            const updateResponse = await apiService.updateResource('games', gameId, formData);
            if (!updateResponse.success) throw new Error(updateResponse.error);

            // Si un nouveau ZIP est fourni, on fait l'upload MinIO
            if (zipFile) {
                showMessage("Étape 2 : Envoi du nouveau code source...", "success-message");
                
                // Demande d'upload
                const reqUpload = await apiService.getAll(`games/${gameId}/upload-request`);
                const s3Data = reqUpload.data?.upload_request || reqUpload.data?.data?.upload_request;
                if (!s3Data || !s3Data.url) throw new Error("Impossible d'obtenir le jeton d'envoi.");

                // Upload S3
                const cloudFormData = new FormData();
                for (const [key, value] of Object.entries(s3Data.fields)) {
                    cloudFormData.append(key, value);
                }
                cloudFormData.append('file', zipFile);

                const s3Response = await fetch(s3Data.url, { method: 'POST', body: cloudFormData });
                if (!s3Response.ok) throw new Error("L'envoi vers le cloud a échoué.");

                // Confirmation
                showMessage("Étape 3 : Lancement de la compilation...", "success-message");
                const confirmReq = await apiService.createResource(`games/${gameId}/confirm-upload`, {});
                if (!confirmReq.success) throw new Error("Erreur lors de la confirmation.");

                // Affichage du terminal
                form.style.display = 'none';
                logsWrapper.style.display = 'block';
                logsWrapper.innerHTML = `<app-build-logs game-id="${gameId}"></app-build-logs>`;
                logsWrapper.scrollIntoView({ behavior: 'smooth' });

                // Redirection après build
                logsWrapper.querySelector('app-build-logs').addEventListener('build-complete', () => {
                    showMessage("Compilation terminée ! Redirection...", "success-message");
                    setTimeout(() => window.location.href = `/games/${gameId}`, 2000);
                });

            } else {
                // Pas de ZIP envoyé, on redirige tout de suite
                showMessage("Modifications enregistrées avec succès !", "success-message");
                setTimeout(() => window.location.href = `/games/${gameId}`, 1500);
            }

        } catch (err) {
            console.error(err);
            showMessage(err.message || "Une erreur est survenue.", "error-message");
            submitBtn.disabled = false;
        }
    });
});
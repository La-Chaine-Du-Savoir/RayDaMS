import { apiService } from '../services/apiService.js';
import '../components/app-navbar.js';
import '../components/app-footer.js';

window.addEventListener('auth-change', () => {
    if (!apiService.isAuthenticated) {
        window.location.href = '/login';
    }
});

// async pour autoriser les requêtes
document.addEventListener('DOMContentLoaded', async () => { 
    if (!apiService.isAuthenticated) {
        window.location.href = '/login';
        return;
    }

    // Chargement des groupes
    const groupSelect = document.getElementById('game-group');
    
    async function loadUserGroups() {
        if (!groupSelect) return;
        
        groupSelect.innerHTML = '<option value="">Chargement de vos groupes...</option>';
        groupSelect.disabled = true;

        try {
            const response = await apiService.getAll('users/me/groups');

            if (response.success && response.data && response.data.length > 0) {
                groupSelect.innerHTML = '<option value="">-- Sélectionner un groupe --</option>';
                
                response.data.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group.id;
                    option.textContent = group.name;
                    groupSelect.appendChild(option);
                });
                groupSelect.disabled = false;
            } else {
                groupSelect.innerHTML = '<option value="">Aucun groupe disponible</option>';
            }
        } catch (error) {
            console.error("Erreur de chargement des groupes", error);
            groupSelect.innerHTML = '<option value="">Erreur serveur</option>';
        }
    }
    await loadUserGroups();


    // Prévisualisation
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
                dropzone.querySelector('.dropzone-text').innerHTML = "Changer l'image";
            } else {
                img.src = '';
                img.style.display = 'none';
                dropzone.classList.remove('has-image');
            }
        });
    }

    const zipInput = document.getElementById('game-file');
    const zipText = document.getElementById('zip-text');
    if (zipInput && zipText) {
        zipInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                zipText.innerHTML = `<b>${file.name}</b><br><small>Prêt pour l'envoi</small>`;
            } else {
                zipText.innerHTML = `<span>Sélectionner le ZIP</span><br>Code source du jeu`;
            }
        });
    }

    setupImagePreview('game-thumbnail', 'dropzone-thumbnail', 'thumbnail-preview-img');
    setupImagePreview('game-screenshot', 'dropzone-screenshot', 'screenshot-preview-img');


    // Envoi du formulaire
    const form = document.getElementById('upload-game-form');
    const messageContainer = document.getElementById('upload-message');
    const MAX_FILE_SIZE = 5 * 1024 * 1024; 

    function showMessage(text, className) {
        messageContainer.textContent = text;
        messageContainer.className = className;
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            messageContainer.className = '';
            messageContainer.textContent = '';

            const name = document.getElementById('game-name').value.trim();
            const groupId = document.getElementById('game-group').value; 
            const description = document.getElementById('game-description').value.trim();
            const trailer = document.getElementById('game-trailer').value.trim();

            if (!groupId) {
                showMessage("Veuillez sélectionner un groupe.", "error-message");
                return;
            }

            const thumbnailFile = document.getElementById('game-thumbnail').files[0];
            const screenshotFile = document.getElementById('game-screenshot').files[0];
            const zipFile = document.getElementById('game-file').files[0];

            if (thumbnailFile && thumbnailFile.size > MAX_FILE_SIZE) {
                showMessage("L'image thumbnail est trop lourde. Limite : 5 Mo.", "error-message");
                return;
            }

            const formData = new FormData();
            
            formData.append('name', name);
            formData.append('group_id', groupId);
            
            if (zipFile) formData.append('game_file', zipFile);
            if (description) formData.append('description', description);
            if (trailer) formData.append('url_trailer', trailer);
            if (thumbnailFile) formData.append('thumbnail', thumbnailFile);
            if (screenshotFile) formData.append('screenshot', screenshotFile);

            // Envoi API
            const response = await apiService.createResource('games', formData);

            if (response.success) {
                showMessage("Jeu uploadé avec succès ! Compilation en cours...", "success-message");
                
                // Nettoyage du formulaire
                form.reset();
                
                const dropzoneThumb = document.getElementById('dropzone-thumbnail');
                const imgThumb = document.getElementById('thumbnail-preview-img');
                if (dropzoneThumb && imgThumb) {
                    imgThumb.src = '';
                    imgThumb.style.display = 'none';
                    dropzoneThumb.classList.remove('has-image');
                    dropzoneThumb.querySelector('.dropzone-text').innerHTML = "<span>Icône</span><br><small>Optionnel (Max 5Mo)</small>";
                }

                const dropzoneScreen = document.getElementById('dropzone-screenshot');
                const imgScreen = document.getElementById('screenshot-preview-img');
                if (dropzoneScreen && imgScreen) {
                    imgScreen.src = '';
                    imgScreen.style.display = 'none';
                    dropzoneScreen.classList.remove('has-image');
                    dropzoneScreen.querySelector('.dropzone-text').innerHTML = "<span>Capture d'écran</span><br><small>Optionnel</small>";
                }

                if (zipText) {
                    zipText.innerHTML = `<span>Sélectionner le ZIP</span><br>Code source du jeu`;
                }
                
            } else {
                showMessage(response.error, "error-message");
            }
        });
    }
});
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
    const submitBtn = document.querySelector('.btn-form');
    const messageContainer = document.getElementById('upload-message');

    function showMessage(text, className) {
        messageContainer.textContent = text;
        messageContainer.className = className;
    }
    
    async function loadUserGroups() {
        if (!groupSelect) return;
        
        groupSelect.innerHTML = '<option value="">Chargement de vos groupes...</option>';
        groupSelect.disabled = true;
        submitBtn.disabled = true;

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
                submitBtn.disabled = false;
            } else {
                groupSelect.innerHTML = '<option value="">Aucun groupe disponible</option>';
                showMessage("Vous devez appartenir à un groupe pour publier un jeu.", "error-message");
            }
        } catch (error) {
            console.error("Erreur de chargement des groupes", error);
            groupSelect.innerHTML = '<option value="">Erreur serveur</option>';
            showMessage("Impossible de charger vos groupes.", "error-message");
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
    const MAX_FILE_SIZE = 5 * 1024 * 1024; 

    if (form) {
        form.addEventListener('submit', async (e) => {
            console.log("test");
            e.preventDefault();
            
            messageContainer.className = '';
            messageContainer.textContent = '';
            submitBtn.disabled = true;

            const name = document.getElementById('game-name').value.trim();
            const groupId = document.getElementById('game-group').value; 
            const description = document.getElementById('game-description').value.trim();
            const trailer = document.getElementById('game-trailer').value.trim();

            if (!groupId) {
                showMessage("Veuillez sélectionner un groupe.", "error-message");
                submitBtn.disabled = false;
                return;
            }

            const thumbnailFile = document.getElementById('game-thumbnail').files[0];
            const screenshotFile = document.getElementById('game-screenshot').files[0];
            const zipFile = document.getElementById('game-file').files[0];

            if (thumbnailFile && thumbnailFile.size > MAX_FILE_SIZE) {
                showMessage("L'image thumbnail est trop lourde. Limite : 5 Mo.", "error-message");
                submitBtn.disabled = false;
                return;
            }

            if (!zipFile) {
                showMessage("Le fichier ZIP du jeu est obligatoire.", "error-message");
                submitBtn.disabled = false;
                return;
            }

            // Create Game & Get Presigned URL
            showMessage("Étape 1/3 : Création du jeu...", "success-message");
            const metaFormData = new FormData();
            metaFormData.append('name', name);
            metaFormData.append('group_id', groupId);
            
            if (description) metaFormData.append('description', description);
            if (trailer) metaFormData.append('url_trailer', trailer);
            if (thumbnailFile) metaFormData.append('thumbnail', thumbnailFile);
            if (screenshotFile) metaFormData.append('screenshot', screenshotFile);

            const createResponse = await apiService.createResource('games', metaFormData);

            if (!createResponse.success) {
                showMessage(createResponse.error, "error-message");
                submitBtn.disabled = false;
                return;
            }

            // Récupération de l'URL et les champs
            const payload = createResponse.data?.game ? createResponse.data : createResponse.data?.data;
            
            const gameId = payload?.game?.id;
            const uploadRequest = payload?.upload_request;
            
            if (!gameId) {
                console.error("Structure de la réponse inattendue:", createResponse);
                showMessage("Erreur : Impossible de lire l'ID du jeu renvoyé par le serveur.", "error-message");
                submitBtn.disabled = false;
                return;
            }
            
            if (!uploadRequest || !uploadRequest.url) {
                showMessage("Erreur : Impossible de récupérer l'URL d'upload S3.", "error-message");
                submitBtn.disabled = false;
                return;
            }
            // Upload du ZIP
            if (zipFile) {
                showMessage("Étape 2/3 : Envoi du fichier source...", "success-message");
                
                const cloudFormData = new FormData();
                // Ajoute tout les champs nécessaires pour l'URL Présignée
                for (const [key, value] of Object.entries(uploadRequest.fields)) {
                    cloudFormData.append(key, value);
                }
                
                // Le fichier doit être le dernier fichier ajouté
                cloudFormData.append('file', zipFile);

                try {
                    const uploadResponse = await fetch(uploadRequest.url, {
                        method: 'POST',
                        body: cloudFormData,
                    });

                    if (!uploadResponse.ok) {
                        throw new Error(`Cloud storage returned ${uploadResponse.status}`);
                    }
                } catch (error) {
                    console.error("Cloud upload error:", error);
                    showMessage("L'envoi du fichier source a échoué.", "error-message");
                    submitBtn.disabled = false;
                    return;
                }
            }

            // Confirmation de l'upload
            showMessage("Étape 3/3 : Confirmation...", "success-message");

            const confirmResponse = await apiService.createResource(`games/${gameId}/confirm-upload`, {});

            if (!confirmResponse.success) {
                showMessage("Le fichier a été envoyé, mais la confirmation a échoué : " + confirmResponse.error, "error-message");
                submitBtn.disabled = false;
                return;
            }

            // -Affichage du terminal
            
            showMessage("Upload réussi ! Lancement de la compilation WebAssembly...", "success-message");
            
            // On cache le formulaire
            form.style.display = 'none';
            
            // On affiche le conteneur du terminal
            const logsWrapper = document.getElementById('build-logs-wrapper');
            logsWrapper.style.display = 'block';
            
            // On injecte le composant lit avec l'ID du jeu
            logsWrapper.innerHTML = `<app-build-logs game-id="${gameId}"></app-build-logs>`;
            
            // On fait défiler la page pour que le terminal soit bien visible
            logsWrapper.scrollIntoView({ behavior: 'smooth' });

            // event du composant
            const terminalElement = logsWrapper.querySelector('app-build-logs');
            terminalElement.addEventListener('build-complete', () => {
                showMessage("Compilation terminée ! Votre jeu est prêt à être joué.", "success-message");
                
                // Bouton de redirection vers le jeu
                const playBtn = document.createElement('a');
                playBtn.href = `games/${gameId}/play`;
                playBtn.className = 'btn-form';
                playBtn.textContent = 'JOUER MAINTENANT';
                logsWrapper.appendChild(playBtn);
            });
        });
    }
});
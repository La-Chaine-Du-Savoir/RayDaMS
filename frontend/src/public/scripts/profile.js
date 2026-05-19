import { apiService } from '../services/apiService.js';

document.addEventListener('DOMContentLoaded', () => {
    // si pas co, on le renvoie à l'accueil ou au login
    if (!apiService.isAuthenticated) {
        window.location.href = '/login.html';
        return;
    }

    const form = document.getElementById('profile-form');
    const emailInput = document.getElementById('email');
    const usernameInput = document.getElementById('username');
    const messageContainer = document.getElementById('profile-message');

    const avatarInput = document.getElementById('avatar-input');
    const avatarPreview = document.getElementById('avatar-preview');

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo

    // Préremplir les champs avec les données actuelles
    const user = apiService.connectedUser;
    usernameInput.value = user.username;
    emailInput.value = user.email;

    if (user.url_profil_picture) {
        avatarPreview.src = user.url_profil_picture;
    }

    // Prévisualisation immédiate de l'image et vérif de la taille
    avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check de la taille
            if (file.size > MAX_FILE_SIZE) {
                showMessage("Le fichier est trop volumineux. La taille maximum est de 5 Mo.", "error-message");
                avatarInput.value = '';
                
                // On remet l'image par défaut ou l'ancienne photo
                avatarPreview.src = user.url_profil_picture ? user.url_profil_picture : '/assets/images/logo-dams.png';
                return;
            }
            messageContainer.textContent = '';
            messageContainer.className = '';
            avatarPreview.src = URL.createObjectURL(file);  
        }
    });

    // Gestion de la soumission du formulaire
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Réinitialiser les messages
        messageContainer.className = '';
        messageContainer.textContent = '';

        const newEmail = emailInput.value.trim();
        const file = avatarInput.files[0];

        // Si l'email n'a pas changé, on ne fait rien
        if (newEmail === user.email && !file) {
            showMessage("Aucune modification détectée.", "success-message");
            return;
        }

        // Création du FormData
        const formData = new FormData();

        // On ajoute l'email uniquement s'il a changé
        if (newEmail !== user.email) {
            formData.append('email', newEmail);
        }

        // On ajoute le fichier si l'utilisateur en a sélectionné un
        if (file) {
            formData.append('avatar', file);
        }

        // Appel à l'API. apiService détectera le FormData et gere les headers
        const response = await apiService.updateResource('users', 'me', formData);

        if (response.success) {
            showMessage("Profil mis à jour avec succès !", "success-message");
            
            // On met à jour l'utilisateur dans le service et le sessionStorage
            apiService.connectedUser = response.data.user;
            sessionStorage.setItem('user', JSON.stringify(response.data.user));
            
            // On met à jour l'aperçu avec la vraie URL générée par Deno
            if (response.data.user.url_profil_picture) {
                avatarPreview.src = response.data.user.url_profil_picture;
            }
            
            // On prévient les autres composants que l'utilisateur a changé
            window.dispatchEvent(new CustomEvent('auth-change', { detail: apiService.connectedUser }));
        } else {
            showMessage(response.error, "error-message");
        }
    });

    function showMessage(text, className) {
        messageContainer.textContent = text;
        messageContainer.className = className;
    }
});
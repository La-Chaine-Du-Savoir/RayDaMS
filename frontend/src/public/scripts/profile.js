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

    // Préremplir les champs avec les données actuelles
    const user = apiService.connectedUser;
    usernameInput.value = user.username;
    emailInput.value = user.email;

    // Gestion de la soumission du formulaire
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Réinitialiser les messages
        messageContainer.className = '';
        messageContainer.textContent = '';

        const newEmail = emailInput.value.trim();

        // Si l'email n'a pas changé, on ne fait rien
        if (newEmail === user.email) {
            showMessage("Aucune modification détectée.", "success-message");
            return;
        }

        // Appel à l'API
        const response = await apiService.updateResource('users', 'me', {
            email: newEmail
        });

        if (response.success) {
            showMessage("Profil mis à jour avec succès !", "success-message");
            
            // On met à jour l'utilisateur dans le service et le sessionStorage
            apiService.connectedUser = response.data.user;
            sessionStorage.setItem('user', JSON.stringify(response.data.user));
            
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
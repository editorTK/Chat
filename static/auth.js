

// auth.js
// Maneja la autenticación de usuario (contraseña y nombre)
// y el rol de administrador.

// Elementos del DOM (asumidos globales o pasados por main.js)
// var passwordModal, passwordInput, passwordSubmit, passwordError, attemptsLeftSpan, accessDeniedOverlay;
// var nameModal, nameInput, nameSubmit, nameError;
// var chatContainer, messageInput;
// var socket; // de main.js
// var userName; // de main.js
// var isAdmin; // de main.js

const CORRECT_PASSWORD_CLIENT_SIDE = 'TIAMO'; // Solo para propósitos de test, la verificación es server-side
const MAX_ATTEMPTS = 3;
let attempts = 0;

// Estas funciones serán llamadas por main.js
function showPasswordModal() {
    passwordModal.classList.remove('hidden');
    passwordInput.focus();
    attempts = 0;
    attemptsLeftSpan.textContent = MAX_ATTEMPTS;
}

async function verifyPassword() {
    const enteredPassword = passwordInput.value;
    try {
        const response = await fetch('/verify_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: enteredPassword }),
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('passwordVerified', 'true');
            // Guardar si el usuario es admin
            localStorage.setItem('isAdmin', data.isAdmin ? 'true' : 'false'); 
            passwordModal.classList.add('hidden');
            // Llamar a la función de main.js para continuar
            window.authSuccessCallback(); 
        } else if (response.status === 401) {
            attempts++;
            attemptsLeftSpan.textContent = MAX_ATTEMPTS - attempts;
            passwordError.classList.remove('hidden');
            passwordInput.value = '';
            if (attempts >= MAX_ATTEMPTS) {
                passwordModal.classList.add('hidden');
                accessDeniedOverlay.classList.remove('hidden');
                passwordInput.disabled = true;
                passwordSubmit.disabled = true;
            }
        } else {
            console.error("Error inesperado en la verificación de contraseña:", response.status, response.statusText);
            passwordError.textContent = "Error de conexión. Inténtalo de nuevo.";
            passwordError.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Error de red al verificar contraseña:", error);
        passwordError.textContent = "No se pudo conectar con el servidor. Verifica tu conexión.";
        passwordError.classList.remove('hidden');
    }
}

function showNameModal() {
    nameModal.classList.remove('hidden');
    nameInput.focus();
}

function saveUserName() {
    const inputName = nameInput.value.trim();
    if (inputName) {
        window.userName = inputName; // Actualizar la variable global en main.js
        localStorage.setItem('userName', window.userName);
        localStorage.setItem('nameSubmitted', 'true');
        nameModal.classList.add('hidden');
        window.authNameSubmittedCallback(); // Llamar a la función de main.js
    } else {
        nameError.classList.remove('hidden');
    }
}

// Event Listeners (serán inicializados por main.js)
// window.authInitEventListeners = function() {
//     passwordSubmit.addEventListener('click', verifyPassword);
//     passwordInput.addEventListener('keypress', function(e) {
//         if (e.key === 'Enter') verifyPassword();
//     });
//     nameSubmit.addEventListener('click', saveUserName);
//     nameInput.addEventListener('keypress', function(e) {
//         if (e.key === 'Enter') saveUserName();
//     });
// };

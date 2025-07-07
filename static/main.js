// main.js
// Orquestador principal del chat, inicializa módulos y maneja el flujo general.

// --- Elementos del DOM (Globalmente accesibles aquí para simplificar la inicialización) ---
var socket = io();
var messageInput = document.getElementById('messageInput');
var messagesDiv = document.getElementById('messages');
var sendButton = document.getElementById('sendButton');
var iaCommandMenu = document.getElementById('iaCommandMenu');
var geminiCommand = document.getElementById('geminiCommand');
var dalleCommand = document.getElementById('dalleCommand');
var chatContainer = document.getElementById('chatContainer');

// Elementos de los modales (pueden ser inicializados aquí o en auth.js)
var passwordModal = document.getElementById('passwordModal');
var passwordInput = document.getElementById('passwordInput');
var passwordSubmit = document.getElementById('passwordSubmit');
var passwordError = document.getElementById('passwordError');
var attemptsLeftSpan = document.getElementById('attemptsLeft');
var accessDeniedOverlay = document.getElementById('accessDeniedOverlay');

var nameModal = document.getElementById('nameModal');
var nameInput = document.getElementById('nameInput');
var nameSubmit = document.getElementById('nameSubmit');
var nameError = document.getElementById('nameError');

var settingsModal = document.getElementById('settingsModal');
var settingsButton = document.getElementById('settingsButton');
var closeSettingsModal = document.getElementById('closeSettingsModal');
var clearChatHistoryButton = document.getElementById('clearChatHistoryButton');
var adminSettingsDiv = document.getElementById('adminSettings');
var songSelect = document.getElementById('songSelect');
var changeSongButton = document.getElementById('changeSongButton');
var trollMessageButton = document.getElementById('trollMessageButton');

var backgroundAudio = document.getElementById('backgroundAudio');


// --- Variables de Estado Globales (compartidas entre módulos) ---
let userName = ''; 
let isAdmin = false; // Estado del rol de administrador
let chatHistory = []; // Array en memoria para almacenar los mensajes


// --- Constantes ---
const GEMINI_COMMAND = '@Gemini';
const DALLE_COMMAND = '@DALL·E';
window.GEMINI_COMMAND = GEMINI_COMMAND;
window.DALLE_COMMAND = DALLE_COMMAND;


// --- Funciones de Orquestación y Flujo de Aplicación ---

// Callback para cuando la autenticación de contraseña es exitosa (llamado desde auth.js)
window.authSuccessCallback = function() {
    isAdmin = localStorage.getItem('isAdmin') === 'true'; // Cargar rol de admin
    checkUserName(); // Continuar con el flujo del nombre
};

// Callback para cuando el nombre de usuario es enviado (llamado desde auth.js)
window.authNameSubmittedCallback = async function() {
    chatContainer.classList.remove('hidden'); // Mostrar el chat
    messageInput.focus();
    // Registrar el nombre y el estado de admin con el servidor
    socket.emit('register_user_name', { userName: userName, isAdmin: isAdmin });
    window.appendMessage(`¡Hola, ${userName}! Bienvenido al chat.`, 'system-message');
    await loadChatHistory(); // Cargar historial después de guardar el nombre
    initializeSettingsPanel(); // Inicializar panel de configuración
};

// Función para verificar el nombre de usuario y continuar el flujo
async function checkUserName() {
    if (localStorage.getItem('nameSubmitted') === 'true' && localStorage.getItem('userName')) {
        userName = localStorage.getItem('userName');
        isAdmin = localStorage.getItem('isAdmin') === 'true'; // Cargar rol de admin
        chatContainer.classList.remove('hidden'); // Mostrar el chat
        messageInput.focus();
        // Registrar el nombre y el estado de admin con el servidor
        socket.emit('register_user_name', { userName: userName, isAdmin: isAdmin });
        window.appendMessage(`Bienvenido de nuevo, ${userName}.`, 'system-message');
        await loadChatHistory(); // Cargar historial al inicio si el usuario ya existe
        initializeSettingsPanel(); // Inicializar panel de configuración
    } else {
        window.showNameModal(); // Llama a la función desde auth.js
    }
}

// Función principal de inicialización de la aplicación
function initializeApp() {
    // Pasar elementos del DOM y variables a módulos que los necesiten
    // Esto es una forma "manual" de inyección de dependencias para JS modular sin bundlers
    window.passwordModal = passwordModal;
    window.passwordInput = passwordInput;
    window.passwordSubmit = passwordSubmit;
    window.passwordError = passwordError;
    window.attemptsLeftSpan = attemptsLeftSpan;
    window.accessDeniedOverlay = accessDeniedOverlay;
    window.nameModal = nameModal;
    window.nameInput = nameInput;
    window.nameSubmit = nameSubmit;
    window.nameError = nameError;
    window.chatContainer = chatContainer;
    window.messageInput = messageInput;

    window.messagesDiv = messagesDiv; // Para chat-ui y chat-history
    window.iaCommandMenu = iaCommandMenu; // Para chat-ui
    window.geminiCommand = geminiCommand; // Para chat-ui
    window.dalleCommand = dalleCommand; // Para chat-ui
    window.socket = socket; // Para todos los módulos que necesitan comunicación
    window.userName = userName; // Para chat-history y sendMessage
    window.isAdmin = isAdmin; // Para manejar opciones de admin

    window.chatHistory = chatHistory; // Para chat-history

    // Inicializar listeners en los módulos
    // auth.js
    passwordSubmit.addEventListener('click', window.verifyPassword);
    passwordInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') window.verifyPassword(); });
    nameSubmit.addEventListener('click', window.saveUserName);
    nameInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') window.saveUserName(); });

    // chat-ui.js
    window.initChatUIEventListeners();

    // Iniciar flujo de autenticación
    if (localStorage.getItem('passwordVerified') === 'true') {
        isAdmin = localStorage.getItem('isAdmin') === 'true'; // Cargar el rol de admin antes de checkUserName
        checkUserName();
    } else {
        window.showPasswordModal(); // Llama a la función desde auth.js
    }
}

// --- Funcionalidad del Botón de Envío y Mensajes ---
sendButton.onclick = function() {
    sendMessage();
};

messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

async function sendMessage() {
    var msg = messageInput.value.trim();
    if (!msg) return;

    messageInput.value = '';
    messageInput.style.color = 'white';
    iaCommandMenu.style.display = 'none';

    let messageData = {
        text: msg,
        type: 'sent',
        senderName: userName,
        timestamp: new Date().toISOString()
    };

    if (msg.startsWith(GEMINI_COMMAND)) {
        const prompt = msg.substring(GEMINI_COMMAND.length).trim();
        window.appendMessage(`Tú: <span class="font-bold">${GEMINI_COMMAND}</span> ${prompt}`, 'sent'); 
        
        messageData.text = `Tú: <span class="font-bold">${GEMINI_COMMAND}</span> ${prompt}`;
        window.chatHistory.push(messageData);
        await window.saveChatHistory();

        // Llamar a la función de Gemini desde ai-logic.js
        await window.callGeminiFlash(prompt, 
            (msgText, msgType, msgId, msgSenderName) => { // Función custom appendMessage para IA
                window.appendMessage(msgText, msgType, msgId, msgSenderName);
                if (msgType !== 'ia-typing') {
                    const iaHistoryText = msgText.replace(/<strong>IA:<\/strong>\s*/, '');
                    window.chatHistory.push({
                        text: iaHistoryText,
                        type: msgType,
                        senderName: 'IA',
                        timestamp: new Date().toISOString()
                    });
                    window.saveChatHistory();
                }
            }, 
            window.removeMessageById, messagesDiv
        );

    } else if (msg.startsWith(DALLE_COMMAND)) {
        const prompt = msg.substring(DALLE_COMMAND.length).trim();
        window.appendMessage(`Tú: <span class="font-bold">${DALLE_COMMAND}</span> ${prompt}`, 'sent');

        messageData.text = `Tú: <span class="font-bold">${DALLE_COMMAND}</span> ${prompt}`;
        window.chatHistory.push(messageData);
        await window.saveChatHistory();

        // Llamar a la función de DALL·E desde ai-logic.js
        await window.callDalle(prompt, 
            (msgHtml, msgType, msgId, msgSenderName) => { // Función custom appendMessage para DALL·E
                window.appendMessage(msgHtml, msgType, msgId, msgSenderName);
                if (msgType !== 'ia-typing') {
                     const imgUrlMatch = msgHtml.match(/src="([^"]+)"/);
                    const imgUrl = imgUrlMatch ? imgUrlMatch[1] : msgHtml;
                    window.chatHistory.push({
                        text: imgUrl,
                        type: msgType,
                        senderName: 'DALL·E',
                        timestamp: new Date().toISOString()
                    });
                    window.saveChatHistory();
                }
            }, 
            window.removeMessageById, messagesDiv
        );

    } else {
        // Mensaje normal de chat
        window.appendMessage(msg, 'sent');
        window.chatHistory.push(messageData);
        await window.saveChatHistory();

        socket.emit('message', msg);
    }
}

// Receptor de mensajes del servidor (de otros usuarios)
socket.on('message', function(data) {
    window.appendMessage(data.message, 'received', null, data.senderName);

    window.chatHistory.push({
        text: data.message,
        type: 'received',
        senderName: data.senderName,
        timestamp: new Date().toISOString()
    });
    window.saveChatHistory();
});

// --- Configuración (Música y Opciones de Admin) ---
function initializeSettingsPanel() {
    // Mostrar/ocultar opciones de administrador
    if (isAdmin) {
        adminSettingsDiv.classList.remove('hidden');
    } else {
        adminSettingsDiv.classList.add('hidden');
    }

    // Event Listeners para el modal de configuración
    settingsButton.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });

    closeSettingsModal.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    clearChatHistoryButton.addEventListener('click', window.clearUserChatHistory); // Llama a la función de chat-history.js

    changeSongButton.addEventListener('click', () => {
        const newSongUrl = songSelect.value;
        if (newSongUrl && isAdmin) {
            socket.emit('change_song', { url: newSongUrl });
        } else if (!isAdmin) {
            window.appendMessage("¡No eres un administrador!", "ia-error");
        }
    });

    trollMessageButton.addEventListener('click', () => {
        if (isAdmin) {
            const trollMsg = prompt("¡Escribe tu mensaje troll para todos!");
            if (trollMsg) {
                socket.emit('admin_troll_message', { message: trollMsg });
            }
        } else {
            window.appendMessage("¡No eres un administrador!", "ia-error");
        }
    });
}

// SocketIO listener para cambiar la canción globalmente
socket.on('current_song_update', function(data) {
    if (data.url && backgroundAudio.src !== data.url) { // Solo si la URL es diferente
        backgroundAudio.src = data.url;
        backgroundAudio.play().catch(e => console.error("Error al reproducir audio:", e));
        window.appendMessage(`La canción de fondo ha cambiado a: ${data.url.split('/').pop().split('.')[0]}`, "system-message");
    }
});

socket.on('system_message', function(msg) {
    window.appendMessage(msg, 'system-message');
});


// Inicializar la aplicación al cargar la página
initializeApp();

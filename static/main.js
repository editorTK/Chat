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
// main.js
// Lógica principal del chat, UI, autenticación y manejo de mensajes.

// Elementos del DOM
var socket = io();
var messageInput = document.getElementById('messageInput');
var messagesDiv = document.getElementById('messages');
var sendButton = document.getElementById('sendButton');
var iaCommandMenu = document.getElementById('iaCommandMenu');
var geminiCommand = document.getElementById('geminiCommand');
var dalleCommand = document.getElementById('dalleCommand');
var chatContainer = document.getElementById('chatContainer');

// Elementos del modal de contraseña
var passwordModal = document.getElementById('passwordModal');
var passwordInput = document.getElementById('passwordInput');
var passwordSubmit = document.getElementById('passwordSubmit');
var passwordError = document.getElementById('passwordError');
var attemptsLeftSpan = document.getElementById('attemptsLeft');
var accessDeniedOverlay = document.getElementById('accessDeniedOverlay');

// Elementos del modal de nombre
var nameModal = document.getElementById('nameModal');
var nameInput = document.getElementById('nameInput');
var nameSubmit = document.getElementById('nameSubmit');
var nameError = document.getElementById('nameError');

// Constantes y variables de estado
const CORRECT_PASSWORD_CLIENT_SIDE = 'RAVEDXRK'; // Solo para propósitos de prueba, la verificación real es en el servidor
const MAX_ATTEMPTS = 3;
let attempts = 0;
let userName = ''; 

const GEMINI_COMMAND = '@Gemini';
const DALLE_COMMAND = '@DALL·E';

// --- Historial del Chat ---
let chatHistory = []; // Array en memoria para almacenar los mensajes


// --- Funciones de Modales y Autenticación ---

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
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: enteredPassword }),
        });

        if (response.ok) {
            localStorage.setItem('passwordVerified', 'true');
            passwordModal.classList.add('hidden');
            checkUserName();
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

async function saveUserName() { // Ahora asíncrona para cargar historial
    const inputName = nameInput.value.trim();
    if (inputName) {
        userName = inputName;
        localStorage.setItem('userName', userName);
        localStorage.setItem('nameSubmitted', 'true');
        nameModal.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        messageInput.focus();
        socket.emit('register_user_name', { userName: userName });
        appendMessage(`¡Hola, ${userName}! Bienvenido al chat.`, 'system-message');
        await loadChatHistory(); // Cargar historial después de guardar el nombre
    } else {
        nameError.classList.remove('hidden');
    }
}

async function checkUserName() { // Ahora asíncrona para cargar historial
    if (localStorage.getItem('nameSubmitted') === 'true' && localStorage.getItem('userName')) {
        userName = localStorage.getItem('userName');
        chatContainer.classList.remove('hidden');
        messageInput.focus();
        socket.emit('register_user_name', { userName: userName });
        appendMessage(`Bienvenido de nuevo, ${userName}.`, 'system-message');
        await loadChatHistory(); // Cargar historial al inicio si el usuario ya existe
    } else {
        showNameModal();
    }
}

function initializeApp() {
    // localStorage.clear(); // Para depuración, puedes limpiar LocalStorage para probar el flujo completo

    if (localStorage.getItem('passwordVerified') === 'true') {
        checkUserName();
    } else {
        showPasswordModal();
    }
}

// --- Gestión del Historial del Chat ---

// Función para guardar el historial en Puter.js
async function saveChatHistory() {
    if (!userName) return; // No guardar si no hay nombre de usuario

    try {
        await puter.kv.set(`chat:${userName}:messages`, JSON.stringify(chatHistory));
        console.log("Historial de chat guardado en Puter.js");
    } catch (error) {
        console.error("Error al guardar el historial en Puter.js:", error);
    }
}

// Función para cargar el historial desde Puter.js
async function loadChatHistory() {
    if (!userName) return;

    try {
        const storedHistory = await puter.kv.get(`chat:${userName}:messages`);
        if (storedHistory) {
            chatHistory = JSON.parse(storedHistory);
            messagesDiv.innerHTML = ''; // Limpiar mensajes actuales antes de cargar
            chatHistory.forEach(message => {
                // Re-renderizar los mensajes usando appendMessage
                // La función appendMessage ya sabe cómo manejar los diferentes tipos
                // y si lleva nombre o no.
                appendMessage(message.text, message.type, null, message.senderName);
            });
            messagesDiv.scrollTop = messagesDiv.scrollHeight; // Asegurarse de ir al final
            console.log("Historial de chat cargado desde Puter.js");
        } else {
            chatHistory = []; // Si no hay historial, inicializar vacío
            console.log("No se encontró historial de chat para este usuario.");
        }
    } catch (error) {
        console.error("Error al cargar el historial desde Puter.js:", error);
        chatHistory = []; // En caso de error, inicializar vacío
    }
}

// --- Eventos de Modales ---
passwordSubmit.addEventListener('click', verifyPassword);
passwordInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') verifyPassword();
});

nameSubmit.addEventListener('click', saveUserName);
nameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') saveUserName();
});


// --- Funcionalidad del Menú de Comandos IA y Autocompletado ---
messageInput.addEventListener('input', function() {
    const inputValue = messageInput.value;

    if (inputValue.startsWith('@') && inputValue.length <= 8) {
        iaCommandMenu.style.display = 'block';
    } else {
        iaCommandMenu.style.display = 'none';
    }

    let isCommandInput = inputValue.startsWith(GEMINI_COMMAND) || inputValue.startsWith(DALLE_COMMAND);
    if (isCommandInput) {
        messageInput.style.color = '#60A5FA';
    } else {
        messageInput.style.color = 'white';
    }
});

geminiCommand.addEventListener('click', function() {
    messageInput.value = GEMINI_COMMAND + ' ';
    iaCommandMenu.style.display = 'none';
    messageInput.focus();
    messageInput.style.color = '#60A5FA';
});

dalleCommand.addEventListener('click', function() {
    messageInput.value = DALLE_COMMAND + ' ';
    iaCommandMenu.style.display = 'none';
    messageInput.focus();
    messageInput.style.color = '#60A5FA';
});

messageInput.addEventListener('blur', function() {
    setTimeout(() => {
        if (!iaCommandMenu.contains(document.activeElement) && messageInput.value.trim() === '') {
            iaCommandMenu.style.display = 'none';
        }
        if (!messageInput.value.startsWith(GEMINI_COMMAND) && !messageInput.value.startsWith(DALLE_COMMAND)) {
            messageInput.style.color = 'white';
        }
    }, 100);
});

// --- Funcionalidad de Envío de Mensajes ---
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

    let messageData = { // Objeto para guardar en el historial
        text: msg,
        type: 'sent',
        senderName: userName, // Tu nombre, para el historial
        timestamp: new Date().toISOString()
    };

    if (msg.startsWith(GEMINI_COMMAND)) {
        const prompt = msg.substring(GEMINI_COMMAND.length).trim();
        appendMessage(`Tú: <span class="font-bold">${GEMINI_COMMAND}</span> ${prompt}`, 'sent'); 
        
        messageData.text = `Tú: <span class="font-bold">${GEMINI_COMMAND}</span> ${prompt}`; // Ajustar el texto para el historial
        chatHistory.push(messageData); // Añadir al historial antes de la llamada IA
        await saveChatHistory(); // Guardar el historial

        // Llamar a la función de Gemini desde ai-logic.js
        await callGeminiFlash(prompt, 
            (msgText, msgType, msgId, msgSenderName) => { // Función custom appendMessage para IA
                appendMessage(msgText, msgType, msgId, msgSenderName);
                if (msgType !== 'ia-typing') { // No guardar el indicador de "pensando" en el historial
                    // Clonar el mensaje de IA para el historial (sin el "IA:")
                    const iaHistoryText = msgText.replace(/<strong>IA:<\/strong>\s*/, '');
                    chatHistory.push({
                        text: iaHistoryText,
                        type: msgType,
                        senderName: 'IA',
                        timestamp: new Date().toISOString()
                    });
                    saveChatHistory(); // Guardar el historial después de cada parte de IA
                }
            }, 
            removeMessageById, messagesDiv
        );

    } else if (msg.startsWith(DALLE_COMMAND)) {
        const prompt = msg.substring(DALLE_COMMAND.length).trim();
        appendMessage(`Tú: <span class="font-bold">${DALLE_COMMAND}</span> ${prompt}`, 'sent');

        messageData.text = `Tú: <span class="font-bold">${DALLE_COMMAND}</span> ${prompt}`;
        chatHistory.push(messageData);
        await saveChatHistory();

        // Llamar a la función de DALL·E desde ai-logic.js
        await callDalle(prompt, 
            (msgHtml, msgType, msgId, msgSenderName) => { // Función custom appendMessage para DALL·E
                appendMessage(msgHtml, msgType, msgId, msgSenderName);
                if (msgType !== 'ia-typing') {
                     // Para DALL·E, guardar la URL de la imagen en lugar del HTML completo
                    const imgUrlMatch = msgHtml.match(/src="([^"]+)"/);
                    const imgUrl = imgUrlMatch ? imgUrlMatch[1] : msgHtml; // Si no hay URL, guardar el HTML completo
                    chatHistory.push({
                        text: imgUrl, // Guardar la URL para reconstruir
                        type: msgType,
                        senderName: 'DALL·E',
                        timestamp: new Date().toISOString()
                    });
                    saveChatHistory();
                }
            }, 
            removeMessageById, messagesDiv
        );

    } else {
        // Mensaje normal de chat
        // Para ti, no se muestra tu propio nombre
        appendMessage(msg, 'sent');
        chatHistory.push(messageData); // Añadir a tu historial
        await saveChatHistory(); // Guardar el historial

        // El servidor añadirá el nombre para los demás
        socket.emit('message', msg);
    }
}

function removeMessageById(id) {
    const elementToRemove = document.getElementById(id);
    if (elementToRemove) {
        elementToRemove.remove();
    }
}

// Receptor de mensajes del servidor (de otros usuarios)
socket.on('message', function(data) {
    // 'data' es ahora un objeto: { senderName: 'Nombre', message: 'Contenido' }
    appendMessage(data.message, 'received', null, data.senderName); // Pasa el nombre del remitente

    // Añadir el mensaje recibido al historial
    chatHistory.push({
        text: data.message,
        type: 'received',
        senderName: data.senderName,
        timestamp: new Date().toISOString()
    });
    saveChatHistory(); // Guardar el historial
});

// Función para añadir mensajes al DOM con el tipo de mensaje adecuado
// msg puede ser texto o HTML
function appendMessage(msg, type, id = null, senderName = null) {
    var messageContainer = document.createElement('div');
    if (id) {
        messageContainer.id = id;
    }
    var messageBubble = document.createElement('div');
    messageBubble.classList.add('p-2', 'rounded-lg', 'max-w-[70%]', 'relative'); // Añadir 'relative' para posicionar el nombre

    // Si hay un senderName y no es un mensaje 'sent' (es decir, es 'received' de otro)
    if (senderName && type !== 'sent') { 
        messageBubble.classList.add('has-sender-name');
        const nameDiv = document.createElement('div');
        nameDiv.classList.add('sender-name');
        nameDiv.textContent = senderName;
        messageBubble.prepend(nameDiv); // Insertar el nombre al principio de la burbuja
    }

    if (type === 'sent') {
        messageContainer.classList.add('flex', 'justify-end');
        messageBubble.classList.add('bg-blue-600', 'text-white');
        messageBubble.innerHTML = msg; 
    } else if (type === 'received') {
        messageContainer.classList.add('flex', 'justify-start');
        messageBubble.classList.add('bg-gray-700', 'text-white');
        messageBubble.innerHTML = msg; 
    } else if (type === 'ia') {
        messageContainer.classList.add('flex', 'justify-start', 'ia-message-container');
        messageBubble.classList.add('bg-purple-700', 'text-white', 'border', 'border-purple-500', 'ia-message-bubble');
        messageBubble.innerHTML = msg; 
    } else if (type === 'dalle-image') {
        messageContainer.classList.add('flex', 'justify-start', 'dalle-image-container');
        messageBubble.classList.add('bg-gray-700', 'p-1', 'dalle-image-bubble'); 
        
        // Si el 'msg' es una URL (al cargar del historial), crear el elemento img
        if (msg.startsWith('<img') || msg.startsWith('<div')) { // Ya es HTML de imagen
            messageBubble.innerHTML = `<strong>DALL·E:</strong><br>${msg}`;
        } else { // Es una URL, crear la imagen
             messageBubble.innerHTML = `<strong>DALL·E:</strong><br><img src="${msg}" alt="Generated Image" class="w-full h-auto rounded-md mt-2 max-h-64 object-contain">`;
        }
        // Asegurarse de que la imagen se adapte
        const imgElement = messageBubble.querySelector('img');
        if (imgElement) {
            imgElement.classList.add('w-full', 'h-auto', 'rounded-md', 'mt-2', 'max-h-64', 'object-contain');
        }
    } else if (type === 'ia-typing') {
        messageContainer.classList.add('flex', 'justify-start', 'ia-typing-message');
        messageBubble.classList.add('bg-gray-600', 'text-gray-300', 'italic', 'animate-pulse');
        messageBubble.innerHTML = msg;
    } else if (type === 'ia-error') {
        messageContainer.classList.add('flex', 'justify-start', 'ia-error-message');
        messageBubble.classList.add('bg-red-800', 'text-white', 'font-bold');
        messageBubble.innerHTML = msg;
    } else if (type === 'system-message') {
        messageContainer.classList.add('flex', 'justify-center', 'text-center', 'w-full');
        messageBubble.classList.add('bg-gray-700', 'text-gray-300', 'text-sm', 'italic', 'max-w-[90%]');
        messageBubble.innerHTML = msg;
    }

    messageContainer.appendChild(messageBubble);
    messagesDiv.appendChild(messageContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Inicializar la aplicación al cargar la página
initializeApp();


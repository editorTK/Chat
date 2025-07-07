

// chat-history.js
// Maneja la persistencia del historial de chat usando Puter.js KV Store.

// Dependencias (asumidas globales o pasadas por main.js)
// var userName; // de main.js
// var chatHistory; // de main.js
// var messagesDiv; // de main.js
// var appendMessage; // de chat-ui.js

// Funciones para guardar y cargar historial
async function saveChatHistory() {
    if (!window.userName) return;

    try {
        await puter.kv.set(`chat:${window.userName}:messages`, JSON.stringify(window.chatHistory));
        console.log("Historial de chat guardado en Puter.js");
    } catch (error) {
        console.error("Error al guardar el historial en Puter.js:", error);
    }
}

async function loadChatHistory() {
    if (!window.userName) return;

    try {
        const storedHistory = await puter.kv.get(`chat:${window.userName}:messages`);
        if (storedHistory) {
            window.chatHistory = JSON.parse(storedHistory);
            window.messagesDiv.innerHTML = ''; // Limpiar mensajes actuales antes de cargar
            window.chatHistory.forEach(message => {
                // Para DALL·E, si el texto es una URL, reconstruir el HTML de la imagen
                let msgTextToRender = message.text;
                if (message.type === 'dalle-image' && !message.text.startsWith('<img')) {
                    msgTextToRender = `<img src="${message.text}" alt="Generated Image">`;
                }
                // Usar la función appendMessage del módulo UI
                window.appendMessage(msgTextToRender, message.type, null, message.senderName);
            });
            window.messagesDiv.scrollTop = window.messagesDiv.scrollHeight;
            console.log("Historial de chat cargado desde Puter.js");
        } else {
            window.chatHistory = [];
            console.log("No se encontró historial de chat para este usuario.");
        }
    } catch (error) {
        console.error("Error al cargar el historial desde Puter.js:", error);
        window.chatHistory = [];
    }
}

// Función para borrar el historial del usuario actual
async function clearUserChatHistory() {
    if (!window.userName) {
        alert("Primero debes establecer tu nombre de usuario para borrar el historial.");
        return;
    }
    const confirmClear = confirm("¿Estás seguro de que quieres borrar todo tu historial de chat? Esta acción es irreversible.");
    if (confirmClear) {
        try {
            await puter.kv.del(`chat:${window.userName}:messages`);
            window.chatHistory = []; // Limpiar historial en memoria
            window.messagesDiv.innerHTML = ''; // Limpiar UI
            window.appendMessage("Tu historial de chat ha sido borrado.", "system-message");
            console.log("Historial de chat borrado para:", window.userName);
        } catch (error) {
            console.error("Error al borrar el historial:", error);
            window.appendMessage("Error al borrar el historial de chat.", "ia-error");
        }
    }
}



// chat-ui.js
// Maneja la interacción con la UI del chat (mostrar mensajes, menú de IA, etc.)

// Elementos del DOM (asumidos globales o pasados por main.js)
// var messagesDiv, messageInput, iaCommandMenu, geminiCommand, dalleCommand;


// Función para añadir mensajes al DOM
function appendMessage(msg, type, id = null, senderName = null) {
    var messageContainer = document.createElement('div');
    if (id) {
        messageContainer.id = id;
    }
    var messageBubble = document.createElement('div');
    messageBubble.classList.add('p-2', 'rounded-lg', 'max-w-[70%]', 'relative', 'message-bubble'); // Añadir 'message-bubble'

    if (senderName && type !== 'sent') { 
        messageBubble.classList.add('has-sender-name');
        const nameDiv = document.createElement('div');
        nameDiv.classList.add('sender-name');
        nameDiv.textContent = senderName;
        messageBubble.prepend(nameDiv);
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
        
        if (msg.startsWith('<img') || msg.startsWith('<div')) {
            messageBubble.innerHTML = `<strong>DALL·E:</strong><br>${msg}`;
        } else {
             messageBubble.innerHTML = `<strong>DALL·E:</strong><br><img src="${msg}" alt="Generated Image" class="w-full h-auto rounded-md mt-2 max-h-64 object-contain">`;
        }
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

function removeMessageById(id) {
    const elementToRemove = document.getElementById(id);
    if (elementToRemove) {
        elementToRemove.remove();
    }
}

// Inicialización de eventos UI (serán llamados por main.js)
window.initChatUIEventListeners = function() {
    messageInput.addEventListener('input', function() {
        const inputValue = messageInput.value;

        if (inputValue.startsWith('@') && inputValue.length <= 8) {
            iaCommandMenu.style.display = 'block';
        } else {
            iaCommandMenu.style.display = 'none';
        }

        let isCommandInput = inputValue.startsWith(window.GEMINI_COMMAND) || inputValue.startsWith(window.DALLE_COMMAND);
        if (isCommandInput) {
            messageInput.style.color = '#60A5FA';
        } else {
            messageInput.style.color = 'white';
        }
    });

    geminiCommand.addEventListener('click', function() {
        messageInput.value = window.GEMINI_COMMAND + ' ';
        iaCommandMenu.style.display = 'none';
        messageInput.focus();
        messageInput.style.color = '#60A5FA';
    });

    dalleCommand.addEventListener('click', function() {
        messageInput.value = window.DALLE_COMMAND + ' ';
        iaCommandMenu.style.display = 'none';
        messageInput.focus();
        messageInput.style.color = '#60A5FA';
    });

    messageInput.addEventListener('blur', function() {
        setTimeout(() => {
            if (!iaCommandMenu.contains(document.activeElement) && messageInput.value.trim() === '') {
                iaCommandMenu.style.display = 'none';
            }
            if (!messageInput.value.startsWith(window.GEMINI_COMMAND) && !messageInput.value.startsWith(window.DALLE_COMMAND)) {
                messageInput.style.color = 'white';
            }
        }, 100);
    });
};

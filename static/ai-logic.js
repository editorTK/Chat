// ai-logic.js
// Contiene la lógica para interactuar con las APIs de IA (Gemini y DALL·E)

// Funciones pasadas como argumentos desde main.js:
// appendMessageFn, removeMessageByIdFn, messagesDivEl

const GEMINI_COMMAND_PREFIX = '@Gemini';
const DALLE_COMMAND_PREFIX = '@DALL·E';

async function callGeminiFlash(prompt, appendMessageFn, removeMessageByIdFn, messagesDivEl) {
    const typingIndicatorId = 'ia-typing-indicator-' + Date.now();
    appendMessageFn('IA está pensando...', 'ia-typing', typingIndicatorId);
    messagesDivEl.scrollTop = messagesDivEl.scrollHeight;

    try {
        const stream = await puter.ai.chat(
            prompt,
            {
                model: 'google/gemini-2.5-flash-preview',
                stream: true
            }
        );

        removeMessageByIdFn(typingIndicatorId);

        const iaResponseBubbleId = 'ia-response-' + Date.now();
        appendMessageFn('', 'ia', iaResponseBubbleId);
        const iaResponseBubble = document.getElementById(iaResponseBubbleId).querySelector('.ia-message-bubble');
        
        let fullResponse = '';
        for await (const part of stream) {
            if (part?.text) {
                fullResponse += part.text;
                iaResponseBubble.innerHTML = `<strong>IA:</strong> ${marked.parse(fullResponse)}`;
                messagesDivEl.scrollTop = messagesDivEl.scrollHeight;
            }
        }

        if (fullResponse.trim() === '') {
            appendMessageFn('La IA no pudo generar una respuesta para eso. Intenta con un prompt diferente.', 'ia-error');
        }

    } catch (error) {
        console.error("Error llamando a Gemini Flash:", error);
        removeMessageByIdFn(typingIndicatorId);
        let errorMessage = 'Error al contactar con la IA. Por favor, inténtalo de nuevo más tarde.';
        
        if (error.response && error.response.status) {
            if (error.response.status === 401 || error.response.status === 403) {
                errorMessage = 'Error de autenticación con la IA. Verifica tu configuración de Puter.js/API Key.';
            } else if (error.response.status === 429) {
                errorMessage = 'Has excedido tu cuota de uso de la IA. Intenta de nuevo más tarde.';
            } else if (error.response.status >= 500) {
                errorMessage = 'Error interno del servidor de IA. Intenta de nuevo más tarde.';
            }
        } else if (error.message) {
             if (error.message.includes('BLOCKED_FOR_SAFETY')) {
                errorMessage = 'La IA bloqueó la respuesta por motivos de seguridad o contenido inapropiado. Intenta con un prompt diferente.';
            } else if (error.message.includes('Quota exceeded')) {
                errorMessage = 'Has excedido tu cuota de uso de la IA. Intenta de nuevo más tarde.';
            }
        }
        
        appendMessageFn(errorMessage, 'ia-error');
        messagesDivEl.scrollTop = messagesDivEl.scrollHeight;
    }
}

async function callDalle(prompt, appendMessageFn, removeMessageByIdFn, messagesDivEl) {
    const generatingIndicatorId = 'dalle-generating-indicator-' + Date.now();
    appendMessageFn('DALL·E está generando tu imagen...', 'ia-typing', generatingIndicatorId);
    messagesDivEl.scrollTop = messagesDivEl.scrollHeight;

    try {
        const imageEl = await puter.ai.txt2img(prompt);
        removeMessageByIdFn(generatingIndicatorId);
        
        appendMessageFn(imageEl.outerHTML, 'dalle-image');
        messagesDivEl.scrollTop = messagesDivEl.scrollHeight;

    } catch (error) {
        console.error("Error generando imagen con DALL·E:", error);
        removeMessageByIdFn(generatingIndicatorId);
        let errorMessage = 'Error al generar imagen con DALL·E. Inténtalo de nuevo.';
         if (error.message && error.message.includes('BLOCKED_FOR_SAFETY')) {
            errorMessage = 'DALL·E bloqueó la generación de la imagen por motivos de seguridad o contenido. Intenta con un prompt diferente.';
        } else if (error.response && error.response.status === 429) {
             errorMessage = 'Has excedido tu cuota de uso de DALL·E. Intenta de nuevo más tarde.';
        }
        appendMessageFn(errorMessage, 'ia-error');
        messagesDivEl.scrollTop = messagesDivEl.scrollHeight;
    }
}


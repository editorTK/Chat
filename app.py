import os
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
socketio = SocketIO(app)

GLOBAL_PASSWORD = os.getenv('GLOBAL_PASSWORD')
ADMIN_GLOBAL_PASSWORD = os.getenv('ADMIN_GLOBAL_PASSWORD') # Nueva contraseña de admin

if not GLOBAL_PASSWORD:
    print("ADVERTENCIA: GLOBAL_PASSWORD no está definida en el archivo .env.")
    GLOBAL_PASSWORD = "default_password" # Para desarrollo, cambia esto en producción

if not ADMIN_GLOBAL_PASSWORD:
    print("ADVERTENCIA: ADMIN_GLOBAL_PASSWORD no está definida en el archivo .env.")
    ADMIN_GLOBAL_PASSWORD = "admin_default_password" # Para desarrollo

# Estado del servidor: Almacena la canción actual y quién es admin (temporalmente por SID)
current_song_url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" # Canción por defecto
users_in_chat = {} # {sid: userName}
admin_sids = set() # Set de SIDs que son administradores

CHAT_ROOM = "main_chat_room"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/verify_password', methods=['POST'])
def verify_password():
    data = request.get_json()
    password = data.get('password')
    is_admin_login = False

    if password == GLOBAL_PASSWORD:
        return jsonify({'success': True, 'isAdmin': False})
    elif password == ADMIN_GLOBAL_PASSWORD:
        is_admin_login = True
        return jsonify({'success': True, 'isAdmin': True})
    else:
        return jsonify({'success': False}), 401

@socketio.on('connect')
def handle_connect():
    join_room(CHAT_ROOM)
    print(f"Cliente {request.sid} conectado y unido a la sala {CHAT_ROOM}")
    # Enviar la canción actual al nuevo cliente
    emit('current_song_update', {'url': current_song_url}, room=request.sid)

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in users_in_chat:
        user_name = users_in_chat.pop(request.sid)
        print(f"Cliente {request.sid} ({user_name}) desconectado.")
    if request.sid in admin_sids:
        admin_sids.remove(request.sid)
        print(f"Admin {request.sid} desconectado.")
    leave_room(CHAT_ROOM)

@socketio.on('register_user_name')
def register_user_name(data):
    user_name = data.get('userName')
    is_admin = data.get('isAdmin', False)
    
    if user_name:
        users_in_chat[request.sid] = user_name
        print(f"Usuario {user_name} (SID: {request.sid}) registrado.")
        if is_admin:
            admin_sids.add(request.sid)
            print(f"Usuario {user_name} (SID: {request.sid}) es ahora administrador.")

@socketio.on('message')
def handle_message(msg):
    sender_sid = request.sid
    sender_name = users_in_chat.get(sender_sid, 'Desconocido')

    print(f'Mensaje recibido de {sender_name} ({sender_sid}): {msg}')
    emit('message', {'senderName': sender_name, 'message': msg}, room=CHAT_ROOM, include_self=False)

@socketio.on('change_song')
def handle_change_song(data):
    # Solo permitir a los administradores cambiar la canción
    if request.sid in admin_sids:
        new_song_url = data.get('url')
        if new_song_url:
            global current_song_url # Necesario para modificar la variable global
            current_song_url = new_song_url
            print(f"Canción cambiada a: {current_song_url} por admin {users_in_chat.get(request.sid)}")
            # Emitir a todos los clientes en la sala (incluido el admin)
            emit('current_song_update', {'url': current_song_url}, room=CHAT_ROOM)
    else:
        print(f"Intento de cambiar canción denegado para {users_in_chat.get(request.sid)}.")
        emit('system_message', "No tienes permiso para cambiar la canción.", room=request.sid)

# Funciones Troll de Administrador (Ejemplo)
@socketio.on('admin_troll_message')
def handle_admin_troll_message(data):
    if request.sid in admin_sids:
        troll_msg = data.get('message', '¡Ha llegado el Administrador! 😈')
        emit('system_message', f"¡Atención, mortales! El administrador dice: {troll_msg}", room=CHAT_ROOM)
    else:
        emit('system_message', "¡Solo el ADMINISTRADOR puede usar este poder!", room=request.sid)


if __name__ == '__main__':
    socketio.run(app, debug=True)


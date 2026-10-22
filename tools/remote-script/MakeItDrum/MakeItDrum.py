"""Surface de contrôle minimale : Live appelle update_display() environ dix fois par
seconde ; on y relève une socket UDP non bloquante (127.0.0.1:47801) et on charge le
preset demandé via le navigateur de Live (browser.user_library → browser.load_item)."""
from __future__ import absolute_import, print_function, unicode_literals
import socket
import time

from .core import parse_message, target_components, find_item

NOTIFY_PORT = 47801
RETRY_SECONDS = 20.0
RETRY_EVERY = 0.5


class MakeItDrum(object):
    def __init__(self, c_instance):
        self.c_instance = c_instance
        self.pending = None  # (nom, échéance, prochain essai)
        self.sock = None
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.bind(('127.0.0.1', NOTIFY_PORT))
            self.sock.setblocking(False)
            self.log('à l\'écoute en UDP sur 127.0.0.1:%d' % NOTIFY_PORT)
        except OSError as err:
            self.sock = None
            self.log('socket UDP impossible : %s' % err)

    # --- journal / messages
    def log(self, message):
        self.c_instance.log_message('[MakeItDrum] %s' % message)

    def show(self, message):
        try:
            self.c_instance.show_message('make it drum : %s' % message)
        except Exception:
            pass

    # --- protocole Live
    def disconnect(self):
        if self.sock is not None:
            self.sock.close()
            self.sock = None

    def connect_script_instances(self, instances):
        pass

    def build_midi_map(self, midi_map_handle):
        pass

    def receive_midi(self, midi_bytes):
        pass

    def can_lock_to_devices(self):
        return False

    def suggest_input_port(self):
        return ''

    def suggest_output_port(self):
        return ''

    def refresh_state(self):
        pass

    def update_display(self):
        self._poll()
        self._retry()

    # --- réception et chargement
    def _poll(self):
        if self.sock is None:
            return
        while True:
            try:
                data, _ = self.sock.recvfrom(65535)
            except (BlockingIOError, OSError):
                return
            msg = parse_message(data)
            if msg is None:
                self.log('message ignoré : %r' % data[:80])
                continue
            name, _path = msg
            self.log('demande de chargement : %s' % name)
            self.show('chargement de « %s »…' % name)
            self.pending = (name, time.time() + RETRY_SECONDS, 0.0)

    def _retry(self):
        if self.pending is None:
            return
        name, deadline, next_try = self.pending
        now = time.time()
        if now < next_try:
            return
        if self._load(name):
            self.pending = None
            return
        if now > deadline:
            self.pending = None
            self.show('« %s » introuvable dans la User Library — glisse-le depuis le navigateur.' % name)
            self.log('abandon : %s' % name)
            return
        self.pending = (name, deadline, now + RETRY_EVERY)

    def _load(self, name):
        try:
            app = self.c_instance.application() if hasattr(self.c_instance, 'application') else None
            if app is None:
                import Live
                app = Live.Application.get_application()
            browser = app.browser
            item = find_item(browser.user_library, target_components(name))
            if item is None:
                return False
            browser.load_item(item)
            self.show('« %s » chargé sur la piste sélectionnée.' % name)
            self.log('chargé : %s' % name)
            return True
        except Exception as err:
            self.log('échec du chargement : %s' % err)
            return False

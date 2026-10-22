"""Remote Script MakeItDrum pour Ableton Live 11/12 : charge sur la piste sélectionnée
le Drum Rack que le compagnon makeitdrum-bridge vient d'écrire dans la User Library."""
from .MakeItDrum import MakeItDrum


def create_instance(c_instance):
    return MakeItDrum(c_instance)

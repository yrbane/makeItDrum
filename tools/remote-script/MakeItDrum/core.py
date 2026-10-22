"""Parties pures du Remote Script MakeItDrum : testables sans Live."""
import json

KIT_FOLDERS = ['Presets', 'Instruments', 'Drum Rack', 'make it drum']


def parse_message(data):
    """Octets UDP → (nom du kit, chemin du .adg) ou None."""
    try:
        msg = json.loads(data.decode('utf-8'))
    except (ValueError, UnicodeDecodeError, AttributeError):
        return None
    if not isinstance(msg, dict) or not isinstance(msg.get('load'), str):
        return None
    return (msg['load'], msg.get('path'))


def target_components(name):
    """Chemin dans la User Library : dossier du kit puis le preset lui-même."""
    return KIT_FOLDERS + [name, name]


def find_item(root, components):
    """Descend l'arbre du navigateur (attributs name / children / is_loadable) ; renvoie l'élément
    chargeable ou None. Les dossiers intermédiaires sont trouvés par nom."""
    node = root
    for comp in components:
        children = list(getattr(node, 'children', []) or [])
        node = next((c for c in children if getattr(c, 'name', None) == comp), None)
        if node is None:
            return None
    return node if getattr(node, 'is_loadable', False) else None

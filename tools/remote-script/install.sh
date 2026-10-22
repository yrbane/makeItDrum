#!/usr/bin/env bash
# Installe le Remote Script MakeItDrum dans la User Library de Live (natif ou Wine).
#   ./install.sh                      # détection automatique
#   ./install.sh "<User Library>"     # chemin explicite
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
UL="${1:-}"
if [ -z "$UL" ]; then
  for c in "$HOME/Music/Ableton/User Library" "$HOME/Documents/Ableton/User Library" "$HOME"/.wine*/drive_c/users/*/Documents/Ableton/User\ Library; do
    [ -d "$c" ] && UL="$c" && break
  done
fi
[ -d "$UL" ] || { echo "User Library introuvable : ./install.sh \"<chemin de la User Library>\""; exit 2; }
DEST="$UL/Remote Scripts/MakeItDrum"
mkdir -p "$DEST"
cp "$HERE/MakeItDrum/"*.py "$DEST/"
rm -rf "$DEST/__pycache__"
echo "✓ Remote Script installé : $DEST"
echo "Dans Live : Préférences › Link, Tempo & MIDI › Surface de contrôle → « MakeItDrum » (entrée/sortie : aucune), puis relancer Live."

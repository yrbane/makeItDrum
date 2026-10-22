import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from MakeItDrum.core import parse_message, target_components, find_item  # noqa: E402


class Item:
    def __init__(self, name, children=(), loadable=False):
        self.name = name
        self.children = list(children)
        self.is_loadable = loadable
        self.is_folder = not loadable


class ParseMessageTest(unittest.TestCase):
    def test_valid_message(self):
        self.assertEqual(parse_message(json.dumps({'load': 'Mon kit', 'path': '/x/Mon kit.adg'}).encode()), ('Mon kit', '/x/Mon kit.adg'))

    def test_invalid_messages(self):
        self.assertIsNone(parse_message(b'not json'))
        self.assertIsNone(parse_message(b'{"path": "/x"}'))
        self.assertIsNone(parse_message(b'{"load": 3}'))


class TargetComponentsTest(unittest.TestCase):
    def test_components(self):
        self.assertEqual(target_components('Mon kit'), ['Presets', 'Instruments', 'Drum Rack', 'make it drum', 'Mon kit', 'Mon kit'])


class FindItemTest(unittest.TestCase):
    def setUp(self):
        self.adg = Item('Mon kit', loadable=True)
        self.root = Item('User Library', [
            Item('Samples', [Item('x', loadable=True)]),
            Item('Presets', [Item('Instruments', [Item('Drum Rack', [Item('make it drum', [Item('Mon kit', [self.adg, Item('Mon kit.sfz', loadable=True)])])])])]),
        ])

    def test_found(self):
        self.assertIs(find_item(self.root, target_components('Mon kit')), self.adg)

    def test_missing(self):
        self.assertIsNone(find_item(self.root, target_components('Autre')))

    def test_folder_not_loadable_is_rejected(self):
        self.assertIsNone(find_item(self.root, ['Presets']))


if __name__ == '__main__':
    unittest.main()

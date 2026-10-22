// Export SFZ : un <region> one-shot par pad, déclenché par sa note MIDI.
// Format texte universel (sforzando, Decent Sampler, Sitala, Bitwig, Renoise…).

function pad2(n) { return String(n + 1).padStart(2, '0'); }

export function buildSfz({ name, pads }) {
  const lines = [
    '// ' + name + ' — make it drum (Masao « Saiya Geez »)',
    '// https://github.com/yrbane/makeItDrum',
    '',
    '<control>',
    'default_path=',
    '',
    '<global>',
    'loop_mode=one_shot',
    'ampeg_release=0.3',
    '',
  ];
  pads.forEach(function (p) {
    if (!p.file) return;
    lines.push('<region>');
    lines.push('region_label=' + pad2(p.index) + ' ' + p.flavor);
    lines.push('sample=' + p.file);
    lines.push('key=' + p.note);
    lines.push('loop_mode=one_shot');
    lines.push('');
  });
  return lines.join('\n');
}

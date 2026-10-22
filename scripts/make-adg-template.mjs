// Fabrique src/core/daw/adg-template.js à partir d'un Drum Rack de référence
// écrit par Live (un .adg = XML gzippé). On garde la structure complète que
// Live attend, on vide ce qui est propre au kit d'origine, et on pose des
// marqueurs @@…@@ dans une branche Simpler que l'export clone pour chaque pad.
//   node scripts/make-adg-template.mjs "<chemin>/Chromatone Kit.adg"
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';

const src = process.argv[2];
if (!src) { console.error('usage : node scripts/make-adg-template.mjs <reference.adg>'); process.exit(2); }

const xml = gunzipSync(readFileSync(src)).toString('utf8');
const minified = xml.replace(/>\s+</g, '><').trim();

// --- wrapper : tout le document, BranchPresets vidé
const bpStart = minified.indexOf('<BranchPresets>');
const bpEnd = minified.indexOf('</BranchPresets>') + '</BranchPresets>'.length;
if (bpStart < 0 || bpEnd < 0) throw new Error('BranchPresets introuvable');
const branchesXml = minified.slice(bpStart + '<BranchPresets>'.length, bpEnd - '</BranchPresets>'.length);
let wrapper = minified.slice(0, bpStart) + '<BranchPresets>@@BRANCHES@@</BranchPresets>' + minified.slice(bpEnd);

// neutraliser ce qui pointe vers le preset d'origine
wrapper = wrapper
  .replace(/<MacroDisplayNames\.(\d+) Value="[^"]*"/g, (m, i) => `<MacroDisplayNames.${i} Value="Macro ${Number(i) + 1}"`)
  .replace(/<MacroDefaults\.(\d+) Value="[^"]*"/g, (m, i) => `<MacroDefaults.${i} Value="0"`)
  .replace(/(<MacroControls\.\d+><LomId Value="0" \/><Manual Value=")[^"]*"/g, '$10"')
  .replace(/<LockId Value="[^"]*"/, '<LockId Value="0"').replace(/<LockSeal Value="[^"]*"/, '<LockSeal Value="0"')
  .replace(/<MacroAnnotations\.(\d+) Value="[^"]*"/g, (m, i) => `<MacroAnnotations.${i} Value=""`)
  .replace(/<BrowserContentPath Value="[^"]*"/g, '<BrowserContentPath Value=""')
  .replace(/<RelativePath Value="[^"]*"/g, '<RelativePath Value=""')
  .replace(/<Path Value="[^"]*"/g, '<Path Value=""')
  .replace(/<LivePackName Value="[^"]*"/g, '<LivePackName Value=""')
  .replace(/<LivePackId Value="[^"]*"/g, '<LivePackId Value=""')
  .replace(/<Annotation Value="[^"]*"/g, '<Annotation Value=""')
  .replace(/<UserName Value="[^"]*"/g, '<UserName Value="@@RACKNAME@@"');

// --- branche : la première DrumBranchPreset, avec marqueurs
const first = branchesXml.match(/<DrumBranchPreset Id="\d+">[\s\S]*?<\/DrumBranchPreset>/);
if (!first) throw new Error('DrumBranchPreset introuvable');
let branch = first[0]
  .replace(/^<DrumBranchPreset Id="\d+">/, '<DrumBranchPreset Id="@@INDEX@@">')
  .replace(/<Name Value="[^"]*"/g, '<Name Value="@@NAME@@"')
  .replace(/<UserName Value="[^"]*"/g, '<UserName Value=""')
  .replace(/<SampleEnd Value="\d+"/g, '<SampleEnd Value="@@END@@"')
  .replace(/<End Value="\d+"/g, '<End Value="@@END@@"')
  .replace(/<DefaultDuration Value="\d+"/g, '<DefaultDuration Value="@@FRAMES@@"')
  .replace(/<DefaultSampleRate Value="\d+"/g, '<DefaultSampleRate Value="@@RATE@@"')
  .replace(/<LastModDate Value="\d+"/g, '<LastModDate Value="@@MODDATE@@"')
  .replace(/<BrowserContentPath Value="[^"]*"/g, '<BrowserContentPath Value=""')
  .replace(/<RoundRobinRandomSeed Value="\d+"/g, '<RoundRobinRandomSeed Value="@@SEED@@"')
  .replace(/<ReceivingNote Value="\d+"/g, '<ReceivingNote Value="@@NOTE@@"')
  .replace(/<SendingNote Value="\d+"/g, '<SendingNote Value="60"')
  .replace(/<ChokeGroup Value="\d+"/g, '<ChokeGroup Value="0"');

// FileRef : ceux qui pointaient vers l'échantillon reçoivent les marqueurs,
// les autres (références de presets) sont vidés.
branch = branch.replace(/<FileRef( Id="\d+")?>[\s\S]*?<\/FileRef>/g, function (block) {
  const isSample = /<RelativePath Value="[^"]*\.wav"/.test(block);
  return block
    .replace(/<RelativePathType Value="\d+"/, isSample ? '<RelativePathType Value="1"' : '$&')
    .replace(/<RelativePath Value="[^"]*"/, isSample ? '<RelativePath Value="@@FILE@@"' : '<RelativePath Value=""')
    .replace(/<Path Value="[^"]*"/, isSample ? '<Path Value="@@FILE@@"' : '<Path Value=""')
    .replace(/<LivePackName Value="[^"]*"/, '<LivePackName Value=""')
    .replace(/<LivePackId Value="[^"]*"/, '<LivePackId Value=""')
    .replace(/<OriginalFileSize Value="\d+"/, isSample ? '<OriginalFileSize Value="@@BYTES@@"' : '<OriginalFileSize Value="0"')
    .replace(/<OriginalCrc Value="\d+"/, '<OriginalCrc Value="0"');
});

const header = (xml.match(/<Ableton [^>]+>/) || [''])[0];
const out = `// Généré par scripts/make-adg-template.mjs — ne pas éditer à la main.
// Gabarit de Drum Rack Ableton (Live 12, chaînes Simpler), XML minifié, gzippé, base64.
// Source : un preset de la Core Library de Live, vidé de ses échantillons et macros.
// En-tête d'origine : ${header.replace(/\s+/g, ' ')}
export const ADG_WRAPPER_GZ = '${gzipSync(Buffer.from(wrapper, 'utf8'), { level: 9 }).toString('base64')}';
export const ADG_BRANCH_GZ = '${gzipSync(Buffer.from(branch, 'utf8'), { level: 9 }).toString('base64')}';
`;
writeFileSync(new URL('../src/core/daw/adg-template.js', import.meta.url), out);
const marks = (branch.match(/@@[A-Z]+@@/g) || []).reduce((acc, m) => (acc[m] = (acc[m] || 0) + 1, acc), {});
console.log(`wrapper ${wrapper.length} o, branche ${branch.length} o, module ${out.length} o ; marqueurs branche :`, JSON.stringify(marks));

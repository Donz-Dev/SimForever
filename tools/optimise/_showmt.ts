import { PRESETS_BY_ID } from '../../src/profiles/presets';
const id = process.env.P ?? 'mage_arcane';
const p = PRESETS_BY_ID.get(id)!.build();
console.log('ST', p.rotation.name, p.rotation.source);
for (const e of p.rotation.entries) console.log('  ', e.disabled ? '(off)' : '', e.abilityId, e.sequence ?? '', JSON.stringify(e.condition ?? ''));
console.log('MT', p.multiTarget?.rotation.name, JSON.stringify(p.multiTarget?.precombat));
for (const e of p.multiTarget?.rotation.entries ?? []) console.log('  ', e.disabled ? '(off)' : '', e.abilityId, e.sequence ?? '', JSON.stringify(e.condition ?? ''));
console.log(JSON.stringify(p.consumables));

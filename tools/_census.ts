import { RACE_IDS } from '../src/game/character';
import { RACIALS } from '../src/game/racials';
import { ALL_PRIORITY_LISTS } from '../src/game/rotations/allLists';
let modelled=0, ruled=0, live=0;
for (const race of RACE_IDS) for (const t of RACIALS[race].traits) {
  if (t.effects.some(e=>e.kind!=='unmodelled')) modelled++;
  for (const e of t.effects) if (e.kind==='unmodelled') { if (e.scope) ruled++; else live++; }
}
console.log({modelled, ruled, live});
console.log('stoneform lists:', ALL_PRIORITY_LISTS.filter(r=>r.list.entries.some(e=>e.abilityId==='stoneform')).map(r=>r.list.name));

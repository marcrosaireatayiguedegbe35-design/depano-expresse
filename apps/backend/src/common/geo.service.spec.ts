import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toArea } from './geo.service';

test('Cotonou : département, commune, arrondissement et quartier', () => {
  assert.deepEqual(toArea({ quarter: 'Missèbo', suburb: 'Placodji', city_district: '5ème Arrondissement', city: 'Cotonou', state: 'Littoral' }),
    { departement: 'Littoral', commune: 'Cotonou', arrondissement: '5ème Arrondissement', quartier: 'Missèbo' });
});

test('Abomey-Calavi sans arrondissement connu : quartier gardé', () => {
  assert.deepEqual(toArea({ suburb: 'Zoca', city: 'Abomey-Calavi', county: 'Abomey-Calavi', state: 'Atlantique' }),
    { departement: 'Atlantique', commune: 'Abomey-Calavi', arrondissement: undefined, quartier: 'Zoca' });
});

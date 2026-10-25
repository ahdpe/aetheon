import assert from 'node:assert/strict';

/**
 * Safe state comparison for large simulation snapshots.
 * Compares scalar properties, structured objects, organisms list, and typed chemical fields
 * without letting node:assert's default Myers diff formatter allocate gigabytes of RAM on mismatch.
 */
export function assertStateEqual(actual, expected) {
  assert.equal(actual.rng, expected.rng, 'RNG state must match exactly');
  if (actual.terrain !== undefined || expected.terrain !== undefined) {
    assert.deepEqual(actual.terrain, expected.terrain, 'Terrain state must match');
  }
  if (actual.flora !== undefined || expected.flora !== undefined) {
    assert.deepEqual(actual.flora, expected.flora, 'Flora state must match');
  }
  if (actual.plants !== undefined || expected.plants !== undefined) {
    assert.deepEqual(actual.plants, expected.plants, 'Plants state must match');
  }
  if (actual.bodies !== undefined || expected.bodies !== undefined) {
    assert.deepEqual(actual.bodies, expected.bodies, 'Remains bodies must match');
  }
  if (actual.epoch !== undefined || expected.epoch !== undefined) {
    assert.deepEqual(actual.epoch, expected.epoch, 'Ecology epoch must match');
  }
  if (actual.history !== undefined || expected.history !== undefined) {
    assert.deepEqual(actual.history, expected.history, 'Family history must match');
  }

  // Compare organisms list element by element
  const actualOrgs = actual.organisms || actual.orgs || [];
  const expectedOrgs = expected.organisms || expected.orgs || [];
  assert.equal(actualOrgs.length, expectedOrgs.length, 'Organism count mismatch');
  for (let i = 0; i < actualOrgs.length; i++) {
    assert.deepEqual(actualOrgs[i], expectedOrgs[i], `Organism #${i} mismatch`);
  }

  // Compare chemical fields element by element safely
  if (actual.fields && expected.fields) {
    const fieldNames = ['nutrients', 'waste', 'signal', 'substrate'];
    assert.equal(actual.fields.length, expected.fields.length, 'Fields array count mismatch');
    for (let f = 0; f < actual.fields.length; f++) {
      const aF = actual.fields[f];
      const eF = expected.fields[f];
      assert.equal(aF.length, eF.length, `Field ${fieldNames[f] || f} length mismatch`);
      for (let i = 0; i < aF.length; i++) {
        if (aF[i] !== eF[i]) {
          assert.fail(`Field ${fieldNames[f] || f} mismatch at cell index ${i}: actual=${aF[i]}, expected=${eF[i]}`);
        }
      }
    }
  }
}

import { SimulationEngine } from './server/core/engine.js';
import { Organism } from './server/core/organism.js';

async function testPhase6() {
  console.log('🧪 Testing Phase 6 Features: Ontogenesis, Detritus, Dynasties, and Optical LOD...');

  const engine = new SimulationEngine();
  console.log(`✅ Engine initialized with ${engine.organisms.length} organisms.`);

  // 1. Test Ontogenesis
  console.log('\n--- 1. Testing Cell Ontogenesis & Somatic Growth ---');
  const adultParent = engine.organisms[0];
  adultParent.energy = 200.0;
  adultParent.age = 100;
  adultParent.maturity = 1.0;
  
  const child = adultParent.reproduce(adultParent.speciesId);
  console.log(`Child created: adultSize=${child.adultSize.toFixed(2)}, maturity=${child.maturity.toFixed(2)}, initial size=${child.size.toFixed(2)}`);
  
  const expectedChildSize = child.adultSize * 0.38;
  if (Math.abs(child.size - expectedChildSize) > 0.05) {
    throw new Error(`Child initial size should be 38% of adult size (${expectedChildSize}), got ${child.size}`);
  }
  console.log('✅ Newborn juvenile correctly starts at 38% adult size.');

  if (child.canReproduce()) {
    throw new Error('Juvenile should NOT be able to reproduce while immature (maturity < 0.85)!');
  }
  console.log('✅ Juvenile mitosis correctly blocked while maturity < 0.85.');

  // Step child growth
  child.energy = 80.0;
  const initialMaturity = child.maturity;
  for (let i = 0; i < 50; i++) {
    child.step(engine.grid, [], engine.nutrientBlooms, 600, 1.0);
  }
  console.log(`After 50 feeding ticks: maturity=${child.maturity.toFixed(3)}, size=${child.size.toFixed(2)}`);
  if (child.maturity <= initialMaturity) {
    throw new Error('Child should have grown in maturity over feeding ticks!');
  }
  console.log('✅ Somatic growth verified.');

  const profile = child.getDetailedProfile(engine.lineage.getSpecies(child.speciesId));
  console.log(`Profile check: maturity=${profile.maturity}%, adultSize=${profile.adultSize}, size=${profile.size}`);
  if (profile.maturity === undefined || profile.adultSize === undefined) {
    throw new Error('Profile must include maturity and adultSize!');
  }
  console.log('✅ Ontogenesis detailed profile verified.');

  // 2. Test Residual Detritus & Bone Reefs
  console.log('\n--- 2. Testing Detritus & Bone Reefs ---');
  const initialBlooms = engine.nutrientBlooms.length;
  const initialSubstrateVal = engine.grid.getSubstrate(Math.floor(adultParent.x / 1400 * 128), Math.floor(adultParent.y / 1400 * 128));

  engine.handleOrganismDeath(adultParent, false, true);
  console.log(`Organism death handled. Blooms: ${initialBlooms} -> ${engine.nutrientBlooms.length}`);

  const detritusBloom = engine.nutrientBlooms.find(b => b.isDetritus);
  if (!detritusBloom) {
    throw new Error('A detritus bloom should have been created on organism death!');
  }
  console.log(`✅ Detritus bloom spawned: energy=${detritusBloom.energy.toFixed(1)}, radius=${detritusBloom.radius.toFixed(1)}, isDetritus=${detritusBloom.isDetritus}`);

  const packet = engine.getBroadcastPacket();
  const packetBloom = packet.blooms.find(b => b.id === detritusBloom.id);
  if (!packetBloom || packetBloom.d !== 1) {
    throw new Error('Broadcast packet blooms must include d: 1 for detritus blooms!');
  }
  console.log('✅ Broadcast packet correctly encodes detritus bloom flag (d: 1).');

  // 3. Test Founder Dynasties
  console.log('\n--- 3. Testing Founder Dynasties ---');
  const targetSpeciesId = adultParent.speciesId;
  const founderName = 'Улана Архитектор';

  const updatedSpecies = engine.nameSpeciesFounder(targetSpeciesId, founderName);
  if (!updatedSpecies || updatedSpecies.founderName !== founderName) {
    throw new Error(`Failed to set founderName: ${updatedSpecies?.founderName}`);
  }
  console.log(`✅ Species #${targetSpeciesId} founder set to: «${updatedSpecies.founderName}»`);

  const journalEntry = engine.naturalist.journalEntries[0];
  console.log(`Latest journal entry: [${journalEntry.badgeRu}] "${journalEntry.titleRu}"`);
  if (!journalEntry.titleRu.includes(founderName)) {
    throw new Error(`Journal chronicle should record the founder's name! Got: ${journalEntry.titleRu}`);
  }
  console.log('✅ Founder dynasty chronicle recorded in Naturalist Journal.');

  console.log('\n🎉 ALL PHASE 6 CORE LOGIC TESTS PASSED SUCCESSFULLY!');
}

testPhase6().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { developBody } from '../public/js/shared/anatomy.js';

const SNAPSHOT_PATH = '/var/lib/aetheon/data/aetheon_world.json';

const checksum = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');

function main() {
  console.log('Loading snapshot from', SNAPSHOT_PATH);
  const raw = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
  const data = JSON.parse(raw);

  const sp119 = data.speciesList.find(s => s.id === 119);
  if (!sp119) {
    console.error('Species 119 not found!');
    process.exit(1);
  }

  console.log('Found species 119:', sp119.nameRu, 'extinctTime was:', sp119.extinctTime);
  sp119.extinctTime = null;
  sp119.population = 8;
  sp119.totalCount = (sp119.totalCount || 0) + 8;

  const CX = data.worldGeometry?.cx || 1024;
  const CY = data.worldGeometry?.cy || 1024;

  const newOrgs = [];
  for (let i = 0; i < 8; i++) {
    const orgId = data.nextOrganismId++;
    const angle = (i / 8) * Math.PI * 2 + 0.3;
    const dist = 140 + (i % 3) * 60;
    const x = CX + Math.cos(angle) * dist;
    const y = CY + Math.sin(angle) * dist;

    const genome = {
      size: 7.2,
      hue: 0.95,
      speedMax: 3.8,
      carnivory: 0.75,
      chemotaxisNutrient: 0.35,
      chemotaxisWaste: -0.6,
      ciliaryFrequency: 0.35,
      phaseCoupling: 0.4,
      splitThreshold: 140.0,
      metabolismEfficiency: 1.4,
      mutationRate: 0.05,
      adhesion: 0.25,
      elongation: 0.62,
      shell: 0.23,
      flagella: 0.63,
      sensing: 0.41
    };

    const body = developBody(genome);

    const org = {
      id: orgId,
      x,
      y,
      vx: Math.cos(angle + Math.PI * 0.5) * 1.5,
      vy: Math.sin(angle + Math.PI * 0.5) * 1.5,
      energy: 160.0,
      age: 0,
      generation: 1,
      parentId: null,
      speciesId: 119,
      birthTime: Date.now(),
      kills: 0,
      childrenCount: 0,
      phase: i * 1.0,
      heading: angle + Math.PI * 0.5,
      isLazarus: false,
      fatalDamage: false,
      genome,
      body,
      adultSize: 7.2,
      maturity: 1.0,
      size: 7.2,
      hue: 0.95,
      carnivory: 0.75,
      maxSpeed: 3.8,
      isAvatarLineage: false,
      pilotedTicks: 0,
      panicTicks: 0,
      dynastyName: null,
      dynastyGen: 0,
      founderId: null,
      familyId: null
    };

    newOrgs.push(org);
  }

  // Trim lowest energy non-vital organisms if total exceeds 280
  const combined = [...data.organisms, ...newOrgs];
  if (combined.length > 280) {
    // Sort by energy ascending, remove lowest energy non-119 organisms
    let excess = combined.length - 280;
    for (let j = 0; j < combined.length && excess > 0; j++) {
      if (combined[j].speciesId !== 119 && combined[j].energy < 60) {
        combined.splice(j, 1);
        j--;
        excess--;
      }
    }
    // If still excess, just splice from start of non-119
    while (combined.length > 280) {
      const idx = combined.findIndex(o => o.speciesId !== 119);
      if (idx !== -1) combined.splice(idx, 1);
      else break;
    }
  }

  data.organisms = combined;
  console.log(`Updated snapshot: ${data.organisms.length} organisms, ${newOrgs.length} Ruby Whirl specimens added.`);

  // Recompute checksum
  delete data.checksum;
  data.checksum = checksum(data);

  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log('Successfully saved snapshot with renewed checksum!');
}

main();

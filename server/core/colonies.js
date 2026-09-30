import { CONFIG } from '../config.js';

let nextColonyId = 1;

export class ColonyManager {
  constructor() {
    // colonyId -> { id, memberIds: Set<orgId>, bonds: [{a, b, restLength}], createdAt }
    this.colonies = new Map();
    // orgId -> colonyId (fast lookup)
    this.orgToColony = new Map();
  }

  /**
   * Form a spring bond between parent and child organisms.
   * Called when child is born from a parent with adhesion > 0.6.
   */
  formBond(parentOrg, childOrg) {
    const restLength = (parentOrg.size + childOrg.size) * 1.6;
    const bond = { a: parentOrg.id, b: childOrg.id, restLength };

    const parentColonyId = this.orgToColony.get(parentOrg.id);

    if (parentColonyId !== undefined) {
      // Parent already in a colony — add child to it
      const colony = this.colonies.get(parentColonyId);
      if (colony) {
        colony.memberIds.add(childOrg.id);
        colony.bonds.push(bond);
        this.orgToColony.set(childOrg.id, parentColonyId);
        return;
      }
    }

    // Create a new colony with both organisms
    const id = nextColonyId++;
    const colony = {
      id,
      memberIds: new Set([parentOrg.id, childOrg.id]),
      bonds: [bond],
      createdAt: Date.now()
    };
    this.colonies.set(id, colony);
    this.orgToColony.set(parentOrg.id, id);
    this.orgToColony.set(childOrg.id, id);
  }

  /**
   * Apply Hookean spring forces + alignment torque on all bonded pairs.
   * Must be O(total bonds) — very lightweight at 10 Hz.
   */
  applyBondPhysics(organismsById) {
    for (const colony of this.colonies.values()) {
      for (let b = 0; b < colony.bonds.length; b++) {
        const bond = colony.bonds[b];
        const orgA = organismsById.get(bond.a);
        const orgB = organismsById.get(bond.b);
        if (!orgA || !orgB) continue;

        const dx = orgB.x - orgA.x;
        const dy = orgB.y - orgA.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const displacement = dist - bond.restLength;

        // Hookean spring: F = k * displacement
        const k = 0.15;
        const force = k * displacement;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        // Apply equal and opposite forces
        orgA.vx += fx * 0.5;
        orgA.vy += fy * 0.5;
        orgB.vx -= fx * 0.5;
        orgB.vy -= fy * 0.5;

        // Mild heading alignment torque (colony members swim together)
        const headingDiff = orgB.heading - orgA.heading;
        const wrappedDiff = Math.atan2(Math.sin(headingDiff), Math.cos(headingDiff));
        const alignForce = wrappedDiff * 0.03;
        orgA.heading += alignForce;
        orgB.heading -= alignForce;
      }

      // Collective metabolism: redistribute 10% of surplus energy to weakest member
      if (colony.memberIds.size >= 2) {
        let minEnergy = Infinity;
        let minOrg = null;
        let totalSurplus = 0;
        let surplusDonors = 0;

        for (const memberId of colony.memberIds) {
          const org = organismsById.get(memberId);
          if (!org) continue;
          if (org.energy < minEnergy) {
            minEnergy = org.energy;
            minOrg = org;
          }
          if (org.energy > 60) {
            totalSurplus += (org.energy - 60) * 0.005; // 0.5% of surplus per tick
            surplusDonors++;
          }
        }

        if (minOrg && totalSurplus > 0.1 && surplusDonors > 0) {
          // Transfer pooled surplus to weakest member
          const transfer = Math.min(totalSurplus, 2.0); // cap transfer per tick
          minOrg.energy = Math.min(CONFIG.MAX_ORGANISM_ENERGY, minOrg.energy + transfer);

          // Deduct proportionally from donors
          const perDonor = transfer / surplusDonors;
          for (const memberId of colony.memberIds) {
            const org = organismsById.get(memberId);
            if (org && org !== minOrg && org.energy > 60) {
              org.energy -= perDonor;
            }
          }
        }
      }
    }
  }

  /**
   * Remove an organism from its colony when it dies.
   */
  removeOrganism(orgId) {
    const colonyId = this.orgToColony.get(orgId);
    if (colonyId === undefined) return;

    const colony = this.colonies.get(colonyId);
    if (!colony) {
      this.orgToColony.delete(orgId);
      return;
    }

    // Remove all bonds involving this organism
    colony.bonds = colony.bonds.filter(b => b.a !== orgId && b.b !== orgId);
    colony.memberIds.delete(orgId);
    this.orgToColony.delete(orgId);

    // Dissolve colony if fewer than 2 members remain
    if (colony.memberIds.size < 2) {
      for (const remainingId of colony.memberIds) {
        this.orgToColony.delete(remainingId);
      }
      this.colonies.delete(colonyId);
    }
  }

  /**
   * Get colony for a specific organism.
   */
  getColonyForOrganism(orgId) {
    const colonyId = this.orgToColony.get(orgId);
    if (colonyId === undefined) return null;
    return this.colonies.get(colonyId) || null;
  }

  /**
   * Serializable colony data for broadcast packet.
   * Returns flat bond array for minimal WebSocket payload.
   */
  getBondPairs() {
    const pairs = [];
    for (const colony of this.colonies.values()) {
      for (const bond of colony.bonds) {
        pairs.push({ a: bond.a, b: bond.b });
      }
    }
    return pairs;
  }

  /**
   * Full serializable data for persistence.
   */
  getSerializableData() {
    const data = [];
    for (const colony of this.colonies.values()) {
      data.push({
        id: colony.id,
        memberIds: Array.from(colony.memberIds),
        bonds: colony.bonds.map(b => ({ a: b.a, b: b.b, restLength: b.restLength })),
        createdAt: colony.createdAt
      });
    }
    return data;
  }

  /**
   * Restore colonies from persistence data.
   * Must be called AFTER organisms are restored so IDs match.
   */
  restoreFromData(colonyDataArray, organismsById) {
    this.colonies.clear();
    this.orgToColony.clear();

    if (!colonyDataArray || !Array.isArray(colonyDataArray)) return;

    for (const cd of colonyDataArray) {
      // Validate that member organisms still exist
      const validMembers = new Set();
      for (const memberId of cd.memberIds) {
        if (organismsById.has(memberId)) {
          validMembers.add(memberId);
        }
      }

      // Filter bonds to only those where both organisms exist
      const validBonds = cd.bonds.filter(b => organismsById.has(b.a) && organismsById.has(b.b));

      if (validMembers.size >= 2 && validBonds.length > 0) {
        const colony = {
          id: cd.id,
          memberIds: validMembers,
          bonds: validBonds,
          createdAt: cd.createdAt || Date.now()
        };

        this.colonies.set(colony.id, colony);
        for (const memberId of validMembers) {
          this.orgToColony.set(memberId, colony.id);
        }

        if (cd.id >= nextColonyId) {
          nextColonyId = cd.id + 1;
        }
      }
    }
  }

  /**
   * Stats for telemetry / AI observations.
   */
  getStats() {
    let colonyCount = 0;
    let largestSize = 0;
    let totalBonded = 0;

    for (const colony of this.colonies.values()) {
      colonyCount++;
      totalBonded += colony.memberIds.size;
      if (colony.memberIds.size > largestSize) {
        largestSize = colony.memberIds.size;
      }
    }

    return {
      colonyCount,
      largestColonySize: largestSize,
      totalBondedOrganisms: totalBonded
    };
  }
}

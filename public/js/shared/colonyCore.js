
export function createColonyClass(CONFIG) {
let nextColonyId = 1;

class ColonyManager {
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
    const parentColonyId = this.orgToColony.get(parentOrg.id);

    if (parentColonyId !== undefined) {
      // Parent already in a colony — add child to it
      const colony = this.colonies.get(parentColonyId);
      if (colony) {
        // Enforce max colony size (micro-colonies capped at 6 cells)
        if (colony.memberIds.size >= 6) return;

        // Enforce max bonds per cell (max 2 bonds to keep morphology filamentous or small cluster)
        let parentBondCount = 0;
        for (let b = 0; b < colony.bonds.length; b++) {
          if (colony.bonds[b].a === parentOrg.id || colony.bonds[b].b === parentOrg.id) {
            parentBondCount++;
          }
        }
        if (parentBondCount >= 2) return;

        const restLength = (parentOrg.size + childOrg.size) * 1.8;
        const bond = { a: parentOrg.id, b: childOrg.id, restLength };
        colony.memberIds.add(childOrg.id);
        colony.bonds.push(bond);
        this.orgToColony.set(childOrg.id, parentColonyId);
        return;
      }
    }

    // Create a new colony with both organisms
    const restLength = (parentOrg.size + childOrg.size) * 1.8;
    const bond = { a: parentOrg.id, b: childOrg.id, restLength };
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
    for (const [colonyId, colony] of [...this.colonies.entries()]) {
      for (let b = 0; b < colony.bonds.length; b++) {
        const bond = colony.bonds[b];
        const orgA = organismsById.get(bond.a);
        const orgB = organismsById.get(bond.b);
        if (!orgA || !orgB) continue;

        const dx = orgB.x - orgA.x;
        const dy = orgB.y - orgA.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;

        // Tension snap: if bond stretched beyond 2.6x rest length, it breaks
        if (dist > bond.restLength * 2.6) {
          colony.bonds.splice(b, 1);
          b--;
          continue;
        }

        const displacement = dist - bond.restLength;

        // Hookean spring: F = k * displacement
        const k = 0.12;
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

      // If bonds broke, dissolve empty colonies
      if (colony.bonds.length === 0) {
        for (const memberId of colony.memberIds) {
          this.orgToColony.delete(memberId);
        }
        this.colonies.delete(colonyId);
        continue;
      }

      for (const component of this.splitDisconnected(colony)) {
        const members = [...component.memberIds].map(id => organismsById.get(id)).filter(Boolean);
        const recipient = members.reduce((min, o) => !min || o.energy < min.energy ? o : min, null);
        if (!recipient) continue;
        const donors = members.filter(o => o !== recipient && o.energy > 60);
        const surplus = donors.reduce((sum, o) => sum + (o.energy - 60) * 0.005, 0);
        const transfer = Math.max(0, Math.min(surplus, 2, CONFIG.MAX_ORGANISM_ENERGY - recipient.energy));
        if (!transfer || !surplus) continue;
        for (const donor of donors) donor.energy -= transfer * ((donor.energy - 60) * 0.005) / surplus;
        recipient.energy += transfer;

      }
    }
  }

  splitDisconnected(colony) {
    const adjacency = new Map([...colony.memberIds].map(id => [id, []]));
    for (const b of colony.bonds) { adjacency.get(b.a)?.push(b.b); adjacency.get(b.b)?.push(b.a); }
    const remaining = new Set(colony.memberIds), components = [];
    while (remaining.size) {
      const stack = [remaining.values().next().value], component = new Set();
      while (stack.length) {
        const id = stack.pop();
        if (!remaining.delete(id)) continue;
        component.add(id); stack.push(...(adjacency.get(id) ?? []));
      }
      components.push(component);
    }
    if (components.length < 2) return [colony];
    const surviving = [];
    this.colonies.delete(colony.id);
    for (const id of colony.memberIds) this.orgToColony.delete(id);
    let first = true;
    for (const members of components) {
      if (members.size < 2) continue;
      const id = first ? colony.id : nextColonyId++;
      first = false;
      this.colonies.set(id, { id, memberIds: members, bonds: colony.bonds.filter(b => members.has(b.a) && members.has(b.b)), createdAt: colony.createdAt });
      surviving.push(this.colonies.get(id));
      for (const member of members) this.orgToColony.set(member, id);
    }
    return surviving;
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

      // Enforce max 6 members on restore to prevent oversized historical colonies
      let memberList = Array.from(validMembers);
      if (memberList.length > 6) {
        memberList = memberList.slice(0, 6);
      }
      const memberSet = new Set(memberList);
      const cappedBonds = validBonds.filter(b => memberSet.has(b.a) && memberSet.has(b.b));

      if (memberSet.size >= 2 && cappedBonds.length > 0) {
        const colony = {
          id: cd.id,
          memberIds: memberSet,
          bonds: cappedBonds,
          createdAt: cd.createdAt || Date.now()
        };

        this.colonies.set(colony.id, colony);
        for (const memberId of memberSet) {
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

return ColonyManager;
}

# AETHEON development sequence

Authorized 2 October 2026: implement the audited plan in order, taking time to validate each phase.

1. Foundation: deployed on 2 October 2026. Stable checkpoint IDs/fields/RNG, recovery, correct morphology registration and counters, colony conservation, safe visitor interactions and HTML, persistent AI cost reservations, bounded codex and lower network traffic. See FOUNDATION-REPORT-RU.md for validation and the first-migration incident.
2. Personal lineage: deployed on 2 October 2026. Understandable introduction, read-only tours, three browser-local family bookmarks, actual parentage, bounded persistent ancestry and generation/genome comparisons. See OBSERVATORY-REPORT-RU.md.
3. Functional morphology and flora: inherited development, resource tradeoffs, plant life cycles and a small set of contrasting habitats.
4. Organism nursery and controlled releases; ecological construction through organisms.
5. Expand habitats and population only from measured performance/retention; finite detailed canonical simulation.

Local source: this directory. Production: /var/www/aetheon on 72.60.134.19. Do not deploy local data or env. Backup: /root/aetheon-backups/20261002T073747Z-evolution.
The legacy shutdown was killed by PM2 before its 20 MB checkpoint finished. The existing last complete checkpoint (tick 486000) was restored, with an explicit SHA256-bound migration receipt allocating new identities. Last observed tick was 488447. Old identities and unsaved elapsed time could not be recovered; old colony records remain archived. World creation time, genomes and all historical morphology records were retained. PM2 kill_timeout is now 30000 and saved in its process configuration. Subsequent real restarts preserved IDs, chemical fields and RNG exactly.

Legacy chemical fields were never saved; full continuity begins with formatVersion 2. FormatVersion 3 stores 39,531 immutable legacy alias records in a separate SHA256-verified archive; regular checkpoints retain active canonical records and all world state, and still read format 2. Rollback requires paired source and data restoration from the protected backup. Historical census totals are retained as legacyCensusCount and do not become birth counts. Old journal entries are labeled unverified archive. First ledger day forbids paid requests because previous spending is unknown. Thereafter the conservative cap is $0.08/day, reserving maximum costs durably before requests. Decision usage is not refunded until aggregate billing can be verified.

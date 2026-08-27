# Dungeon regression seeds

Each JSON file stores minimized, replayable seeds by invariant category. Add the
canonical seed, config override, failing stage, and (when produced by fast-check)
its `seed`/`path`. Normal dungeon tests replay this corpus headlessly.

These cases capture failures found while replacing anchor placement, abstract
connectivity repair, unsafe progression shortcuts, and decorative stairs.

type ZoneCallback = (zone: string) => void;
let activeZone = "PRODUCT";
const cbs: ZoneCallback[] = [];

export const ZoneController = {
  getActiveZone() {
    return activeZone;
  },
  setActiveZone(z: string) {
    activeZone = z;
    for (const cb of cbs) cb(activeZone);
  },
  subscribe(cb: ZoneCallback) {
    cbs.push(cb);
    return () => {
      const i = cbs.indexOf(cb);
      if (i >= 0) cbs.splice(i, 1);
    };
  },
};

export default ZoneController;

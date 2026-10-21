import fs from 'node:fs';
const source =
  fs
    .readFileSync((fs.existsSync(new URL('./worker-live.mjs', import.meta.url)) ? new URL('./worker-live.mjs', import.meta.url) : new URL('../worker-live.mjs', import.meta.url)), 'utf8')
    .replace(
      'import { DurableObject } from "cloudflare:workers";',
      'class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env;}}'
    ) +
  '\nexport {RoomService,createMatch,submitBid,discardCards,chooseTrump,playCard,makeDeck,canPlay,x1PlayInput,x1BidInput,freshOnlineX1,chooseOnlineBotAction,observeOnlineX1,x1CardId,x1Compatible,ONLINE_X1,onlineX1Proof};';
export const api = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
export function database() {
  const map = new Map();
  let alarm = 0;
  return {
    map,
    get alarm() {
      return alarm;
    },
    async get(k) {
      return structuredClone(map.get(k));
    },
    async put(k, v) {
      map.set(k, structuredClone(v));
    },
    async delete(k) {
      return map.delete(k);
    },
    async setAlarm(at) {
      alarm = at;
    },
    async getAlarm() {
      return alarm;
    },
    async deleteAlarm() {
      alarm = 0;
    },
  };
}
export const players = Array.from({ length: 4 }, (_, seat) => ({
  playerId: 'p' + seat,
  name: 'Unit ' + seat,
  isBot: seat > 0,
}));

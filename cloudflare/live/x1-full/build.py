from pathlib import Path
import hashlib,argparse
root=Path(__file__).parent
parser=argparse.ArgumentParser(description='Extend exact verified online X1 v1; preserve its native R10 and frozen engines')
parser.add_argument('--base',type=Path,default=root/'base-worker.mjs')
parser.add_argument('--v1-bridge',type=Path,default=root/'base-bridge.mjs')
parser.add_argument('--output',type=Path,default=root/'worker-live.mjs')
args=parser.parse_args()
base=args.base.read_text();old=args.v1_bridge.read_text()
assert hashlib.sha256(base.encode()).hexdigest()=='313ed667456754003a054b6506c9c5579d98d16ecb179b9d8465fa954152e6c1'
assert base.endswith(old)
s=old.replace('// Online X1 sees only its own cards plus confirmed public information.\n// Offline partner-mask/Anchor assistance never crosses this boundary.', '// Online X1 uses own/public input; sole-human partner assistance is explicitly gated.')
s=s.replace("const ONLINE_X1_VERSION = 'x1-online-v1';","const ONLINE_X1_VERSION = 'x1-online-v2';")
s=s.replace('function chooseOnlineBotAction(room, seat)', 'function choosePreviousOnlineBotAction(room, seat)')
s=s.replace('function x1PlayInput(state, seat, memory)', 'function x1PlayInput(state, seat, memory, partner = null)')
s=s.replace('  return {\n    h,\n    tc,','  const privilege = partner === null ? {} : {partnerMask:String(C.mask(state.hands[partner].map(x1CardId)))};\n  return {\n    ...privilege,\n    h,\n    tc,')
s=s.replace('action.value <= 200','action.value <= makeDeck(state.settings.rules).reduce((n,c)=>n+cardPoints(c,state.settings.rules),0)')
s=s.replace('if (card && !followsLedSuit(card,', 'if (card && !(before.settings.rules.specialsAnytime && isSpecialCard(card,before.settings.rules)) && !followsLedSuit(card,')
s=s.replace('  memory.lastEngine = decision.engine;','  memory.lastEngine = decision.engine;\n  memory.lastPartnerAssist = !!decision.partnerAssist;\n  memory.partnerDecisions = (memory.partnerDecisions || 0) + Number(!!decision.partnerAssist);\n  memory.ruleDecisions = (memory.ruleDecisions || 0) + Number(decision.engine === "x1-rules");')
s=s.replace('    partnerAssist: false,','    partnerAssist: !!m?.lastPartnerAssist,\n    partnerDecisions: m?.partnerDecisions || 0,\n    ruleDecisions: m?.ruleDecisions || 0,\n    handEngineVersion: m?.version || "legacy",')
wrapper='''
function chooseOnlineBotAction(room,seat) {
 const s=room.gameState,m=room.x1;
 if(!m||m.hand!==s.handNumber||m.version!==ONLINE_X1_VERSION)return choosePreviousOnlineBotAction(room,seat);
 const partner=x1EligiblePartner(room,seat),started=performance.now();
 try {
  let d;
  if(!x1Compatible(s)||s.shotTheMoon)d=chooseExtendedX1(room,seat,partner);
  else {
   d=choosePreviousOnlineBotAction(room,seat);
   if(d.engine!=="x1")return d;
   if(s.phase==='bidding') {
    if(partner!==null&&s.bidder===partner){const v=x1BidInput(s,seat,m),ask=v.high+5,cap=ONLINE_X1.core.ceiling(v.h,{seat,high:v.high,history:v.history,scores:v.scores});if(cap>=ask){const p=ONLINE_X1.bidding.decide(v);if(![0,ask].includes(p.bid))throw Error('X1_BAD_TAKEOVER');d.action={type:'bid',value:p.bid};}}
    if(s.settings.shootMoonEnabled){const v=x1ExtendedView(s,seat,m,partner),power=Math.max(...Array.from({length:4},(_,tr)=>X1_RULES.plan({...v,tr},0,false).score));if(power>=90||d.action.value===200){const p=X1_RULES.bid(v,[d.action.value===200?0:d.action.value,200]);d.action={type:'bid',value:p.bid};}}
   }
   if(s.phase==='play'&&partner!==null){const v=x1PlayInput(s,seat,m,partner),p=ONLINE_X1.core.choose(v);const card=s.hands[seat].find(c=>x1CardId(c)===p.card);if(!card)throw Error('X1_PARTNER_SAMPLE');d.action={type:'play',cardId:card.id};}
   d.partnerAssist=partner!==null;
  }
  if(s.phase==='play'&&!s.shotTheMoon){const card=x1AnchorRoute(s,seat,partner);if(card)d.action={type:'play',cardId:card.id};}
  if(!x1ActionLegal(s,seat,d.action))throw Error('X1_RULE_ACTION_ILLEGAL');
  return {...d,ms:Math.round((performance.now()-started)*100)/100};
 }catch(e){return {action:chooseTestBotAction(s,seat),engine:'legacy',reason:'x1-extension-error:'+e.message,partnerAssist:false};}
}
'''
(root/'bridge.mjs').write_text(s+wrapper)
source=base[:-len(old)]+(root/'rules-engine.mjs').read_text()+'\n'+(root/'adapter.mjs').read_text()+'\n'+s+wrapper
args.output.write_text(source)
print('Built X1 v2 candidate without changing native R10/HTTP/DO wrapper.')

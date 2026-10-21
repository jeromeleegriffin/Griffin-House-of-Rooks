from pathlib import Path
import hashlib,json,argparse
parser=argparse.ArgumentParser(description="Rebuild X1 from the exact deployed R10 base and frozen native engines")
parser.add_argument("--base",required=True,type=Path)
parser.add_argument("--engine-dir",required=True,type=Path)
parser.add_argument("--output",required=True,type=Path)
args=parser.parse_args()
assert hashlib.sha256(args.base.read_bytes()).hexdigest()=="a8cb41c717bf1178373e559cc6b36263d45e172474870849f8b0af4e88672eae", "Wrong R10 base; refusing to overwrite later work"
root=Path(__file__).parent
sources=[args.engine_dir/p for p in ['core.js','sha256.js','bidding.js']]
engine="// Preserved X1 sources; isolated namespace, no browser worker or private partner input.\nconst ONLINE_X1 = (() => {\nconst module = undefined; const globalThis = {};\n"+'\n'.join(p.read_text() for p in sources)+"\nreturn Object.freeze({core:globalThis.X1Core,bidding:globalThis.X1Bidding,sha256:globalThis.x1SHA256});\n})();\n"
manifest=json.loads((root/'FROZEN_SOURCE.json').read_text())
for p in sources:
 assert hashlib.sha256(p.read_bytes()).hexdigest()==manifest[p.name]['sha256'], 'Frozen engine changed: '+p.name
s=args.base.read_text()
s=s.replace('function beginCloudOpening(room) {room.opening=', 'function beginCloudOpening(room) {room.x1=freshOnlineX1(room.gameState);room.opening=')
s=s.replace('    room.gameState = result.state;\n', '    observeOnlineX1(room, room.gameState, result);\n    room.gameState = result.state;\n',1)
s=s.replace('      const action = chooseTestBotAction(state, seat);','      const decision = chooseOnlineBotAction(room, seat);\n      const action = decision.action;')
needle='    room.gameState = result.state;\n      room.revision += 1;'
assert s.count(needle)==1
s=s.replace(needle,'    observeOnlineX1(room, state, result, decision);\n    room.gameState = result.state;\n      room.revision += 1;')
s=s.replace('      ...playerView(room.gameState, seat),','      ...playerView(room.gameState, seat),\n      botIntelligence: onlineX1Proof(room),')
s += '\n'+engine+'\n'+(root/'bridge.mjs').read_text()
args.output.write_text(s)
print('Built X1 candidate from verified R10 base; UI/audio/native asset pin unchanged.')

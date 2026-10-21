// X1 rule-aware extension. Frozen standard engines remain unchanged.
// Every world below is sampled from the detached own/public view.
const X1_RULES = (() => {
  function rng(seed) {
    let x = seed >>> 0;
    return n => { x = (x + 0x6d2b79f5) >>> 0; let t = x; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) % n; };
  }
  function seed(v) {
    let x = 2166136261;
    for (const c of JSON.stringify(v)) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0;
    return x;
  }
  function rules(v, tr = v.tr) {
    const { cards, settings } = v, n = cards.length;
    const p = cards.map(c => c.points), rank = cards.map(c => c.rank);
    const cat = cards.map(c => c.special ? tr : c.color);
    function legal(h, tc) {
      if (!tc.length) return h.slice();
      const led = cat[tc[0]], follows = h.filter(c => cat[c] === led);
      let result = follows.length ? follows : settings.rules.mustTrumpWhenVoid && h.some(c => cat[c] === tr) ? h.filter(c => cat[c] === tr) : h.slice();
      if (settings.rules.specialsAnytime) result = [...new Set([...result, ...h.filter(c => cards[c].special)])];
      return result;
    }
    const beats = (a,b,led) => cat[a] !== cat[b] ? cat[a] === tr || (cat[b] !== tr && cat[a] === led) : (cat[a]===tr||cat[a]===led)&&rank[a] > rank[b];
    function winner(tc) { let w = 0; for (let i=1;i<tc.length;i++) if (beats(tc[i],tc[w],cat[tc[0]])) w=i; return w; }
    // Same own/public continuation principles as the approved Sol7 rollout.
    function move(h,tc,ts,seen,knownNest,seat) {
      const L=legal(h,tc), low = a => a.reduce((a,b)=>((cat[b]===tr?1e6:0)+p[b]*2000+rank[b])<((cat[a]===tr?1e6:0)+p[a]*2000+rank[a])?b:a);
      const np=a=>{const q=a.filter(c=>!cards[c].special);return q.length?q:a;};
      if(!tc.length){
        const unknown=cards.map((_,i)=>i).filter(c=>!seen[c]&&!h.includes(c)&&!knownNest.includes(c));
        const trump=L.filter(c=>cat[c]===tr),plain=trump.filter(c=>!cards[c].special),side=L.filter(c=>cat[c]!==tr);
        if(trump.length>=4&&unknown.filter(c=>cat[c]===tr).length>=2&&plain.length)return low(plain);
        if(side.length){let group=[],high=-Infinity;for(let col=0;col<4;col++){const q=side.filter(c=>cat[c]===col),r=Math.max(...q.map(c=>rank[c]));if(q.length>group.length||(q.length===group.length&&r>high)){group=q;high=r;}}
          const top=group.filter(c=>!unknown.some(x=>beats(x,c,cat[c]))),zero=group.filter(c=>!p[c]);return low(top.length?top:zero.length?zero:group);
        }return low(np(L));
      }
      const wi=winner(tc),val=tc.reduce((a,c)=>a+p[c],0),wins=L.filter(c=>beats(c,tc[wi],cat[tc[0]])),zero=L.filter(c=>!p[c]);
      if(ts[wi]===(seat+2)%4){if(tc.length===3){const feed=L.filter(c=>p[c]&&!cards[c].special&&!beats(c,tc[wi],cat[tc[0]]));if(feed.length)return feed.reduce((a,b)=>p[b]>p[a]||(p[b]===p[a]&&rank[b]<rank[a])?b:a);}return low(np(zero.length?zero:L));}
      if(wins.length){if(tc.length===3||val>=10)return low(np(wins));const cheap=wins.filter(c=>cat[c]!==tr&&!p[c]);if(cheap.length)return cheap.reduce((a,b)=>rank[b]<rank[a]?b:a);}
      return low(np(zero.length?zero:L));
    }
    function discard(h,count) {
      const lens=Array.from({length:4},(_,i)=>h.filter(c=>cat[c]===i&&!cards[c].special).length);
      const strong=h.filter(c=>cat[c]===tr).length>=6;
      const value=c=>{if(cat[c]===tr)return 5000+rank[c]*8+p[c]*20;const len=lens[cat[c]],r=rank[c];return (r>=15?1800:r>=14?1150:r>=13?550:r>=12?260:0)+p[c]*28+r*2+len*45-(p[c]&&len<=2&&r<14?(strong?260:120):0)-(p[c]===0?(len===1?900:len===2?520:len===3?140:0):0);};
      return h.slice().sort((a,b)=>value(b)-value(a)||a-b).slice(0,h.length-count);
    }
    return {p,rank,cat,legal,beats,winner,move,discard,n};
  }
  // Hall-feasible weighted allocation plus constrained cyclic mixing, adapted
  // from frozen X1 to variable deck/nest sizes and public widow information.
  function sampler(v, random) {
    const own=new Set(v.h),played=new Set(v.played||[]),known=new Set(v.nest||[]),partner=v.partner??null;
    const partnerCards=new Set(v.partnerHand||[]),widow=new Set(v.publicWidow||[]);
    const seats=[],sizes=[];
    for(let s=0;s<4;s++)if(s!==v.seat){seats.push(s);sizes.push(v.lengths[s]);}
    if(v.hiddenNest){seats.push(4);sizes.push(v.hiddenNest);}
    const unknown=v.cards.map((_,i)=>i).filter(c=>!own.has(c)&&!played.has(c)&&!known.has(c));
    if(sizes.reduce((a,b)=>a+b,0)!==unknown.length)throw Error('X1_WORLD_SIZE');
    const R=rules(v),allow=[];
    for(const c of unknown){let bits=0;for(let g=0;g<seats.length;g++){const s=seats[g];if(s<4&&((v.voids[s]||0)&1<<R.cat[c]))continue;if(partner!==null&&((s===partner)!==partnerCards.has(c)))continue;if(c===v.revealed&&s!==4)continue;if(widow.has(c)&&s!==v.bidder&&s!==4)continue;bits|=1<<g;}if(!bits)throw Error('X1_WORLD_CONSTRAINT');allow[c]=bits;}
    const G=seats.length,counts=Array(1<<G).fill(0),remain=sizes.slice();for(const c of unknown)counts[allow[c]]++;
    function feasible(){for(let m=1;m<(1<<G);m++){let need=0,capacity=0;for(let x=1;x<(1<<G);x++)if((x&m)===x)need+=counts[x];for(let g=0;g<G;g++)if(m&1<<g)capacity+=remain[g];if(need>capacity)return false;}return true;}
    if(!feasible())throw Error('X1_INFEASIBLE_WORLD');
    const order=unknown.slice();for(let i=order.length-1;i>0;i--){const j=random(i+1);[order[i],order[j]]=[order[j],order[i]];}
    const pop=n=>{let p=0;while(n){n&=n-1;p++;}return p;};order.sort((a,b)=>pop(allow[a])-pop(allow[b]));
    const slots=[],groups=[];
    for(const c of order){counts[allow[c]]--;const choices=[];let total=0;for(let g=0;g<G;g++)if(remain[g]&&(allow[c]&1<<g)){remain[g]--;const ok=feasible();remain[g]++;if(ok){choices.push(g);total+=remain[g];}}if(!choices.length)throw Error('X1_ALLOCATE');let roll=random(total),g=choices[0];for(const q of choices){g=q;if(roll<remain[q])break;roll-=remain[q];}remain[g]--;slots.push(c);groups.push(g);}
    function mix(steps){if(slots.length<2)return;for(let z=0;z<steps;z++){const count=slots.length>=3&&random(4)===0?Math.min(slots.length,3+random(2)):2,ix=[];while(ix.length<count){const i=random(slots.length);if(!ix.includes(i))ix.push(i);}if(!ix.every((i,j)=>allow[slots[i]]&1<<groups[ix[(j+1)%count]]))continue;const last=slots[ix[count-1]];for(let i=count-1;i>0;i--)slots[ix[i]]=slots[ix[i-1]];slots[ix[0]]=last;}}
    mix(512);
    return ()=>{mix(64);const h=[[],[],[],[]],nest=(v.nest||[]).slice();h[v.seat]=v.h.slice();slots.forEach((c,i)=>{const s=seats[groups[i]];if(s===4)nest.push(c);else h[s].push(c);});return {h,nest};};
  }
  function utility(v, points) {
    const b=v.bidder%2,delta=points.slice(),made=points[b]>=v.bid;
    delta[b]=made?(v.settings.bidOnlyScoring?v.bid:points[b]):-v.bid;
    if(made&&v.settings.sandbagging){const added=Math.floor(Math.max(0,points[b]-v.bid)/10)*10;delta[b]-=Math.floor(((v.sandbagOverpoints?.[b]||0)+added)/100)*100;}
    const scores=v.scores.map((s,i)=>s+delta[i]);
    if(v.moon&&made)scores[b]=Math.max(scores[b],v.settings.targetScore);
    const result=matchResult(scores,v.settings.targetScore),team=v.seat%2;
    // A made Moon/terminal win dominates margin, including negative scores.
    if(result)return result==='Tie'?0:(result===(team===0?'Team A':'Team B')?10000:-10000);
    return Math.max(-9999,Math.min(9999,scores[team]-scores[1-team]));
  }
  function rollout(v,world,first=null,config={}) {
    const tr=config.tr??v.tr,R=rules(v,tr),h=world.h.map(a=>a.slice()),nest=world.nest.slice();
    let tc=(config.tc??v.tc??[]).slice(),ts=(config.ts??v.ts??[]).slice(),seat=config.lead??v.seat,c=first;
    const seen=Array(v.cards.length).fill(false);for(const x of v.played||[])seen[x]=true;
    const points=(config.points??v.points??[0,0]).slice();let last=v.bidder,steps=0;
    while(h.some(a=>a.length)){
      if(++steps>v.cards.length+4)throw Error('X1_ROLLOUT_LIMIT');
      if(c===null)c=R.move(h[seat],tc,ts,seen,seat===v.bidder?nest:[],seat);
      const at=h[seat].indexOf(c);if(at<0||!R.legal(h[seat],tc).includes(c))throw Error('X1_ROLLOUT_LEGALITY');
      h[seat].splice(at,1);tc.push(c);ts.push(seat);seen[c]=true;
      if(tc.length===4){last=ts[R.winner(tc)];points[last%2]+=tc.reduce((n,c)=>n+R.p[c],0);tc=[];ts=[];seat=last;}else seat=(seat+1)%4;c=null;
    }
    if(tc.length)throw Error('X1_INCOMPLETE_TRICK');
    points[(v.settings.nestGoesTo==='bidder'?v.bidder:last)%2]+=nest.reduce((n,c)=>n+R.p[c],0);
    return {points,value:utility(v,points)};
  }
  function choose(v) {
    const R=rules(v),L=R.legal(v.h,v.tc),seen=Array(v.cards.length).fill(false);for(const c of v.played)seen[c]=true;
    const reference=R.move(v.h,v.tc,v.ts,seen,v.nest,v.seat),ri=L.indexOf(reference);
    if(L.length===1)return{card:L[0],samples:0};
    const draw=sampler(v,rng(seed(v))),samples=v.h.length<=3?256:128,sum=L.map(()=>0),squares=L.map(()=>0);
    for(let i=0;i<samples;i++){const world=draw(),values=L.map((c,j)=>{const n=rollout(v,world,c).value;sum[j]+=n;return n;});for(let j=0;j<L.length;j++){const d=values[j]-values[ri];squares[j]+=d*d;}}
    let best=ri,adv=0;for(let j=0;j<L.length;j++){const d=(sum[j]-sum[ri])/samples,se=Math.sqrt(Math.max(0,squares[j]/samples-d*d)/(samples-1)),adjusted=d-.5-.5*se;if(adjusted>adv){adv=adjusted;best=j;}}
    return {card:L[best],samples,reference};
  }
  function strength(v,h,tr) {
    const R=rules(v,tr),suited=h.filter(c=>R.cat[c]===tr),side=h.filter(c=>R.cat[c]!==tr),high=suited.reduce((n,c)=>n+(R.rank[c]>=14?4:R.rank[c]>=12?2:0),0);
    return suited.length*10+Math.max(0,suited.length-4)*4+high*4+side.reduce((n,c)=>n+(R.rank[c]>=14?12:R.rank[c]>=13?4:0),0)+h.reduce((n,c)=>n+R.p[c],0)*.55;
  }
  function plan(v,count,search=true) {
    const candidates=Array.from({length:4},(_,tr)=>{const keep=rules(v,tr).discard(v.h,count);return{tr,keep,score:strength(v,keep,tr)};}).sort((a,b)=>b.score-a.score||a.tr-b.tr);
    if(!search)return candidates[0];
    const input={...v,lengths:Array(4).fill(v.settings.handSize),hiddenNest:0,nest:[],played:[],tc:[],ts:[],voids:[0,0,0,0]};
    const draw=sampler(input,rng(seed(input))),sum=candidates.map(()=>0),sq=candidates.map(()=>0),samples=128;
    for(let i=0;i<samples;i++){const w=draw(),values=candidates.map((p,j)=>{const h=w.h.map(a=>a.slice());h[v.seat]=p.keep.slice();const nest=v.h.filter(c=>!p.keep.includes(c));const lead=v.settings.leadOrder==='leftOfBidder'?(v.bidder+1)%4:v.settings.leadOrder==='rightOfBidder'?(v.bidder+3)%4:v.bidder;const out=rollout({...v,tr:p.tr,tc:[],ts:[],played:[],points:[0,0]}, {h,nest},null,{lead}).value;sum[j]+=out;return out;});for(let j=0;j<candidates.length;j++){const d=values[j]-values[0];sq[j]+=d*d;}}
    let best=0,adv=0;for(let j=1;j<candidates.length;j++){const d=(sum[j]-sum[0])/samples,se=Math.sqrt(Math.max(0,sq[j]/samples-d*d)/(samples-1));if(d-.5-.5*se>adv){adv=d-.5-.5*se;best=j;}}return candidates[best];
  }
  function bid(v, allowedCandidates=null) {
    const total=v.cards.reduce((n,c)=>n+c.points,0),limit=Math.floor(total/5)*5,ask=v.high+5;
    if(ask>limit)return{bid:0,samples:0};
    const initialPlan=plan(v,0,false),power=strength(v,v.h,initialPlan.tr),cap=Math.min(limit,Math.max(0,Math.floor((power*.8+v.h.reduce((n,c)=>n+v.cards[c].points,0)*.4)/5)*5));
    let candidates=[0];if(cap>=ask)candidates.push(ask,...[10,15,20].map(n=>v.high+n).filter(n=>n>ask&&n<=Math.min(cap-10,limit)));
    // Moon is evaluated on actual terminal utility, not ordinary point margin.
    if(v.settings.shootMoonEnabled&&total%5===0&&power>=90)candidates.push(total);
    if(allowedCandidates)candidates=[...new Set(allowedCandidates)];
    if(candidates.length===1)return{bid:0,samples:0};
    const input={...v,lengths:Array(4).fill(v.settings.handSize),hiddenNest:v.cards.length-4*v.settings.handSize,nest:[],tc:[],ts:[],played:[],voids:[0,0,0,0]},draw=sampler(input,rng(seed(input)));
    const sums=candidates.map(()=>0),squares=candidates.map(()=>0),samples=128;
    function auction(w,offer){const active=v.passed.map(p=>!p),history=v.history.slice();let high=v.high,bidder=v.bidder;if(offer){high=offer;bidder=v.seat;history.push([v.seat,offer]);}else active[v.seat]=false;
      if(offer===total&&v.settings.shootMoonEnabled)return{bidder,bid:high};
      for(let s=(v.seat+1)%4,k=0;k<200;k++,s=(s+1)%4){if(bidder>=0&&active.filter(Boolean).length<=1)return{bidder,bid:high};if(!active[s])continue;const view={...v,seat:s,h:w.h[s]},p=plan(view,0,false),ability=Math.min(limit,Math.floor((strength(view,w.h[s],p.tr)*.8+w.h[s].reduce((n,c)=>n+v.cards[c].points,0)*.4)/5)*5);if(ability>=high+5&&high+5<=limit){high+=5;bidder=s;}else active[s]=false;}
      return bidder>=0?{bidder,bid:high}:v.settings.screwTheDealer?{bidder:v.dealer,bid:v.settings.minBid}:null;
    }
    for(let i=0;i<samples;i++){const w=draw(),cache=new Map(),values=candidates.map((offer,j)=>{const a=auction(w,offer);if(!a)return 0;const key=a.bidder+':'+a.bid;let out=cache.get(key);if(out===undefined){const h=w.h.map(a=>a.slice()),all=h[a.bidder].concat(w.nest),base={...v,seat:a.bidder,h:all,bidder:a.bidder,bid:a.bid,moon:!!v.settings.shootMoonEnabled&&a.bid===total};const p=plan(base,w.nest.length,false);h[a.bidder]=p.keep;const nest=all.filter(c=>!p.keep.includes(c)),lead=v.settings.leadOrder==='leftOfBidder'?(a.bidder+1)%4:v.settings.leadOrder==='rightOfBidder'?(a.bidder+3)%4:a.bidder;out=rollout({...base,seat:v.seat,tr:p.tr,played:[],tc:[],ts:[],points:[0,0]}, {h,nest},null,{lead}).value;cache.set(key,out);}sums[j]+=out;return out;});for(let j=0;j<values.length;j++){const d=values[j]-values[0];squares[j]+=d*d;}}
    let best=0,adv=0;for(let j=1;j<candidates.length;j++){const d=(sums[j]-sums[0])/samples,se=Math.sqrt(Math.max(0,squares[j]/samples-d*d)/(samples-1));if(d-2-.5*se>adv){adv=d-2-.5*se;best=j;}}return{bid:candidates[best],samples};
  }
  return {rules,sampler,utility,rollout,choose,plan,bid,seed};
})();

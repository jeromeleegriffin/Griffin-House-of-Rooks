/* Owner-locked entrance only. Existing game owns teams, rules, audio and play. */
(()=>{'use strict';
const lobby=document.getElementById('lobby'),input=document.getElementById('hor-player-name');
if(!lobby||!input)return;
const card=lobby.querySelector('.lobby-card'),nameLabel=card.querySelector('.identity-name-label'),identity=card.querySelector('.identity-choice');
const saved=(()=>{try{return JSON.parse(localStorage.getItem('horLandingIdentityV1')||'null')}catch(_){return null}})();
if(saved?.name&&!input.value)input.value=saved.name;
if(!input.value){try{input.value=window.HORProgression?.core?.read()?.identity.displayName||loadSession()?.myName||''}catch(_){}}
let returning=!!input.value.trim(),roster=[],chosenThisVisit=null;
const scene=document.createElement('div');scene.id='landingScene783';scene.setAttribute('aria-hidden','true');lobby.prepend(scene);
const branding=document.createElement('div');branding.id='landingBrand783';branding.innerHTML='<strong>GRIFFIN</strong><span>♜</span><small>HOUSE OF ROOKS</small>';lobby.prepend(branding);
const panel=document.createElement('section');panel.id='landingPanel783';panel.setAttribute('aria-label','Take your seat');
const greeting=document.createElement('div');greeting.id='landingGreeting783';
const edit=document.createElement('button');edit.type='button';edit.textContent='Change player';edit.onclick=()=>{lobby.classList.remove('landing-returning');input.focus()};greeting.append(edit);
panel.append(nameLabel,input,identity,greeting,document.getElementById('soloPracticeBtn'),document.getElementById('friendsToggleBtn'),document.getElementById('reconnectBox'),document.getElementById('joinForm'),document.getElementById('lobbyStatus'));lobby.append(panel);
const noService=document.getElementById('noServiceModal');if(noService)lobby.append(noService);
const solo=document.getElementById('soloPracticeBtn');solo.textContent='Take Your Seat ›';document.getElementById('friendsToggleBtn').textContent='Play With Friends';
const menu=document.createElement('div');menu.id='landingMenu783';menu.hidden=true;
const menuButton=document.createElement('button');menuButton.id='landingMenuButton783';menuButton.type='button';menuButton.textContent='☰';menuButton.setAttribute('aria-label','Menu');menuButton.setAttribute('aria-expanded','false');
menuButton.onclick=()=>{menu.hidden=!menu.hidden;menuButton.setAttribute('aria-expanded',String(!menu.hidden))};
for(const id of ['joinBtn','showRules','replayTutorialBtn','btnCardBackLobby','installAppBtn','toggleMuteLobby']){const b=document.getElementById(id);if(b)menu.append(b)}
const change=document.createElement('button');change.type='button';change.textContent='Change player';change.onclick=()=>{edit.click();menu.hidden=true;menuButton.setAttribute('aria-expanded','false')};menu.prepend(change);
lobby.append(menuButton,menu);
const partner=document.createElement('button');partner.id='landingPartner783';partner.type='button';partner.textContent='♧ Change Partner';lobby.append(partner);
const picker=document.createElement('dialog');picker.className='identity-dialog';picker.id='landingPartners783';picker.setAttribute('aria-label','Choose your partner');picker.innerHTML='<div class="identity-dialog-head"><h2>Choose your partner</h2><button type="button" data-close aria-label="Close partner choices">✕</button></div><p>Your partner sits opposite you. Opponents stay random.</p><div data-partner-control></div><button type="button" data-done>Done</button>';document.body.append(picker);
// Reuse the existing favorite selector and its storage handler, not a second store.
const favorite=document.getElementById('opt-favorite-partner'),favoriteHome=favorite.parentNode,nextFavorite=favorite.nextSibling;
partner.onclick=()=>{myName=input.value.trim()||'You';syncFavoritePartner042();picker.querySelector('[data-partner-control]').append(favorite);picker.showModal()};
function closePartner(){picker.close()}
picker.querySelector('[data-close]').onclick=closePartner;picker.querySelector('[data-done]').onclick=closePartner;
picker.addEventListener('close',()=>{favoriteHome.insertBefore(favorite,nextFavorite);chooseRoster();partner.focus()});
favorite.addEventListener('change',()=>{chosenThisVisit=favorite.value;chooseRoster()});
function chooseRoster(){
 myName=input.value.trim()||'You';const saved=favoritePartner042(),humanAvatar=ensurePreferredAvatar();
 const favored=saved?.avatar===humanAvatar?null:saved;
 const eligible=HORCharacterStudio077.castPool(BOT_PERSONAS).filter(p=>HORCharacterStudio077.characters[p.avatar]&&p.avatar!==humanAvatar);
 const pool=eligible.filter(p=>p.name!==favored?.name);const take=()=>pool.splice(Math.floor(Math.random()*pool.length),1)[0];
 const top=favored||take();roster=[take(),top,take()];paint();
}
function paint(){
 const original=document.querySelector('#characters077 svg');if(!original){requestAnimationFrame(paint);return}
 const svg=original.cloneNode(true);svg.removeAttribute('style');svg.querySelectorAll('[id]').forEach(e=>e.id='landing-'+e.id);
 svg.querySelectorAll('[clip-path]').forEach(e=>e.setAttribute('clip-path',e.getAttribute('clip-path').replace('#cs077','#landing-cs077')));
 const seats=HORCharacterStudio077.inspect().seats;
 for(let i=0;i<3;i++){
  const s=seats[i],p=roster[i],c=HORCharacterStudio077.characters[p.avatar],body=svg.querySelector(`[data-seat="${s.pose}"]`),fg=svg.querySelector(`[data-foreground="${s.pose}"]`);
  const g=p.avatar==='cobalt'&&s.pose==='top'?{x:272.5,y:295,w:330}:s;
  for(const [k,v]of Object.entries({x:g.x,y:g.y,width:g.w,height:g.w*1.5}))body.setAttribute(k,v);
  body.setAttribute('clip-path',`url(#landing-cs077-${p.avatar==='cobalt'&&s.pose==='top'?'cobalt-top':s.pose==='top'?'far-outside':'outside'})`);
  const bodyPath='assets/characters077/'+c.poses[s.pose],armPath=c.foreground?.[s.pose]?'assets/characters077/'+c.foreground[s.pose]:null;
  body.removeAttribute('href');fg.removeAttribute('href');body.style.display='';fg.style.display=armPath?'':'none';
  window.HORAssetLoading772.requireImages([bodyPath,armPath].filter(Boolean)).then(()=>{
   if(!body.isConnected)return;body.setAttribute('href',bodyPath);if(armPath)fg.setAttribute('href',armPath);
  }).catch(()=>{});
  const label=document.createElementNS('http://www.w3.org/2000/svg','text');label.setAttribute('x',s.label[0]);label.setAttribute('y',s.label[1]+18);label.setAttribute('text-anchor','middle');label.setAttribute('class','landing-seat-name');label.textContent=p.name;svg.append(label);
 }
 scene.replaceChildren(svg);
}
function saveName(explicit=false){window.HORFounderProfile785?.syncName();const name=input.value.trim();myName=name||'You';if(explicit&&name&&window.HORProgression?.core?.read()){try{HORProgression.core.rename(name);}catch(e){console.error('[Career name]',e.message);}}if(chosenThisVisit!==null)saveFavoritePartner042(chosenThisVisit);try{localStorage.setItem('horLandingIdentityV1',JSON.stringify({name}));}catch(_){}return name}
function restoreView(){lobby.classList.toggle('landing-returning',returning);greeting.firstChild===edit||greeting.querySelector('strong')?.remove();const t=document.createElement('strong');t.textContent='Welcome back, '+input.value.trim();greeting.prepend(t)}
input.addEventListener('change',()=>{saveName(true);chooseRoster()});
for(const id of ['soloPracticeBtn','friendsToggleBtn','joinConfirmBtn','spectateBtn'])document.getElementById(id)?.addEventListener('click',()=>{saveName();menu.hidden=true;returning=!!input.value.trim()},true);
input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();(lobby.classList.contains('joining')?document.getElementById('joinConfirmBtn'):solo).click()}});
document.addEventListener('hor-artwork-retry',paint);
window.HORLanding783={refreshIdentity:()=>{const editing=!lobby.classList.contains('landing-returning');returning=!!input.value.trim();restoreView();if(editing)lobby.classList.remove('landing-returning');chooseRoster()},rosterForStart:()=>roster.slice(),inspect:()=>({roster:roster.map(p=>({name:p.name,avatar:p.avatar,style:p.style})),returning}),refresh:chooseRoster};
lobby.classList.add('landing783');restoreView();chooseRoster();
// Returning from a game shows saved identity and a new eligible random table.
let wasHidden=lobby.classList.contains('hidden');new MutationObserver(()=>{const hidden=lobby.classList.contains('hidden');if(wasHidden&&!hidden){restoreView();chooseRoster()}wasHidden=hidden;}).observe(lobby,{attributes:true,attributeFilter:['class']});
})();

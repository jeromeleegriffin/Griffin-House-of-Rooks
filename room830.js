/* Approved full-room entrance. Move live controls, retain their original handlers and portrait homes. */
(()=>{'use strict';
 const lobby=document.getElementById('lobby'),waiting=document.getElementById('waiting');if(!lobby)return;
 const wide=()=>matchMedia('(orientation:landscape)').matches,homes=new Map();
 function park(el,parent){if(!el||el.parentNode===parent)return;if(!homes.has(el)){const mark=document.createComment('portrait home');el.before(mark);homes.set(el,mark);}parent.append(el);}
 function restore(el){const mark=homes.get(el);if(mark?.parentNode&&el.parentNode!==mark.parentNode)mark.after(el);}
 const brand=document.createElement('div');brand.className='room-brand830';brand.innerHTML='<img src="assets/brand835/house-plaque835.png" alt="Griffin House of Rooks">';lobby.append(brand);
 if(waiting){const b=brand.cloneNode(true);waiting.append(b);}
 const hero=document.createElement('section');hero.id='roomWelcome830';hero.innerHTML='<h1></h1><button type="button" id="roomEditPlayer830"><img alt=""><span></span><small>Edit player ✎</small></button>';lobby.append(hero);
 const dock=document.createElement('nav');dock.id='roomEntryDock830';dock.setAttribute('aria-label','Play options');lobby.append(dock);
 const partnerLabel=document.createElement('div');partnerLabel.id='roomPartnerLabel830';lobby.append(partnerLabel);
 const edit=document.createElement('dialog');edit.id='roomIdentity830';edit.className='identity-dialog';edit.innerHTML='<header><h2>Edit player</h2><button type="button" data-room-done>Done</button></header><div data-room-identity></div>';document.body.append(edit);
 const input=document.getElementById('hor-player-name'),identity=lobby.querySelector('.identity-choice'),nameLabel=lobby.querySelector('.identity-name-label'),solo=document.getElementById('soloPracticeBtn');let entry=document.getElementById('houseFriendsEntry805');
 const editable=[nameLabel,input,identity];
 function close(){input.dispatchEvent(new Event('change',{bubbles:true}));edit.close();}
 edit.querySelector('[data-room-done]').onclick=close;
 edit.addEventListener('close',()=>{editable.forEach(restore);sync();});
 document.getElementById('roomEditPlayer830').onclick=()=>{if(!wide())return;for(const n of editable)park(n,edit.querySelector('[data-room-identity]'));edit.showModal();input.focus();};
 const oldEdit=document.querySelector('#landingGreeting783 button'),oldEditAction=oldEdit?.onclick;
 if(oldEdit)oldEdit.onclick=function(e){if(wide())document.getElementById('roomEditPlayer830').click();else oldEditAction?.call(this,e);};
 function sync(){
  entry=document.getElementById('houseFriendsEntry805');
  if(!wide()){if(edit.open)edit.close();[solo,entry,...editable].forEach(restore);solo.textContent='Take Your Seat ›';return;}
  park(solo,dock);park(entry,dock);if(solo.textContent!=='Play Offline')solo.textContent='Play Offline';
  const name=input.value.trim()||'You',h=hero.querySelector('h1'),b=hero.querySelector('#roomEditPlayer830'),image=b.querySelector('img');
  const title=name==='You'?'Welcome to the table':'Welcome back, '+name;if(h.textContent!==title)h.textContent=title;
  if(b.querySelector('span').textContent!==name)b.querySelector('span').textContent=name;
  const src=avatarSrc(ensurePreferredAvatar());if(image.getAttribute('src')!==src)image.src=src;
  const p=window.HORLanding783?.inspect().roster?.[1];const favorite=favoritePartner042(),conflict=favorite?.avatar===ensurePreferredAvatar();const text=conflict?'Random partner · '+favorite.name+' portrait in use':p?p.name+' · Partner':'Your partner';if(partnerLabel.textContent!==text)partnerLabel.textContent=text;
 }
 input.addEventListener('change',sync);identity?.addEventListener('click',()=>setTimeout(sync,0));
 const scene=document.getElementById('landingScene783');if(scene)new MutationObserver(sync).observe(scene,{childList:true});new MutationObserver(sync).observe(lobby,{attributes:true,attributeFilter:['class']});addEventListener('resize',sync);document.addEventListener('DOMContentLoaded',sync);sync();
})();

(() => {
  'use strict';
  const root=document.querySelector('.hla-guide-directory');
  if(!root) return;
  const input=root.querySelector('#guide-query');
  const select=root.querySelector('#guide-app');
  const status=root.querySelector('#guide-status');
  const empty=root.querySelector('#guide-empty');
  const reset=root.querySelector('#guide-reset');
  const normalize=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const groups=Array.from(root.querySelectorAll(':scope > details')).map(group=>({
    group, initialOpen:group.open, name:normalize(group.querySelector('summary').textContent),
    items:Array.from(group.querySelectorAll('.hla-links > li')).map(li=>({li,text:normalize(li.textContent)}))
  }));
  function update(){
    const terms=normalize(input.value).split(' ').filter(Boolean);
    const selected=select.value;
    const active=terms.length>0 || selected!=='';
    let count=0;
    for(const g of groups){
      let matches=0;
      for(const item of g.items){
        const show=(!selected||g.group.dataset.app===selected)&&terms.every(term=>(g.name+' '+item.text).includes(term));
        item.li.hidden=!show;
        if(show) matches++;
      }
      g.group.hidden=matches===0;
      g.group.open=active&&matches>0 ? true : g.initialOpen;
      const counter=g.group.querySelector('.guide-count');
      if(counter) counter.textContent=' ('+matches+')';
      count+=matches;
    }
    status.textContent=active ? count+' matching '+(count===1?'guide':'guides')+'.' : count+' guides and tools. Search by topic or choose an app.';
    empty.hidden=count>0;
    reset.disabled=!active;
  }
  input.addEventListener('input',update);
  select.addEventListener('change',update);
  reset.addEventListener('click',()=>{input.value='';select.value='';update();input.focus();});
  root.querySelector('.guide-controls').hidden=false;
  update();
})();

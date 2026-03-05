// ================================================================
//  FARM SIM 25 MANAGER — app.js v1.3
// ================================================================

// ---------- STATE ----------
let state = {
  farmName:'My Farm', season:'Spring', year:1,
  startingBalance:0, walletTransactions:[],
  fields:[], equipment:[], harvests:[], sales:[], purchases:[], finances:[], animals:[], activity:[],
};
const DEFAULT_STATE = () => ({
  farmName:'My Farm', season:'Spring', year:1,
  startingBalance:0, walletTransactions:[],
  fields:[], equipment:[], harvests:[], sales:[], purchases:[], finances:[], animals:[], activity:[],
});

let pendingDeleteFn=null, finChart=null, expChart=null;

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded',()=>{
  loadState(); setupNav(); setupSidebar(); setupModals(); setupForms(); setupReset();
  renderAll(); setTodayDates();
});

// ---------- PERSIST ----------
function saveState(silent=false){
  localStorage.setItem('fs25_state',JSON.stringify(state));
  if(!silent) showToast('💾 Saved!');
}
function loadState(){
  const raw=localStorage.getItem('fs25_state');
  if(raw){try{state=Object.assign(DEFAULT_STATE(),JSON.parse(raw))}catch(e){state=DEFAULT_STATE()}}
}
function setTodayDates(){
  const t=new Date().toISOString().split('T')[0];
  ['harvestDate','saleDate','purchaseDate','finDate','equipDate'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.value)el.value=t});
}

// ---------- RESET ----------
function setupReset(){
  document.getElementById('resetBtn').addEventListener('click',()=>{
    document.getElementById('resetConfirmInput').value='';
    openModal('resetModal');
  });
  document.getElementById('confirmResetBtn').addEventListener('click',()=>{
    const val=document.getElementById('resetConfirmInput').value.trim();
    if(val!=='RESET'){
      const inp=document.getElementById('resetConfirmInput');
      inp.style.borderColor='var(--red)';
      inp.style.animation='shake 0.4s ease';
      inp.addEventListener('animationend',()=>{inp.style.animation=''},{ once:true });
      showToast('Type RESET (all caps) to confirm.','error'); return;
    }
    state=DEFAULT_STATE(); localStorage.removeItem('fs25_state');
    if(finChart){finChart.destroy();finChart=null}
    if(expChart){expChart.destroy();expChart=null}
    closeModal('resetModal'); navigateTo('dashboard'); renderAll();
    showToast('🔄 All data has been reset!','warning');
  });
  document.getElementById('resetConfirmInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('confirmResetBtn').click()});
}

// ---------- WALLET CORE ----------
function computeBalance(){
  return state.walletTransactions.reduce((b,t)=>b+t.amount, state.startingBalance);
}
function addWalletTx(type,desc,amount){
  const bal=computeBalance()+amount;
  state.walletTransactions.push({id:uid(),ts:new Date().toISOString(),type,desc,amount,balanceAfter:bal});
  renderWallet(); updateDashStats();
}
function renderWallet(){
  const bal=computeBalance();
  const salesTotal=state.walletTransactions.filter(t=>t.type==='sale').reduce((s,t)=>s+t.amount,0);
  const purchTotal=Math.abs(state.walletTransactions.filter(t=>t.type==='purchase').reduce((s,t)=>s+t.amount,0));

  // Hero
  const heroAmt=document.getElementById('walletHeroAmount');
  if(heroAmt){
    heroAmt.textContent=fmt$(bal); heroAmt.classList.toggle('negative',bal<0);
    const sub=document.getElementById('walletHeroSub');
    if(sub) sub.innerHTML=`
      <span class="wallet-pill start">🏁 Starting: ${fmt$(state.startingBalance)}</span>
      <span class="wallet-pill green">💰 +${fmt$(salesTotal)} from sales</span>
      <span class="wallet-pill red">🛒 -${fmt$(purchTotal)} from purchases</span>`;
    const sbi=document.getElementById('startingBalanceInput');
    if(sbi) sbi.value=state.startingBalance||'';
  }
  // Topbar
  const tbAmt=document.getElementById('topbarBalanceAmt');
  const tbEl=document.getElementById('topbarBalance');
  if(tbAmt) tbAmt.textContent=fmt$(bal);
  if(tbEl) tbEl.classList.toggle('negative',bal<0);
  // Hero dashboard
  const hBal=document.getElementById('heroBalance');
  if(hBal){hBal.textContent=fmt$(bal);hBal.classList.toggle('negative',bal<0)}
  document.getElementById('heroBalanceSub') && (document.getElementById('heroBalanceSub').textContent=`Starting: ${fmt$(state.startingBalance)}`);
  // History
  const tbody=document.getElementById('walletHistoryBody');
  if(!tbody) return;
  if(!state.walletTransactions.length){tbody.innerHTML='<tr><td colspan="5" class="empty-row">No transactions yet. Set a starting balance to begin!</td></tr>';return}
  const tCfg={start:{l:'🏁 Starting',c:'badge-blue'},sale:{l:'💰 Sale',c:'badge-green'},purchase:{l:'🛒 Purchase',c:'badge-red'},add:{l:'➕ Manual Add',c:'badge-emerald'},subtract:{l:'➖ Manual Deduct',c:'badge-orange'},update:{l:'✏️ Update',c:'badge-purple'}};
  tbody.innerHTML=[...state.walletTransactions].reverse().map(t=>{
    const cfg=tCfg[t.type]||{l:t.type,c:'badge-gray'};
    const amtHtml=t.amount>=0?`<span style="color:var(--green);font-weight:700">+${fmt$(t.amount)}</span>`:`<span style="color:var(--red);font-weight:700">${fmt$(t.amount)}</span>`;
    const balHtml=t.balanceAfter>=0?`<strong style="color:var(--green)">${fmt$(t.balanceAfter)}</strong>`:`<strong style="color:var(--red)">${fmt$(t.balanceAfter)}</strong>`;
    const dt=new Date(t.ts);
    return `<tr><td style="white-space:nowrap;font-size:0.79rem">${dt.toLocaleDateString()} ${dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td><td><span class="badge ${cfg.c}">${cfg.l}</span></td><td>${esc(t.desc)}</td><td>${amtHtml}</td><td>${balHtml}</td></tr>`;
  }).join('');
}
function clearWalletHistory(){
  if(!state.walletTransactions.length)return;
  confirmDelete(()=>{state.walletTransactions=[];state.startingBalance=0;renderWallet();updateDashStats();saveState(true);showToast('Wallet cleared.','warning')});
}

// ---------- NAVIGATION ----------
function setupNav(){
  document.querySelectorAll('.nav-link').forEach(l=>{
    l.addEventListener('click',e=>{e.preventDefault();navigateTo(l.dataset.page);document.getElementById('sidebar').classList.remove('mobile-open')});
  });
  document.getElementById('topbarBalance').addEventListener('click',()=>navigateTo('wallet'));
}
const PAGE_META={
  dashboard:{title:'Dashboard',icon:'🏠'},
  wallet:{title:'Wallet / Balance',icon:'💰'},
  fields:{title:'Fields',icon:'🌱'},
  equipment:{title:'Equipment',icon:'🚜'},
  crops:{title:'Crops & Harvest',icon:'🌾'},
  sales:{title:'Sales',icon:'💵'},
  purchases:{title:'Purchases',icon:'🛒'},
  finance:{title:'Finances',icon:'📊'},
  animals:{title:'Animals',icon:'🐄'},
};
function navigateTo(page){
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.toggle('active',l.dataset.page===page));
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));
  const meta=PAGE_META[page]||{title:page,icon:'📄'};
  document.getElementById('pageTitle').textContent=meta.title;
  document.getElementById('breadcrumbIcon').textContent=meta.icon;
  if(page==='finance') renderFinanceCharts();
  if(page==='dashboard'){renderFinanceBarChart();renderActivity()}
  if(page==='wallet') renderWallet();
}

// ---------- SIDEBAR ----------
function setupSidebar(){
  const sb=document.getElementById('sidebar');
  document.getElementById('sidebarToggle').addEventListener('click',()=>sb.classList.toggle('collapsed'));
  document.getElementById('mobileMenuBtn').addEventListener('click',()=>sb.classList.toggle('mobile-open'));
  document.getElementById('editFarmNameBtn').addEventListener('click',()=>{
    document.getElementById('farmNameInput').value=state.farmName;
    document.getElementById('seasonSelect').value=state.season;
    document.getElementById('yearInput').value=state.year;
    openModal('farmNameModal');
  });
}

// ---------- MODALS ----------
function openModal(id){document.getElementById(id).classList.add('open')}
function closeModal(id){document.getElementById(id).classList.remove('open')}
function setupModals(){
  document.querySelectorAll('.modal-close,[data-modal]').forEach(btn=>{
    btn.addEventListener('click',()=>{if(btn.dataset.modal)closeModal(btn.dataset.modal)});
  });
  document.querySelectorAll('.modal-overlay').forEach(o=>{
    o.addEventListener('click',e=>{if(e.target===o)closeModal(o.id)});
  });
  document.getElementById('confirmDeleteBtn').addEventListener('click',()=>{
    if(pendingDeleteFn){pendingDeleteFn();pendingDeleteFn=null}
    closeModal('confirmModal');
  });
}
function confirmDelete(fn){pendingDeleteFn=fn;openModal('confirmModal')}

// ---------- TOAST ----------
function showToast(msg,type='success'){
  const t=document.getElementById('toast');
  document.getElementById('toastMsg').textContent=msg;
  t.className='toast show'+(type==='error'?' error':type==='warning'?' warning':'');
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),3200);
}

// ---------- ACTIVITY ----------
function logActivity(msg){
  const now=new Date();
  state.activity.unshift({msg,time:now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})});
  if(state.activity.length>50)state.activity.pop();
  renderActivity();
}
function renderActivity(){
  const ul=document.getElementById('activityList');
  const cnt=document.getElementById('activityCount');
  if(cnt)cnt.textContent=state.activity.length;
  if(!state.activity.length){ul.innerHTML='<li class="activity-empty"><i class="fa fa-seedling"></i> No activity yet — start tracking!</li>';return}
  ul.innerHTML=state.activity.slice(0,25).map(a=>`<li><span>${a.msg}</span><span class="act-time">${a.time}</span></li>`).join('');
}

// ---------- DASHBOARD STATS ----------
function updateDashStats(){
  const bal=computeBalance();
  const totalSales=state.sales.reduce((s,x)=>s+(+x.total||0),0);
  const totalPurch=state.purchases.reduce((s,x)=>s+(+x.total||0),0);
  const totalHarv=state.harvests.reduce((s,x)=>s+(+x.amount||0),0);
  const net=totalSales-totalPurch;

  setEl('statFields',state.fields.length);
  setEl('statEquipment',state.equipment.length);
  setEl('statSales',fmt$(totalSales));
  setEl('statPurchases',fmt$(totalPurch));
  setEl('statHarvest',fmtN(totalHarv)+' L');
  const npEl=document.getElementById('statNetProfit');
  if(npEl){npEl.textContent=fmt$(net);npEl.style.color=net>=0?'var(--green)':'var(--red)'}

  // Topbar + hero balance
  const tbAmt=document.getElementById('topbarBalanceAmt');
  const tbEl=document.getElementById('topbarBalance');
  if(tbAmt)tbAmt.textContent=fmt$(bal);
  if(tbEl)tbEl.classList.toggle('negative',bal<0);
  const hb=document.getElementById('heroBalance');
  if(hb){hb.textContent=fmt$(bal);hb.classList.toggle('negative',bal<0)}
  const hs=document.getElementById('heroBalanceSub');
  if(hs)hs.textContent=`Starting: ${fmt$(state.startingBalance)}`;

  // Count badges
  setEl('fieldCount',state.fields.length);
  setEl('equipCount',state.equipment.length);
  setEl('animalCount',state.animals.length);
  setEl('activityCount',state.activity.length);

  // Hero farm name
  const seasonEmoji={Spring:'🌸',Summer:'☀️',Autumn:'🍂',Winter:'❄️'};
  const seasonStr=`${seasonEmoji[state.season]||'🌿'} ${state.season} – Year ${state.year}`;
  setEl('farmNameDisplay',state.farmName);
  setEl('sidebarFarmName',state.farmName);
  setEl('heroBigFarmName',state.farmName);
  setEl('heroSeason',`${state.season} – Year ${state.year}`);
  const sb=document.getElementById('seasonBadge');
  if(sb)sb.innerHTML=`<span>${seasonEmoji[state.season]||'🌿'}</span> ${state.season} – Year ${state.year}`;

  // Field overview table
  const tbody=document.getElementById('dashFieldBody');
  if(!state.fields.length){tbody.innerHTML='<tr><td colspan="5" class="empty-row"><i class="fa fa-seedling"></i> No fields added yet.</td></tr>'}
  else tbody.innerHTML=state.fields.slice(0,8).map(f=>`<tr><td><strong>${esc(f.name)}</strong></td><td>${f.ha} ha</td><td>${esc(f.crop)}</td><td>${statusBadge(f.status)}</td><td>${soilBadge(f.soil)}</td></tr>`).join('');
}

// ---------- FORMS ----------
function setupForms(){
  // Starting Balance
  document.getElementById('startingBalanceForm').addEventListener('submit',e=>{
    e.preventDefault();
    const newStart=parseFloat(document.getElementById('startingBalanceInput').value)||0;
    const note=document.getElementById('startingBalanceNote').value.trim()||'Starting balance set';
    const diff=newStart-state.startingBalance;
    state.startingBalance=newStart;
    const newBal=computeBalance();
    state.walletTransactions.push({id:uid(),ts:new Date().toISOString(),type:state.walletTransactions.length===0?'start':'update',desc:note,amount:diff,balanceAfter:newBal});
    logActivity(`🏁 Starting balance set to ${fmt$(newStart)}`);
    renderWallet();updateDashStats();saveState(true);
    showToast(`✅ Balance set to ${fmt$(newStart)}!`);
    document.getElementById('startingBalanceNote').value='';
  });

  // Manual Adjustment
  document.getElementById('manualAdjustForm').addEventListener('submit',e=>{
    e.preventDefault();
    const type=document.getElementById('adjustType').value;
    const rawAmt=parseFloat(document.getElementById('adjustAmount').value)||0;
    const amount=type==='subtract'?-rawAmt:rawAmt;
    const note=document.getElementById('adjustNote').value.trim();
    addWalletTx(type==='subtract'?'subtract':'add',note,amount);
    logActivity(`${type==='add'?'➕':'➖'} Manual ${type}: ${fmt$(rawAmt)} — ${note}`);
    saveState(true);
    showToast(`${type==='add'?'➕ Added':'➖ Deducted'} ${fmt$(rawAmt)} ${type==='add'?'to':'from'} balance!`);
    document.getElementById('manualAdjustForm').reset();
  });

  // Fields
  onBtn('addFieldBtn',()=>{resetForm('fieldForm');setEl_val('fieldId','');setEl_val('fieldModalTitle','Add Field');openModal('fieldModal')});
  document.getElementById('fieldForm').addEventListener('submit',e=>{
    e.preventDefault();
    const id=val('fieldId');
    const rec={id:id||uid(),name:val('fieldName'),ha:val('fieldHa'),crop:val('fieldCrop'),status:val('fieldStatus'),soil:val('fieldSoil'),hired:val('fieldHired'),notes:val('fieldNotes')};
    if(id){state.fields[state.fields.findIndex(x=>x.id===id)]=rec;logActivity(`✏️ Updated field: ${rec.name}`)}
    else{state.fields.push(rec);logActivity(`🌱 Added field: ${rec.name} (${rec.ha} ha)`)}
    closeModal('fieldModal');renderFields();updateDashStats();saveState(true);showToast(`Field "${rec.name}" saved!`);
  });

  // Equipment
  onBtn('addEquipBtn',()=>{resetForm('equipForm');setEl_val('equipId','');setEl_val('equipModalTitle','Add Equipment');openModal('equipModal')});
  document.getElementById('equipForm').addEventListener('submit',e=>{
    e.preventDefault();
    const id=val('equipId');
    const rec={id:id||uid(),name:val('equipName'),type:val('equipType'),brand:val('equipBrand'),price:val('equipPrice'),date:val('equipDate'),condition:val('equipCondition'),field:val('equipField'),notes:val('equipNotes')};
    if(id){state.equipment[state.equipment.findIndex(x=>x.id===id)]=rec;logActivity(`✏️ Updated equipment: ${rec.name}`)}
    else{state.equipment.push(rec);logActivity(`🚜 Added equipment: ${rec.name}`)}
    closeModal('equipModal');renderEquipment();updateDashStats();saveState(true);showToast(`Equipment "${rec.name}" saved!`);
  });

  // Harvests
  onBtn('addHarvestBtn',()=>{resetForm('harvestForm');setEl_val('harvestId','');setTodayDates();openModal('harvestModal')});
  document.getElementById('harvestForm').addEventListener('submit',e=>{
    e.preventDefault();
    const id=val('harvestId');
    const rec={id:id||uid(),date:val('harvestDate'),field:val('harvestField'),crop:val('harvestCrop'),amount:val('harvestAmount'),quality:val('harvestQuality'),sold:val('harvestSold'),notes:val('harvestNotes')};
    if(id){state.harvests[state.harvests.findIndex(x=>x.id===id)]=rec;logActivity(`✏️ Updated harvest`)}
    else{state.harvests.push(rec);logActivity(`🌾 Harvested: ${rec.crop} – ${fmtN(rec.amount)}L from ${rec.field}`)}
    closeModal('harvestModal');renderHarvests();updateDashStats();saveState(true);showToast(`Harvest logged: ${rec.crop} (${fmtN(rec.amount)} L)!`);
  });

  // Sales — AUTO ADD
  onBtn('addSaleBtn',()=>{resetForm('saleForm');setEl_val('saleId','');setTodayDates();openModal('saleModal')});
  ['saleAmt','salePPU'].forEach(id=>{
    document.getElementById(id).addEventListener('input',()=>{
      const a=parseFloat(val('saleAmt'))||0,p=parseFloat(val('salePPU'))||0;
      if(a&&p)document.getElementById('saleTotal').value=(a*p).toFixed(2);
    });
  });
  document.getElementById('saleForm').addEventListener('submit',e=>{
    e.preventDefault();
    const eid=val('saleId');
    const rec={id:eid||uid(),date:val('saleDate'),item:val('saleItem'),cat:val('saleCat'),amt:val('saleAmt'),ppu:val('salePPU'),total:val('saleTotal'),buyer:val('saleBuyer'),notes:val('saleNotes')};
    const saleAmt=parseFloat(rec.total)||0;
    if(eid){
      const old=state.sales.find(x=>x.id===eid);const oldAmt=parseFloat(old?.total)||0;
      state.sales[state.sales.findIndex(x=>x.id===eid)]=rec;
      if(saleAmt!==oldAmt)addWalletTx('sale',`Sale edit: ${rec.item}`,saleAmt-oldAmt);
      logActivity(`✏️ Updated sale: ${rec.item}`);
    }else{
      state.sales.push(rec);
      if(saleAmt>0){addWalletTx('sale',`Sale: ${rec.item}`,saleAmt);logActivity(`💰 Sale: ${rec.item} → +${fmt$(saleAmt)}`)}
      else logActivity(`💰 Sale logged: ${rec.item}`);
    }
    closeModal('saleModal');renderSales();updateDashStats();saveState(true);showToast(`✅ Sale saved! +${fmt$(saleAmt)} added to balance.`);
  });

  // Purchases — AUTO DEDUCT
  onBtn('addPurchaseBtn',()=>{resetForm('purchaseForm');setEl_val('purchaseId','');setTodayDates();openModal('purchaseModal')});
  ['purchaseQty','purchaseUC'].forEach(id=>{
    document.getElementById(id).addEventListener('input',()=>{
      const q=parseFloat(val('purchaseQty'))||0,u=parseFloat(val('purchaseUC'))||0;
      if(q&&u)document.getElementById('purchaseTotal').value=(q*u).toFixed(2);
    });
  });
  document.getElementById('purchaseForm').addEventListener('submit',e=>{
    e.preventDefault();
    const eid=val('purchaseId');
    const rec={id:eid||uid(),date:val('purchaseDate'),item:val('purchaseItem'),cat:val('purchaseCat'),qty:val('purchaseQty'),uc:val('purchaseUC'),total:val('purchaseTotal'),seller:val('purchaseSeller'),notes:val('purchaseNotes')};
    const purchAmt=parseFloat(rec.total)||0;
    if(eid){
      const old=state.purchases.find(x=>x.id===eid);const oldAmt=parseFloat(old?.total)||0;
      state.purchases[state.purchases.findIndex(x=>x.id===eid)]=rec;
      if(purchAmt!==oldAmt)addWalletTx('purchase',`Purchase edit: ${rec.item}`,-(purchAmt-oldAmt));
      logActivity(`✏️ Updated purchase: ${rec.item}`);
    }else{
      state.purchases.push(rec);
      if(purchAmt>0){addWalletTx('purchase',`Purchase: ${rec.item}`,-purchAmt);logActivity(`🛒 Purchase: ${rec.item} → -${fmt$(purchAmt)}`)}
      else logActivity(`🛒 Purchase logged: ${rec.item}`);
    }
    closeModal('purchaseModal');renderPurchases();updateDashStats();saveState(true);showToast(`✅ Purchase saved! -${fmt$(purchAmt)} deducted.`,'warning');
  });

  // Animals
  onBtn('addAnimalBtn',()=>{resetForm('animalForm');setEl_val('animalId','');openModal('animalModal')});
  document.getElementById('animalForm').addEventListener('submit',e=>{
    e.preventDefault();
    const id=val('animalId');
    const rec={id:id||uid(),type:val('animalType'),name:val('animalName'),count:val('animalCount'),pen:val('animalPen'),feed:val('animalFeed'),prod:val('animalProd'),value:val('animalValue'),notes:val('animalNotes')};
    if(id){state.animals[state.animals.findIndex(x=>x.id===id)]=rec;logActivity(`✏️ Updated animal: ${rec.name}`)}
    else{state.animals.push(rec);logActivity(`🐄 Added: ${rec.type} – ${rec.name} (${rec.count})`)}
    closeModal('animalModal');renderAnimals();updateDashStats();saveState(true);showToast(`Animal "${rec.name}" saved!`);
  });

  // Farm Name
  document.getElementById('farmNameForm').addEventListener('submit',e=>{
    e.preventDefault();
    state.farmName=val('farmNameInput')||'My Farm';
    state.season=val('seasonSelect');
    state.year=parseInt(val('yearInput'))||1;
    closeModal('farmNameModal');updateDashStats();saveState(true);showToast('Farm info updated!');
  });

  // Finances
  document.getElementById('financeForm').addEventListener('submit',e=>{
    e.preventDefault();
    const rec={id:uid(),date:val('finDate'),type:val('finType'),cat:val('finCategory'),amount:val('finAmount'),desc:val('finDesc')};
    state.finances.push(rec);
    logActivity(`💵 Finance: ${rec.cat} – ${fmt$(rec.amount)} (${rec.type})`);
    document.getElementById('financeForm').reset();setTodayDates();
    renderFinances();updateDashStats();renderFinanceCharts();saveState(true);showToast('Finance entry added!');
  });
}

// ---------- RENDER FIELDS ----------
function renderFields(){
  const tbody=document.getElementById('fieldTableBody');
  setEl('fieldCount',state.fields.length);
  if(!state.fields.length){tbody.innerHTML='<tr><td colspan="9" class="empty-row"><i class="fa fa-seedling"></i> No fields added yet.</td></tr>';return}
  tbody.innerHTML=state.fields.map((f,i)=>`
    <tr><td style="color:var(--text2)">${i+1}</td><td><strong>${esc(f.name)}</strong></td><td>${f.ha} ha</td><td>${esc(f.crop)}</td>
    <td>${statusBadge(f.status)}</td><td>${soilBadge(f.soil)}</td>
    <td>${f.hired==='Yes'?'<span class="badge badge-green">Yes</span>':'<span class="badge badge-gray">No</span>'}</td>
    <td class="td-notes">${esc(f.notes)||'—'}</td>
    <td><div class="table-actions">
      <button class="btn btn-outline btn-icon btn-xs" onclick="editField('${f.id}')"><i class="fa fa-pen"></i></button>
      <button class="btn btn-danger btn-icon btn-xs" onclick="deleteField('${f.id}')"><i class="fa fa-trash"></i></button>
    </div></td></tr>`).join('');
}
function editField(id){
  const f=state.fields.find(x=>x.id===id);if(!f)return;
  setEl_val('fieldId',f.id);setEl_val('fieldName',f.name);setEl_val('fieldHa',f.ha);
  setEl_val('fieldCrop',f.crop);setEl_val('fieldStatus',f.status);setEl_val('fieldSoil',f.soil);
  setEl_val('fieldHired',f.hired);setEl_val('fieldNotes',f.notes);
  document.getElementById('fieldModalTitle').innerHTML='<i class="fa fa-pen"></i> Edit Field';
  openModal('fieldModal');
}
function deleteField(id){
  const f=state.fields.find(x=>x.id===id);
  confirmDelete(()=>{state.fields=state.fields.filter(x=>x.id!==id);logActivity(`🗑️ Deleted field: ${f?.name}`);renderFields();updateDashStats();saveState(true);showToast('Field deleted.','warning')});
}

// ---------- RENDER EQUIPMENT ----------
function renderEquipment(){
  const tbody=document.getElementById('equipTableBody');
  setEl('equipCount',state.equipment.length);
  if(!state.equipment.length){tbody.innerHTML='<tr><td colspan="9" class="empty-row"><i class="fa fa-tractor"></i> No equipment added yet.</td></tr>';return}
  tbody.innerHTML=state.equipment.map(eq=>`
    <tr><td><strong>${esc(eq.name)}</strong></td><td>${esc(eq.type)}</td><td>${esc(eq.brand)||'—'}</td>
    <td>${eq.price?fmt$(eq.price):'—'}</td><td>${eq.date||'—'}</td><td>${condBadge(eq.condition)}</td>
    <td>${esc(eq.field)||'—'}</td><td class="td-notes">${esc(eq.notes)||'—'}</td>
    <td><div class="table-actions">
      <button class="btn btn-outline btn-icon btn-xs" onclick="editEquip('${eq.id}')"><i class="fa fa-pen"></i></button>
      <button class="btn btn-danger btn-icon btn-xs" onclick="deleteEquip('${eq.id}')"><i class="fa fa-trash"></i></button>
    </div></td></tr>`).join('');
}
function editEquip(id){
  const eq=state.equipment.find(x=>x.id===id);if(!eq)return;
  ['equipId','equipName','equipType','equipBrand','equipPrice','equipDate','equipCondition','equipField','equipNotes'].forEach(k=>{
    const prop=k.replace('equip','').toLowerCase();setEl_val(k,eq[prop]??'');
  });
  setEl_val('equipId',eq.id);
  document.getElementById('equipModalTitle').innerHTML='<i class="fa fa-pen"></i> Edit Equipment';
  openModal('equipModal');
}
function deleteEquip(id){
  const eq=state.equipment.find(x=>x.id===id);
  confirmDelete(()=>{state.equipment=state.equipment.filter(x=>x.id!==id);logActivity(`🗑️ Deleted equipment: ${eq?.name}`);renderEquipment();updateDashStats();saveState(true);showToast('Equipment deleted.','warning')});
}

// ---------- RENDER HARVESTS ----------
function renderHarvests(){
  const g={grain:0,canola:0,corn:0,grass:0,root:0,other:0};
  state.harvests.forEach(h=>{const a=+h.amount||0;if(['Wheat','Barley','Oat'].includes(h.crop))g.grain+=a;else if(['Canola','Sunflower'].includes(h.crop))g.canola+=a;else if(['Corn','Soybeans'].includes(h.crop))g.corn+=a;else if(['Grass','Hay','Silage'].includes(h.crop))g.grass+=a;else if(['Potatoes','Sugar Beet','Cotton'].includes(h.crop))g.root+=a;else g.other+=a});
  setEl('harvestGrain',fmtN(g.grain)+' L');setEl('harvestCanola',fmtN(g.canola)+' L');
  setEl('harvestCorn',fmtN(g.corn)+' L');setEl('harvestGrass',fmtN(g.grass)+' L');
  setEl('harvestRoot',fmtN(g.root)+' L');setEl('harvestOther',fmtN(g.other)+' L');
  const tbody=document.getElementById('harvestTableBody');
  if(!state.harvests.length){tbody.innerHTML='<tr><td colspan="

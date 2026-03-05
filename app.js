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
  if(!state.harvests.length){tbody.innerHTML='<tr><td colspan="8" class="empty-row"><i class="fa fa-wheat-awn"></i> No harvests logged yet.</td></tr>';return}
  tbody.innerHTML=state.harvests.map(h=>`
    <tr><td>${h.date||'—'}</td><td>${esc(h.field)}</td><td>${esc(h.crop)}</td>
    <td>${fmtN(+h.amount||0)} L</td><td>${qualityBadge(h.quality)}</td>
    <td>${h.sold==='Yes'?'<span class="badge badge-green">Yes</span>':'<span class="badge badge-gray">No</span>'}</td>
    <td class="td-notes">${esc(h.notes)||'—'}</td>
    <td><div class="table-actions">
      <button class="btn btn-outline btn-icon btn-xs" onclick="editHarvest('${h.id}')"><i class="fa fa-pen"></i></button>
      <button class="btn btn-danger btn-icon btn-xs" onclick="deleteHarvest('${h.id}')"><i class="fa fa-trash"></i></button>
    </div></td></tr>`).join('');
}
function editHarvest(id){
  const h=state.harvests.find(x=>x.id===id);if(!h)return;
  setEl_val('harvestId',h.id);setEl_val('harvestDate',h.date);setEl_val('harvestField',h.field);
  setEl_val('harvestCrop',h.crop);setEl_val('harvestAmount',h.amount);setEl_val('harvestQuality',h.quality);
  setEl_val('harvestSold',h.sold);setEl_val('harvestNotes',h.notes);
  document.getElementById('harvestModalTitle').innerHTML='<i class="fa fa-pen"></i> Edit Harvest';
  openModal('harvestModal');
}
function deleteHarvest(id){
  const h=state.harvests.find(x=>x.id===id);
  confirmDelete(()=>{state.harvests=state.harvests.filter(x=>x.id!==id);logActivity('🗑️ Deleted harvest');renderHarvests();updateDashStats();saveState(true);showToast('Harvest deleted.','warning')});
}

// ---------- RENDER SALES ----------
function renderSales(){
  const tbody=document.getElementById('salesTableBody');
  const total=state.sales.reduce((s,x)=>s+(+x.total||0),0);
  setEl('totalSalesRevenue',fmt$(total));
  setEl('totalSalesCount',state.sales.length);
  if(!state.sales.length){tbody.innerHTML='<tr><td colspan="9" class="empty-row"><i class="fa fa-dollar-sign"></i> No sales logged yet.</td></tr>';return}
  tbody.innerHTML=state.sales.map(s=>`
    <tr><td>${s.date||'—'}</td><td><strong>${esc(s.item)}</strong></td><td>${esc(s.cat)}</td>
    <td>${s.amt?fmtN(+s.amt)+' L':'—'}</td><td>${s.ppu?fmt$(s.ppu):'—'}</td>
    <td style="color:var(--green);font-weight:700">${fmt$(s.total)}</td>
    <td>${esc(s.buyer)||'—'}</td><td class="td-notes">${esc(s.notes)||'—'}</td>
    <td><div class="table-actions">
      <button class="btn btn-outline btn-icon btn-xs" onclick="editSale('${s.id}')"><i class="fa fa-pen"></i></button>
      <button class="btn btn-danger btn-icon btn-xs" onclick="deleteSale('${s.id}')"><i class="fa fa-trash"></i></button>
    </div></td></tr>`).join('');
}
function editSale(id){
  const s=state.sales.find(x=>x.id===id);if(!s)return;
  setEl_val('saleId',s.id);setEl_val('saleDate',s.date);setEl_val('saleItem',s.item);
  setEl_val('saleCat',s.cat);setEl_val('saleAmt',s.amt);setEl_val('salePPU',s.ppu);
  setEl_val('saleTotal',s.total);setEl_val('saleBuyer',s.buyer);setEl_val('saleNotes',s.notes);
  document.getElementById('saleModalTitle').innerHTML='<i class="fa fa-pen"></i> Edit Sale';
  openModal('saleModal');
}
function deleteSale(id){
  const s=state.sales.find(x=>x.id===id);
  confirmDelete(()=>{
    const amt=parseFloat(s?.total)||0;
    if(amt>0)addWalletTx('sale',`Sale deleted: ${s?.item}`,-amt);
    state.sales=state.sales.filter(x=>x.id!==id);
    logActivity(`🗑️ Deleted sale: ${s?.item}`);
    renderSales();updateDashStats();saveState(true);showToast('Sale deleted.','warning');
  });
}

// ---------- RENDER PURCHASES ----------
function renderPurchases(){
  const tbody=document.getElementById('purchaseTableBody');
  const total=state.purchases.reduce((s,x)=>s+(+x.total||0),0);
  setEl('totalPurchasesSpent',fmt$(total));
  setEl('totalPurchasesCount',state.purchases.length);
  if(!state.purchases.length){tbody.innerHTML='<tr><td colspan="9" class="empty-row"><i class="fa fa-shopping-cart"></i> No purchases logged yet.</td></tr>';return}
  tbody.innerHTML=state.purchases.map(p=>`
    <tr><td>${p.date||'—'}</td><td><strong>${esc(p.item)}</strong></td><td>${esc(p.cat)}</td>
    <td>${p.qty||'—'}</td><td>${p.uc?fmt$(p.uc):'—'}</td>
    <td style="color:var(--red);font-weight:700">${fmt$(p.total)}</td>
    <td>${esc(p.seller)||'—'}</td><td class="td-notes">${esc(p.notes)||'—'}</td>
    <td><div class="table-actions">
      <button class="btn btn-outline btn-icon btn-xs" onclick="editPurchase('${p.id}')"><i class="fa fa-pen"></i></button>
      <button class="btn btn-danger btn-icon btn-xs" onclick="deletePurchase('${p.id}')"><i class="fa fa-trash"></i></button>
    </div></td></tr>`).join('');
}
function editPurchase(id){
  const p=state.purchases.find(x=>x.id===id);if(!p)return;
  setEl_val('purchaseId',p.id);setEl_val('purchaseDate',p.date);setEl_val('purchaseItem',p.item);
  setEl_val('purchaseCat',p.cat);setEl_val('purchaseQty',p.qty);setEl_val('purchaseUC',p.uc);
  setEl_val('purchaseTotal',p.total);setEl_val('purchaseSeller',p.seller);setEl_val('purchaseNotes',p.notes);
  document.getElementById('purchaseModalTitle').innerHTML='<i class="fa fa-pen"></i> Edit Purchase';
  openModal('purchaseModal');
}
function deletePurchase(id){
  const p=state.purchases.find(x=>x.id===id);
  confirmDelete(()=>{
    const amt=parseFloat(p?.total)||0;
    if(amt>0)addWalletTx('purchase',`Purchase deleted: ${p?.item}`,amt);
    state.purchases=state.purchases.filter(x=>x.id!==id);
    logActivity(`🗑️ Deleted purchase: ${p?.item}`);
    renderPurchases();updateDashStats();saveState(true);showToast('Purchase deleted.','warning');
  });
}

// ---------- RENDER FINANCES ----------
function renderFinances(){
  const tbody=document.getElementById('financeTableBody');
  const income=state.finances.filter(f=>f.type==='income').reduce((s,f)=>s+(+f.amount||0),0);
  const expenses=state.finances.filter(f=>f.type==='expense').reduce((s,f)=>s+(+f.amount||0),0);
  setEl('finTotalIncome',fmt$(income));
  setEl('finTotalExpenses',fmt$(expenses));
  const npEl=document.getElementById('finNetProfit');
  if(npEl){const net=income-expenses;npEl.textContent=fmt$(net);npEl.style.color=net>=0?'var(--green)':'var(--red)'}
  if(!state.finances.length){tbody.innerHTML='<tr><td colspan="6" class="empty-row">No entries yet.</td></tr>';return}
  tbody.innerHTML=[...state.finances].reverse().map(f=>`
    <tr>
    <td>${f.date||'—'}</td>
    <td>${f.type==='income'?'<span class="badge badge-green">Income</span>':'<span class="badge badge-red">Expense</span>'}</td>
    <td>${esc(f.cat)}</td>
    <td style="font-weight:700;color:${f.type==='income'?'var(--green)':'var(--red)'}">${f.type==='income'?'+':'−'}${fmt$(f.amount)}</td>
    <td class="td-notes">${esc(f.desc)||'—'}</td>
    <td><button class="btn btn-danger btn-icon btn-xs" onclick="deleteFinance('${f.id}')"><i class="fa fa-trash"></i></button></td>
    </tr>`).join('');
}
function deleteFinance(id){
  confirmDelete(()=>{state.finances=state.finances.filter(x=>x.id!==id);renderFinances();renderFinanceCharts();saveState(true);showToast('Entry deleted.','warning')});
}
function renderFinanceCharts(){
  const expenses=state.finances.filter(f=>f.type==='expense');
  const catTotals={};
  expenses.forEach(f=>{catTotals[f.cat]=(catTotals[f.cat]||0)+(+f.amount||0)});
  const labels=Object.keys(catTotals);
  const data=Object.values(catTotals);
  const colors=['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6','#a3e635','#6b7280','#84cc16'];
  const ctx=document.getElementById('expenseChart');
  if(!ctx)return;
  if(expChart)expChart.destroy();
  if(!labels.length){expChart=null;return}
  expChart=new Chart(ctx,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors.slice(0,labels.length),borderWidth:2}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{color:'#94a3b8',font:{size:11}}}}}});
}

// ---------- RENDER ANIMALS ----------
function renderAnimals(){
  const tbody=document.getElementById('animalTableBody');
  setEl('animalCount',state.animals.length);
  if(!state.animals.length){tbody.innerHTML='<tr><td colspan="9" class="empty-row"><i class="fa fa-horse"></i> No animals added yet.</td></tr>';return}
  tbody.innerHTML=state.animals.map(a=>`
    <tr><td>${esc(a.type)}</td><td><strong>${esc(a.name)}</strong></td><td>${a.count||1}</td>
    <td>${esc(a.pen)||'—'}</td><td>${feedBadge(a.feed)}</td>
    <td>${esc(a.prod)||'—'}</td><td>${a.value?fmt$(a.value):'—'}</td>
    <td class="td-notes">${esc(a.notes)||'—'}</td>
    <td><div class="table-actions">
      <button class="btn btn-outline btn-icon btn-xs" onclick="editAnimal('${a.id}')"><i class="fa fa-pen"></i></button>
      <button class="btn btn-danger btn-icon btn-xs" onclick="deleteAnimal('${a.id}')"><i class="fa fa-trash"></i></button>
    </div></td></tr>`).join('');
}
function editAnimal(id){
  const a=state.animals.find(x=>x.id===id);if(!a)return;
  setEl_val('animalId',a.id);setEl_val('animalType',a.type);setEl_val('animalName',a.name);
  setEl_val('animalCount',a.count);setEl_val('animalPen',a.pen);setEl_val('animalFeed',a.feed);
  setEl_val('animalProd',a.prod);setEl_val('animalValue',a.value);setEl_val('animalNotes',a.notes);
  document.getElementById('animalModalTitle').innerHTML='<i class="fa fa-pen"></i> Edit Animal';
  openModal('animalModal');
}
function deleteAnimal(id){
  const a=state.animals.find(x=>x.id===id);
  confirmDelete(()=>{state.animals=state.animals.filter(x=>x.id!==id);logActivity(`🗑️ Deleted animal: ${a?.name}`);renderAnimals();updateDashStats();saveState(true);showToast('Animal deleted.','warning')});
}

// ---------- FINANCE BAR CHART (DASHBOARD) ----------
function renderFinanceBarChart(){
  const ctx=document.getElementById('financeChart');
  if(!ctx)return;
  const income=state.finances.filter(f=>f.type==='income').reduce((s,f)=>s+(+f.amount||0),0);
  const expenses=state.finances.filter(f=>f.type==='expense').reduce((s,f)=>s+(+f.amount||0),0);
  const salesIncome=state.sales.reduce((s,x)=>s+(+x.total||0),0);
  const purchExpense=state.purchases.reduce((s,x)=>s+(+x.total||0),0);
  const totalIncome=income+salesIncome;
  const totalExpense=expenses+purchExpense;
  const net=totalIncome-totalExpense;
  if(finChart)finChart.destroy();
  finChart=new Chart(ctx,{
    type:'bar',
    data:{
      labels:['Income','Expenses','Net'],
      datasets:[{data:[totalIncome,totalExpense,net],backgroundColor:['rgba(34,197,94,0.8)','rgba(239,68,68,0.8)',net>=0?'rgba(59,130,246,0.8)':'rgba(239,68,68,0.5)'],borderRadius:6,borderWidth:0}]
    },
    options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>'$'+fmtN(v),color:'#94a3b8'},grid:{color:'rgba(255,255,255,0.05)'}},x:{ticks:{color:'#94a3b8'},grid:{display:false}}}}
  });
}

// ---------- RENDER ALL ----------
function renderAll(){
  updateDashStats();
  renderWallet();
  renderFields();
  renderEquipment();
  renderHarvests();
  renderSales();
  renderPurchases();
  renderFinances();
  renderAnimals();
  renderActivity();
}

// ---------- QUICK ACTION HANDLERS ----------
const MODAL_OPEN_DELAY=200;
function quickNavWallet(){navigateTo('wallet')}
function quickNavEquipment(){navigateTo('equipment');setTimeout(()=>document.getElementById('addEquipBtn').click(),MODAL_OPEN_DELAY)}
function quickNavSales(){navigateTo('sales');setTimeout(()=>document.getElementById('addSaleBtn').click(),MODAL_OPEN_DELAY)}
function quickNavPurchases(){navigateTo('purchases');setTimeout(()=>document.getElementById('addPurchaseBtn').click(),MODAL_OPEN_DELAY)}
function quickNavCrops(){navigateTo('crops');setTimeout(()=>document.getElementById('addHarvestBtn').click(),MODAL_OPEN_DELAY)}
function quickNavAnimals(){navigateTo('animals');setTimeout(()=>document.getElementById('addAnimalBtn').click(),MODAL_OPEN_DELAY)}

// ---------- UTILITIES ----------
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function val(id){const el=document.getElementById(id);return el?el.value:''}
function setEl(id,txt){const el=document.getElementById(id);if(el)el.textContent=txt}
function setEl_val(id,v){const el=document.getElementById(id);if(el)el.value=v??''}
function fmt$(n){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(+n||0)}
function fmtN(n){return new Intl.NumberFormat('en-US').format(Math.round(+n||0))}
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function onBtn(id,fn){const el=document.getElementById(id);if(el)el.addEventListener('click',fn)}
function resetForm(id){const el=document.getElementById(id);if(el)el.reset()}
function statusBadge(s){
  const m={Plowed:'badge-blue',Cultivated:'badge-blue',Seeded:'badge-blue',Fertilized:'badge-purple',Growing:'badge-green','Ready to Harvest':'badge-yellow',Harvested:'badge-emerald',Fallow:'badge-gray'};
  return'<span class="badge '+(m[s]||'badge-gray')+'">'+(s||'—')+'</span>'}
function soilBadge(s){
  const m={Poor:'badge-red',Average:'badge-yellow',Good:'badge-green',Excellent:'badge-emerald'};
  return'<span class="badge '+(m[s]||'badge-gray')+'">'+(s||'—')+'</span>'}
function condBadge(s){
  const m={New:'badge-emerald',Good:'badge-green',Fair:'badge-yellow','Needs Repair':'badge-red'};
  return'<span class="badge '+(m[s]||'badge-gray')+'">'+(s||'—')+'</span>'}
function qualityBadge(s){
  const m={Low:'badge-red',Average:'badge-blue',Good:'badge-green',Excellent:'badge-emerald'};
  return'<span class="badge '+(m[s]||'badge-gray')+'">'+(s||'—')+'</span>'}
function feedBadge(s){
  const m={Full:'badge-green',Half:'badge-yellow',Low:'badge-orange',Empty:'badge-red'};
  return'<span class="badge '+(m[s]||'badge-gray')+'">'+(s||'—')+'</span>'}

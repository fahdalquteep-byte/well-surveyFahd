const DB='wells_survey_v1', STORE='forms';let currentId=null;
const sections=[...new Set(FIELD_DEFS.map(x=>x.section))];
function openDB(){return new Promise((res,rej)=>{let r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function all(){let d=await openDB();return new Promise((res,rej)=>{let q=d.transaction(STORE).objectStore(STORE).getAll();q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
async function put(x){let d=await openDB();return new Promise((res,rej)=>{let q=d.transaction(STORE,'readwrite').objectStore(STORE).put(x);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}
async function del(id){let d=await openDB();return new Promise((res,rej)=>{let q=d.transaction(STORE,'readwrite').objectStore(STORE).delete(id);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}
const $=id=>document.getElementById(id);
function toast(t){$('toast').textContent=t;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',1800)}
function renderForm(data={}){
 const f=$('form');f.innerHTML='';
 for(const s of sections){let sec=document.createElement('div');sec.className='section';sec.innerHTML='<h3>'+s+'</h3><div class="grid"></div>';let g=sec.querySelector('.grid');
 FIELD_DEFS.filter(x=>x.section===s).forEach(d=>{let w=document.createElement('div');w.className='field';
 let v=data[d.id]??''; if(d.type==='multi'){let opts=d.options.map(o=>`<label class="check"><input type="checkbox" data-id="${d.id}" value="${o}" ${(Array.isArray(v)&&v.includes(o))?'checked':''}>${o}</label>`).join('');w.innerHTML=`<label>${d.label}</label><div class="checks">${opts}</div>`}
 else if(d.type==='select'){w.innerHTML=`<label>${d.label}</label><select data-id="${d.id}"><option value="">اختر…</option>${d.options.map(o=>`<option ${v===o?'selected':''}>${o}</option>`).join('')}</select>`}
 else {w.innerHTML=`<label>${d.label}</label><input data-id="${d.id}" type="${d.type}" value="${v}" ${d.readonly?'readonly':''}>`}
 g.appendChild(w)});f.appendChild(sec)}
 f.querySelector('[data-id="panels"]')?.addEventListener('input',calc);f.querySelector('[data-id="panel_power"]')?.addEventListener('input',calc);calc()
}
function calc(){let a=parseFloat(document.querySelector('[data-id="panels"]')?.value||0),b=parseFloat(document.querySelector('[data-id="panel_power"]')?.value||0),x=document.querySelector('[data-id="total_panel_power"]');if(x)x.value=(a&&b?a*b:'')}
function readForm(){let x={};FIELD_DEFS.forEach(d=>{if(d.type==='multi')x[d.id]=[...document.querySelectorAll(`input[data-id="${d.id}"]:checked`)].map(e=>e.value);else{x[d.id]=document.querySelector(`[data-id="${d.id}"]`)?.value||''}});return x}
function showEditor(data={},id=null){currentId=id;$('editor').classList.remove('hidden');$('list').classList.add('hidden');$('editorTitle').textContent=id?'تعديل الاستمارة':'استمارة جديدة';renderForm(data);scrollTo(0,0)}
async function save(){let x=readForm();x.id=currentId||crypto.randomUUID();x.updated=new Date().toISOString();await put(x);currentId=x.id;toast('تم حفظ الاستمارة بنجاح');renderList();$('editor').classList.add('hidden');$('list').classList.remove('hidden')}
async function renderList(){let arr=await all(),q=$('search').value.trim().toLowerCase();arr=arr.filter(x=>!q||Object.values(x).join(' ').toLowerCase().includes(q));$('list').innerHTML=arr.sort((a,b)=>(b.updated||'').localeCompare(a.updated||'')).map(x=>`<article class="card" data-id="${x.id}"><h3>${x.form_no||'بدون رقم استمارة'}</h3><div>${x.site_name||x.address||'موقع غير محدد'}</div><div class="muted">${x.owner||'بدون مالك'} — ${x.survey_date||''}</div></article>`).join('')||'<p class="muted">لا توجد استمارات محفوظة. اضغط «استمارة جديدة» للبدء.</p>';document.querySelectorAll('.card').forEach(c=>c.onclick=async()=>{let a=(await all()).find(x=>x.id===c.dataset.id);showEditor(a,a.id)})}
async function exportCSV(){let arr=await all();if(!arr.length){toast('لا توجد بيانات للتصدير');return}let headers=FIELD_DEFS.map(x=>x.label);let rows=arr.map(x=>FIELD_DEFS.map(d=>Array.isArray(x[d.id])?x[d.id].join('، '):(x[d.id]??'')));let csv='\ufeff'+[headers,...rows].map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='استمارات_مسح_الابار.csv';a.click()}
$('newBtn').onclick=()=>showEditor();$('closeBtn').onclick=()=>{$('editor').classList.add('hidden');$('list').classList.remove('hidden')};$('saveBtn').onclick=e=>{e.preventDefault();save()};$('deleteBtn').onclick=async()=>{if(currentId&&confirm('هل تريد حذف الاستمارة؟')){await del(currentId);$('closeBtn').click();renderList();toast('تم الحذف')}};$('search').oninput=renderList;$('exportAll').onclick=exportCSV;renderList();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');

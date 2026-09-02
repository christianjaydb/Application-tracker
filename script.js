/* ============ STATE ============ */
let jobs = [
  {id:1, position:"Frontend Developer", company:"Northgate Systems", location:"Makati City", salary:35000, status:"Interview", appliedDate:"2026-07-18", interviewDate:"2026-08-12", notes:"Panel interview w/ Eng Lead Marco T. Focus on React + component architecture.", file:"resume_cj_frontend.pdf"},
  {id:2, position:"Junior Data Analyst", company:"Meridian Insights", location:"Remote", salary:32000, status:"Assessment", appliedDate:"2026-07-25", interviewDate:"", notes:"Take-home SQL + dashboard exercise due Friday.", file:"resume_cj_data.pdf"},
  {id:3, position:"IT Support Specialist", company:"BlueRock BPO", location:"Lipa City", salary:24000, status:"Applied", appliedDate:"2026-08-02", interviewDate:"", notes:"", file:""},
  {id:4, position:"Software QA Tester", company:"Ferrum Digital", location:"Batangas City", salary:28000, status:"Applied", appliedDate:"2026-08-05", interviewDate:"", notes:"Referred by former TESDA batchmate.", file:"resume_cj_qa.pdf"},
  {id:5, position:"Full Stack Developer Intern", company:"Ironclad Labs", location:"Remote", salary:15000, status:"Offer", appliedDate:"2026-06-30", interviewDate:"2026-07-20", notes:"Offer received — 3 days to respond. Compare against Northgate.", file:"resume_cj_fullstack.pdf"},
  {id:6, position:"UI/UX Designer", company:"Solace Studio", location:"Quezon City", salary:30000, status:"Rejected", appliedDate:"2026-06-15", interviewDate:"", notes:"Portfolio was strong but they hired someone with Figma dev-handoff experience.", file:""},
  {id:7, position:"Systems Administrator Trainee", company:"Anvilcore Networks", location:"Lipa City", salary:26000, status:"Interview", appliedDate:"2026-07-29", interviewDate:"2026-08-10", notes:"Technical interview — review subnetting & Active Directory basics.", file:"resume_cj_sysadmin.pdf"},
  {id:8, position:"Web Developer", company:"Granite & Co.", location:"Remote", salary:33000, status:"Applied", appliedDate:"2026-08-07", interviewDate:"", notes:"", file:""}
];
const STORAGE_KEY = "trajectory_jobs_v1";

// The artifact storage API (window.storage) only exists when this page is
// rendered live inside Claude's own artifact panel. If it's missing —
// e.g. the file was downloaded and opened directly in a browser — fall
// back to localStorage so the tracker still works and saves within that
// browser/profile.
const hasArtifactStorage = (typeof window !== "undefined")
  && window.storage
  && typeof window.storage.get === "function"
  && typeof window.storage.set === "function";

async function loadState(){
  try{
    if(hasArtifactStorage){
      const saved = await window.storage.get(STORAGE_KEY, false);
      if(saved && saved.value){
        applyLoadedState(saved.value);
      }
    } else {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) applyLoadedState(raw);
    }
  }catch(e){
    // Key doesn't exist yet (first run) or fetch failed — fall back to defaults.
    console.warn("Could not load saved applications, using defaults.", e);
  }
}
function applyLoadedState(raw){
  const parsed = JSON.parse(raw);
  if(parsed && Array.isArray(parsed.jobs)){
    jobs = parsed.jobs;
    nextId = parsed.nextId || (jobs.reduce((m,j)=>Math.max(m,j.id||0),0) + 1);
  }
}
async function saveState(){
  const payload = JSON.stringify({jobs, nextId});
  try{
    if(hasArtifactStorage){
      const result = await window.storage.set(STORAGE_KEY, payload, false);
      return !!result;
    } else {
      localStorage.setItem(STORAGE_KEY, payload);
      return true;
    }
  }catch(e){
    console.warn("Could not save applications.", e);
    return false;
  }
}

let nextId = 9;
let editingId = null;
let selectedFileName = "";
let calRefDate = new Date();
let draggedJobId = null;
let firstGaugeRender = true;

const STATUS_KEY = {Applied:"applied", Assessment:"assessment", Interview:"interview", Offer:"offer", Rejected:"rejected"};
const STATUS_COLOR_VAR = {Applied:"--st-applied", Assessment:"--st-assessment", Interview:"--st-interview", Offer:"--st-offer", Rejected:"--st-rejected"};

/* ============ LOAD CURTAIN / SCROLL LOCK ============ */
(function(){
  const html = document.documentElement;
  const curtain = document.querySelector(".load-curtain");
  const unlock = () => html.classList.remove("is-loading");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(!curtain || prefersReducedMotion){
    unlock();
  } else {
    curtain.addEventListener("animationend", unlock, {once:true});
    // Safety net in case the animationend event doesn't fire for some reason
    setTimeout(unlock, 1300);
  }
})();

/* ============ NAV ============ */
document.querySelectorAll(".nav-item").forEach(item=>{
  item.addEventListener("click", ()=>{
    document.querySelectorAll(".nav-item").forEach(i=>i.classList.remove("active"));
    item.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
    document.getElementById("tab-"+item.dataset.tab).classList.add("active");
    if(item.dataset.tab==="calendar") renderCalendar();
    if(item.dataset.tab==="dashboard") renderGauges();
  });
});

/* ============ TOASTS ============ */
function showToast(msg, isErr){
  const zone = document.getElementById("toastZone");
  const t = document.createElement("div");
  t.className = "toast" + (isErr?" err":"");
  t.innerHTML = isErr
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg><span>${msg}</span>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg><span>${msg}</span>`;
  zone.appendChild(t);
  setTimeout(()=>{
    t.style.animation = "toastOut .3s var(--ease) forwards";
    setTimeout(()=>t.remove(), 300);
  }, 2600);
}

/* ============ HELPERS ============ */
function fmtMoney(v){ return "₱" + Number(v||0).toLocaleString(); }
function fmtDate(d){
  if(!d) return "—";
  const dt = new Date(d+"T00:00:00");
  return dt.toLocaleDateString("en-US",{month:"short", day:"numeric", year:"numeric"});
}
function daysUntil(d){
  if(!d) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const dt = new Date(d+"T00:00:00");
  return Math.round((dt-today)/86400000);
}
function daysAgo(d){
  if(!d) return 999;
  const today = new Date(); today.setHours(0,0,0,0);
  const dt = new Date(d+"T00:00:00");
  return Math.round((today-dt)/86400000);
}

/* ============ ALERT BANNER ============ */
function renderAlerts(){
  const zone = document.getElementById("alertZone");
  const upcoming = jobs.filter(j=>j.interviewDate && daysUntil(j.interviewDate)!==null && daysUntil(j.interviewDate)>=0 && daysUntil(j.interviewDate)<=3);
  if(upcoming.length===0){ zone.innerHTML=""; return; }
  upcoming.sort((a,b)=> daysUntil(a.interviewDate)-daysUntil(b.interviewDate));
  const soonest = upcoming[0];
  const du = daysUntil(soonest.interviewDate);
  const when = du===0? "today" : du===1? "tomorrow" : `in ${du} days`;
  const extra = upcoming.length>1 ? ` (+${upcoming.length-1} more this week)` : "";
  zone.innerHTML = `
    <div class="alert-banner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
      <div><strong>Interview reminder:</strong> ${soonest.position} at ${soonest.company} is ${when}${extra}.</div>
    </div>`;
}

/* ============ DASHBOARD: GAUGES ============ */
function animateNumber(el, target, isPercent){
  const start = 0;
  const dur = 700;
  const t0 = performance.now();
  function tick(now){
    const p = Math.min(1, (now-t0)/dur);
    const eased = 1 - Math.pow(1-p, 3);
    const val = Math.round(start + (target-start)*eased);
    el.textContent = isPercent ? val+"%" : val;
    if(p<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderGauges(){
  const total = jobs.length;
  const active = jobs.filter(j=>!["Offer","Rejected"].includes(j.status)).length;
  const interviewed = jobs.filter(j=>["Interview","Offer","Rejected"].includes(j.status)).length;
  const offers = jobs.filter(j=>j.status==="Offer").length;
  const interviewRate = total? Math.round((interviewed/total)*100):0;
  const offerRate = total? Math.round((offers/total)*100):0;
  const activeRate = total? Math.round((active/total)*100):0;
  const thisWeek = jobs.filter(j=>daysAgo(j.appliedDate)<=7).length;

  const data = [
    {label:"Total Applications", num:total, pct:100, color:"var(--signal)", sub:thisWeek? `+${thisWeek} this week` : "All time", isPercent:false, filter:"all"},
    {label:"Active Pipeline", num:active, pct:activeRate, color:"var(--st-assessment)", sub:activeRate+"% of total", isPercent:false, filter:"active"},
    {label:"Interview Rate", num:interviewRate, pct:interviewRate, color:"var(--st-interview)", sub:interviewed+" reached interview", isPercent:true, filter:"Interview"},
    {label:"Offer Rate", num:offerRate, pct:offerRate, color:"var(--st-offer)", sub:offers+" offer(s) received", isPercent:true, filter:"Offer"},
  ];

  const r = 24, c = 2*Math.PI*r;
  document.getElementById("gaugeRow").innerHTML = data.map((d,i)=>`
    <div class="gauge-card" tabindex="0" role="button" aria-label="View ${d.label}" onclick="goToApplications('${d.filter}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goToApplications('${d.filter}');}">
      <div class="gauge-ring">
        <svg viewBox="0 0 58 58">
          <circle class="track" cx="29" cy="29" r="${r}"></circle>
          <circle class="val" cx="29" cy="29" r="${r}" stroke="${d.color}" stroke-dasharray="0 ${c}" data-target="${(d.pct/100)*c}" data-c="${c}" id="ring-${i}"></circle>
        </svg>
        <div class="num mono" id="gnum-${i}">0</div>
      </div>
      <div>
        <div class="gauge-label">${d.label}</div>
        <div class="gauge-sub">${d.sub}</div>
      </div>
    </div>`).join("");

  // animate after paint — on first load, wait for the entry curtain to
  // finish sweeping away so the count-up/ring-fill is actually visible
  // instead of playing behind it; later re-renders animate immediately.
  const delayMs = firstGaugeRender ? 1100 : 0;
  firstGaugeRender = false;
  setTimeout(()=>{
    requestAnimationFrame(()=>{
      data.forEach((d,i)=>{
        const ring = document.getElementById(`ring-${i}`);
        if(!ring) return;
        const dash = (d.pct/100)*c;
        ring.style.strokeDasharray = `${dash} ${c}`;
        animateNumber(document.getElementById(`gnum-${i}`), d.num, d.isPercent);
      });
    });
  }, delayMs);
}

/* ============ GAUGE CARD NAVIGATION ============ */
function goToApplications(filterValue){
  const navItem = document.querySelector('.nav-item[data-tab="applications"]');
  document.querySelectorAll(".nav-item").forEach(i=>i.classList.remove("active"));
  navItem.classList.add("active");
  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
  document.getElementById("tab-applications").classList.add("active");

  document.getElementById("searchInput").value = "";
  document.getElementById("statusFilter").value = filterValue || "all";
  document.getElementById("sortFilter").value = "recent";
  renderApplications();
  window.scrollTo({top:0, behavior:"smooth"});
}

/* ============ EXPORT STATISTICS ============ */
function downloadStats(){
  const total = jobs.length;
  const active = jobs.filter(j=>!["Offer","Rejected"].includes(j.status)).length;
  const interviewed = jobs.filter(j=>["Interview","Offer","Rejected"].includes(j.status)).length;
  const offers = jobs.filter(j=>j.status==="Offer").length;
  const rejected = jobs.filter(j=>j.status==="Rejected").length;
  const interviewRate = total? Math.round((interviewed/total)*100):0;
  const offerRate = total? Math.round((offers/total)*100):0;
  const activeRate = total? Math.round((active/total)*100):0;
  const thisWeek = jobs.filter(j=>daysAgo(j.appliedDate)<=7).length;
  const avgSalary = total? Math.round(jobs.reduce((s,j)=>s+(j.salary||0),0)/total) : 0;

  const statuses = ["Applied","Assessment","Interview","Offer","Rejected"];
  const byStatus = statuses.map(st=> ({st, count: jobs.filter(j=>j.status===st).length}));

  const today = new Date().toISOString().slice(0,10);
  const rows = [
    ["Metric","Value"],
    ["Generated on", today],
    ["Total applications", total],
    ["Applied this week", thisWeek],
    ["Active pipeline", active],
    ["Active pipeline %", activeRate+"%"],
    ["Reached interview", interviewed],
    ["Interview rate", interviewRate+"%"],
    ["Offers received", offers],
    ["Offer rate", offerRate+"%"],
    ["Rejected", rejected],
    ["Average monthly salary", avgSalary],
    [],
    ["Status","Count"],
    ...byStatus.map(s=>[s.st==="Offer"?"Job Offer":s.st, s.count])
  ];

  const csv = rows.map(r=> r.map(v=>{
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(",")).join("\n");

  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trajectory-stats-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Statistics exported");
}

/* ============ DASHBOARD: PIPELINE (drag & drop) ============ */
function renderPipeline(){
  const statuses = ["Applied","Assessment","Interview","Offer","Rejected"];
  const board = document.getElementById("pipelineBoard");
  board.innerHTML = statuses.map(st=>{
    const list = jobs.filter(j=>j.status===st);
    const colorVar = STATUS_COLOR_VAR[st];
    const cards = list.length? list.map(j=>`
      <div class="job-card" draggable="true" data-id="${j.id}" onclick="openJobModal(${j.id})">
        <div class="pos">${escapeHtml(j.position)}</div>
        <div class="co">${escapeHtml(j.company)}</div>
        <div class="meta"><span>${escapeHtml(j.location||"—")}</span><span>${j.salary?fmtMoney(j.salary):""}</span></div>
      </div>`).join("") : `<div class="empty-pipe">Drop here</div>`;
    return `
    <div class="pipe-col" data-status="${st}" style="--st:var(${colorVar})">
      <div class="pipe-head">
        <span class="dot"></span>
        <span class="name">${st==="Offer"?"Job Offer":st}</span>
        <span class="count mono">${list.length}</span>
      </div>
      <div class="pipe-body">${cards}</div>
    </div>`;
  }).join("");

  wireDragAndDrop();
}

function wireDragAndDrop(){
  document.querySelectorAll(".job-card").forEach(card=>{
    card.addEventListener("dragstart", e=>{
      draggedJobId = Number(card.dataset.id);
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", ()=>{
      card.classList.remove("dragging");
      draggedJobId = null;
    });
  });
  document.querySelectorAll(".pipe-col").forEach(col=>{
    col.addEventListener("dragover", e=>{
      e.preventDefault();
      col.classList.add("drag-over");
    });
    col.addEventListener("dragleave", ()=> col.classList.remove("drag-over"));
    col.addEventListener("drop", e=>{
      e.preventDefault();
      col.classList.remove("drag-over");
      if(draggedJobId==null) return;
      const newStatus = col.dataset.status;
      const job = jobs.find(j=>j.id===draggedJobId);
      if(job && job.status!==newStatus){
        const prevStatus = job.status;
        job.status = newStatus;
        renderAll();
        saveState().then(ok=>{
          if(ok){
            showToast(`${job.position} moved to ${newStatus==="Offer"?"Job Offer":newStatus}`);
          } else {
            job.status = prevStatus;
            renderAll();
            showToast("Could not save the move — try again.", true);
          }
        });
      }
    });
  });
}

/* ============ APPLICATIONS TABLE ============ */
function renderApplications(){
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const statusF = document.getElementById("statusFilter").value;
  const sortF = document.getElementById("sortFilter").value;

  let list = jobs.filter(j=>{
    const matchesQ = !q || j.company.toLowerCase().includes(q) || j.position.toLowerCase().includes(q);
    const matchesS = statusF==="all" || (statusF==="active" ? !["Offer","Rejected"].includes(j.status) : j.status===statusF);
    return matchesQ && matchesS;
  });

  if(sortF==="recent") list.sort((a,b)=> new Date(b.appliedDate)-new Date(a.appliedDate));
  if(sortF==="oldest") list.sort((a,b)=> new Date(a.appliedDate)-new Date(b.appliedDate));
  if(sortF==="salary") list.sort((a,b)=> (b.salary||0)-(a.salary||0));
  if(sortF==="company") list.sort((a,b)=> a.company.localeCompare(b.company));

  const body = document.getElementById("appTableBody");
  const empty = document.getElementById("appEmptyState");
  document.getElementById("appCountSub").textContent = `${jobs.length} total application${jobs.length!==1?'s':''} tracked`;
  document.getElementById("navAppCount").textContent = jobs.length;

  if(list.length===0){
    body.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  body.innerHTML = list.map((j,i)=>{
    const key = STATUS_KEY[j.status];
    const label = j.status==="Offer" ? "Job Offer" : j.status;
    return `
    <tr onclick="openJobModal(${j.id})" style="animation:fadeUp .25s var(--ease) both; animation-delay:${Math.min(i*0.03,0.3)}s;">
      <td class="cell-pos" data-label="Position">${escapeHtml(j.position)}</td>
      <td class="cell-co" data-label="Company">${escapeHtml(j.company)}</td>
      <td data-label="Location">${escapeHtml(j.location||"—")}</td>
      <td class="mono" data-label="Salary">${j.salary?fmtMoney(j.salary):"—"}</td>
      <td data-label="Status"><span class="status-pill st-${key}"><span class="dot"></span>${label}</span></td>
      <td class="mono" data-label="Applied">${fmtDate(j.appliedDate)}</td>
    </tr>`;
  }).join("");
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

/* ============ CALENDAR ============ */
function shiftMonth(delta){
  calRefDate.setMonth(calRefDate.getMonth()+delta);
  renderCalendar();
}
function renderCalendar(){
  const year = calRefDate.getFullYear();
  const month = calRefDate.getMonth();
  document.getElementById("calMonthLabel").textContent = calRefDate.toLocaleDateString("en-US",{month:"long", year:"numeric"});

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0,10);

  const interviewDates = {};
  jobs.forEach(j=>{ if(j.interviewDate) interviewDates[j.interviewDate] = (interviewDates[j.interviewDate]||[]).concat(j); });

  let html = ["S","M","T","W","T","F","S"].map(d=>`<div class="cal-dow">${d}</div>`).join("");
  for(let i=0;i<firstDay;i++) html += `<div class="cal-day empty"></div>`;
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr===todayStr;
    const hasEvent = interviewDates[dateStr];
    html += `<div class="cal-day ${isToday?'today':''}" onclick="focusDate('${dateStr}')">${d}${hasEvent?'<span class="mark"></span>':''}</div>`;
  }
  document.getElementById("calGrid").innerHTML = html;

  renderAgenda();
}
function focusDate(dateStr){
  const matches = jobs.filter(j=>j.interviewDate===dateStr);
  if(matches.length) openJobModal(matches[0].id);
}
function renderAgenda(){
  const upcoming = jobs.filter(j=>j.interviewDate).sort((a,b)=> new Date(a.interviewDate)-new Date(b.interviewDate));
  const list = document.getElementById("agendaList");
  if(upcoming.length===0){
    list.innerHTML = `<div class="empty-pipe" style="padding:30px 10px;">No interviews scheduled</div>`;
    return;
  }
  list.innerHTML = upcoming.map(j=>`
    <div class="agenda-item" onclick="openJobModal(${j.id})">
      <div class="date">${fmtDate(j.interviewDate)}</div>
      <div class="title">${escapeHtml(j.position)}</div>
      <div class="co">${escapeHtml(j.company)}</div>
    </div>`).join("");
}

/* ============ MODAL / CRUD ============ */
function openJobModal(id){
  editingId = id || null;
  const overlay = document.getElementById("jobOverlay");
  const deleteBtn = document.getElementById("deleteBtn");
  selectedFileName = "";
  document.getElementById("fileDrop").textContent = "Click to attach a file (PDF, DOCX)";
  document.getElementById("fileDrop").classList.remove("has-file");

  if(id){
    const j = jobs.find(x=>x.id===id);
    document.getElementById("modalTitle").textContent = "Edit Application";
    document.getElementById("f_position").value = j.position;
    document.getElementById("f_company").value = j.company;
    document.getElementById("f_location").value = j.location;
    document.getElementById("f_salary").value = j.salary;
    document.getElementById("f_status").value = j.status;
    document.getElementById("f_appliedDate").value = j.appliedDate;
    document.getElementById("f_interviewDate").value = j.interviewDate;
    document.getElementById("f_notes").value = j.notes;
    if(j.file){
      selectedFileName = j.file;
      document.getElementById("fileDrop").textContent = "📎 " + j.file;
      document.getElementById("fileDrop").classList.add("has-file");
    }
    deleteBtn.classList.remove("hidden");
  } else {
    document.getElementById("modalTitle").textContent = "New Application";
    ["f_position","f_company","f_location","f_salary","f_notes"].forEach(id=>document.getElementById(id).value="");
    document.getElementById("f_status").value = "Applied";
    document.getElementById("f_appliedDate").value = new Date().toISOString().slice(0,10);
    document.getElementById("f_interviewDate").value = "";
    deleteBtn.classList.add("hidden");
  }
  overlay.classList.add("open");
}
function closeJobModal(){
  document.getElementById("jobOverlay").classList.remove("open");
  editingId = null;
}
function handleFileSelect(input){
  if(input.files && input.files[0]){
    selectedFileName = input.files[0].name;
    document.getElementById("fileDrop").textContent = "📎 " + selectedFileName;
    document.getElementById("fileDrop").classList.add("has-file");
  }
}
async function saveJob(){
  const position = document.getElementById("f_position").value.trim();
  const company = document.getElementById("f_company").value.trim();
  if(!position || !company){
    showToast("Position and Company are required.", true);
    return;
  }
  const data = {
    position,
    company,
    location: document.getElementById("f_location").value.trim(),
    salary: Number(document.getElementById("f_salary").value)||0,
    status: document.getElementById("f_status").value,
    appliedDate: document.getElementById("f_appliedDate").value,
    interviewDate: document.getElementById("f_interviewDate").value,
    notes: document.getElementById("f_notes").value.trim(),
    file: selectedFileName
  };
  const wasEdit = !!editingId;
  if(editingId){
    const idx = jobs.findIndex(x=>x.id===editingId);
    jobs[idx] = {...jobs[idx], ...data};
  } else {
    jobs.push({id: nextId++, ...data});
  }
  const ok = await saveState();
  closeJobModal();
  renderAll();
  showToast(ok ? (wasEdit ? "Application updated" : "Application added") : "Saved locally, but could not sync — changes may not persist.", !ok);
}
async function deleteCurrentJob(){
  if(!editingId) return;
  if(!confirm("Delete this application? This cannot be undone.")) return;
  jobs = jobs.filter(j=>j.id!==editingId);
  const ok = await saveState();
  closeJobModal();
  renderAll();
  showToast(ok ? "Application deleted" : "Deleted locally, but could not sync.", !ok);
}
document.getElementById("jobOverlay").addEventListener("click", e=>{
  if(e.target.id==="jobOverlay") closeJobModal();
});
document.addEventListener("keydown", e=>{
  if(e.key==="Escape") closeJobModal();
});

/* ============ RENDER ALL ============ */
function renderAll(){
  renderAlerts();
  renderGauges();
  renderPipeline();
  renderApplications();
  if(document.getElementById("tab-calendar").classList.contains("active")) renderCalendar();
}

async function init(){
  await loadState();
  renderAll();
}
init();

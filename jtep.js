const NAV_SCREENS = ['beranda','dashboard','notif','profile'];
const STEP_LABELS = {
  beranda:'0. Beranda (Home)', offer:'1. Embedded Finance Offer', simulate:'2. Loan Simulation', consent:'3. Data Consent',
  assess:'4. AI Credit Assessment', decision:'5. Credit Decision', agreement:'6. Agreement & e-Sign',
  success:'7. Approval Success', dashboard:'8. Loan Dashboard', notif:'9. Notification Center', profile:'10. Profile & Security'
};
let stack = ['beranda'];
let assessDone = false;
let hasActiveLoan = false; // Flag untuk tracking pinjaman

function fmt(n){ return 'Rp' + Math.round(n).toLocaleString('id-ID'); }

function buildToolbar(){
  const tb = document.getElementById('toolbar');
  Object.keys(STEP_LABELS).forEach(id=>{
    const b = document.createElement('button');
    b.textContent = STEP_LABELS[id];
    b.id = 'tbtn-'+id;
    b.onclick = ()=> go(id, {push:false});
    tb.appendChild(b);
  });
  const reset = document.createElement('button');
  reset.textContent = 'Ulangi dari awal';
  reset.className = 'reset-btn';
  reset.onclick = restartJourney;
  tb.appendChild(reset);
}

function setToolbarActive(id){
  document.querySelectorAll('.toolbar button').forEach(b=>b.classList.remove('active'));
  const el = document.getElementById('tbtn-'+id);
  if(el) el.classList.add('active');
}

function go(id, opts){
  opts = opts || {};
  const cur = document.querySelector('.screen.active');
  const next = document.getElementById('screen-'+id);
  if(!next || cur === next) return;
  if(cur) cur.classList.remove('active');
  requestAnimationFrame(()=> next.classList.add('active'));
  if(opts.push !== false && !opts.tab) stack.push(id);
  if(opts.tab){ stack = [id]; }
  
  const isNav = NAV_SCREENS.includes(id);
  document.getElementById('bottomNav').style.display = isNav ? 'flex' : 'none';
  document.querySelectorAll('.nav-item').forEach(n=> n.classList.toggle('active', n.dataset.s === id));
  
  setToolbarActive(id);
  if(id === 'assess') runAssessment();
  if(id === 'decision') syncDecision();
  if(id === 'agreement') syncAgreement();
  if(id === 'success') { syncSuccess(); fireConfetti(); }
  if(id === 'notif') { 
      document.getElementById('navBadge').style.display='none'; 
      document.getElementById('navBadge').textContent='0'; 
  }
}

function back(){
  if(stack.length > 1){ stack.pop(); go(stack[stack.length-1], {push:false}); }
  else go('beranda', {push:false});
}

function restartJourney(){
  state.amount = 8000000; state.tenor = 12;
  document.getElementById('simRange').value = 8000000;
  updateSim();
  document.querySelectorAll('.tenor-btn').forEach(b=> b.classList.toggle('active', b.dataset.t==='12'));
  document.getElementById('masterToggle').classList.remove('on');
  document.getElementById('consentBtn').disabled = true;
  document.querySelectorAll('.assess-item').forEach(it=>{
    it.querySelector('.assess-dot').className='assess-dot';
    it.querySelector('.assess-status').textContent='Menunggu';
    it.querySelector('.assess-status').className='assess-status';
  });
  document.getElementById('ringFg').style.strokeDashoffset = 389.6;
  document.getElementById('ringPct').textContent = '0%';
  document.getElementById('assessBtn').disabled = true;
  document.getElementById('assessBtn').style.opacity = .5;
  document.getElementById('assessBtn').textContent = 'Menganalisis…';
  assessDone = false;
  hasActiveLoan = false;
  clearSig();
  document.querySelectorAll('.otp-box').forEach(o=> o.value='');
  document.getElementById('agError').style.display='none';
  document.getElementById('navBadge').style.display='none';
  document.getElementById('navBadge').textContent='0';
  document.getElementById('berandaKredit').textContent = 'Rp0';
  
  // Reset Notif
  const notifList = document.getElementById('notifList');
  notifList.innerHTML = `
    <div class="notif-card" data-cat="info">
      <div class="icon-tile" style="background:var(--red-light);color:#b8362c;width:36px;height:36px;"><svg class="ic" style="width:18px;height:18px"><use href="#ic-alert"/></svg></div>
      <div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--navy)">Keamanan akun</div><div style="font-size:11.5px;color:var(--g500);margin-top:1px">Login baru terdeteksi di perangkat saat ini</div><div style="font-size:10px;color:var(--g400);margin-top:3px">Kemarin · 08:30</div></div>
    </div>
  `;
  
  // Reset Dashboard
  document.getElementById('dashOutstanding').textContent = 'Rp0';
  document.getElementById('dashRemT').textContent = '0 Bulan';
  document.getElementById('dashMonthly').textContent = 'Rp0';
  document.getElementById('dashProgress').style.width = '0%';
  document.getElementById('dashProgressLabel').textContent = 'Belum ada cicilan terbayar';
  document.getElementById('dashNext').textContent = 'Rp0';
  document.getElementById('histList').innerHTML = '<div style="font-size:12px; color:var(--g400); text-align:center; padding: 10px 0;">Belum ada riwayat pembayaran</div>';

  stack = ['beranda'];
  go('beranda', {push:false});
}

/* ---------- Overlay Menu Utama ---------- */
function openMainMenu() {
  document.getElementById('mainMenuOverlay').classList.add('show');
}
function closeMainMenu() {
  document.getElementById('mainMenuOverlay').classList.remove('show');
}

const FEATURE_MODALS = {
  qris:{title:'Bayar QRIS', description:'Pilih merchant dan scan QRIS untuk checkout cepat.', icon:'#ic-home'},
  kirimBayar:{title:'Kirim & Bayar', description:'Transfer cepat ke nomor tujuan atau bayar tagihan dalam satu layar.', icon:'#ic-wallet'},
  topup:{title:'Top Up Saldo', description:'Isi ulang saldo Jago dengan mudah, pilih nominal yang kamu butuhkan.', icon:'#ic-bolt'},
  pinjaman:{title:'Ringkasan Pinjaman', description:'Lihat penawaran pinjaman dan kelola aplikasi kreditmu.', icon:'#ic-doc'},
  personal:{title:'Informasi Pribadi', description:'Kelola data dirimu agar layanan lebih personal dan aman.', icon:'#ic-user'},
  rekening:{title:'Rekening Bank Jago', description:'Lihat detail rekening dan salin nomor untuk transfer masuk.', icon:'#ic-wallet'},
  partner:{title:'Partner Terhubung', description:'Kelola koneksi partner yang sudah terhubung dengan akunmu.', icon:'#ic-link'},
  settings:{title:'Pengaturan Akun', description:'Atur keamanan, notifikasi, dan preferensi layanan Jago.', icon:'#ic-settings'}
};

function openFeatureModal(key){
  const def = FEATURE_MODALS[key];
  if(!def) return;
  const overlay = document.getElementById('featureModalOverlay');
  const modal = overlay.querySelector('.feature-modal');
  overlay.classList.remove('hide');
  modal.classList.remove('closing');
  document.getElementById('featureModalTitle').textContent = def.title;
  document.getElementById('featureModalDescription').textContent = def.description;
  document.getElementById('featureModalIcon').innerHTML = `<svg class="ic" viewBox="0 0 24 24"><use href="${def.icon}"/></svg>`;
  document.getElementById('featureModalBody').innerHTML = buildFeatureBody(key);
  overlay.classList.add('show');
  overlay.dataset.feature = key;
}
function closeFeatureModal(event){
  if(event && event.type === 'click' && event.target !== event.currentTarget && !event.target.closest('.modal-close')) return;
  const overlay = document.getElementById('featureModalOverlay');
  if(!overlay.classList.contains('show')) return;
  const modal = overlay.querySelector('.feature-modal');
  overlay.classList.remove('show');
  overlay.classList.add('hide');
  modal.classList.add('closing');
  setTimeout(()=>{
    overlay.classList.remove('hide');
    modal.classList.remove('closing');
    overlay.dataset.feature = '';
  }, 280);
}

document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && document.getElementById('featureModalOverlay').classList.contains('show')){
    closeFeatureModal();
  }
});

function buildFeatureBody(key){
  switch(key){
    case 'qris':
      return `
        <div class="modal-card">
          <div class="feature-row"><div>
            <div class="feature-title">Merchant: Warung Rina</div>
            <div class="feature-sub">Nusantara Mall · QRIS siap</div>
          </div><strong>Rp75.000</strong></div>
          <div class="feature-action-grid">
            <div class="feature-amount-pill active" onclick="setModalAmount(this)">Rp50.000</div>
            <div class="feature-amount-pill" onclick="setModalAmount(this)">Rp75.000</div>
            <div class="feature-amount-pill" onclick="setModalAmount(this)">Rp100.000</div>
            <div class="feature-amount-pill" onclick="setModalAmount(this)">Rp150.000</div>
          </div>
          <button class="btn btn-primary" onclick="performFeatureAction('qris')">Scan QRIS</button>
        </div>`;
    case 'kirimBayar':
      return `
        <div class="modal-card">
          <div class="field-row"><label>Nama Penerima</label><strong><input id="feature-recipient" class="modal-input" placeholder="Contoh: Budi"/></strong></div>
          <div class="field-row"><label>Nominal</label><strong><input id="feature-amount" class="modal-input" type="number" placeholder="50000"/></strong></div>
          <p class="modal-note">Masukkan nomor telepon atau nama kontak tujuan.</p>
          <button class="btn btn-primary" onclick="performFeatureAction('send')">Kirim Sekarang</button>
        </div>`;
    case 'topup':
      return `
        <div class="modal-card">
          <div class="feature-title">Pilih nominal top up</div>
          <div class="feature-action-grid">
            <div class="feature-amount-pill active" onclick="setModalAmount(this)">Rp50.000</div>
            <div class="feature-amount-pill" onclick="setModalAmount(this)">Rp100.000</div>
            <div class="feature-amount-pill" onclick="setModalAmount(this)">Rp150.000</div>
            <div class="feature-amount-pill" onclick="setModalAmount(this)">Rp200.000</div>
          </div>
          <p class="modal-note">Saldo akan langsung masuk ke rekening Jago.</p>
          <button class="btn btn-primary" onclick="performFeatureAction('topup')">Top Up Sekarang</button>
        </div>`;
    case 'pinjaman':
      return `
        <div class="modal-card">
          <div class="feature-row"><div><div class="feature-title">Pinjaman J-TEP</div><div class="feature-sub">Limit disetujui hingga Rp10.500.000</div></div><strong>12 Bulan</strong></div>
          <div class="field-row"><label>Cicilan estimasi</label><strong>Rp749.000/bulan</strong></div>
          <button class="btn btn-primary" onclick="performFeatureAction('pinjaman')">Lihat Detail Pinjaman</button>
        </div>`;
    case 'personal':
      return `
        <div class="modal-card">
          <div class="feature-row"><div><div class="feature-title">Andi Rahman</div><div class="feature-sub">a****@email.com · 08xx-xxx-xx23</div></div><strong>Aktif</strong></div>
          <div class="field-row"><label>NIK</label><strong>3201********1234</strong></div>
          <div class="field-row"><label>Alamat</label><strong>Jl. Malioboro No. 12</strong></div>
          <button class="btn btn-primary" onclick="performFeatureAction('personal')">Perbarui Data</button>
        </div>`;
    case 'rekening':
      return `
        <div class="modal-card">
          <div class="feature-row"><div><div class="feature-title">Bank Jago</div><div class="feature-sub">Rekening utama untuk pencairan</div></div><strong>7001234567</strong></div>
          <p class="modal-note">Salin nomor untuk top up atau transfer dari bank lain.</p>
          <button class="btn btn-primary" onclick="performFeatureAction('rekening')">Salin Nomor</button>
        </div>`;
    case 'partner':
      return `
        <div class="modal-card">
          <div class="feature-row"><div><div class="feature-title">JelajahGo</div><div class="feature-sub">Partner sedang terhubung</div></div><strong>Aktif</strong></div>
          <p class="modal-note">Semua transaksi perjalanan dan pemesanan akan dilacak otomatis.</p>
          <button class="btn btn-primary" onclick="performFeatureAction('partner')">Kelola Koneksi</button>
        </div>`;
    case 'settings':
      return `
        <div class="modal-card">
          <div class="feature-row"><div><div class="feature-title">Notifikasi</div><div class="feature-sub">Pemberitahuan push dan SMS</div></div><div class="toggle-pill active" onclick="toggleModalPreference(this)">Aktif</div></div>
          <div class="feature-row"><div><div class="feature-title">Biometrik</div><div class="feature-sub">Akses lebih cepat dan aman</div></div><div class="toggle-pill active" onclick="toggleModalPreference(this)">Aktif</div></div>
          <button class="btn btn-primary" onclick="performFeatureAction('settings')">Simpan Pengaturan</button>
        </div>`;
    default:
      return `<div class="modal-card"><p class="modal-note">Konten belum tersedia.</p></div>`;
  }
}

function setModalAmount(el){
  document.querySelectorAll('.feature-amount-pill').forEach(item=> item.classList.remove('active'));
  el.classList.add('active');
}

function toggleModalPreference(el){
  el.classList.toggle('active');
  el.textContent = el.classList.contains('active') ? 'Aktif' : 'Mati';
}

function performFeatureAction(action){
  switch(action){
    case 'qris':
      toast('QRIS berhasil discan! Pembayaran sedang diproses.', 1400);
      closeFeatureModal();
      break;
    case 'send':
      const recipient = document.getElementById('feature-recipient');
      const amount = document.getElementById('feature-amount');
      if(!recipient.value.trim() || !amount.value.trim()){
        toast('Lengkapi nama penerima dan nominal.', 1400);
        return;
      }
      toast(`Transfer ke ${recipient.value.trim()} berhasil!`, 1500);
      closeFeatureModal();
      break;
    case 'topup':
      const selected = document.querySelector('.feature-amount-pill.active');
      const value = selected ? selected.textContent : 'Rp50.000';
      toast(`Top up ${value} berhasil!`, 1500);
      closeFeatureModal();
      break;
    case 'pinjaman':
      toast('Membuka dashboard pinjaman…', 1100, true);
      closeFeatureModal();
      go('dashboard',{tab:true});
      break;
    case 'personal':
      toast('Data pribadi diperbarui (demo).', 1300);
      closeFeatureModal();
      break;
    case 'rekening':
      if(navigator.clipboard){
        navigator.clipboard.writeText('7001234567').catch(()=>{});
      }
      toast('Nomor rekening disalin ke clipboard.', 1400);
      closeFeatureModal();
      break;
    case 'partner':
      toast('Hubungan partner tetap aktif.', 1300);
      closeFeatureModal();
      break;
    case 'settings':
      toast('Pengaturan telah disimpan.', 1300);
      closeFeatureModal();
      break;
    default:
      closeFeatureModal();
      break;
  }
}

/* ---------- Simulation ---------- */
const state = { amount: 8000000, tenor: 12 };
function calc(){
  const p = state.amount, t = state.tenor;
  const interest = Math.round(p * 0.015 * t / 1000) * 1000;
  const admin = 150000;
  const total = p + interest + admin;
  const monthly = Math.round((total / t) / 1000) * 1000;
  return {p, t, interest, admin, total, monthly};
}
function updateSim(){
  state.amount = parseInt(document.getElementById('simRange').value, 10);
  document.getElementById('simAmt').textContent = fmt(state.amount);
  const c = calc();
  document.getElementById('simMonthly').textContent = fmt(c.monthly);
  document.getElementById('simInterest').textContent = fmt(c.interest);
  document.getElementById('simAdmin').textContent = fmt(c.admin);
  document.getElementById('simTotal').textContent = fmt(c.total);
}
function setTenor(t){
  state.tenor = t;
  document.querySelectorAll('.tenor-btn').forEach(b=> b.classList.toggle('active', parseInt(b.dataset.t,10)===t));
  updateSim();
}

/* ---------- Consent ---------- */
function toggleConsentDetail(el){ el.classList.toggle('open'); }
function toggleMaster(el){
  el.classList.toggle('on');
  document.getElementById('consentBtn').disabled = !el.classList.contains('on');
}

/* ---------- Assessment ---------- */
function runAssessment(){
  if(assessDone) return;
  const items = document.querySelectorAll('.assess-item');
  const ring = document.getElementById('ringFg');
  const CIRC = 389.6;
  const targetPct = 85;
  let delay = 250;
  const durations = [700, 650, 800, 900, 700, 900];
  items.forEach((it, i)=>{
    setTimeout(()=>{
      const dot = it.querySelector('.assess-dot');
      const st = it.querySelector('.assess-status');
      dot.className = 'assess-dot processing';
      st.className = 'assess-status processing';
      st.textContent = 'Sedang diproses';
    }, delay);
    delay += durations[i];
    setTimeout(()=>{
      const dot = it.querySelector('.assess-dot');
      const st = it.querySelector('.assess-status');
      dot.className = 'assess-dot done';
      dot.innerHTML = '<svg class="ic" style="width:14px;height:14px"><use href="#ic-check"/></svg>';
      st.className = 'assess-status done';
      st.textContent = 'Selesai';
      const pctNow = Math.round(targetPct * (i+1) / items.length);
      const offset = CIRC - (CIRC * pctNow / 100);
      ring.style.transition = 'stroke-dashoffset .6s ease';
      ring.style.strokeDashoffset = offset;
      document.getElementById('ringPct').textContent = pctNow + '%';
      if(i === items.length - 1){
        assessDone = true;
        const btn = document.getElementById('assessBtn');
        btn.disabled = false;
        btn.style.opacity = 1;
        btn.textContent = 'Lihat Hasil';
      }
    }, delay);
  });
}

/* ---------- Decision ---------- */
function syncDecision(){
  const c = calc();
  const approved = Math.round((state.amount * 1.3) / 500000) * 500000;
  document.getElementById('decLimit').textContent = fmt(approved);
  document.getElementById('decTenor').textContent = state.tenor + ' Bulan';
  document.getElementById('decMonthly').textContent = fmt(c.monthly);
  setTimeout(()=>{
    document.getElementById('confFill').style.width = '92%';
    document.getElementById('confPctLabel').textContent = '92%';
  }, 150);
}

/* ---------- Agreement ---------- */
function syncAgreement(){
  const c = calc();
  document.getElementById('agAmt').textContent = fmt(state.amount);
  document.getElementById('agTenor').textContent = state.tenor + ' Bulan';
  document.getElementById('agMonthly').textContent = fmt(c.monthly);
  initSigPad();
}
let sigCtx, sigDrawn = false, drawing = false;
function initSigPad(){
  const canvas = document.getElementById('sigPad');
  const ratio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * ratio;
  canvas.height = canvas.clientHeight * ratio;
  sigCtx = canvas.getContext('2d');
  sigCtx.scale(ratio, ratio);
  sigCtx.strokeStyle = '#0B1E3D';
  sigCtx.lineWidth = 2.4;
  sigCtx.lineCap = 'round';
  const pos = e => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  canvas.onpointerdown = e => { drawing = true; sigDrawn = true; const p = pos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); };
  canvas.onpointermove = e => { if(!drawing) return; const p = pos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); };
  canvas.onpointerup = () => drawing = false;
  canvas.onpointerleave = () => drawing = false;
}
function clearSig(){
  const canvas = document.getElementById('sigPad');
  if(sigCtx) sigCtx.clearRect(0,0,canvas.width,canvas.height);
  sigDrawn = false;
}
function otpNext(el){
  el.value = el.value.replace(/[^0-9]/g,'');
  if(el.value && el.nextElementSibling && el.nextElementSibling.classList.contains('otp-box')){
    el.nextElementSibling.focus();
  }
}
function otpPrev(el, e){
  if(e.key === 'Backspace' && el.value === '' && el.previousElementSibling && el.previousElementSibling.classList.contains('otp-box')){
    el.previousElementSibling.focus();
  }
}

let resendTimer = 45, resendInterval = null;
function resendOtp(){
  const btn = document.getElementById('resendOtp');
  if(resendTimer < 45) return;
  toast('Kode OTP baru telah dikirim', 1400);
  resendTimer = 45;
  btn.style.pointerEvents = 'none';
  if(resendInterval) clearInterval(resendInterval);
  resendInterval = setInterval(()=>{
    resendTimer--;
    const ss = String(resendTimer).padStart(2,'0');
    btn.textContent = 'Kirim ulang OTP (00:' + ss + ')';
    if(resendTimer <= 0){
      clearInterval(resendInterval);
      btn.textContent = 'Kirim ulang OTP';
      btn.style.pointerEvents = 'auto';
    }
  }, 1000);
}

function submitAgreement(){
  const otpVal = Array.from(document.querySelectorAll('.otp-box')).map(o=>o.value).join('');
  const err = document.getElementById('agError');
  if(!sigDrawn || otpVal.length < 6){
    err.style.display = 'flex';
    const card = err.closest('.card');
    card.classList.add('shake');
    setTimeout(()=> card.classList.remove('shake'), 420);
    return;
  }
  err.style.display = 'none';
  document.getElementById('stepDot3').classList.add('on');
  go('success');
}

/* ---------- Success & Dashboard Injection ---------- */
function syncSuccess(){
  const c = calc();
  document.getElementById('scAmt').textContent = fmt(state.amount);
  document.getElementById('scTenor').textContent = state.tenor + ' Bulan';
  document.getElementById('scMonthly').textContent = fmt(c.monthly);
  
  // Set Dashboard Values Dynamically
  document.getElementById('dashOutstanding').textContent = fmt(c.total);
  document.getElementById('berandaKredit').textContent = fmt(c.total);
  document.getElementById('dashRemT').textContent = state.tenor + ' Bulan';
  document.getElementById('dashMonthly').textContent = fmt(c.monthly);
  document.getElementById('dashNext').textContent = fmt(c.monthly);
  document.getElementById('histList').innerHTML = '';
  document.getElementById('dashProgress').style.width = '0%';
  document.getElementById('dashProgressLabel').textContent = '0 dari ' + state.tenor + ' cicilan terbayar';
  
  installmentsPaid = 0;
  hasActiveLoan = true;

  // Add Dynamic Notification
  addDynamicNotif();
}

function addDynamicNotif() {
  const notifList = document.getElementById('notifList');
  const now = new Date();
  const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  const amountStr = fmt(state.amount);
  const html = `
    <div class="notif-card" data-cat="pinjaman">
      <div class="icon-tile" style="background:var(--emerald-light);color:#0a7b4d;width:36px;height:36px;"><svg class="ic" style="width:18px;height:18px"><use href="#ic-check"/></svg></div>
      <div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--navy)">Pinjaman J-TEP Berhasil Cair!</div><div style="font-size:11.5px;color:var(--g500);margin-top:1px">Dana sebesar ${amountStr} telah masuk ke kantong utama Jago.</div><div style="font-size:10px;color:var(--g400);margin-top:3px">Hari ini · ${timeStr}</div></div>
      <div class="unread-dot"></div>
    </div>
  `;
  notifList.insertAdjacentHTML('afterbegin', html);
  
  const badge = document.getElementById('navBadge');
  badge.style.display = 'flex';
  badge.textContent = parseInt(badge.textContent || '0') + 1;
}

function fireConfetti(){
  const canvas = document.getElementById('confetti-canvas');
  const wrap = canvas.parentElement;
  canvas.width = wrap.clientWidth; canvas.height = wrap.clientHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#FF7A1A','#0FA968','#F5A623','#16294D'];
  const parts = Array.from({length:38}, () => ({
    x: canvas.width/2 + (Math.random()-0.5)*40,
    y: canvas.height*0.28,
    vx: (Math.random()-0.5)*7,
    vy: Math.random()*-6 - 3,
    size: Math.random()*5+3,
    color: colors[Math.floor(Math.random()*colors.length)],
    rot: Math.random()*360,
    vr: (Math.random()-0.5)*10,
    life: 0
  }));
  let frame = 0;
  function tick(){
    frame++;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let alive = false;
    parts.forEach(p=>{
      p.vy += 0.22; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
      if(p.life < 70){
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - p.life/70);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI/180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
        ctx.restore();
      }
    });
    if(alive && frame < 90) requestAnimationFrame(tick);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  tick();
}

/* ---------- Dashboard Action ---------- */
let installmentsPaid = 0;
function payNow(){
  if(!hasActiveLoan) {
      toast('Belum ada pinjaman aktif', 1200);
      return;
  }
  if(installmentsPaid >= state.tenor) {
      toast('Semua cicilan sudah lunas!', 1200);
      return;
  }
  
  const btn = document.getElementById('payBtn');
  btn.innerHTML = '<span class="spin-loader"></span> Memproses…';
  btn.disabled = true;
  setTimeout(()=>{
    installmentsPaid = Math.min(installmentsPaid + 1, state.tenor);
    const total = state.tenor;
    const pct = Math.round((installmentsPaid/total)*100);
    document.getElementById('dashProgress').style.width = pct + '%';
    document.getElementById('dashProgressLabel').textContent = installmentsPaid + ' dari ' + total + ' cicilan terbayar';
    document.getElementById('dashRemT').textContent = (total - installmentsPaid) + ' Bulan';
    
    const c = calc();
    const remaining = Math.max(0, c.total - (installmentsPaid * c.monthly));
    document.getElementById('dashOutstanding').textContent = fmt(remaining);
    document.getElementById('berandaKredit').textContent = fmt(remaining);
    
    if(remaining <= 0) {
        document.getElementById('dashNext').textContent = "Rp0 (Lunas)";
        btn.textContent = "Pinjaman Lunas";
        btn.disabled = true;
    } else {
        document.getElementById('dashNext').textContent = fmt(c.monthly);
        btn.innerHTML = 'Bayar Cicilan (Simulasi)';
        btn.disabled = false;
    }

    const list = document.getElementById('histList');
    const row = document.createElement('div');
    row.className = 'hist-item';
    row.innerHTML = '<span style="font-size:12.5px;color:var(--navy)">Baru saja</span><span style="font-size:12.5px;color:var(--navy);font-weight:600">' + fmt(c.monthly) + '</span><span class="badge badge-emerald">Berhasil</span>';
    list.prepend(row);
    
    toast('Pembayaran cicilan berhasil!', 1600, true);
  }, 1100);
}

/* ---------- Notifications UI ---------- */
function filterNotif(el){
  document.querySelectorAll('.chip').forEach(c=> c.classList.remove('active'));
  el.classList.add('active');
  const cat = el.dataset.cat;
  const cards = document.querySelectorAll('.notif-card');
  let visible = 0;
  cards.forEach(c=>{
    const show = cat === 'all' || c.dataset.cat === cat;
    c.style.display = show ? 'flex' : 'none';
    if(show) visible++;
  });
  document.getElementById('notifEmpty').style.display = visible === 0 ? 'block' : 'none';
  document.getElementById('notifList').style.display = visible === 0 ? 'none' : 'block';
}

/* ---------- Onboarding finish ---------- */
function finishOnboarding(){
  go('dashboard', {tab:true});
}

/* ---------- Toast ---------- */
let toastTimeout;
function toast(msg, ms, useNav){
  const box = document.getElementById('toastBox');
  box.textContent = msg;
  box.classList.toggle('toast-nav', !!useNav);
  box.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(()=> box.classList.remove('show'), ms || 1600);
}

buildToolbar();
updateSim();
go('beranda', {push:false});
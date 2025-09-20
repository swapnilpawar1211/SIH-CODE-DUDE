
const STORAGE_KEY = 'attenD_frontend_db_v1';
let DB = { students: [], attendance: {} };
let modelsLoaded = false, enrollStream = null, attendStream = null, recognizeInterval = null, faceMatcher = null;
let classChart = null, timelineChart = null, studentChart = null;
function loadDB() { try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) DB = JSON.parse(raw); } catch (e) { DB = { students: [], attendance: {} } } }
function saveDB() { localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); }
function getTeacherPass() { return localStorage.getItem('attenD_teacher_pass') || 'pass123'; }
function setTeacherPass(p) { localStorage.setItem('attenD_teacher_pass', p); }
function hideAllCards() { ['loginCard', 'dashCard', 'enrollCard', 'attendCard', 'reportCard', 'studentReportCard'].forEach(id => { document.getElementById(id).classList.add('hidden'); }); }
function backToDash() { stopEnrollCamera(); stopAttendance(); renderStats(); hideAllCards(); document.getElementById('dashCard').classList.remove('hidden'); }
const MODEL_URL_CDN = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
async function loadModels() { try { await faceapi.nets.ssdMobilenetv1.loadFromUri('/models').catch(() => faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL_CDN)); await faceapi.nets.faceLandmark68Net.loadFromUri('/models').catch(() => faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL_CDN)); await faceapi.nets.faceRecognitionNet.loadFromUri('/models').catch(() => faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL_CDN)); modelsLoaded = true; } catch (err) { alert('Model load error'); } document.getElementById('splash').style.display = 'none'; }
window.addEventListener('load', async () => { loadDB(); await loadModels(); renderStats(); });
function showTeacherLogin() { document.getElementById('teacherBox').classList.remove('hidden'); document.getElementById('studentBox').classList.add('hidden'); }
function showStudentLogin() { document.getElementById('studentBox').classList.remove('hidden'); document.getElementById('teacherBox').classList.add('hidden'); }
function togglePassword() { const i = document.getElementById('tpass'); i.type = i.type === 'password' ? 'text' : 'password'; }
function doTeacherLogin() { const u = document.getElementById('tuser').value.trim(); const p = document.getElementById('tpass').value.trim(); if (u !== 'teacher1' || p !== getTeacherPass()) { alert('Invalid login'); return; } hideAllCards(); renderStats(); document.getElementById('dashCard').classList.remove('hidden'); }
function doStudentLogin() { const r = document.getElementById('sroll').value.trim(); const stu = DB.students.find(s => s.roll === r); if (!stu) { alert('No such student'); return; } hideAllCards(); renderStudentReport(r); document.getElementById('studentReportCard').classList.remove('hidden'); }
function logout() { stopEnrollCamera(); stopAttendance(); hideAllCards(); document.getElementById('loginCard').classList.remove('hidden'); }
function openForgot() { document.getElementById('forgotModal').style.display = 'flex'; }
function closeForgot() { document.getElementById('forgotModal').style.display = 'none'; }
function doResetPassword() { const u = document.getElementById('fpUser').value.trim(); const p = document.getElementById('fpPass').value.trim(); const p2 = document.getElementById('fpPass2').value.trim(); if (u !== 'teacher1' || p !== p2 || p.length < 4) { alert('Invalid'); return; } setTeacherPass(p); alert('Updated'); closeForgot(); }
function renderStats() { const today = new Date().toISOString().slice(0, 10); const att = DB.attendance[today] || {}; const tot = DB.students.length; const pres = Object.keys(att).length; document.getElementById('totStud').innerText = tot; document.getElementById('presStud').innerText = pres; document.getElementById('absStud').innerText = tot - pres; }
async function openEnroll() { hideAllCards(); document.getElementById('enrollCard').classList.remove('hidden'); try { enrollStream = await navigator.mediaDevices.getUserMedia({ video: true }); document.getElementById('enrollVideo').srcObject = enrollStream; } catch (e) { alert('Camera error'); } }
async function captureMultiAndEnroll() { const roll = document.getElementById('enrollRoll').value.trim(); if (!roll || DB.students.find(s => s.roll === roll)) { alert('Invalid'); return; } const video = document.getElementById('enrollVideo'); let descs = []; for (let i = 0; i < 3; i++) { const det = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor(); if (!det) { alert('No face'); return; } descs.push(det.descriptor); await new Promise(r => setTimeout(r, 500)); } DB.students.push({ roll, descriptors: descs.map(d => Array.from(d)) }); saveDB(); alert('Enrolled ' + roll); renderStats(); }
function stopEnrollCamera() { if (enrollStream) { enrollStream.getTracks().forEach(t => t.stop()); enrollStream = null; } }
async function openAttend() {
    hideAllCards(); document.getElementById('attendCard').classList.remove('hidden');
    try {
        attendStream = await navigator.mediaDevices.getUserMedia({ video: true });
        document.getElementById('attendVideo').srcObject = attendStream;
    } catch (e) {
        alert('Camera access failed');
        return;
    }

    // Build labeled descriptors for recognition
    const labeled = DB.students.map(s => new faceapi.LabeledFaceDescriptors(
        s.roll,
        s.descriptors.map(d => new Float32Array(d))
    ));
    faceMatcher = new faceapi.FaceMatcher(labeled, 0.6);

    // Start recognition loop
    recognizeInterval = setInterval(async () => {
        const video = document.getElementById('attendVideo');
        if (video.readyState < 2) return;
        const detections = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors();
        const wrap = document.getElementById('recognizedWrap');
        wrap.innerHTML = '';
        detections.forEach(det => {
            const best = faceMatcher.findBestMatch(det.descriptor);
            const tag = document.createElement('div');
            tag.className = 'face-tag';
            tag.textContent = best.toString();
            wrap.appendChild(tag);

            if (best.label !== 'unknown') markPresent(best.label, video);
        });
    }, 1500);
}

function markPresent(roll, video) {
    const today = new Date().toISOString().slice(0, 10);
    if (!DB.attendance[today]) DB.attendance[today] = {};
    if (!DB.attendance[today][roll]) {
        DB.attendance[today][roll] = new Date().toLocaleTimeString();
        saveDB();
        renderStats();

        // Snapshot
        const canvas = document.createElement('canvas');
        canvas.width = 120; canvas.height = 90;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 120, 90);
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/jpeg', 0.7);
        img.className = 'small-thumb';
        document.getElementById('snapshotGallery').appendChild(img);
    }
}

function stopAttendance() {
    if (attendStream) {
        attendStream.getTracks().forEach(t => t.stop());
        attendStream = null;
    }
    clearInterval(recognizeInterval);
    recognizeInterval = null;
    faceMatcher = null;
    hideAllCards();
    document.getElementById('dashCard').classList.remove('hidden');
}

function openReport() {
    hideAllCards();
    document.getElementById('reportCard').classList.remove('hidden');
    renderReports();
}

function renderReports() {
    const today = new Date().toISOString().slice(0, 10);
    const att = DB.attendance[today] || {};
    const total = DB.students.length;
    const present = Object.keys(att).length;
    const absent = total - present;

    if (classChart) classChart.destroy();
    classChart = new Chart(document.getElementById('classChart'), {
        type: 'pie',
        data: {
            labels: ['Present', 'Absent'],
            datasets: [{ data: [present, absent] }]
        }
    });

    const days = Object.keys(DB.attendance).sort();
    const vals = days.map(d => Object.keys(DB.attendance[d]).length);
    if (timelineChart) timelineChart.destroy();
    timelineChart = new Chart(document.getElementById('timelineChart'), {
        type: 'line',
        data: { labels: days, datasets: [{ label: 'Daily Attendance', data: vals }] }
    });

    const list = document.getElementById('studentList');
    list.innerHTML = '';
    DB.students.forEach(s => {
        const div = document.createElement('div');
        div.className = 'd-flex align-items-center justify-content-between border-bottom py-1';
        div.innerHTML = `<span>${s.roll}</span><span>${att[s.roll] ? '✅' : '❌'}</span>`;
        list.appendChild(div);
    });
}

function renderStudentReport(roll) {
    document.getElementById('srRoll').textContent = roll;
    const hist = [];
    let pres = 0, abs = 0;
    Object.entries(DB.attendance).forEach(([d, rec]) => {
        if (rec[roll]) { hist.push({ d, status: 'Present', time: rec[roll] }); pres++; }
        else { hist.push({ d, status: 'Absent', time: '-' }); abs++; }
    });

    if (studentChart) studentChart.destroy();
    studentChart = new Chart(document.getElementById('studentChart'), {
        type: 'doughnut',
        data: { labels: ['Present', 'Absent'], datasets: [{ data: [pres, abs] }] }
    });

    const ul = document.getElementById('srHistory');
    ul.innerHTML = '';
    hist.sort((a, b) => a.d.localeCompare(b.d)).forEach(r => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = `${r.d}: ${r.status} ${r.time}`;
        ul.appendChild(li);
    });
}

function exportClassReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Class Attendance Report', 10, 15);
    let y = 30;
    Object.entries(DB.attendance).forEach(([d, rec]) => {
        doc.setFontSize(12);
        doc.text(`${d} - ${Object.keys(rec).length} present`, 10, y);
        y += 7;
    });
    doc.save('class_report.pdf');
}

function exportStudentReport() {
    const roll = document.getElementById('srRoll').textContent;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Attendance Report - ${roll}`, 10, 15);
    let y = 30;
    Object.entries(DB.attendance).forEach(([d, rec]) => {
        doc.setFontSize(12);
        doc.text(`${d}: ${rec[roll] ? 'Present' : 'Absent'}`, 10, y);
        y += 7;
    });
    doc.save(`report_${roll}.pdf`);
}

function openHelp() { document.getElementById('helpModal').style.display = 'flex'; }
function closeHelp() { document.getElementById('helpModal').style.display = 'none'; }

function clearAllStudents() {
    if (confirm('This will delete all enrolled students and attendance records. Continue?')) {
        DB = { students: [], attendance: {} };
        saveDB();
        renderStats();
        alert('All students and attendance cleared.');
    }
}

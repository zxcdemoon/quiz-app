const SUPABASE_URL = 'https://jdszmkyarbkjrqcirpkh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NV0ytzdKVjnvhg7li88YsA_xO6wCrEM';
let sbClient = null, currentUser = null;
let tests = [], attempts = [], srsData = {}, game = {xp:0, level:1, streak:0};
let TEST = null, editing = null, state = null, startMode = 'normal';

const $ = id => document.getElementById(id);
const uid = () => 't' + Date.now() + Math.random().toString(36).slice(2,6);
const pad = n => String(n).padStart(2, '0');
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 3000); }

// INIT
document.addEventListener('DOMContentLoaded', () => {
    loadAll();
    $('syncBtn').onclick = openSyncModal;
    $('leaderBtn').onclick = openLeaderboard;
    $('shopBtn').onclick = openShop;
    $('settingsBtn').onclick = () => $('settingsModal').classList.remove('hidden');
});

function loadAll(){
    try { const t = localStorage.getItem('aq_tests_v12'); if(t) tests = JSON.parse(t); } catch(e) {}
    try { const g = localStorage.getItem('aq_game_v12'); if(g) game = JSON.parse(g); } catch(e) {}
    try { const s = localStorage.getItem('aq_srs_v12'); if(s) srsData = JSON.parse(s); } catch(e) {}
    renderLib(); renderXP();
}

// UI NAVIGATION
function show(id){
    ['welcomeScreen','startScreen','editorScreen','quizScreen','flashcardScreen','resultScreen','profileScreen','shopScreen','leaderboardScreen','multiplayerMenuScreen','multiplayerLobbyScreen','aiChatScreen'].forEach(s=>{ const el=$(s); if(el) el.classList.toggle('hidden', s!==id); });
}
function renderLib(){
    $('testList').innerHTML = tests.map(t=>`<div class="test-item" onclick="openStart('${t.id}')"><b>${t.title}</b><div style="font-size:12px;color:#888">${t.questions.length} вопр.</div></div>`).join('');
}
function openStart(id){
    TEST = tests.find(t=>t.id===id);
    $('startTitle').textContent = TEST.title;
    $('theoryBox').classList.toggle('hidden', !TEST.theory);
    $('theoryContent').innerHTML = TEST.theory || '';
    show('startScreen');
}
function selectMode(m){ startMode=m; document.querySelectorAll('.mode-card').forEach(c=>c.style.borderColor=c.dataset.mode===m?'var(--accent)':'transparent'); }

// EDITOR & AI
function openEditor(){
    editing = { id:uid(), title:'', questions:[{type:'single',question:'',options:[{text:'',correct:true},{text:'',correct:false}]}] };
    renderEditor(); show('editorScreen');
}
function renderEditor(){
    $('edQuestions').innerHTML = editing.questions.map((q,i)=>`
        <div class="q-card" style="padding:16px;background:rgba(255,255,255,0.05);margin-bottom:12px;border-radius:12px;">
            <input type="text" value="${q.question}" oninput="editing.questions[${i}].question=this.value" placeholder="Вопрос" style="width:100%;margin-bottom:8px;background:transparent;color:#fff;border:1px solid #333;padding:8px;border-radius:8px;">
            ${q.options.map((opt,j)=>`<div style="display:flex;gap:8px;margin-bottom:4px;"><input type="${q.type==='multi'?'checkbox':'radio'}" ${opt.correct?'checked':''} onchange="editing.questions[${i}].options[${j}].correct=this.checked"><input type="text" value="${opt.text}" oninput="editing.questions[${i}].options[${j}].text=this.value" style="flex:1;background:transparent;color:#fff;border:1px solid #333;padding:8px;border-radius:8px;"></div>`).join('')}
            <div style="display:flex;gap:8px;margin-top:8px;">
                <input type="url" placeholder="Аудио URL" oninput="editing.questions[${i}].audio=this.value" style="flex:1;background:transparent;color:#fff;border:1px solid #333;padding:8px;border-radius:8px;">
                <input type="url" placeholder="Видео URL (YouTube)" oninput="editing.questions[${i}].video=this.value" style="flex:1;background:transparent;color:#fff;border:1px solid #333;padding:8px;border-radius:8px;">
            </div>
        </div>
    `).join('');
}
function saveTest(){
    editing.title = $('edTitle').value || 'Без названия';
    editing.theory = $('edTheory').value;
    const idx = tests.findIndex(t=>t.id===editing.id);
    if(idx>=0) tests[idx] = editing; else tests.push(editing);
    localStorage.setItem('aq_tests_v12', JSON.stringify(tests));
    renderLib(); show('welcomeScreen'); toast('Сохранено');
}
async function generateTheory(){
    if(!editing) return;
    toast('Генерация...');
    const qText = editing.questions.map(q=>'- '+q.question).join('\n');
    try {
        const res = await fetch('https://text.pollinations.ai/openai', { method:'POST', body: JSON.stringify({model:'openai', messages:[{role:'user', content:'Напиши конспект по темам:\n'+qText}]}) });
        const data = await res.json();
        $('edTheory').value = data.choices[0].message.content;
    } catch(e) { toast('Ошибка AI'); }
}

// QUIZ LOGIC
function startTest(){
    let qs = TEST.questions;
    if(startMode === 'srs'){
        qs = qs.filter(q => !srsData[TEST.id+'_'+q.question] || srsData[TEST.id+'_'+q.question].next <= Date.now());
        if(!qs.length) return toast('Нет карточек для SRS!');
    }
    state = { testId:TEST.id, mode:startMode, questions:qs, answers:[], current:0 };
    if(startMode==='flashcards'||startMode==='srs'){ show('flashcardScreen'); renderFC(); }
    else { show('quizScreen'); renderQ(); }
}
function renderQ(){
    const q = state.questions[state.current];
    $('counterBig').textContent = pad(state.current+1);
    $('counterSmall').textContent = state.questions.length;
    $('questionText').textContent = q.question;
    
    let media = '';
    if(q.video) { let vid=q.video; if(vid.includes('v=')) vid=vid.split('v=')[1].split('&')[0]; media+=`<iframe width="100%" height="250" src="https://www.youtube.com/embed/${vid}" style="border-radius:12px;margin-bottom:12px;"></iframe>`; }
    if(q.audio) media+=`<audio controls src="${q.audio}" style="width:100%;margin-bottom:12px;"></audio>`;
    $('questionMedia').innerHTML = media; $('questionMedia').style.display = media ? 'block' : 'none';

    $('options').innerHTML = q.options.map((opt,i)=>`<div class="option" onclick="state.answers[state.current]=${i};renderQ()"><span class="option-marker">${state.answers[state.current]===i?'■':'□'}</span>${opt.text}</div>`).join('');
    $('nextBtn').textContent = state.current===state.questions.length-1 ? 'Завершить' : 'Далее';
}
function nextQuestion(){
    if(state.current < state.questions.length-1){ state.current++; renderQ(); }
    else {
        let correct = 0; state.questions.forEach((q,i)=>{ if(q.options[state.answers[i]]?.correct) correct++; });
        const pct = Math.round(correct/state.questions.length*100);
        show('resultScreen'); $('scoreText').textContent = pct+'%'; $('scoreMsg').textContent = `Правильно: ${correct} из ${state.questions.length}`;
        game.xp += 10; localStorage.setItem('aq_game_v12', JSON.stringify(game)); renderXP();
    }
}
function renderFC(){
    const q = state.questions[state.current];
    $('fcCounterBig').textContent = pad(state.current+1);
    $('fcQuestion').textContent = q.question;
    $('fcAnswer').textContent = q.options ? q.options.filter(o=>o.correct).map(o=>o.text).join(', ') : '';
    $('fcAnswer').classList.add('hidden');
    $('fcActions').innerHTML = `<button class="btn-primary" onclick="$('fcAnswer').classList.remove('hidden');$('fcActions').innerHTML='<button onclick=\\'fcRate(false)\\'>Не знал</button><button onclick=\\'fcRate(true)\\'>Знаю</button>'">Показать</button>`;
}
function fcRate(knew){
    const id = TEST.id + '_' + state.questions[state.current].question;
    srsData[id] = knew ? { next: Date.now() + 2*86400000 } : { next: Date.now() + 5*60000 };
    localStorage.setItem('aq_srs_v12', JSON.stringify(srsData));
    if(state.current < state.questions.length-1){ state.current++; renderFC(); }
    else { show('welcomeScreen'); toast('SRS завершен'); }
}

// CLOUD & LEADERBOARD
async function openSyncModal(){
    if(!sbClient) sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    if(currentUser) { await syncPush(); return; }
    $('syncModal').classList.remove('hidden');
}
async function syncAuth(type){
    const email = $('syncEmail').value, pass = $('syncPass').value;
    let res = type==='login' ? await sbClient.auth.signInWithPassword({email,password:pass}) : await sbClient.auth.signUp({email,password:pass});
    if(res.error) return toast(res.error.message);
    currentUser = res.data.user; $('syncModal').classList.add('hidden'); await syncPush();
}
async function syncPush(){
    await sbClient.from('user_profiles').upsert({ user_id: currentUser.id, tests: tests, game_state: game });
    toast('Синхронизировано ☁️');
}
async function openLeaderboard(){
    if(!sbClient) sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    show('leaderboardScreen'); $('leaderboardContent').innerHTML = 'Загрузка...';
    const {data} = await sbClient.from('leaderboard').select('*').order('xp', {ascending:false}).limit(10);
    if(!data) return;
    $('leaderboardContent').innerHTML = data.map((u,i)=>`<div style="padding:12px;border-bottom:1px solid #333">${i+1}. ${u.name} (Lv.${u.level}) — ${u.xp} XP</div>`).join('');
}

// MULTIPLAYER STUB (Для работы нужен бэкенд, здесь базовый UI)
function openMultiplayerMenu(){ show('multiplayerMenuScreen'); }
function selectTestForHost(){ $('roomPinDisplay').textContent='123456'; show('multiplayerLobbyScreen'); }
function hostStartGame(){ show('quizScreen'); }

// UTILS
function renderXP(){
    $('statXP').textContent = game.xp;
    $('lvlText').textContent = 'Lv.' + Math.floor(game.xp/100);
}
function openShop(){ show('shopScreen'); $('shopContent').innerHTML='<h2>Скоро...</h2>'; }
function openProfile(){ show('profileScreen'); $('profileContent').innerHTML='<h2>Профиль</h2>'; }
function backToWelcome(){ show('welcomeScreen'); }
function openHotkeys(){ $('hotkeysModal').classList.remove('hidden'); }
function openCsvImport(){ $('csvModal').classList.remove('hidden'); }
function openAiChat(){ show('aiChatScreen'); }
function openAiModal(){ $('aiModal').classList.remove('hidden'); }
function closeAiModal(){ $('aiModal').classList.add('hidden'); }
function closeEditor(){ show('welcomeScreen'); }
function addQuestion(){ editing.questions.push({type:'single',question:'',options:[{text:'',correct:true},{text:'',correct:false}]}); renderEditor(); }
function onSearch() {}
function processCsv(){}
function sendChatMessage(){}

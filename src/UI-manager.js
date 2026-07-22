import { AppState, processorSelect, startBtn, stopBtn } from "./main";
import { plotPerformanceCurve, showMemVis, updateMemVis } from "./performanceCurve";

// Sidebar Elements
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// UI elements to change appearance
const settingsOpenBtn = document.getElementById('settings-open-btn');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsModal = document.getElementById('settings-modal');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

export const simdCheckbox = document.getElementById('simd-checkbox');
export const computeType = document.getElementById('compute-type');
export const iterInput = document.getElementById("iter-input");
export const matTestCB = document.getElementById("mat-test-checkbox");
export const aluTestCB = document.getElementById("alu-test-checkbox");
export const stressTestCB = document.getElementById("stress-test-checkbox");
export const matSize = document.getElementById("matrix-size");
export const memTestCB = document.getElementById("mem-test-cb")
export const aiChatCB = document.getElementById("ai-chatCB");

const panelHeader = document.getElementById('set-panel-header');
const panelContent = document.getElementById('set-panel-content');
const chevronIcon = document.getElementById('set-chevron');

const advSettingsToggle = document.getElementById('advanced-set-id');
const advChevronIcon = document.getElementById('adv-chevron');
const advSettingsContainer = document.getElementById('adv-set-container');

const aiCont = document.getElementById("aiChatCont");
const ChatInp = document.getElementById("aiChatInpSec");
const ChatSendBtn = document.getElementById("sendBtnAI");
const aiErrMsg = document.getElementById("ai-err-msg");

panelHeader.addEventListener('click', () => {
    panelContent.classList.toggle('collapsed');
    chevronIcon.classList.toggle('up');
});

advSettingsToggle.addEventListener('click', () => {
    advSettingsContainer.classList.toggle('hidden');
    advChevronIcon.classList.toggle('up');
});

// ai interface
aiChatCB?.addEventListener('change', (e) => {
    aiCont.classList.toggle('hidden', !e.target.checked);
});

function handleAiSubmit() {
    if (ChatInp.value.trim() === "") return;
    
    aiErrMsg.classList.add('show-warning');
    setTimeout(() => aiErrMsg.classList.remove('show-warning'), 20000);
    ChatInp.value = "";
}

ChatSendBtn?.addEventListener('click', handleAiSubmit);
ChatInp?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAiSubmit();
});

// Btns for graphs
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

function toggleSidebar() {
    sidebar.classList.toggle('closed');
    sidebarOverlay.classList.toggle('active');
    menuBtn.classList.toggle('open'); 
}

export function showGraphBtn(showGraph){
    if (!prevBtn || !nextBtn) return;
    if (showGraph && AppState.graphType.length > 1) {
        prevBtn.classList.remove('hidden');
        nextBtn.classList.remove('hidden');
    }
    else {
        prevBtn.classList.add('hidden');
        nextBtn.classList.add('hidden');
    }
}

const matTestRow = matTestCB?.closest('.test-checkbox');
const matSizeRow = matSize?.closest('.hardware-dd-container');

export function isMatTest(isVisible) {
    if (matTestRow) {
        matTestRow.classList.toggle('hidden', !isVisible);
    }
    if (matSizeRow) {
        matSizeRow.classList.toggle('hidden', !isVisible);
    }

    if (!isVisible) {
        matTestCB.checked = false;
    }
}

// won't have to convert flops again
export function flopsFormat(gflops) {
    if (!gflops) return "0.00 GFLOPS";
    return gflops >= 1000 
        ? `${(gflops / 1000).toFixed(2)} TFLOPS` 
        : `${gflops.toFixed(2)} GFLOPS`;
}

export function stressChangeM(currentGflops, baselineGflops) { //manager
    const displayFlops = flopsFormat(currentGflops);
    if (!baselineGflops) return displayFlops;

    const changePercent = ((currentGflops - baselineGflops) / baselineGflops) * 100;
    
    if (changePercent >= 1.0) {
        return `${displayFlops} <span class="inc-percentage">▲ ${changePercent.toFixed(1)}%</span>`;
    } else if (changePercent <= -1.0) {
        return `${displayFlops} <span class="drop-percentage">▼ ${Math.abs(changePercent).toFixed(1)}%</span>`;
    }
    
    return displayFlops;
}

function changeGraphNum(moveGraph){
    if (AppState.graphType.length === 0) return;

    if (moveGraph !== 0 && AppState.graphType.length > 1) {
        AppState.currentGraphNum += moveGraph;
        if (AppState.currentGraphNum < 0) {
            AppState.currentGraphNum = AppState.graphType.length - 1;
        }
        else if (AppState.currentGraphNum >= AppState.graphType.length) {
            AppState.currentGraphNum = 0;
        }
    }

    const activeGraph = AppState.graphType[AppState.currentGraphNum];
    if (activeGraph.isVisualizer) {
        showMemVis(true);
        if (activeGraph.finalBanVal) {
            for (const [type, speed] of Object.entries(activeGraph.finalBanVal)) {
                updateMemVis(type, speed, 700);
            }
        }
    } else {
        showMemVis(false);
        AppState.currentGraphData = activeGraph.data;

        plotPerformanceCurve(AppState.currentGraphData);

   const resultText = document.getElementsByClassName('.metric-box h3');
    const displayText = document.getElementById("gflops-current");
   if (resultText && displayText) {
            const maxGflops = Math.max(...activeGraph.data.map(item => item.gflops || 0));
            if (activeGraph.name && activeGraph.name.includes('Memory')) {
                displayText.innerText = `${maxGflops.toFixed(2)} GB/s`;
            } else if (maxGflops >= 1000) {
                displayText.innerText = `${(maxGflops / 1000).toFixed(2)} TFLOPS`;
            } else {
                displayText.innerText = `${maxGflops.toFixed(2)} GFLOPS`;
            }
        }
    }
}

export function graphSync() {
    changeGraphNum(0);
}

if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => changeGraphNum(-1));
    nextBtn.addEventListener('click', () => changeGraphNum(1));
}

function stressTestUI(onStressTest) {
    if (onStressTest) {
        matTestCB.checked = false;
        aluTestCB.checked = false;
        matTestCB.disabled = true;
        aluTestCB.disabled = true;
        memTestCB.checked = false;
        memTestCB.disabled = true;
        aiChatCB.checked = false;
        aiChatCB.disabled = true;
        aiCont.classList.add("hidden");
    }
    else {
        matTestCB.disabled = false;
        aluTestCB.disabled = processorSelect.value === "CPU"; // disable ALU test if CPU is selected
        memTestCB.disabled = false;
        aiChatCB.disabled = false;
    }
}

export function updateTimerDisplay() {
    const timeLeft = AppState.stressRunTime - Date.now();
    if (timeLeft <= 0) {
        document.getElementById('time-remaining').innerText = '';
        clearInterval(AppState.RunTimeState);
        if (AppState.isEngineRunning) {
            stopBtn.click();
        } 
    }
    else {
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        document.getElementById('time-remaining').innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}s`;
    }
}

document.getElementById('add-time-btn')?.addEventListener('click', () => {
    AppState.stressRunTime += 60000;
    updateTimerDisplay();;
});
document.getElementById('reduce-time-btn')?.addEventListener('click', () => {
    if (AppState.stressRunTime - Date.now() > 60000) {
        AppState.stressRunTime -= 60000;
        updateTimerDisplay();
    }
});

export function updatePreciOption() {
    computeType.innerHTML = '';
    const isSIMD = simdCheckbox.checked;
    const isCPU = processorSelect.value === "CPU";

    if (isSIMD) {
        computeType.add(new Option('Float4 (32-bit)', 'f4-vec-f32'));

        if (isCPU) {
            computeType.add(new Option('Float2 (64-bit)', 'f2-vec-f64')); 
        } else {
            computeType.add(new Option('Float4 (16-bit)', 'f4-vec-f16')); 
        }
    }
    else {
        computeType.add(new Option('F32 Scalar', "f32-scalar"));

        if (isCPU) {
            computeType.add(new Option('F64 Scalar', 'f64-scalar')); 
        } else {
            computeType.add(new Option('F16 Scalar', 'f16-scalar')); 
        }
    }
    
    const savedPrecision = localStorage.getItem('benchmark_precision');
    let optionExists = Array.from(computeType.options).some(opt => opt.value === savedPrecision);
    
    if (optionExists) {
        computeType.value = savedPrecision;
    } else {
        computeType.selectedIndex = 0;
        localStorage.setItem('benchmark_precision', computeType.value);
    }
}

menuBtn.addEventListener('click', toggleSidebar);

sidebarOverlay.addEventListener('click', () => {
    if(!sidebar.classList.contains('closed')) {
        toggleSidebar();
    }
});

settingsOpenBtn.addEventListener('click', () => {
    // close sidebar when opening settings on mobile
    if(window.innerWidth <= 850 && !sidebar.classList.contains('closed')) {
        toggleSidebar();
    }
    settingsModal.classList.remove('hidden');
});

settingsCloseBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.add('hidden');
    }
});

themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');

    if (document.body.classList.contains('light-mode')) {
        themeToggleBtn.innerText = "Switch to Dark Mode";
        localStorage.setItem('benchmark_appearance', 'light');
    } 
    else {
        themeToggleBtn.innerText = "Switch to Light Mode";
        localStorage.setItem("benchmark_appearance", "dark");
    }

    if (AppState.currentGraphData.length > 0) {
        plotPerformanceCurve(AppState.currentGraphData);
    }
});

// for init settings on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem("benchmark_appearance");
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        themeToggleBtn.innerText = 'Switch to Dark Mode'
    }
    else {
        themeToggleBtn.innerText = "Switch to Light Mode"
    }

    // iters management
    const savedIters = localStorage.getItem("benchmark_iters");
    if (savedIters) {
        iterInput.value = savedIters;
    }

    // simd management
    const storedSimd = localStorage.getItem("benchmark_simd") || 'true'; // default to true on first visit
    const savedSimd = storedSimd === 'true';
    simdCheckbox.checked = savedSimd;

    const savedMatTest = localStorage.getItem("benchmark_mat_test");
    if (savedMatTest !== null) {
        matTestCB.checked = savedMatTest === 'true';
    }

    const savedAluTest = localStorage.getItem("benchmark_alu_test");
    if (savedAluTest !== null) {
        aluTestCB.checked = savedAluTest === 'true';
    }

    const savedStressTest = localStorage.getItem("benchmark_stress_test");
    if (savedStressTest !== null) {
        stressTestCB.checked = savedStressTest === 'true';
        stressTestUI(savedStressTest === 'true');
    }
    updatePreciOption();

    const savedMemTest = localStorage.getItem("benchmark_mem_test");
    if (savedMemTest !== null) {
        memTestCB.checked = savedMemTest === 'true';
    }

    const savedPrecision = localStorage.getItem("benchmark_precision");
    if (savedPrecision) {
        computeType.value = savedPrecision;
        localStorage.setItem("benchmark_precision", savedPrecision);
    }

    setTimeout(() => {
        const cores = navigator.hardwareConcurrency || 'Unknown';
        document.getElementById('core-count').innerText = `${cores} Threads`;
    }, 800);
});
simdCheckbox.addEventListener('change', (e)=> {
    localStorage.setItem('benchmark_simd', e.target.checked);
    updatePreciOption();
});

matTestCB.addEventListener('change', (e) => {
    localStorage.setItem('benchmark_mat_test', e.target.checked);
});

stressTestCB.addEventListener('change', (e) => {
    localStorage.setItem('benchmark_stress_test', e.target.checked);
    stressTestUI(e.target.checked);
});

aluTestCB.addEventListener('change', (e) => {
    localStorage.setItem('benchmark_alu_test', e.target.checked);
});

memTestCB.addEventListener('change', (e) => {
    localStorage.setItem('benchmark_mem_test', e.target.checked);
})

computeType.addEventListener('change', (e) => {
    localStorage.setItem('benchmark_precision', e.target.value);
});

iterInput.addEventListener('change', (e) => {
    let val = parseInt(e.target.value);
    if (isNaN(val) || val <= 0){
        e.target.value = 1;
    }
    else if (val >= 100){
        e.target.value = 99;
    }
    localStorage.setItem('benchmark_iters', e.target.value);
});

const iterUp = document.getElementById("iter-up");
const iterDown = document.getElementById("iter-down");

iterUp.addEventListener("click", () =>{
    let val = parseInt(iterInput.value) || 1;
    if (val < 99) {
        iterInput.value = val + 1;
        iterInput.dispatchEvent(new Event('change'));
    }
});

iterDown.addEventListener('click', () => {
    let val = parseInt(iterInput.value) || 1;
    if (val > 1) {
        iterInput.value = val - 1;
        iterInput.dispatchEvent(new Event("change"));
    }
});

// prevent user from changing settings while benchmark is running
export function toggleUILock(isLocked){
    iterInput.disabled = isLocked;
    computeType.disabled = isLocked;
    processorSelect.disabled = isLocked;
    simdCheckbox.disabled = isLocked;
    matSize.disabled = isLocked;
    memTestCB.disabled = isLocked;
    matTestCB.disabled = isLocked;
    advSettingsToggle.disabled = isLocked;
    stressTestCB.disabled = isLocked;
    aiChatCB.disabled = isLocked;
    if (isLocked) {
        startBtn.classList.add('is-disabled');
    } else {
        startBtn.classList.remove('is-disabled');
    }

    if (isLocked) {
        aluTestCB.disabled = true; // disable alu when running
    }
    else {
        aluTestCB.disabled = processorSelect.value === "CPU" // enable alu if CPU isn't selected
    }

    aluTestCB.disabled = isLocked;

    const iterArrows = document.querySelector('.iter-arrow');
    if (iterArrows) {
        iterArrows.style.pointerEvents = isLocked ? 'none' : 'auto';
        iterArrows.style.opacity = isLocked ? '0.5' : '1';
    }
}
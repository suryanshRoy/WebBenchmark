import { AppState, processorSelect, startBtn, warningMsg } from "./main";
import { plotPerformanceCurve } from "./performanceCurve";

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

const panelHeader = document.getElementById('set-panel-header');
const panelContent = document.getElementById('set-panel-content');
const chevronIcon = document.getElementById('set-chevron');

const advSettingsToggle = document.getElementById('advanced-set-id');
const advChevronIcon = document.getElementById('adv-chevron');
const advSettingsContainer = document.getElementById('adv-set-container');

panelHeader.addEventListener('click', () => {
    panelContent.classList.toggle('collapsed');
    chevronIcon.classList.toggle('up');
});

advSettingsToggle.addEventListener('click', () => {
    advSettingsContainer.classList.toggle('hidden');
    advChevronIcon.classList.toggle('up');
});

// Btns for graphs
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

function toggleSidebar() {
    sidebar.classList.toggle('closed');
    sidebarOverlay.classList.toggle('active');
    
    // Add this line to trigger the CSS morph animation!
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

function changeGraphNum(moveGraph){
    if (AppState.graphType.length <= 1) return;
    AppState.currentGraphNum += moveGraph;
    if (AppState.currentGraphNum < 0) {
        AppState.currentGraphNum = AppState.graphType.length - 1;
    }
    else if (AppState.currentGraphNum >= AppState.graphType.length) {
        AppState.currentGraphNum = 0;
    }

    const activeGraph = AppState.graphType[AppState.currentGraphNum];
    AppState.currentGraphData = activeGraph.data;
    
    plotPerformanceCurve(AppState.currentGraphData);

   const resultText = document.getElementsByClassName('.metric-box h3');
   const displayText = document.getElementById("gflops-current");
   if (resultText && displayText) {
        const maxGflops = Math.max(...activeGraph.data.map(item => item.gflops || 0));
        if (maxGflops >= 1000) {
            displayText.innerText = `${(maxGflops / 1000).toFixed(2)} TFLOPS`;
        } else {
            displayText.innerText = `${maxGflops.toFixed(2)} GFLOPS`;
        }
   }
}

if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => changeGraphNum(-1));
    nextBtn.addEventListener('click', () => changeGraphNum(1));
}

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

// for UI settings pop
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem("benchmark_appearance");
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        themeToggleBtn.innerText = 'Switch to Dark Mode'
    }
    else {
        themeToggleBtn.innerText = "Switch to Light Mode"
    }

    const savedIters = localStorage.getItem("benchmark_iters");
    if (savedIters) {
        iterInput.value = savedIters;
    }
    // savedPrecision defined before cause it gets overwrite by simd
    const savedPrecision = localStorage.getItem("benchmark_precision");
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
    updatePreciOption();

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

aluTestCB.addEventListener('change', (e) => {
    localStorage.setItem('benchmark_alu_test', e.target.checked);
});

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

    matTestCB.disabled = isLocked;
    advSettingsToggle.disabled = isLocked;

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
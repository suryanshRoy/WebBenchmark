const memResElem = {
    read: document.getElementById('memory-read-speed'),
    write: document.getElementById('memory-write-speed'),
    copy: document.getElementById('memory-copy-speed')
};

const canv = document.getElementById('gflops-canvas');
const Mem_vis = document.getElementById('mem-visualizer');
const memResult = document.getElementById('memory-results');
const resultF = document.getElementById('gflops-current');
const rawOut = document.getElementById('raw-terminal');

export function showMemVis(show) {
    canv?.classList.toggle('hidden', show);
    Mem_vis?.classList.toggle('hidden', !show);
    resultF?.classList.toggle('hidden', show);
    memResult?.classList.toggle('hidden', !show);
}

export function resetMemVis() {
    showMemVis(false);
    rawOut?.replaceChildren();

    for (const type of Object.keys(memResElem)) {
        const bar = document.getElementById(`mem-bar-${type}`);
        const value = document.getElementById(`mem-val-${type}`);
        if (bar) bar.style.width = '0%';
        if (value) value.innerText = '0 GB/s';
        if (memResElem[type]) memResElem[type].innerText = '0.00 GB/s';
    }
}

export function updateMemVis(type, speed, maxMemBand) {
    const bar = document.getElementById(`mem-bar-${type}`);
    const value = document.getElementById(`mem-val-${type}`);
    const percentage = Math.min((speed / maxMemBand) * 100, 100);

    if (bar) bar.style.width = `${percentage}%`;
    if (value) value.innerText = `${speed.toFixed(0)} GB/s`;
    if (memResElem[type]) memResElem[type].innerText = `${speed.toFixed(2)} GB/s`;
}

export function addMemLog(message, isHeading = false) {
    if (!rawOut) return;

    const line = document.createElement('div');
    line.innerText = message;
    if (isHeading) line.classList.add('mem-log');
    rawOut.append(line);
    rawOut.scrollTop = rawOut.scrollHeight;
}

export function plotPerformanceCurve(performanceData) {
    const canvas = document.getElementById('gflops-canvas'); 
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight || 250;

    ctx.clearRect(0, 0, canvas.width, canvas.height); // clear up the graph before plotting newer

    const placeholder = canvas.parentElement.querySelector('.placeholder-text');
    if (placeholder) placeholder.style.display = 'none';
    if (performanceData.length < 2) return;

    const maxGflops = Math.max(...performanceData.map(d => d.gflops), 1);

    const padding = {top: 35, right: 20, bottom: 30, left: 50};
    const graphWidth = canvas.width - padding.left - padding.right;
    const graphHeight = canvas.height - padding.top - padding.bottom;
    const bottomY = canvas.height - padding.bottom;

    const isLightMode = document.body.classList.contains('light-mode');
    const axisColor = isLightMode ? 'rgb(0, 25, 12)' : 'rgba(255, 255, 255, 0.2)';
    const gridTextColor = isLightMode ? 'rgba(21, 22, 23, 0.89)' : 'rgba(230, 230, 230, 0.9)';
    const scaleTextColor = isLightMode ? 'rgba(28, 29, 31, 0.93)' : 'rgba(230, 230, 230, 0.9)';
    const maxGflopsColor = isLightMode ? 'rgba(0, 140, 110, 0.8)' : 'rgba(98, 242, 108, 0.87)';
    const nodeTextColor = isLightMode ? 'rgba(0, 140, 114, 0.85)' : 'rgb(0, 201, 205)';
    const lineColor = isLightMode ? 'rgba(18, 210, 175, 0.84)' : 'rgba(0, 255, 204, 0.86)';
    const gradientStart = isLightMode ? 'rgba(37, 207, 165, 0.66)' : 'rgba(0, 255, 204, 0.29)';
    const gradientEnd = isLightMode ? 'rgba(142, 182, 223, 0.68)' : 'rgba(0, 72, 92, 0.09)';

    ctx.beginPath();
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, bottomY);
    ctx.lineTo(canvas.width - padding.right, bottomY);
    ctx.stroke();
    
    let coords = [];
    performanceData.forEach((point, index) => {
        const x = padding.left + (index / (performanceData.length - 1)) * graphWidth;
        const heightRatio = point.gflops / maxGflops;
        const y = bottomY - (heightRatio * graphHeight);
        coords.push({x, y});
    });

    // Draw line of GFLOPS
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) {
        ctx.lineTo(coords[i].x, coords[i].y);
    }
    ctx.stroke();

    ctx.lineTo(coords[coords.length - 1].x, bottomY);
    ctx.lineTo(coords[0].x, bottomY);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, bottomY);
    gradient.addColorStop(0, gradientStart);
    gradient.addColorStop(1, gradientEnd);
    ctx.fillStyle = gradient;
    ctx.fill();

    const isALU = performanceData.length > 0 && performanceData[0].matrix === null;
    const isStressTest = performanceData.length > 0 && performanceData.some(point => point.matrix === 'throttleTest');

    coords.forEach((coord, index) => {
        // Display points on Graph
        const point = performanceData[index];

        if (!isALU && !isStressTest) {
        ctx.fillStyle = 'rgba(255, 49, 49, 0.82)';
        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // label grids on graph
        ctx.fillStyle = gridTextColor;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';

        const labelText = String(point.matrix).startsWith("L") ? point.matrix : `M:${point.matrix}`;
        ctx.fillText(labelText, coord.x, bottomY + 15);
        
        ctx.fillStyle = nodeTextColor;
        ctx.fillText(`${point.gflops.toFixed(0)} GF`, coord.x, coord.y - 10);
        } 
        else if (isALU) {
            if (index % 10 === 0){
                ctx.fillStyle = gridTextColor;
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`${(index / 10).toFixed(0)}s`, coord.x, bottomY + 15);
            }
        }
        else if (isStressTest) {
            if (index % 10 === 0){
                ctx.fillStyle = gridTextColor;
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`|`, coord.x, bottomY + 15);
            }
        }
    });

    // Y-axis limits
    ctx.fillStyle = scaleTextColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${maxGflops.toFixed(0)}`, padding.left - 8, padding.top);
    ctx.fillText(`${(maxGflops / 2).toFixed(0)}`, padding.left - 8, padding.top + (graphHeight / 2));
    ctx.fillText(`0`, padding.left - 8, bottomY);

    ctx.fillStyle = maxGflopsColor;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const maxTflops = maxGflops >= 1000 
        ? `Max Value: ${(maxGflops/1000).toFixed(2)} TFLOPS` 
        : `Max Value: ${maxGflops.toFixed(1)} GFLOPS`;
    ctx.fillText(maxTflops, padding.left, 5);
}
function renderBarChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth || 320;
    const height = canvas.height = 200;
    ctx.clearRect(0, 0, width, height);
    if (!data.length) {
        ctx.fillStyle = '#666';
        ctx.fillText('Sem dados ainda', 10, 30);
        return;
    }
    const max = Math.max(...data.map((d) => Number(d.value) || 0), 1);
    const barWidth = (width - 40) / data.length;
    data.forEach((item, index) => {
        const barHeight = ((Number(item.value) || 0) / max) * (height - 60);
        const x = 20 + index * barWidth;
        const y = height - barHeight - 30;
        ctx.fillStyle = '#f7b500';
        ctx.fillRect(x, y, barWidth - 10, barHeight);
        ctx.fillStyle = '#222';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(String(item.label), x, height - 10);
        ctx.fillText(String(item.value || 0), x, y - 5);
    });
}

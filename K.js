function buildDataIndex(rawData) {
  ALL_CARDS = rawData;
  const byDrill = {};
  rawData.forEach(c => {
    (byDrill[c.drill] = byDrill[c.drill] || []).push(c);
  });
  DRILLS = byDrill;
  DRILL_META = Object.keys(byDrill).sort((a,b)=>a-b).map(k => {
    const arr = byDrill[k];
    arr.sort((a,b) => a.seq - b.seq); // Strictly enforce sequential order
    return { num: +k, start: arr[0].word, end: arr[arr.length-1].word, count: arr.length };
  });
}
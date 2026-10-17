// Intelligent, zero-dependency natural language task parser for Fintask
// Recognizes deadlines, relative times, days of week, and priority tokens

export function parseTaskNlp(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { hasSuggestion: false, cleanTitle: rawInput, detectedDueAt: null, detectedPriority: null, label: '' };
  }

  let text = rawInput;
  let detectedPriority = null;
  let detectedDueAt = null;
  let matchedSnippets = [];

  // 1. Detect Priority: !p1, !high, !urgent, #p1, #high, !p2, !med, #p2, !p3, !low, #p3
  const p1Match = text.match(/(?:^|\s)(!p1|!high|!urgent|#p1|#high)(?=\s|$)/i);
  if (p1Match) {
    detectedPriority = 1;
    matchedSnippets.push(p1Match[1]);
    text = text.replace(p1Match[1], ' ');
  }

  const p2Match = text.match(/(?:^|\s)(!p2|!med|!medium|#p2|#med)(?=\s|$)/i);
  if (!detectedPriority && p2Match) {
    detectedPriority = 2;
    matchedSnippets.push(p2Match[1]);
    text = text.replace(p2Match[1], ' ');
  }

  const p3Match = text.match(/(?:^|\s)(!p3|!low|#p3|#low)(?=\s|$)/i);
  if (!detectedPriority && p3Match) {
    detectedPriority = 3;
    matchedSnippets.push(p3Match[1]);
    text = text.replace(p3Match[1], ' ');
  }

  // Helper to format Date to YYYY-MM-DDTHH:MM
  const formatIso = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const now = new Date();

  // 2. Relative Hours / Minutes: "in 2 hours", "in 30 mins", "in 1h", "in 45m"
  const relHoursMatch = text.match(/(?:^|\s)(in\s+(\d+)\s*(?:hours?|hrs?|h))(?=\s|$)/i);
  if (relHoursMatch) {
    const h = parseInt(relHoursMatch[2], 10);
    const target = new Date(now.getTime() + h * 60 * 60 * 1000);
    detectedDueAt = formatIso(target);
    matchedSnippets.push(relHoursMatch[1]);
    text = text.replace(relHoursMatch[1], ' ');
  }

  const relMinsMatch = text.match(/(?:^|\s)(in\s+(\d+)\s*(?:mins?|minutes?|m))(?=\s|$)/i);
  if (!detectedDueAt && relMinsMatch) {
    const m = parseInt(relMinsMatch[2], 10);
    const target = new Date(now.getTime() + m * 60 * 1000);
    detectedDueAt = formatIso(target);
    matchedSnippets.push(relMinsMatch[1]);
    text = text.replace(relMinsMatch[1], ' ');
  }

  // 3. Named Expressions: "tonight"
  const tonightMatch = text.match(/(?:^|\s)(tonight(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?)(?=\s|$)/i);
  if (!detectedDueAt && tonightMatch) {
    const d = new Date(now);
    let hour = 21;
    let min = 0;
    if (tonightMatch[2]) {
      let h = parseInt(tonightMatch[2], 10);
      const isPm = tonightMatch[4] && tonightMatch[4].toLowerCase() === 'pm';
      const isAm = tonightMatch[4] && tonightMatch[4].toLowerCase() === 'am';
      if (isPm && h < 12) h += 12;
      if (isAm && h === 12) h = 0;
      hour = h;
      min = tonightMatch[3] ? parseInt(tonightMatch[3], 10) : 0;
    }
    d.setHours(hour, min, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    detectedDueAt = formatIso(d);
    matchedSnippets.push(tonightMatch[1]);
    text = text.replace(tonightMatch[1], ' ');
  }

  // 4. "tomorrow morning" / "tomorrow evening" / "tomorrow 5pm" / "tomorrow at 3pm" / "tomorrow"
  const tomorrowMatch = text.match(/(?:^|\s)(tomorrow(?:\s+(morning|evening|afternoon|(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?))?)(?=\s|$)/i);
  if (!detectedDueAt && tomorrowMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    let hour = 9;
    let min = 0;
    const sub = (tomorrowMatch[2] || '').toLowerCase();
    if (sub.includes('morning')) {
      hour = 9;
    } else if (sub.includes('evening') || sub.includes('afternoon')) {
      hour = 17;
    } else if (tomorrowMatch[3]) {
      let h = parseInt(tomorrowMatch[3], 10);
      const isPm = tomorrowMatch[5] && tomorrowMatch[5].toLowerCase() === 'pm';
      const isAm = tomorrowMatch[5] && tomorrowMatch[5].toLowerCase() === 'am';
      if (isPm && h < 12) h += 12;
      if (isAm && h === 12) h = 0;
      hour = h;
      min = tomorrowMatch[4] ? parseInt(tomorrowMatch[4], 10) : 0;
    }
    d.setHours(hour, min, 0, 0);
    detectedDueAt = formatIso(d);
    matchedSnippets.push(tomorrowMatch[1]);
    text = text.replace(tomorrowMatch[1], ' ');
  }

  // 5. Day of Week: "this friday", "friday", "next monday", "monday at 3pm"
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayRegex = new RegExp(`(?:^|\\s)((?:this\\s+|next\\s+)?(${dayNames.join('|')})(?:\\s+(?:at\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?)?)(?=\\s|$)`, 'i');
  const dayMatch = text.match(dayRegex);
  if (!detectedDueAt && dayMatch) {
    const dayIndex = dayNames.indexOf(dayMatch[2].toLowerCase());
    const isNext = (dayMatch[1] || '').toLowerCase().startsWith('next');
    const d = new Date(now);
    const currentDay = d.getDay();
    let diff = (dayIndex - currentDay + 7) % 7;
    if (diff === 0 || isNext) diff += 7;
    d.setDate(d.getDate() + diff);

    let hour = dayIndex === 5 ? 17 : 9; // Friday defaults to 5pm, others to 9am
    let min = 0;
    if (dayMatch[3]) {
      let h = parseInt(dayMatch[3], 10);
      const isPm = dayMatch[5] && dayMatch[5].toLowerCase() === 'pm';
      const isAm = dayMatch[5] && dayMatch[5].toLowerCase() === 'am';
      if (isPm && h < 12) h += 12;
      if (isAm && h === 12) h = 0;
      hour = h;
      min = dayMatch[4] ? parseInt(dayMatch[4], 10) : 0;
    }
    d.setHours(hour, min, 0, 0);
    detectedDueAt = formatIso(d);
    matchedSnippets.push(dayMatch[1]);
    text = text.replace(dayMatch[1], ' ');
  }

  // 6. Generic "at 4pm", "at 10:30am" today
  const timeOnlyMatch = text.match(/(?:^|\s)(at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm))(?=\s|$)/i);
  if (!detectedDueAt && timeOnlyMatch) {
    let h = parseInt(timeOnlyMatch[2], 10);
    const isPm = timeOnlyMatch[4].toLowerCase() === 'pm';
    const isAm = timeOnlyMatch[4].toLowerCase() === 'am';
    if (isPm && h < 12) h += 12;
    if (isAm && h === 12) h = 0;
    const min = timeOnlyMatch[3] ? parseInt(timeOnlyMatch[3], 10) : 0;

    const d = new Date(now);
    d.setHours(h, min, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1); // If time has passed today, assume tomorrow
    detectedDueAt = formatIso(d);
    matchedSnippets.push(timeOnlyMatch[1]);
    text = text.replace(timeOnlyMatch[1], ' ');
  }

  const cleanTitle = text.replace(/\s+/g, ' ').trim();
  const hasSuggestion = Boolean(detectedDueAt || detectedPriority);

  let labelParts = [];
  if (detectedDueAt) {
    const d = new Date(detectedDueAt);
    const formattedDate = d.toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    labelParts.push(`📅 ${formattedDate}`);
  }
  if (detectedPriority) {
    const pLabel = detectedPriority === 1 ? '🔥 High (P1)' : (detectedPriority === 2 ? '⚡ Med (P2)' : '🌱 Low (P3)');
    labelParts.push(pLabel);
  }

  return {
    hasSuggestion,
    cleanTitle: cleanTitle || rawInput.trim(),
    detectedDueAt,
    detectedPriority,
    label: labelParts.join(' • '),
    rawSnippet: matchedSnippets.join(', ')
  };
}

export const CHANNELS = [
  {
    num: '02',
    name: 'NIGHT OWL',
    callsign: 'KOWL',
    genre: 'LATE NIGHT',
    theme: 'lateNight',
    accent: '#ffb347',
    accent2: '#ff7a3c',
    offset: 0,
    desc: 'Call-in conversation for the beautifully awake.',
    programs: [
      { title: 'After Hours', minutes: 60 },
      { title: 'Midnight Calls', minutes: 30 },
      { title: 'The Static Hour', minutes: 60 },
      { title: 'Dawn Patrol', minutes: 30 }
    ]
  },
  {
    num: '04',
    name: 'STORM DESK',
    callsign: 'KTMP',
    genre: 'WEATHER',
    theme: 'weather',
    accent: '#6fe3ff',
    accent2: '#3b82f6',
    offset: 15,
    desc: 'Doppler, lightning, and a little bit of dread.',
    programs: [
      { title: 'Storm Desk Live', minutes: 30 },
      { title: 'Radar Watch', minutes: 30 },
      { title: 'Coastal Forecast', minutes: 30 },
      { title: 'Weather Wire', minutes: 30 }
    ]
  },
  {
    num: '05',
    name: 'PUBLIC ACCESS',
    callsign: 'KACC',
    genre: 'VARIETY',
    theme: 'access',
    accent: '#ff5edb',
    accent2: '#7c5cff',
    offset: 45,
    desc: 'Nobody approved this broadcast. That is the point.',
    programs: [
      { title: 'Open Frequency', minutes: 60 },
      { title: 'The Liquid Room', minutes: 30 },
      { title: 'Viewer Mail', minutes: 30 },
      { title: 'Test Patterns', minutes: 60 }
    ]
  },
  {
    num: '07',
    name: 'VALUE VISION',
    callsign: 'KVLV',
    genre: 'SHOPPING',
    theme: 'infomercial',
    accent: '#ffe14d',
    accent2: '#ff8a1f',
    offset: 30,
    desc: 'Operators are standing by. They always are.',
    programs: [
      { title: 'Miracle Mop Live', minutes: 30 },
      { title: 'Set It & Forget It', minutes: 30 },
      { title: 'The $19.99 Show', minutes: 60 },
      { title: 'Call Now!', minutes: 30 }
    ]
  },
  {
    num: '09',
    name: 'NEON FM',
    callsign: 'KNFM',
    genre: 'MUSIC',
    theme: 'synth',
    accent: '#8b5cf6',
    accent2: '#22d3ee',
    offset: 10,
    desc: 'Music television after the last train home.',
    programs: [
      { title: 'Neon Nights', minutes: 60 },
      { title: 'Midnight Drive', minutes: 30 },
      { title: 'Waveform', minutes: 30 },
      { title: 'The Chrome Hour', minutes: 60 }
    ]
  },
  {
    num: '11',
    name: 'ACTION 11',
    callsign: 'KACT',
    genre: 'NEWS',
    theme: 'news',
    accent: '#ff4d4d',
    accent2: '#ffb347',
    offset: 0,
    desc: 'Breaking, developing, and slightly breathless.',
    programs: [
      { title: 'Action News at 11', minutes: 30 },
      { title: 'The Briefing', minutes: 30 },
      { title: 'City Hall Live', minutes: 30 },
      { title: 'Night Beat', minutes: 30 }
    ]
  },
  {
    num: '13',
    name: 'TOON LOOP',
    callsign: 'KTLP',
    genre: 'KIDS',
    theme: 'cartoons',
    accent: '#38e07b',
    accent2: '#ffd166',
    offset: 25,
    desc: 'Bright colors, loud noises, questionable physics.',
    programs: [
      { title: 'Toon Loop', minutes: 30 },
      { title: 'Rocket Pals', minutes: 30 },
      { title: 'Mud Buddies', minutes: 30 },
      { title: 'Cartoon Carnivale', minutes: 60 }
    ]
  },
  {
    num: '17',
    name: 'GRINDHOUSE',
    callsign: 'KGRD',
    genre: 'MOVIES',
    theme: 'grindhouse',
    accent: '#ff7a1a',
    accent2: '#c0262d',
    offset: 40,
    desc: 'Chrome, dust, and revenge at 24 frames per second.',
    programs: [
      { title: 'Drive Into Darkness', minutes: 90 },
      { title: 'Chrome & Dust', minutes: 60 },
      { title: 'The Last Exit', minutes: 60 }
    ]
  },
  {
    num: '21',
    name: 'DEEP FIELD',
    callsign: 'KDFD',
    genre: 'SCIENCE',
    theme: 'starfield',
    accent: '#6ea8ff',
    accent2: '#b06bff',
    offset: 5,
    desc: 'The universe, narrated very slowly.',
    programs: [
      { title: 'Deep Field', minutes: 60 },
      { title: 'Orbit Report', minutes: 30 },
      { title: 'Pale Blue Dot', minutes: 60 },
      { title: 'Signal Lost', minutes: 30 }
    ]
  },
  {
    num: '28',
    name: 'RETRO ACTIVE',
    callsign: 'KRTA',
    genre: 'COMEDY',
    theme: 'sitcom',
    accent: '#f97316',
    accent2: '#ffd166',
    offset: 20,
    desc: 'A live studio audience and one very loud couch.',
    programs: [
      { title: 'Must See Sunday', minutes: 30 },
      { title: 'The Laugh Track', minutes: 30 },
      { title: 'Apartment 4C', minutes: 30 },
      { title: 'Family Static', minutes: 60 }
    ]
  },
  {
    num: '33',
    name: 'CAST IRON',
    callsign: 'KCST',
    genre: 'FOOD',
    theme: 'cooking',
    accent: '#ffd166',
    accent2: '#ff7a1a',
    offset: 50,
    desc: 'Butter is a personality trait.',
    programs: [
      { title: 'Sizzle & Serve', minutes: 30 },
      { title: 'Cast Iron Hour', minutes: 30 },
      { title: 'Late Night Bites', minutes: 30 },
      { title: 'Pantry Raid', minutes: 60 }
    ]
  },
  {
    num: '36',
    name: 'OFF AIR',
    callsign: 'KTST',
    genre: 'TEST',
    theme: 'testpattern',
    accent: '#cbd5e1',
    accent2: '#64748b',
    offset: 0,
    desc: 'Please stand by. Or do not. It is your evening.',
    programs: [
      { title: 'Off Air', minutes: 120 },
      { title: 'Test Pattern', minutes: 60 },
      { title: 'Technical Difficulties', minutes: 60 }
    ]
  }
];

export const LAYOUTS = {
  '2x2': { cols: 2, count: 4, width: 480, height: 270 },
  '3x2': { cols: 3, count: 6, width: 480, height: 360 },
  '3x3': { cols: 3, count: 9, width: 480, height: 270 },
  '4x3': { cols: 4, count: 12, width: 480, height: 360 }
};

function cycleMinutes(channel) {
  return channel.programs.reduce((total, program) => total + program.minutes, 0);
}

function dayAnchorMs(channel, timeMs) {
  const midnight = new Date(timeMs);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime() + (channel.offset || 0) * 60000;
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function programAt(channel, timeMs = Date.now()) {
  const cycle = cycleMinutes(channel);
  const elapsed = (timeMs - dayAnchorMs(channel, timeMs)) / 60000;
  const position = positiveModulo(elapsed, cycle);
  let cursor = 0;

  for (let index = 0; index < channel.programs.length; index += 1) {
    const program = channel.programs[index];
    if (position < cursor + program.minutes) {
      const startMs = timeMs - (position - cursor) * 60000;
      return {
        title: program.title,
        minutes: program.minutes,
        index,
        startMs,
        endMs: startMs + program.minutes * 60000
      };
    }
    cursor += program.minutes;
  }

  const fallback = channel.programs[0];
  return {
    title: fallback.title,
    minutes: fallback.minutes,
    index: 0,
    startMs: timeMs,
    endMs: timeMs + fallback.minutes * 60000
  };
}

export function scheduleBetween(channel, startMs, endMs) {
  const current = programAt(channel, startMs);
  const entries = [];
  let cursor = current.startMs;
  let index = current.index;
  let guard = 0;

  while (cursor < endMs && guard < 100) {
    const program = channel.programs[index % channel.programs.length];
    const item = {
      title: program.title,
      minutes: program.minutes,
      startMs: cursor,
      endMs: cursor + program.minutes * 60000
    };
    if (item.endMs > startMs) entries.push(item);
    cursor = item.endMs;
    index += 1;
    guard += 1;
  }

  return entries;
}

export function nextPrograms(channel, timeMs, count = 4) {
  const current = programAt(channel, timeMs);
  const items = [];
  let cursor = current.startMs;
  let index = current.index;

  for (let step = 0; step < count; step += 1) {
    const program = channel.programs[index % channel.programs.length];
    items.push({
      title: program.title,
      minutes: program.minutes,
      startMs: cursor,
      endMs: cursor + program.minutes * 60000,
      isNow: step === 0
    });
    cursor += program.minutes * 60000;
    index += 1;
  }

  return items;
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: '2-digit',
  month: 'short'
});

export function formatTime(value) {
  return timeFormatter.format(new Date(value));
}

export function formatDate(value) {
  return dateFormatter.format(new Date(value)).replace(/,/g, '').toUpperCase();
}

export function formatSeconds(value) {
  const total = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function tickerMarkup(now = Date.now()) {
  return CHANNELS.map((channel) => {
    const program = programAt(channel, now);
    return `<span><b>${channel.num} ${channel.name}</b> ${program.title.toUpperCase()}</span>`;
  }).join('<span aria-hidden="true">•</span>');
}

// lib.jsx — shared tokens, i18n, icons, primitives for all FitnessMaxxing variations.
// Exports to window. Load AFTER React/Babel, BEFORE variation screen files.

// ─────────────────────────────────────────────────────────────
// Bilingual strings — Swedish (current app) + English (V2 launch)
// ─────────────────────────────────────────────────────────────
const I18N = {
  sv: {
    // Auth
    signIn: 'Logga in',
    signUp: 'Registrera',
    signingIn: 'Loggar in…',
    email: 'E-post',
    password: 'Lösenord',
    noAccount: 'Inget konto?',
    forgotPassword: 'Glömt lösenord?',
    welcome: 'Välkommen tillbaka',
    welcomeSub: 'Logga in för att fortsätta din resa.',

    // Tabs
    plans: 'Planer',
    history: 'Historik',
    settings: 'Inställningar',

    // Home / Planer
    myPlans: 'Mina planer',
    weekVolume: 'Veckans volym',
    weekSessions: 'Pass denna vecka',
    streak: 'streak',
    days: 'dagar',
    day: 'dag',
    createPlan: 'Skapa plan',
    newPlan: 'Ny plan',
    noPlans: 'Inga planer än',
    noPlansSub: 'Skapa din första plan för att komma igång.',
    exercises: 'övningar',
    lastTrained: 'Tränad senast',
    resumeSession: 'Återuppta passet?',
    resume: 'Återuppta',
    finishSession: 'Avsluta sessionen',
    sessionSaved: 'Passet sparat',
    ongoingSession: 'Pågående pass',
    tapToResume: 'Tryck för att återgå',

    // Plan detail
    name: 'Namn',
    description: 'Beskrivning',
    optional: '(valfritt)',
    save: 'Spara',
    saving: 'Sparar…',
    startSession: 'Starta pass',
    addExercise: 'Lägg till övning',
    needExercise: 'Lägg till minst en övning för att kunna starta.',
    archivePlan: 'Arkivera plan',

    // Workout
    workout: 'Pass',
    finish: 'Avsluta',
    continue: 'Fortsätt',
    set: 'Set',
    sets: 'set',
    setsDone: 'set klart',
    weight: 'Vikt',
    reps: 'Reps',
    rpe: 'RPE',
    done: 'Klart',
    previous: 'Förra',
    notes: 'Anteckningar',
    notesPlaceholder: 'Anteckningar (valfri)',
    finishWorkoutQ: 'Avsluta passet?',
    setsSavedBody: (n) => `${n} set sparade. Avsluta passet?`,
    noSetsBody: 'Inget set är loggat. Avsluta utan att spara?',
    finishWithoutSaving: 'Avsluta utan att spara',
    deleteSet: 'Ta bort',
    personalBest: 'Nytt personbästa',
    pbSub: (kg, reps) => `${kg} kg × ${reps} reps`,

    // History
    historyTitle: 'Historik',
    noHistory: 'Inga pass än',
    noHistorySub: 'Starta ditt första pass från en plan.',
    goToPlans: 'Gå till planer',
    noPlan: '— ingen plan',
    deleteSession: 'Ta bort pass',
    sessionDeleted: 'Passet borttaget',
    duration: 'Tid',
    volume: 'Volym',
    maxWeight: 'Max',
    avgRpe: 'Snitt RPE',
    addNote: 'Lägg till anteckning',

    // Chart
    progression: 'Progression',
    estimated1RM: 'Estimerat 1RM',
    topSet: 'Tungaste set',
    last30: '30 dagar',
    last90: '90 dagar',
    allTime: 'Allt',

    // Settings
    theme: 'Tema',
    system: 'System',
    light: 'Ljust',
    dark: 'Mörkt',
    language: 'Språk',
    units: 'Enheter',
    metric: 'Metrisk (kg)',
    imperial: 'Imperial (lbs)',
    notifications: 'Notiser',
    restTimer: 'Vilotimer',
    haptics: 'Haptik',
    account: 'Konto',
    signOut: 'Logga ut',
    appearance: 'Utseende',
    workoutPrefs: 'Träning',

    // Banners
    offline: 'Du är offline — ändringar synkar när nätet är tillbaka.',
  },
  en: {
    signIn: 'Sign in',
    signUp: 'Sign up',
    signingIn: 'Signing in…',
    email: 'Email',
    password: 'Password',
    noAccount: 'No account?',
    forgotPassword: 'Forgot password?',
    welcome: 'Welcome back',
    welcomeSub: 'Sign in to continue your journey.',

    plans: 'Plans',
    history: 'History',
    settings: 'Settings',

    myPlans: 'My plans',
    weekVolume: 'Weekly volume',
    weekSessions: 'Sessions this week',
    streak: 'streak',
    days: 'days',
    day: 'day',
    createPlan: 'Create plan',
    newPlan: 'New plan',
    noPlans: 'No plans yet',
    noPlansSub: 'Create your first plan to get started.',
    exercises: 'exercises',
    lastTrained: 'Last trained',
    resumeSession: 'Resume workout?',
    resume: 'Resume',
    finishSession: 'End session',
    sessionSaved: 'Workout saved',
    ongoingSession: 'Ongoing workout',
    tapToResume: 'Tap to return',

    name: 'Name',
    description: 'Description',
    optional: '(optional)',
    save: 'Save',
    saving: 'Saving…',
    startSession: 'Start workout',
    addExercise: 'Add exercise',
    needExercise: 'Add at least one exercise to start.',
    archivePlan: 'Archive plan',

    workout: 'Workout',
    finish: 'Finish',
    continue: 'Continue',
    set: 'Set',
    sets: 'sets',
    setsDone: 'sets done',
    weight: 'Weight',
    reps: 'Reps',
    rpe: 'RPE',
    done: 'Done',
    previous: 'Last',
    notes: 'Notes',
    notesPlaceholder: 'Notes (optional)',
    finishWorkoutQ: 'Finish workout?',
    setsSavedBody: (n) => `${n} sets saved. Finish workout?`,
    noSetsBody: 'No sets logged. Finish without saving?',
    finishWithoutSaving: 'Finish without saving',
    deleteSet: 'Delete',
    personalBest: 'New personal best',
    pbSub: (kg, reps) => `${kg} kg × ${reps} reps`,

    historyTitle: 'History',
    noHistory: 'No workouts yet',
    noHistorySub: 'Start your first workout from a plan.',
    goToPlans: 'Go to plans',
    noPlan: '— no plan',
    deleteSession: 'Delete workout',
    sessionDeleted: 'Workout deleted',
    duration: 'Duration',
    volume: 'Volume',
    maxWeight: 'Max',
    avgRpe: 'Avg RPE',
    addNote: 'Add note',

    progression: 'Progression',
    estimated1RM: 'Estimated 1RM',
    topSet: 'Top set',
    last30: '30 days',
    last90: '90 days',
    allTime: 'All time',

    theme: 'Theme',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    language: 'Language',
    units: 'Units',
    metric: 'Metric (kg)',
    imperial: 'Imperial (lbs)',
    notifications: 'Notifications',
    restTimer: 'Rest timer',
    haptics: 'Haptics',
    account: 'Account',
    signOut: 'Sign out',
    appearance: 'Appearance',
    workoutPrefs: 'Workout',

    offline: "You're offline — changes will sync when you're back online.",
  },
};

// ─────────────────────────────────────────────────────────────
// Theme tokens per variation × mode
// ─────────────────────────────────────────────────────────────
const THEMES = {
  forge: {
    // Apple Fitness DNA — pure black, warm off-white, single bright orange
    name: 'Forge',
    tagline: 'Apple Fitness DNA',
    font: "'Inter Display', 'Inter', -apple-system, system-ui, sans-serif",
    fontDisplay: "'Inter Display', 'Inter', -apple-system, system-ui, sans-serif",
    fontMono: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
    radius: { sm: 10, md: 14, lg: 20, xl: 28 },
    dark: {
      bg: '#000000',
      surface: '#0E0E10',
      surface2: '#18181B',
      surface3: '#222226',
      border: 'rgba(255,255,255,0.08)',
      borderStrong: 'rgba(255,255,255,0.14)',
      text: '#FFFFFF',
      text2: 'rgba(255,255,255,0.62)',
      text3: 'rgba(255,255,255,0.38)',
      accent: '#FF5A1F',
      accentText: '#FFFFFF',
      accentSoft: 'rgba(255,90,31,0.14)',
      success: '#30D158',
      warn: '#FFD60A',
      danger: '#FF453A',
      gradFrom: '#FF7A2E',
      gradTo: '#FF2D55',
      tabBg: 'rgba(20,20,22,0.85)',
    },
    light: {
      bg: '#FAFAF7',
      surface: '#FFFFFF',
      surface2: '#F2F1EC',
      surface3: '#E8E7E1',
      border: 'rgba(0,0,0,0.07)',
      borderStrong: 'rgba(0,0,0,0.14)',
      text: '#0A0A0A',
      text2: '#4D4D4D',
      text3: '#8B8B8B',
      accent: '#E14E10',
      accentText: '#FFFFFF',
      accentSoft: 'rgba(225,78,16,0.10)',
      success: '#1E9E45',
      warn: '#B68000',
      danger: '#D70015',
      gradFrom: '#FF7A2E',
      gradTo: '#FF3D5E',
      tabBg: 'rgba(255,255,255,0.85)',
    },
  },
  atlas: {
    // Editorial / Linear / Whoop — warmer stone palette, typographic
    name: 'Atlas',
    tagline: 'Editorial · Typographic',
    font: "'Inter Display', 'Inter', -apple-system, system-ui, sans-serif",
    fontDisplay: "'Inter Display', 'Inter', -apple-system, system-ui, sans-serif",
    fontMono: "'JetBrains Mono', ui-monospace, monospace",
    radius: { sm: 6, md: 10, lg: 14, xl: 18 },
    dark: {
      bg: '#100D0B',
      surface: '#171311',
      surface2: '#1F1A17',
      surface3: '#27211D',
      border: 'rgba(255,240,225,0.07)',
      borderStrong: 'rgba(255,240,225,0.14)',
      text: '#F5F0EA',
      text2: 'rgba(245,240,234,0.62)',
      text3: 'rgba(245,240,234,0.38)',
      accent: '#FF6B3D',
      accentText: '#FFFFFF',
      accentSoft: 'rgba(255,107,61,0.12)',
      success: '#7DBE71',
      warn: '#E0B86F',
      danger: '#E5644E',
      gradFrom: '#FF8B5E',
      gradTo: '#E5644E',
      tabBg: 'rgba(23,19,17,0.92)',
    },
    light: {
      bg: '#F4F0EA',
      surface: '#FBF8F4',
      surface2: '#EBE6DD',
      surface3: '#DDD5C8',
      border: 'rgba(40,30,20,0.08)',
      borderStrong: 'rgba(40,30,20,0.18)',
      text: '#1A1612',
      text2: '#56504A',
      text3: '#8A8278',
      accent: '#C24516',
      accentText: '#FFFFFF',
      accentSoft: 'rgba(194,69,22,0.10)',
      success: '#3F7A33',
      warn: '#A06B12',
      danger: '#B53A1F',
      gradFrom: '#E26538',
      gradTo: '#B53A1F',
      tabBg: 'rgba(251,248,244,0.92)',
    },
  },
  volt: {
    // Sporty / energetic — cool dark with gradient blobs
    name: 'Volt',
    tagline: 'Sporty · Energetic',
    font: "'Inter Display', 'Inter', -apple-system, system-ui, sans-serif",
    fontDisplay: "'Inter Display', 'Inter', -apple-system, system-ui, sans-serif",
    fontMono: "'JetBrains Mono', ui-monospace, monospace",
    radius: { sm: 12, md: 16, lg: 24, xl: 32 },
    dark: {
      bg: '#08080D',
      surface: '#12131A',
      surface2: '#1A1C26',
      surface3: '#252734',
      border: 'rgba(255,255,255,0.06)',
      borderStrong: 'rgba(255,255,255,0.12)',
      text: '#FFFFFF',
      text2: 'rgba(255,255,255,0.58)',
      text3: 'rgba(255,255,255,0.34)',
      accent: '#FF6A1A',
      accentText: '#FFFFFF',
      accentSoft: 'rgba(255,106,26,0.14)',
      success: '#26E07F',
      warn: '#FFC53D',
      danger: '#FF3D5E',
      gradFrom: '#FF8A2B',
      gradTo: '#FF2D7A',
      tabBg: 'rgba(18,19,26,0.85)',
    },
    light: {
      bg: '#F6F5F2',
      surface: '#FFFFFF',
      surface2: '#EFEDE7',
      surface3: '#E2DFD7',
      border: 'rgba(0,0,0,0.07)',
      borderStrong: 'rgba(0,0,0,0.14)',
      text: '#0E0E14',
      text2: '#4A4A55',
      text3: '#8888A0',
      accent: '#E04E0F',
      accentText: '#FFFFFF',
      accentSoft: 'rgba(224,78,15,0.10)',
      success: '#0E8E4F',
      warn: '#A06A00',
      danger: '#D2294B',
      gradFrom: '#FF7B2B',
      gradTo: '#FF2D7A',
      tabBg: 'rgba(255,255,255,0.88)',
    },
  },
};

// ─────────────────────────────────────────────────────────────
// Icons — minimal SF Symbol-ish set, stroke-based
// ─────────────────────────────────────────────────────────────
const Icon = ({ name, size = 20, color = 'currentColor', strokeWidth = 1.8, fill = 'none' }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill, stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'barbell': return <svg {...props}><path d="M2 12h2M20 12h2M5 8v8M19 8v8M8 6v12M16 6v12M8 12h8"/></svg>;
    case 'ascend': return <svg {...props}><path d="M4 20v-6.5Q4 11.5 5.5 11.5L7.5 11.5Q9 11.5 9 13.5L9 20M14 20V7Q14 5 15.5 5L17.5 5Q19 5 19 7L19 20"/><circle cx="21" cy="5.4" r="1.7" fill={color} stroke="none"/></svg>;
    case 'flame': return <svg {...props}><path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-4 3 0-2 1-4 1-6 0-2-2-3-3-3 .5 4-4 5-4 11 0 5 2 9 6 9z"/></svg>;
    case 'clock': return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'chart': return <svg {...props}><path d="M3 20h18M6 16V9M11 16V5M16 16v-7M21 16v-3"/></svg>;
    case 'settings': return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case 'plus': return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'check': return <svg {...props}><path d="M4 12l5 5L20 6"/></svg>;
    case 'checkCircle': return <svg {...props} fill={color} stroke="none"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14.4l-4-4 1.4-1.4L11 13.6l5.6-5.6L18 9.4l-7 7z"/></svg>;
    case 'chevronRight': return <svg {...props}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevronLeft': return <svg {...props}><path d="M15 6l-6 6 6 6"/></svg>;
    case 'chevronDown': return <svg {...props}><path d="M6 9l6 6 6-6"/></svg>;
    case 'ellipsis': return <svg {...props} fill={color} stroke="none"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>;
    case 'close': return <svg {...props}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'grip': return <svg {...props} fill={color} stroke="none"><circle cx="9" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>;
    case 'play': return <svg {...props} fill={color} stroke="none"><path d="M8 5l12 7-12 7V5z"/></svg>;
    case 'pause': return <svg {...props} fill={color} stroke="none"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>;
    case 'trash': return <svg {...props}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>;
    case 'pencil': return <svg {...props}><path d="M17 3l4 4-12 12H5v-4L17 3z"/></svg>;
    case 'spark': return <svg {...props}><path d="M12 3v4M12 17v4M5 12H1M23 12h-4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case 'trophy': return <svg {...props}><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM5 4H3v2a3 3 0 0 0 3 3M19 4h2v2a3 3 0 0 1-3 3"/></svg>;
    case 'user': return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case 'bell': return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"/></svg>;
    case 'globe': return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
    case 'scale': return <svg {...props}><path d="M12 3v18M5 9l7-6 7 6M5 9l-3 7a4 4 0 0 0 8 0L7 9zM19 9l3 7a4 4 0 0 1-8 0l3-7z"/></svg>;
    case 'arrowUp': return <svg {...props}><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
    case 'arrowRight': return <svg {...props}><path d="M5 12h14M12 5l7 7-7 7"/></svg>;
    case 'wifi': return <svg {...props}><path d="M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01"/></svg>;
    case 'wifiOff': return <svg {...props}><path d="M2 2l20 20M8.5 15.5a5 5 0 0 1 6 0M5 12a10 10 0 0 1 5-2.7M19 12a10 10 0 0 0-4.7-2.6M12 19h.01"/></svg>;
    case 'eye': return <svg {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'lock': return <svg {...props}><rect x="4" y="11" width="16" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>;
    case 'mail': return <svg {...props}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 7l10 7L22 7"/></svg>;
    case 'list': return <svg {...props}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>;
    default: return <svg {...props}><circle cx="12" cy="12" r="9"/></svg>;
  }
};

// ─────────────────────────────────────────────────────────────
// ProgressRing — Apple-Fitness-style activity ring
// ─────────────────────────────────────────────────────────────
function ProgressRing({ size = 80, stroke = 8, value = 0.7, color = '#FF5A1F', trackColor = 'rgba(255,255,255,0.08)', children, gradient }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * Math.min(1, Math.max(0, value));
  const id = React.useId();
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {gradient && (
          <defs>
            <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradient[0]} />
              <stop offset="100%" stopColor={gradient[1]} />
            </linearGradient>
          </defs>
        )}
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={gradient ? `url(#${id})` : color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sparkline / Chart — minimal stroke chart with gradient fill
// ─────────────────────────────────────────────────────────────
function Sparkline({ data, width = 200, height = 48, color = '#FF5A1F', fill = true, showDot = true, strokeWidth = 2 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pad = strokeWidth + 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return [x, y];
  });
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const fillD = `${d} L ${width - pad} ${height} L ${pad} ${height} Z`;
  const id = React.useId();
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {fill && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={fillD} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {showDot && <circle cx={last[0]} cy={last[1]} r={strokeWidth + 1.5} fill={color} />}
      {showDot && <circle cx={last[0]} cy={last[1]} r={strokeWidth + 4.5} fill={color} opacity="0.18" />}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// FullChart — bigger progression chart with axis labels
// ─────────────────────────────────────────────────────────────
function FullChart({ data, width = 340, height = 200, color = '#FF5A1F', textColor = 'rgba(255,255,255,0.5)', gridColor = 'rgba(255,255,255,0.06)' }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.v));
  const min = Math.min(...data.map(d => d.v));
  const range = max - min || 1;
  const padL = 32, padR = 12, padT = 12, padB = 22;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const pts = data.map((d, i) => {
    const x = padL + (i / (data.length - 1)) * innerW;
    const y = padT + (1 - (d.v - min) / range) * innerH;
    return [x, y, d];
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const fillPath = `${path} L ${pts[pts.length - 1][0]} ${padT + innerH} L ${pts[0][0]} ${padT + innerH} Z`;
  const id = React.useId();
  const yTicks = 4;
  const ticks = Array.from({ length: yTicks }, (_, i) => {
    const v = min + (range * i) / (yTicks - 1);
    const y = padT + (1 - i / (yTicks - 1)) * innerH;
    return { v: Math.round(v), y };
  });
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* grid + y-labels */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={t.y} x2={width - padR} y2={t.y} stroke={gridColor} strokeWidth="1" />
          <text x={padL - 6} y={t.y + 4} textAnchor="end" fontSize="10" fill={textColor} fontFamily="'JetBrains Mono', ui-monospace">{t.v}</text>
        </g>
      ))}
      <path d={fillPath} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => i % Math.ceil(pts.length / 6) === 0 || i === pts.length - 1 ? (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} />
      ) : null)}
      {/* x labels */}
      {pts.filter((_, i) => i % Math.ceil(pts.length / 4) === 0 || i === pts.length - 1).map((p, i) => (
        <text key={i} x={p[0]} y={height - 6} textAnchor="middle" fontSize="10" fill={textColor} fontFamily="'JetBrains Mono', ui-monospace">{p[2].label}</text>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Gradient blob — soft hero accent (used in Volt, optional in Forge/Atlas)
// ─────────────────────────────────────────────────────────────
function GradientBlob({ from = '#FF7A2E', to = '#FF2D55', size = 320, opacity = 0.55, style = {} }) {
  return (
    <div style={{
      position: 'absolute', width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 30% 30%, ${from}, ${to} 65%, transparent 75%)`,
      filter: 'blur(30px)', opacity, pointerEvents: 'none', ...style,
    }} />
  );
}

// ─────────────────────────────────────────────────────────────
// FrameScreen — wrapper that gives every screen the bg + font
// ─────────────────────────────────────────────────────────────
function FrameScreen({ theme, mode = 'dark', children, scroll = true, statusBarPad = 54, hidePad = false }) {
  const t = theme[mode];
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.bg, color: t.text,
      fontFamily: theme.font,
      WebkitFontSmoothing: 'antialiased',
      display: 'flex', flexDirection: 'column',
      overflow: scroll ? 'auto' : 'hidden',
      fontFeatureSettings: '"ss01", "cv11"',
    }}>
      {!hidePad && <div style={{ height: statusBarPad, flexShrink: 0 }} />}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab bar — used in all variations, themed per variation
// ─────────────────────────────────────────────────────────────
function TabBar({ theme, mode = 'dark', active = 'plans', t }) {
  const tk = theme[mode];
  const items = [
    { id: 'plans', label: t.plans, icon: 'barbell' },
    { id: 'history', label: t.history, icon: 'clock' },
    { id: 'settings', label: t.settings, icon: 'settings' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingBottom: 28, paddingTop: 10,
      background: tk.tabBg,
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderTop: `1px solid ${tk.border}`,
      display: 'flex', justifyContent: 'space-around',
      zIndex: 30,
    }}>
      {items.map(it => {
        const isActive = it.id === active;
        const color = isActive ? tk.accent : tk.text3;
        return (
          <div key={it.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <Icon name={it.icon} size={24} color={color} strokeWidth={isActive ? 2 : 1.6} />
            <span style={{ fontSize: 10.5, fontWeight: isActive ? 600 : 500, color, letterSpacing: -0.1 }}>
              {it.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Display number — tabular nums for stats
// ─────────────────────────────────────────────────────────────
const numStyle = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum", "ss01"' };

// ─────────────────────────────────────────────────────────────
// Sample data
// ─────────────────────────────────────────────────────────────
const SAMPLE = {
  plans: [
    { id: 'p1', name: 'Push Day', desc: 'Bröst · Axlar · Triceps', exercises: 6, lastDays: 2 },
    { id: 'p2', name: 'Pull Day', desc: 'Rygg · Biceps', exercises: 5, lastDays: 4 },
    { id: 'p3', name: 'Ben & Bål', desc: 'Quads · Hamstrings · Core', exercises: 7, lastDays: 1 },
    { id: 'p4', name: 'Upper Power', desc: 'Tunga lyft, låga reps', exercises: 5, lastDays: 7 },
  ],
  history: [
    { id: 'h1', date: '14 maj 2026', dateEn: 'May 14, 2026', plan: 'Push Day', sets: 18, vol: 4820, duration: 62 },
    { id: 'h2', date: '12 maj 2026', dateEn: 'May 12, 2026', plan: 'Pull Day', sets: 15, vol: 3960, duration: 54 },
    { id: 'h3', date: '10 maj 2026', dateEn: 'May 10, 2026', plan: 'Ben & Bål', sets: 22, vol: 6210, duration: 71 },
    { id: 'h4', date: '8 maj 2026', dateEn: 'May 8, 2026', plan: 'Push Day', sets: 17, vol: 4540, duration: 58 },
    { id: 'h5', date: '6 maj 2026', dateEn: 'May 6, 2026', plan: 'Pull Day', sets: 14, vol: 3740, duration: 49 },
    { id: 'h6', date: '4 maj 2026', dateEn: 'May 4, 2026', plan: 'Upper Power', sets: 12, vol: 5120, duration: 65 },
  ],
  // Mock chart: estimated 1RM bench press over weeks
  chart: [
    { label: 'Mar', v: 92 }, { label: '', v: 94 }, { label: '', v: 95 },
    { label: 'Apr', v: 96 }, { label: '', v: 98 }, { label: '', v: 100 },
    { label: 'Maj', v: 102 }, { label: '', v: 104 }, { label: 'Nu', v: 107.5 },
  ],
  spark: [82, 84, 85, 88, 90, 92, 95, 100, 102, 107],
  exercisesInPlan: [
    { id: 'e1', name: 'Bänkpress', nameEn: 'Bench press', sets: 4, repMin: 6, repMax: 8, last: '100 × 6' },
    { id: 'e2', name: 'Axelpress', nameEn: 'Overhead press', sets: 3, repMin: 8, repMax: 10, last: '60 × 8' },
    { id: 'e3', name: 'Lutande hantelpress', nameEn: 'Incline DB press', sets: 3, repMin: 10, repMax: 12, last: '32 × 10' },
    { id: 'e4', name: 'Sidolyft', nameEn: 'Lateral raise', sets: 4, repMin: 12, repMax: 15, last: '14 × 12' },
    { id: 'e5', name: 'Triceps pushdown', nameEn: 'Triceps pushdown', sets: 3, repMin: 10, repMax: 12, last: '35 × 12' },
    { id: 'e6', name: 'Diparmpress', nameEn: 'Skullcrusher', sets: 3, repMin: 10, repMax: 12, last: '30 × 10' },
  ],
  // Workout state — bench press, set 3 of 4 logged
  workoutSets: [
    { n: 1, w: 100, r: 8, rpe: 7, done: true },
    { n: 2, w: 102.5, r: 7, rpe: 8, done: true },
    { n: 3, w: 105, r: 6, rpe: 8.5, done: true, pb: true },
  ],
};

const fmtNum = (n) => n.toLocaleString('sv-SE').replace(/,/g, ' ');

// ─────────────────────────────────────────────────────────────
// Logo — "Ascend" mark (chosen direction). Two rising bars + peak dot.
//   variant 'gradient' → orange→pink stroke on transparent (standalone)
//   variant 'white'    → white stroke (sits inside a gradient square / accent)
// ─────────────────────────────────────────────────────────────
function Logo({ size = 64, variant = 'gradient', from = '#FF7A2E', to = '#FF2D55' }) {
  const id = React.useId();
  const stroke = variant === 'white' ? '#fff' : `url(#${id})`;
  const sw = 7;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {variant === 'gradient' && (
        <defs>
          <linearGradient id={id} x1="0" y1="64" x2="64" y2="0">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
      )}
      <path d="M10 50 L10 30 Q10 26 14 26 L18 26 Q22 26 22 30 L22 50"
        stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />
      <path d="M32 50 L32 18 Q32 14 36 14 L40 14 Q44 14 44 18 L44 50"
        stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />
      <circle cx="54" cy="14" r="5" fill={variant === 'white' ? '#fff' : stroke} />
    </svg>
  );
}

// AppIcon — gradient squircle containing the white Ascend mark (home-screen icon form)
function AppIcon({ size = 56, radius, from = '#FF7A2E', to = '#FF2D55' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius ?? size * 0.28,
      background: `linear-gradient(135deg, ${from}, ${to})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 ${size * 0.14}px ${size * 0.32}px ${from}40`,
    }}>
      <Logo size={size * 0.62} variant="white" />
    </div>
  );
}

Object.assign(window, {
  I18N, THEMES, Icon, Logo, AppIcon, ProgressRing, Sparkline, FullChart, GradientBlob,
  FrameScreen, TabBar, numStyle, SAMPLE, fmtNum,
});

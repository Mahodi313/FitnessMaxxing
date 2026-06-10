// forge-screens.jsx — Forge variation: Apple Fitness DNA
// Pure black bg, warm off-white, single bright orange accent, big display nums.

const F_THEME = THEMES.forge;

function FSignIn({ mode = 'dark', t }) {
  const tk = F_THEME[mode];
  return (
    <FrameScreen theme={F_THEME} mode={mode} scroll={false}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 28px 32px' }}>
        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `linear-gradient(135deg, ${tk.gradFrom}, ${tk.gradTo})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Logo size={18} variant="white" />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, color: tk.text2, textTransform: 'uppercase' }}>
            FitnessMaxxing
          </span>
        </div>

        {/* Hero heading */}
        <div style={{ marginTop: 'auto', marginBottom: 36 }}>
          <h1 style={{
            fontSize: 44, fontWeight: 700, letterSpacing: -1.4, lineHeight: 1.02,
            color: tk.text, margin: 0,
            fontFamily: F_THEME.fontDisplay,
          }}>{t.welcome}</h1>
          <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.4, color: tk.text2 }}>
            {t.welcomeSub}
          </p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ForgeField mode={mode} icon="mail" placeholder={t.email} value="anna@nordström.se" />
          <ForgeField mode={mode} icon="lock" placeholder={t.password} value="••••••••••" />

          <button style={{
            marginTop: 12, height: 56, borderRadius: 16, border: 'none',
            background: tk.accent, color: tk.accentText,
            fontSize: 17, fontWeight: 600, letterSpacing: -0.2,
            fontFamily: F_THEME.font, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: mode === 'dark' ? `0 8px 24px ${tk.accent}40` : 'none',
          }}>
            {t.signIn}
            <Icon name="arrowRight" size={18} color={tk.accentText} strokeWidth={2.2} />
          </button>

          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 14, color: tk.text3 }}>{t.forgotPassword}</span>
          </div>
        </div>

        {/* Sign up link */}
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', gap: 6, paddingTop: 24 }}>
          <span style={{ fontSize: 15, color: tk.text2 }}>{t.noAccount}</span>
          <span style={{ fontSize: 15, color: tk.accent, fontWeight: 600 }}>{t.signUp}</span>
        </div>
      </div>
    </FrameScreen>
  );
}

function ForgeField({ mode, icon, placeholder, value }) {
  const tk = F_THEME[mode];
  return (
    <div style={{
      height: 56, borderRadius: 14,
      background: tk.surface, border: `1px solid ${tk.border}`,
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
    }}>
      <Icon name={icon} size={18} color={tk.text3} />
      <span style={{ fontSize: 16, color: value ? tk.text : tk.text3, letterSpacing: -0.2, flex: 1 }}>
        {value || placeholder}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Home / Planer — Apple Fitness rings + plan list
// ─────────────────────────────────────────────────────────────
function FHome({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  return (
    <FrameScreen theme={F_THEME} mode={mode}>
      <div style={{ padding: '0 0 100px' }}>
        {/* Status row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: `linear-gradient(135deg, ${tk.gradFrom}, ${tk.gradTo})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Logo size={20} variant="white" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: tk.text2, textTransform: 'uppercase' }}>
              FitnessMaxxing
            </span>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: 18,
            background: tk.surface, border: `1px solid ${tk.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="user" size={16} color={tk.text2} />
          </div>
        </div>

        {/* Page title */}
        <h1 style={{
          fontSize: 36, fontWeight: 700, letterSpacing: -1.2, margin: '12px 20px 4px',
          color: tk.text, fontFamily: F_THEME.fontDisplay,
        }}>{t.myPlans}</h1>
        <p style={{ margin: '0 20px 20px', fontSize: 15, color: tk.text2 }}>
          {lang === 'sv' ? 'Tisdag · 16 maj' : 'Tuesday · May 16'}
        </p>

        {/* Activity rings hero */}
        <div style={{
          margin: '0 16px 24px', borderRadius: 24,
          background: tk.surface, border: `1px solid ${tk.border}`,
          padding: 20, display: 'flex', gap: 18, alignItems: 'center',
        }}>
          <ProgressRing
            size={104} stroke={11} value={0.72}
            color={tk.accent}
            trackColor={mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
            gradient={[tk.gradFrom, tk.gradTo]}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: tk.text, letterSpacing: -0.5, ...numStyle }}>3</span>
              <span style={{ fontSize: 10, color: tk.text3, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>/ 4</span>
            </div>
          </ProgressRing>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: tk.text3, textTransform: 'uppercase' }}>
              {t.weekSessions}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: tk.text, letterSpacing: -1, marginTop: 4, fontFamily: F_THEME.fontDisplay, ...numStyle }}>
              3 <span style={{ color: tk.text3, fontSize: 18, fontWeight: 500 }}>/ 4</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <ForgeChip mode={mode} icon="flame">
                <span style={numStyle}>12</span>&nbsp;{t.day === 'dag' ? t.days : t.days}&nbsp;{t.streak}
              </ForgeChip>
              <ForgeChip mode={mode}>
                <span style={numStyle}>14 540</span>&nbsp;kg
              </ForgeChip>
            </div>
          </div>
        </div>

        {/* Section header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 24px 12px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1, color: tk.text3, textTransform: 'uppercase' }}>
            {t.myPlans}
          </span>
          <span style={{ fontSize: 13, fontWeight: 500, color: tk.accent }}>
            {t.newPlan}
          </span>
        </div>

        {/* Plan list */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SAMPLE.plans.slice(0, 4).map((p, i) => (
            <div key={p.id} style={{
              borderRadius: 18, background: tk.surface, border: `1px solid ${tk.border}`,
              padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: i === 0 ? `linear-gradient(135deg, ${tk.gradFrom}, ${tk.gradTo})` : tk.surface2,
                border: i === 0 ? 'none' : `1px solid ${tk.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="barbell" size={20} color={i === 0 ? '#fff' : tk.text2} strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: tk.text, letterSpacing: -0.3 }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 13, color: tk.text2, marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={numStyle}>{p.exercises}</span> {t.exercises}
                  <span style={{ width: 3, height: 3, borderRadius: 2, background: tk.text3 }} />
                  <span>{p.lastDays}{lang === 'sv' ? 'd' : 'd'} {lang === 'sv' ? 'sedan' : 'ago'}</span>
                </div>
              </div>
              <Icon name="chevronRight" size={18} color={tk.text3} />
            </div>
          ))}
        </div>
      </div>
      <TabBar theme={F_THEME} mode={mode} active="plans" t={t} />
    </FrameScreen>
  );
}

function ForgeChip({ mode, icon, children }) {
  const tk = F_THEME[mode];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 9px', borderRadius: 8,
      background: tk.surface2, border: `1px solid ${tk.border}`,
      fontSize: 12, fontWeight: 600, color: tk.text2, letterSpacing: -0.1,
    }}>
      {icon && <Icon name={icon} size={12} color={tk.accent} strokeWidth={2} />}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Plan detail
// ─────────────────────────────────────────────────────────────
function FPlanDetail({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  return (
    <FrameScreen theme={F_THEME} mode={mode}>
      <div style={{ padding: '0 0 32px' }}>
        {/* Nav row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 4px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: tk.surface, border: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevronLeft" size={18} color={tk.text} strokeWidth={2.2} />
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: tk.surface, border: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="ellipsis" size={18} color={tk.text} />
          </div>
        </div>

        {/* Title block */}
        <div style={{ padding: '12px 20px 20px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase' }}>
            {lang === 'sv' ? 'Plan' : 'Plan'}
          </span>
          <h1 style={{
            fontSize: 36, fontWeight: 700, letterSpacing: -1.2, margin: '4px 0 6px',
            color: tk.text, fontFamily: F_THEME.fontDisplay,
          }}>Push Day</h1>
          <p style={{ margin: 0, fontSize: 15, color: tk.text2 }}>
            Bröst · Axlar · Triceps
          </p>
        </div>

        {/* Start workout primary CTA */}
        <div style={{ padding: '0 16px 20px' }}>
          <button style={{
            width: '100%', height: 64, borderRadius: 18, border: 'none',
            background: tk.accent, color: tk.accentText,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontSize: 18, fontWeight: 600, letterSpacing: -0.3,
            fontFamily: F_THEME.font, cursor: 'pointer',
            boxShadow: mode === 'dark' ? `0 12px 32px ${tk.accent}50` : `0 8px 20px ${tk.accent}30`,
          }}>
            <Icon name="play" size={18} color={tk.accentText} />
            {t.startSession}
          </button>
        </div>

        {/* Quick stats */}
        <div style={{ padding: '0 20px 16px', display: 'flex', gap: 24 }}>
          <ForgeStat mode={mode} label={lang === 'sv' ? 'Övningar' : 'Exercises'} value="6" />
          <ForgeStat mode={mode} label={lang === 'sv' ? 'Senast' : 'Last'} value={lang === 'sv' ? '2 dgr' : '2d'} />
          <ForgeStat mode={mode} label={lang === 'sv' ? 'Snitt-tid' : 'Avg time'} value="58 min" />
        </div>

        {/* Section heading */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px 12px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1, color: tk.text3, textTransform: 'uppercase' }}>
            {lang === 'sv' ? 'Övningar' : 'Exercises'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 500, color: tk.accent }}>
            + {t.addExercise}
          </span>
        </div>

        {/* Exercise rows */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SAMPLE.exercisesInPlan.map((e, i) => (
            <div key={e.id} style={{
              borderRadius: 16, background: tk.surface, border: `1px solid ${tk.border}`,
              padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Icon name="grip" size={18} color={tk.text3} />
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: tk.surface2, border: `1px solid ${tk.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: tk.text2, ...numStyle,
              }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: tk.text, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {lang === 'sv' ? e.name : e.nameEn}
                </div>
                <div style={{ fontSize: 13, color: tk.text2, marginTop: 2 }}>
                  <span style={numStyle}>{e.sets}×{e.repMin}–{e.repMax}</span>
                  <span style={{ margin: '0 6px', color: tk.text3 }}>·</span>
                  <span style={{ color: tk.text3 }}>{t.previous} </span>
                  <span style={{ color: tk.accent, fontWeight: 600, ...numStyle }}>{e.last}</span>
                </div>
              </div>
              <Icon name="chevronRight" size={16} color={tk.text3} />
            </div>
          ))}
        </div>
      </div>
    </FrameScreen>
  );
}

function ForgeStat({ mode, label, value }) {
  const tk = F_THEME[mode];
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.8, color: tk.text3, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tk.text, letterSpacing: -0.5, marginTop: 2, fontFamily: F_THEME.fontDisplay, ...numStyle }}>
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Workout active — the hot path
// ─────────────────────────────────────────────────────────────
function FWorkout({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  return (
    <FrameScreen theme={F_THEME} mode={mode}>
      <div style={{ padding: '0 0 32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 4px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: tk.surface, border: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevronLeft" size={18} color={tk.text} strokeWidth={2.2} />
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 20,
            background: tk.accentSoft, border: `1px solid ${tk.accent}30`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: tk.accent }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: tk.accent, letterSpacing: -0.1, ...numStyle }}>
              42:18
            </span>
          </div>
          <button style={{
            height: 36, padding: '0 16px', borderRadius: 18,
            background: tk.accent, color: tk.accentText, border: 'none',
            fontSize: 14, fontWeight: 600, letterSpacing: -0.1, fontFamily: F_THEME.font,
          }}>{t.finish}</button>
        </div>

        {/* Workout title */}
        <div style={{ padding: '12px 20px 8px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase' }}>
            Push Day · {lang === 'sv' ? 'Övning' : 'Exercise'} 1 / 6
          </span>
          <h1 style={{
            fontSize: 32, fontWeight: 700, letterSpacing: -1.1, margin: '4px 0 0',
            color: tk.text, fontFamily: F_THEME.fontDisplay,
          }}>{lang === 'sv' ? 'Bänkpress' : 'Bench press'}</h1>
        </div>

        {/* Set progress dots */}
        <div style={{ padding: '10px 20px 18px', display: 'flex', gap: 6, alignItems: 'center' }}>
          {[1, 2, 3, 4].map(n => {
            const done = n <= 3;
            const current = n === 4;
            return (
              <div key={n} style={{
                flex: 1, height: 6, borderRadius: 3,
                background: done ? tk.accent : current ? tk.accentSoft : tk.surface2,
                border: current ? `1px solid ${tk.accent}` : 'none',
              }} />
            );
          })}
          <span style={{ fontSize: 12, fontWeight: 600, color: tk.text2, marginLeft: 6, ...numStyle }}>3 / 4</span>
        </div>

        {/* PR celebration banner */}
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{
            borderRadius: 16, padding: '12px 14px',
            background: `linear-gradient(135deg, ${tk.gradFrom}15, ${tk.gradTo}15)`,
            border: `1px solid ${tk.accent}30`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${tk.gradFrom}, ${tk.gradTo})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="trophy" size={18} color="#fff" strokeWidth={2.2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: tk.text, letterSpacing: -0.2 }}>
                {t.personalBest}
              </div>
              <div style={{ fontSize: 12, color: tk.text2, marginTop: 1, ...numStyle }}>
                {t.pbSub('105', '6')} · {lang === 'sv' ? 'sätt 3' : 'set 3'}
              </div>
            </div>
          </div>
        </div>

        {/* Logged sets card */}
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{
            borderRadius: 18, background: tk.surface, border: `1px solid ${tk.border}`,
            overflow: 'hidden',
          }}>
            {/* Column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: '32px 1fr 1fr 56px 36px',
              padding: '10px 16px', gap: 12,
              fontSize: 10, fontWeight: 600, letterSpacing: 1, color: tk.text3, textTransform: 'uppercase',
              borderBottom: `1px solid ${tk.border}`,
            }}>
              <div>{lang === 'sv' ? '#' : '#'}</div>
              <div>{t.weight}</div>
              <div>{t.reps}</div>
              <div>{t.rpe}</div>
              <div />
            </div>
            {/* Logged sets */}
            {SAMPLE.workoutSets.map((s, i) => (
              <div key={s.n} style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 1fr 56px 36px',
                padding: '14px 16px', gap: 12, alignItems: 'center',
                borderBottom: `1px solid ${tk.border}`,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 11,
                  background: tk.accent, color: tk.accentText,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, ...numStyle,
                }}>{s.n}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: tk.text, letterSpacing: -0.3, ...numStyle, fontFamily: F_THEME.fontDisplay }}>
                  {s.w} <span style={{ fontSize: 12, color: tk.text3, fontWeight: 500 }}>kg</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: tk.text, letterSpacing: -0.3, ...numStyle, fontFamily: F_THEME.fontDisplay }}>
                  {s.r}
                </div>
                <div style={{ fontSize: 14, color: tk.text2, ...numStyle }}>{s.rpe}</div>
                {s.pb ? (
                  <div style={{
                    width: 24, height: 24, borderRadius: 12,
                    background: `linear-gradient(135deg, ${tk.gradFrom}, ${tk.gradTo})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="trophy" size={12} color="#fff" strokeWidth={2.2} />
                  </div>
                ) : (
                  <Icon name="checkCircle" size={20} color={tk.success} />
                )}
              </div>
            ))}

            {/* Input row for next set */}
            <div style={{
              padding: '16px 16px 18px',
              background: mode === 'dark' ? 'rgba(255,90,31,0.05)' : 'rgba(225,78,16,0.04)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tk.accent, textTransform: 'uppercase' }}>
                  {t.set} 4
                </span>
                <span style={{ fontSize: 11, color: tk.text3 }}>
                  {t.previous} <span style={{ color: tk.text2, fontWeight: 600, ...numStyle }}>105 × 6</span>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px', gap: 8 }}>
                <ForgeInput mode={mode} value="107.5" unit="kg" />
                <ForgeInput mode={mode} value="5" unit="reps" />
                <ForgeInput mode={mode} value="9" unit="rpe" small />
              </div>
              <button style={{
                width: '100%', marginTop: 10, height: 50, borderRadius: 14, border: 'none',
                background: tk.accent, color: tk.accentText,
                fontSize: 16, fontWeight: 600, letterSpacing: -0.2, fontFamily: F_THEME.font,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Icon name="check" size={18} color={tk.accentText} strokeWidth={2.4} />
                {t.done}
              </button>
            </div>
          </div>
        </div>

        {/* Next exercise hint */}
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: tk.text3, textTransform: 'uppercase', marginBottom: 8 }}>
            {lang === 'sv' ? 'Härnäst' : 'Up next'}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 14,
            background: tk.surface, border: `1px solid ${tk.border}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: tk.text2, ...numStyle, width: 16 }}>2</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: tk.text }}>
                {lang === 'sv' ? 'Axelpress' : 'Overhead press'}
              </div>
              <div style={{ fontSize: 12, color: tk.text3, marginTop: 1, ...numStyle }}>
                3 × 8–10
              </div>
            </div>
            <Icon name="chevronRight" size={16} color={tk.text3} />
          </div>
        </div>
      </div>
    </FrameScreen>
  );
}

function ForgeInput({ mode, value, unit, small }) {
  const tk = F_THEME[mode];
  return (
    <div style={{
      height: 56, borderRadius: 12,
      background: mode === 'dark' ? 'rgba(0,0,0,0.4)' : '#fff',
      border: `1px solid ${tk.accent}50`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <span style={{
        fontSize: small ? 20 : 22, fontWeight: 700, color: tk.text, letterSpacing: -0.6,
        fontFamily: F_THEME.fontDisplay, ...numStyle, lineHeight: 1,
      }}>{value}</span>
      <span style={{ fontSize: 9.5, color: tk.text3, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600, marginTop: 3 }}>
        {unit}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// History list
// ─────────────────────────────────────────────────────────────
function FHistory({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  return (
    <FrameScreen theme={F_THEME} mode={mode}>
      <div style={{ padding: '0 0 100px' }}>
        <div style={{ padding: '8px 20px 4px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase' }}>
            {lang === 'sv' ? '24 pass · 87 timmar' : '24 workouts · 87 hours'}
          </span>
        </div>
        <h1 style={{
          fontSize: 36, fontWeight: 700, letterSpacing: -1.2, margin: '4px 20px 16px',
          color: tk.text, fontFamily: F_THEME.fontDisplay,
        }}>{t.historyTitle}</h1>

        {/* Volume overview card */}
        <div style={{ padding: '0 16px 20px' }}>
          <div style={{
            borderRadius: 20, padding: '18px 20px',
            background: tk.surface, border: `1px solid ${tk.border}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: tk.text3, textTransform: 'uppercase' }}>
                  {t.weekVolume}
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: tk.text, letterSpacing: -1, marginTop: 4, fontFamily: F_THEME.fontDisplay, ...numStyle }}>
                  28 720 <span style={{ fontSize: 16, color: tk.text3, fontWeight: 500 }}>kg</span>
                </div>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '4px 8px', borderRadius: 8,
                background: mode === 'dark' ? 'rgba(48,209,88,0.15)' : 'rgba(30,158,69,0.12)',
                color: tk.success, fontSize: 12, fontWeight: 700, ...numStyle,
              }}>
                <Icon name="arrowUp" size={11} color={tk.success} strokeWidth={2.5} />
                +12%
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <Sparkline data={SAMPLE.spark} width={340} height={56} color={tk.accent} strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* Session list */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SAMPLE.history.slice(0, 5).map((h, i) => (
            <div key={h.id} style={{
              borderRadius: 16, background: tk.surface, border: `1px solid ${tk.border}`,
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: tk.surface2, border: `1px solid ${tk.border}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: tk.text, letterSpacing: -0.3, lineHeight: 1, fontFamily: F_THEME.fontDisplay, ...numStyle }}>
                  {lang === 'sv' ? h.date.split(' ')[0] : h.dateEn.split(' ')[1].replace(',', '')}
                </span>
                <span style={{ fontSize: 9, color: tk.text3, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2, fontWeight: 600 }}>
                  {lang === 'sv' ? h.date.split(' ')[1] : h.dateEn.split(' ')[0]}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: tk.text, letterSpacing: -0.2 }}>
                  {h.plan}
                </div>
                <div style={{ fontSize: 12, color: tk.text2, marginTop: 3, display: 'flex', gap: 6, alignItems: 'center', ...numStyle }}>
                  <span>{h.sets} {t.sets}</span>
                  <span style={{ width: 3, height: 3, borderRadius: 2, background: tk.text3 }} />
                  <span>{fmtNum(h.vol)} kg</span>
                  <span style={{ width: 3, height: 3, borderRadius: 2, background: tk.text3 }} />
                  <span>{h.duration} min</span>
                </div>
              </div>
              {i === 0 && (
                <div style={{
                  width: 24, height: 24, borderRadius: 12,
                  background: `linear-gradient(135deg, ${tk.gradFrom}, ${tk.gradTo})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="trophy" size={12} color="#fff" strokeWidth={2.2} />
                </div>
              )}
              <Icon name="chevronRight" size={16} color={tk.text3} />
            </div>
          ))}
        </div>
      </div>
      <TabBar theme={F_THEME} mode={mode} active="history" t={t} />
    </FrameScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// Session detail
// ─────────────────────────────────────────────────────────────
function FSessionDetail({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  return (
    <FrameScreen theme={F_THEME} mode={mode}>
      <div style={{ padding: '0 0 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 4px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: tk.surface, border: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevronLeft" size={18} color={tk.text} strokeWidth={2.2} />
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: tk.surface, border: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="ellipsis" size={18} color={tk.text} />
          </div>
        </div>

        <div style={{ padding: '12px 20px 16px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase' }}>
            Push Day
          </span>
          <h1 style={{
            fontSize: 32, fontWeight: 700, letterSpacing: -1, margin: '4px 0 0',
            color: tk.text, fontFamily: F_THEME.fontDisplay,
          }}>{lang === 'sv' ? '14 maj 2026' : 'May 14, 2026'}</h1>
        </div>

        {/* Big stats grid */}
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{
            borderRadius: 20,
            background: tk.surface, border: `1px solid ${tk.border}`,
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          }}>
            <div style={{ padding: '18px 14px', textAlign: 'center', borderRight: `1px solid ${tk.border}` }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: tk.text, letterSpacing: -0.6, fontFamily: F_THEME.fontDisplay, ...numStyle }}>18</div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: tk.text3, textTransform: 'uppercase', marginTop: 2 }}>
                {t.sets}
              </div>
            </div>
            <div style={{ padding: '18px 14px', textAlign: 'center', borderRight: `1px solid ${tk.border}` }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: tk.text, letterSpacing: -0.6, fontFamily: F_THEME.fontDisplay, ...numStyle }}>4 820</div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: tk.text3, textTransform: 'uppercase', marginTop: 2 }}>
                kg · {t.volume.toLowerCase()}
              </div>
            </div>
            <div style={{ padding: '18px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: tk.text, letterSpacing: -0.6, fontFamily: F_THEME.fontDisplay, ...numStyle }}>62</div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: tk.text3, textTransform: 'uppercase', marginTop: 2 }}>
                min
              </div>
            </div>
          </div>
        </div>

        {/* Notes block */}
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{
            padding: '14px 16px', borderRadius: 14,
            background: tk.accentSoft, border: `1px solid ${tk.accent}25`,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <Icon name="pencil" size={14} color={tk.accent} />
            <p style={{ margin: 0, fontSize: 13, color: tk.text2, lineHeight: 1.5, flex: 1 }}>
              {lang === 'sv'
                ? 'Bra känsla. PR på bänk — kunde tagit mer. Axlarna trötta från igår.'
                : 'Felt strong. Bench PR — could have gone heavier. Shoulders fatigued from yesterday.'}
            </p>
          </div>
        </div>

        {/* Exercise breakdown */}
        <div style={{ padding: '8px 24px 12px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1, color: tk.text3, textTransform: 'uppercase' }}>
            {lang === 'sv' ? 'Övningar' : 'Exercises'}
          </span>
        </div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { name: 'Bänkpress', nameEn: 'Bench press', sets: '4 × 8 · 6 · 6 · 5', max: 107.5, pb: true },
            { name: 'Axelpress', nameEn: 'Overhead press', sets: '3 × 10 · 9 · 8', max: 62.5, pb: false },
            { name: 'Lutande hantelpress', nameEn: 'Incline DB press', sets: '3 × 12 · 11 · 10', max: 34, pb: false },
          ].map((e, i) => (
            <div key={i} style={{
              borderRadius: 16, background: tk.surface, border: `1px solid ${tk.border}`,
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: tk.text, letterSpacing: -0.2 }}>
                      {lang === 'sv' ? e.name : e.nameEn}
                    </span>
                    {e.pb && <div style={{
                      width: 18, height: 18, borderRadius: 9,
                      background: `linear-gradient(135deg, ${tk.gradFrom}, ${tk.gradTo})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="trophy" size={10} color="#fff" strokeWidth={2.2} />
                    </div>}
                  </div>
                  <div style={{ fontSize: 12, color: tk.text2, marginTop: 3, ...numStyle }}>{e.sets}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: tk.text, letterSpacing: -0.3, fontFamily: F_THEME.fontDisplay, ...numStyle }}>
                    {e.max}
                  </div>
                  <div style={{ fontSize: 10, color: tk.text3, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>
                    {t.maxWeight} · kg
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FrameScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// Exercise progression chart
// ─────────────────────────────────────────────────────────────
function FChart({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  return (
    <FrameScreen theme={F_THEME} mode={mode}>
      <div style={{ padding: '0 0 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 4px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: tk.surface, border: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevronLeft" size={18} color={tk.text} strokeWidth={2.2} />
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: tk.surface, border: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="ellipsis" size={18} color={tk.text} />
          </div>
        </div>

        <div style={{ padding: '12px 20px 8px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase' }}>
            {t.progression}
          </span>
          <h1 style={{
            fontSize: 32, fontWeight: 700, letterSpacing: -1, margin: '4px 0 0',
            color: tk.text, fontFamily: F_THEME.fontDisplay,
          }}>{lang === 'sv' ? 'Bänkpress' : 'Bench press'}</h1>
        </div>

        {/* Hero stat */}
        <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: tk.text3, textTransform: 'uppercase' }}>
              {t.estimated1RM}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 52, fontWeight: 700, color: tk.text, letterSpacing: -2, fontFamily: F_THEME.fontDisplay, ...numStyle, lineHeight: 1 }}>
                107.5
              </div>
              <div style={{ fontSize: 18, color: tk.text2, fontWeight: 500 }}>kg</div>
            </div>
          </div>
          <div style={{
            marginLeft: 'auto', marginBottom: 6,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '5px 9px', borderRadius: 8,
            background: mode === 'dark' ? 'rgba(48,209,88,0.15)' : 'rgba(30,158,69,0.12)',
            color: tk.success, fontSize: 13, fontWeight: 700, ...numStyle,
          }}>
            <Icon name="arrowUp" size={12} color={tk.success} strokeWidth={2.5} />
            +15.5 kg
          </div>
        </div>

        {/* Range selector */}
        <div style={{ padding: '20px 16px 8px' }}>
          <div style={{
            display: 'flex', padding: 4,
            borderRadius: 12, background: tk.surface, border: `1px solid ${tk.border}`,
          }}>
            {[t.last30, t.last90, t.allTime].map((r, i) => (
              <div key={r} style={{
                flex: 1, padding: '8px 0', textAlign: 'center', borderRadius: 9,
                background: i === 1 ? tk.surface3 : 'transparent',
                color: i === 1 ? tk.text : tk.text2,
                fontSize: 13, fontWeight: 600, letterSpacing: -0.1,
              }}>{r}</div>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div style={{ padding: '12px 16px 20px' }}>
          <div style={{
            borderRadius: 20, padding: '18px 14px 12px',
            background: tk.surface, border: `1px solid ${tk.border}`,
          }}>
            <FullChart
              data={SAMPLE.chart}
              width={340}
              height={200}
              color={tk.accent}
              textColor={tk.text3}
              gridColor={tk.border}
            />
          </div>
        </div>

        {/* Stats row */}
        <div style={{ padding: '0 16px', display: 'flex', gap: 8 }}>
          <FChartStat mode={mode} label={t.topSet} value="105 × 6" />
          <FChartStat mode={mode} label={lang === 'sv' ? 'Volym/pass' : 'Vol/session'} value="1 820 kg" />
          <FChartStat mode={mode} label={t.avgRpe} value="8.2" />
        </div>
      </div>
    </FrameScreen>
  );
}

function FChartStat({ mode, label, value }) {
  const tk = F_THEME[mode];
  return (
    <div style={{
      flex: 1, padding: '14px 12px', borderRadius: 14,
      background: tk.surface, border: `1px solid ${tk.border}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, color: tk.text3, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: tk.text, letterSpacing: -0.4, marginTop: 4, fontFamily: F_THEME.fontDisplay, ...numStyle }}>
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────
function FSettings({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  return (
    <FrameScreen theme={F_THEME} mode={mode}>
      <div style={{ padding: '0 0 100px' }}>
        <h1 style={{
          fontSize: 36, fontWeight: 700, letterSpacing: -1.2, margin: '8px 20px 20px',
          color: tk.text, fontFamily: F_THEME.fontDisplay,
        }}>{t.settings}</h1>

        {/* Profile card */}
        <div style={{ padding: '0 16px 24px' }}>
          <div style={{
            borderRadius: 20, padding: '18px 20px',
            background: tk.surface, border: `1px solid ${tk.border}`,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 28,
              background: `linear-gradient(135deg, ${tk.gradFrom}, ${tk.gradTo})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: F_THEME.fontDisplay,
            }}>AN</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: tk.text, letterSpacing: -0.3 }}>Anna Nordström</div>
              <div style={{ fontSize: 13, color: tk.text2, marginTop: 1 }}>anna@nordstrom.se</div>
            </div>
            <Icon name="chevronRight" size={18} color={tk.text3} />
          </div>
        </div>

        {/* Theme section */}
        <SettingsSection mode={mode} label={t.appearance}>
          <SettingsRow mode={mode} icon="globe" label={t.theme} value={null}>
            <div style={{ display: 'flex', padding: 3, borderRadius: 10, background: tk.surface2, gap: 2 }}>
              {[t.system, t.light, t.dark].map((opt, i) => (
                <div key={opt} style={{
                  padding: '6px 12px', borderRadius: 8,
                  background: i === 2 ? tk.surface : 'transparent',
                  fontSize: 12, fontWeight: 600,
                  color: i === 2 ? tk.text : tk.text2,
                }}>{opt}</div>
              ))}
            </div>
          </SettingsRow>
          <SettingsRow mode={mode} icon="globe" label={t.language} value={lang === 'sv' ? 'Svenska' : 'English'} chevron />
        </SettingsSection>

        <SettingsSection mode={mode} label={t.workoutPrefs}>
          <SettingsRow mode={mode} icon="scale" label={t.units} value={t.metric} chevron />
          <SettingsRow mode={mode} icon="clock" label={t.restTimer} value={lang === 'sv' ? 'På · 2 min' : 'On · 2 min'} chevron />
          <SettingsRow mode={mode} icon="spark" label={t.haptics} toggle />
          <SettingsRow mode={mode} icon="bell" label={t.notifications} toggle />
        </SettingsSection>

        <div style={{ padding: '0 16px' }}>
          <button style={{
            width: '100%', height: 52, borderRadius: 14, border: `1px solid ${tk.border}`,
            background: tk.surface, color: tk.danger,
            fontSize: 16, fontWeight: 600, letterSpacing: -0.2, fontFamily: F_THEME.font,
          }}>{t.signOut}</button>
        </div>
      </div>
      <TabBar theme={F_THEME} mode={mode} active="settings" t={t} />
    </FrameScreen>
  );
}

function SettingsSection({ mode, label, children }) {
  const tk = F_THEME[mode];
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ padding: '0 24px 10px', fontSize: 11, fontWeight: 600, letterSpacing: 1.2, color: tk.text3, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{
        margin: '0 16px', borderRadius: 16,
        background: tk.surface, border: `1px solid ${tk.border}`,
        overflow: 'hidden',
      }}>{children}</div>
    </div>
  );
}

function SettingsRow({ mode, icon, label, value, chevron, toggle, children }) {
  const tk = F_THEME[mode];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
      borderBottom: `1px solid ${tk.border}`, minHeight: 52,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: tk.accentSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={15} color={tk.accent} strokeWidth={2} />
      </div>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: tk.text, letterSpacing: -0.2 }}>
        {label}
      </span>
      {value && <span style={{ fontSize: 14, color: tk.text2, ...numStyle }}>{value}</span>}
      {chevron && <Icon name="chevronRight" size={16} color={tk.text3} />}
      {toggle && (
        <div style={{
          width: 44, height: 26, borderRadius: 13,
          background: tk.accent, display: 'flex', alignItems: 'center', padding: 2,
          justifyContent: 'flex-end',
        }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
        </div>
      )}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sign up — registreringssidan
// ─────────────────────────────────────────────────────────────
function FSignUp({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  const s = lang === 'sv' ? {
    title: 'Skapa konto', sub: 'Börja logga din träning på 30 sekunder.',
    name: 'Namn', namePh: 'Anna Nordström',
    emailPh: 'du@example.com', pwPh: 'Minst 8 tecken',
    pwHint: 'Lösenord · stark',
    create: 'Skapa konto', haveAccount: 'Har du redan ett konto?', signIn: 'Logga in',
    terms: 'Genom att fortsätta godkänner du våra användarvillkor och integritetspolicy.',
  } : {
    title: 'Create account', sub: 'Start logging your training in 30 seconds.',
    name: 'Name', namePh: 'Anna Nordström',
    emailPh: 'you@example.com', pwPh: 'At least 8 characters',
    pwHint: 'Password · strong',
    create: 'Create account', haveAccount: 'Already have an account?', signIn: 'Sign in',
    terms: 'By continuing you agree to our Terms of Service and Privacy Policy.',
  };

  return (
    <FrameScreen theme={F_THEME} mode={mode} scroll={false}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 28px 28px' }}>
        {/* Top: back + brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 18,
            background: tk.surface, border: `1px solid ${tk.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="chevronLeft" size={16} color={tk.text} strokeWidth={2.2} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 7,
              background: `linear-gradient(135deg, ${tk.gradFrom}, ${tk.gradTo})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Logo size={15} variant="white" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.8, color: tk.text2, textTransform: 'uppercase' }}>
              FitnessMaxxing
            </span>
          </div>
        </div>

        {/* Hero heading */}
        <div style={{ marginTop: 36, marginBottom: 24 }}>
          <h1 style={{
            fontSize: 38, fontWeight: 700, letterSpacing: -1.2, lineHeight: 1.04,
            color: tk.text, margin: 0,
            fontFamily: F_THEME.fontDisplay,
          }}>{s.title}</h1>
          <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.4, color: tk.text2 }}>
            {s.sub}
          </p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ForgeField mode={mode} icon="user" placeholder={s.namePh} value="Anna Nordström" />
          <ForgeField mode={mode} icon="mail" placeholder={s.emailPh} value="anna@nordstrom.se" />

          {/* Password with strength indicator */}
          <div>
            <ForgeField mode={mode} icon="lock" placeholder={s.pwPh} value="••••••••••••" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 4px 0' }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: tk.surface2, display: 'flex', gap: 2, overflow: 'hidden' }}>
                <div style={{ flex: 1, background: tk.success }} />
                <div style={{ flex: 1, background: tk.success }} />
                <div style={{ flex: 1, background: tk.success }} />
                <div style={{ flex: 1, background: tk.surface3 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: tk.success, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                {s.pwHint}
              </span>
            </div>
          </div>

          <button style={{
            marginTop: 14, height: 56, borderRadius: 16, border: 'none',
            background: tk.accent, color: tk.accentText,
            fontSize: 17, fontWeight: 600, letterSpacing: -0.2,
            fontFamily: F_THEME.font, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: mode === 'dark' ? `0 8px 24px ${tk.accent}40` : 'none',
          }}>
            {s.create}
            <Icon name="arrowRight" size={18} color={tk.accentText} strokeWidth={2.2} />
          </button>

          <p style={{
            margin: '12px 4px 0', fontSize: 11, color: tk.text3,
            textAlign: 'center', lineHeight: 1.5, letterSpacing: 0.1,
          }}>
            {s.terms}
          </p>
        </div>

        {/* Sign in link at bottom */}
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', gap: 6, paddingTop: 16 }}>
          <span style={{ fontSize: 15, color: tk.text2 }}>{s.haveAccount}</span>
          <span style={{ fontSize: 15, color: tk.accent, fontWeight: 600 }}>{s.signIn}</span>
        </div>
      </div>
    </FrameScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// Ny plan / New plan — plans/new.tsx
// ─────────────────────────────────────────────────────────────
function FNewPlan({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  const s = lang === 'sv' ? {
    title: 'Ny plan', name: 'Namn', namePh: 't.ex. Push, Pull, Ben',
    desc: 'Beskrivning', descPh: '(valfritt)', descHelp: 'Lägg till en kort beskrivning för att hålla koll på vad planen fokuserar på.',
    create: 'Skapa plan', cancel: 'Avbryt',
  } : {
    title: 'New plan', name: 'Name', namePh: 'e.g. Push, Pull, Legs',
    desc: 'Description', descPh: '(optional)', descHelp: 'Add a short description to keep track of what this plan focuses on.',
    create: 'Create plan', cancel: 'Cancel',
  };
  return (
    <FrameScreen theme={F_THEME} mode={mode}>
      <div style={{ padding: '0 0 32px' }}>
        {/* Modal-style header: back chevron + centered title */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px 8px', position: 'relative' }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: tk.surface, border: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevronLeft" size={18} color={tk.text} strokeWidth={2.2} />
          </div>
          <div style={{
            position: 'absolute', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none',
            fontSize: 15, fontWeight: 600, color: tk.text, letterSpacing: -0.2,
          }}>{s.title}</div>
        </div>

        <div style={{ padding: '24px 20px 20px' }}>
          <h1 style={{
            fontSize: 36, fontWeight: 700, letterSpacing: -1.2, lineHeight: 1.02, margin: 0,
            color: tk.text, fontFamily: F_THEME.fontDisplay,
          }}>{s.title}</h1>
          <p style={{ margin: '10px 0 0', fontSize: 15, color: tk.text2, lineHeight: 1.4, maxWidth: 320 }}>
            {s.descHelp}
          </p>
        </div>

        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              {s.name}
            </label>
            <div style={{
              height: 56, borderRadius: 14,
              background: tk.surface, border: `2px solid ${tk.accent}`,
              display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
            }}>
              <span style={{ fontSize: 16, color: tk.text, flex: 1, letterSpacing: -0.2 }}>Push Day</span>
              <div style={{ width: 2, height: 22, background: tk.accent, borderRadius: 1 }} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              {s.desc} <span style={{ textTransform: 'none', fontWeight: 500, color: tk.text3, letterSpacing: 0 }}>{lang === 'sv' ? '· valfritt' : '· optional'}</span>
            </label>
            <div style={{
              minHeight: 110, borderRadius: 14,
              background: tk.surface, border: `1px solid ${tk.border}`,
              padding: '14px 16px',
              fontSize: 16, color: tk.text2, lineHeight: 1.4,
            }}>
              {lang === 'sv'
                ? 'Bröst · Axlar · Triceps. Tunga compound-rörelser först, isolering sist.'
                : 'Chest · Shoulders · Triceps. Heavy compounds first, isolation last.'}
            </div>
          </div>
        </div>

        {/* Primary CTA pinned visually (at end of scroll) */}
        <div style={{ padding: '32px 16px 0' }}>
          <button style={{
            width: '100%', height: 60, borderRadius: 16, border: 'none',
            background: tk.accent, color: tk.accentText,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 17, fontWeight: 600, letterSpacing: -0.2, fontFamily: F_THEME.font,
            boxShadow: mode === 'dark' ? `0 8px 24px ${tk.accent}40` : `0 6px 16px ${tk.accent}25`,
          }}>
            {s.create}
            <Icon name="arrowRight" size={18} color={tk.accentText} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </FrameScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// Exercise picker — plans/[id]/exercise-picker.tsx (modal)
// ─────────────────────────────────────────────────────────────
const EXERCISE_LIBRARY = [
  { name: 'Bänkpress', nameEn: 'Bench press', mg: 'Bröst', mgEn: 'Chest', eq: 'Skivstång' },
  { name: 'Lutande hantelpress', nameEn: 'Incline DB press', mg: 'Bröst', mgEn: 'Chest', eq: 'Hantlar' },
  { name: 'Marklyft', nameEn: 'Deadlift', mg: 'Rygg · Ben', mgEn: 'Back · Legs', eq: 'Skivstång' },
  { name: 'Knäböj', nameEn: 'Squat', mg: 'Ben', mgEn: 'Legs', eq: 'Skivstång' },
  { name: 'Axelpress', nameEn: 'Overhead press', mg: 'Axlar', mgEn: 'Shoulders', eq: 'Skivstång' },
  { name: 'Sidolyft', nameEn: 'Lateral raise', mg: 'Axlar', mgEn: 'Shoulders', eq: 'Hantlar' },
  { name: 'Chins', nameEn: 'Pull-ups', mg: 'Rygg', mgEn: 'Back', eq: 'Bodyweight' },
  { name: 'Stående hantelcurl', nameEn: 'DB curl', mg: 'Biceps', mgEn: 'Biceps', eq: 'Hantlar' },
  { name: 'Triceps pushdown', nameEn: 'Triceps pushdown', mg: 'Triceps', mgEn: 'Triceps', eq: 'Kabel' },
];

function FExercisePicker({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  const s = lang === 'sv' ? {
    title: 'Lägg till övning', cancel: 'Avbryt', search: 'Sök övning…',
    createNew: 'Skapa ny övning', filters: 'Filtrera',
    chest: 'Bröst', back: 'Rygg', legs: 'Ben', shoulders: 'Axlar', arms: 'Armar',
  } : {
    title: 'Add exercise', cancel: 'Cancel', search: 'Search exercise…',
    createNew: 'Create new exercise', filters: 'Filter',
    chest: 'Chest', back: 'Back', legs: 'Legs', shoulders: 'Shoulders', arms: 'Arms',
  };
  return (
    <FrameScreen theme={F_THEME} mode={mode}>
      <div style={{ padding: '0 0 32px' }}>
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 8px', position: 'relative' }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: tk.accent, letterSpacing: -0.2 }}>{s.cancel}</span>
          <div style={{
            position: 'absolute', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none',
            fontSize: 15, fontWeight: 600, color: tk.text, letterSpacing: -0.2,
          }}>{s.title}</div>
        </div>

        {/* Search field */}
        <div style={{ padding: '14px 16px 8px' }}>
          <div style={{
            height: 48, borderRadius: 14,
            background: tk.surface, border: `1px solid ${tk.border}`,
            display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tk.text3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <span style={{ fontSize: 15, color: tk.text3, letterSpacing: -0.2, flex: 1 }}>{s.search}</span>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ padding: '8px 16px 4px', display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {[s.chest, s.back, s.legs, s.shoulders, s.arms].map((fp, i) => (
            <div key={fp} style={{
              padding: '6px 12px', borderRadius: 18,
              background: i === 0 ? tk.accent : tk.surface,
              border: `1px solid ${i === 0 ? tk.accent : tk.border}`,
              color: i === 0 ? tk.accentText : tk.text2,
              fontSize: 13, fontWeight: 600, letterSpacing: -0.1, flexShrink: 0,
            }}>{fp}</div>
          ))}
        </div>

        {/* Create new sticky CTA */}
        <div style={{ padding: '12px 16px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', borderRadius: 14,
            background: tk.accentSoft, border: `1px dashed ${tk.accent}50`,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: tk.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="plus" size={16} color="#fff" strokeWidth={2.4} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: tk.accent, letterSpacing: -0.2 }}>{s.createNew}</div>
              <div style={{ fontSize: 12, color: tk.text2, marginTop: 1 }}>
                {lang === 'sv' ? 'Lägg till en egen rörelse i biblioteket.' : 'Add your own movement to the library.'}
              </div>
            </div>
            <Icon name="chevronRight" size={16} color={tk.accent} />
          </div>
        </div>

        {/* Exercise list */}
        <div style={{ padding: '8px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: tk.text3, textTransform: 'uppercase', padding: '6px 4px 8px' }}>
            {lang === 'sv' ? 'Övningar · Bröst' : 'Exercises · Chest'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {EXERCISE_LIBRARY.slice(0, 7).map((e, i) => (
              <div key={i} style={{
                borderRadius: 14, background: tk.surface, border: `1px solid ${tk.border}`,
                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: tk.surface2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="barbell" size={16} color={tk.text2} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: tk.text, letterSpacing: -0.2 }}>
                    {lang === 'sv' ? e.name : e.nameEn}
                  </div>
                  <div style={{ fontSize: 12, color: tk.text2, marginTop: 2 }}>
                    {lang === 'sv' ? e.mg : e.mgEn} · {e.eq}
                  </div>
                </div>
                <div style={{
                  width: 30, height: 30, borderRadius: 15,
                  background: tk.accentSoft, border: `1px solid ${tk.accent}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="plus" size={14} color={tk.accent} strokeWidth={2.4} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </FrameScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// Exercise picker · create-new state — plans/[id]/exercise-picker.tsx (showCreateForm)
// ─────────────────────────────────────────────────────────────
function FExercisePickerNew({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  const s = lang === 'sv' ? {
    title: 'Ny övning', cancel: 'Avbryt', back: '← Tillbaka',
    name: 'Namn', namePh: 'Övningens namn',
    mg: 'Muskelgrupp', mgPh: 'Välj muskelgrupp',
    eq: 'Utrustning', eqPh: 't.ex. Skivstång, Hantlar',
    notes: 'Anteckningar', notesPh: '(valfritt)',
    cta: 'Skapa & lägg till',
  } : {
    title: 'New exercise', cancel: 'Cancel', back: '← Back',
    name: 'Name', namePh: 'Exercise name',
    mg: 'Muscle group', mgPh: 'Select muscle group',
    eq: 'Equipment', eqPh: 'e.g. Barbell, Dumbbells',
    notes: 'Notes', notesPh: '(optional)',
    cta: 'Create & add',
  };
  return (
    <FrameScreen theme={F_THEME} mode={mode}>
      <div style={{ padding: '0 0 32px' }}>
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 8px', position: 'relative' }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: tk.accent, letterSpacing: -0.2 }}>{s.back}</span>
          <div style={{
            position: 'absolute', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none',
            fontSize: 15, fontWeight: 600, color: tk.text, letterSpacing: -0.2,
          }}>{s.title}</div>
        </div>

        <div style={{ padding: '20px 20px 24px' }}>
          <h1 style={{
            fontSize: 32, fontWeight: 700, letterSpacing: -1.1, lineHeight: 1.02, margin: 0,
            color: tk.text, fontFamily: F_THEME.fontDisplay,
          }}>{s.title}</h1>
        </div>

        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              {s.name}
            </label>
            <ForgeField mode={mode} icon="barbell" placeholder={s.namePh} value={lang === 'sv' ? 'Lutande hantelpress' : 'Incline DB press'} />
          </div>

          {/* Muscle group dropdown */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              {s.mg}
            </label>
            <div style={{
              height: 56, borderRadius: 14,
              background: tk.surface, border: `1px solid ${tk.border}`,
              display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
            }}>
              <span style={{ fontSize: 16, color: tk.text, flex: 1, letterSpacing: -0.2 }}>
                {lang === 'sv' ? 'Bröst' : 'Chest'}
              </span>
              <Icon name="chevronDown" size={16} color={tk.text2} />
            </div>
          </div>

          {/* Equipment */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              {s.eq}
            </label>
            <ForgeField mode={mode} icon="scale" placeholder={s.eqPh} value={lang === 'sv' ? 'Hantlar' : 'Dumbbells'} />
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              {s.notes} <span style={{ textTransform: 'none', fontWeight: 500, color: tk.text3, letterSpacing: 0 }}>{lang === 'sv' ? '· valfritt' : '· optional'}</span>
            </label>
            <div style={{
              minHeight: 92, borderRadius: 14,
              background: tk.surface, border: `1px solid ${tk.border}`,
              padding: '12px 16px',
              fontSize: 15, color: tk.text3, lineHeight: 1.4,
            }}>
              {s.notesPh}
            </div>
          </div>

          <button style={{
            marginTop: 14, width: '100%', height: 60, borderRadius: 16, border: 'none',
            background: tk.accent, color: tk.accentText,
            fontSize: 17, fontWeight: 600, letterSpacing: -0.2, fontFamily: F_THEME.font,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: mode === 'dark' ? `0 8px 24px ${tk.accent}40` : `0 6px 16px ${tk.accent}25`,
          }}>
            <Icon name="plus" size={18} color={tk.accentText} strokeWidth={2.4} />
            {s.cta}
          </button>
        </div>
      </div>
    </FrameScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// Plan exercise edit — plans/[id]/exercise/[planExerciseId]/edit.tsx (modal)
// ─────────────────────────────────────────────────────────────
function FExerciseEdit({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  const s = lang === 'sv' ? {
    title: 'Redigera mål', cancel: 'Avbryt', save: 'Spara',
    sets: 'Antal set', setsHelp: 'Hur många set per pass.',
    reps: 'Reps', repsHelp: 'Sätt min och max för ett intervall, eller bara ett av dem.',
    repsMin: 'Min', repsMax: 'Max',
    notes: 'Anteckningar', notesPh: 'Tempo, vilotid, formfokus…',
    target: 'Mål',
  } : {
    title: 'Edit targets', cancel: 'Cancel', save: 'Save',
    sets: 'Sets', setsHelp: 'How many sets per session.',
    reps: 'Reps', repsHelp: 'Set a min/max range or just one.',
    repsMin: 'Min', repsMax: 'Max',
    notes: 'Notes', notesPh: 'Tempo, rest, form cues…',
    target: 'Target',
  };
  return (
    <FrameScreen theme={F_THEME} mode={mode}>
      <div style={{ padding: '0 0 32px' }}>
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 8px', position: 'relative' }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: tk.accent, letterSpacing: -0.2 }}>{s.cancel}</span>
          <div style={{
            position: 'absolute', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none',
            fontSize: 15, fontWeight: 600, color: tk.text, letterSpacing: -0.2,
          }}>{s.title}</div>
          <span style={{ fontSize: 16, fontWeight: 700, color: tk.accent, letterSpacing: -0.2 }}>{s.save}</span>
        </div>

        {/* Exercise hero */}
        <div style={{ padding: '20px 20px 16px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase' }}>
            Push Day · {s.target}
          </span>
          <h1 style={{
            fontSize: 32, fontWeight: 700, letterSpacing: -1.1, lineHeight: 1.02, margin: '6px 0 0',
            color: tk.text, fontFamily: F_THEME.fontDisplay,
          }}>{lang === 'sv' ? 'Bänkpress' : 'Bench press'}</h1>
        </div>

        {/* Current target preview chip */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 10,
            background: tk.accentSoft, border: `1px solid ${tk.accent}30`,
          }}>
            <Icon name="spark" size={12} color={tk.accent} strokeWidth={2.2} />
            <span style={{ fontSize: 13, fontWeight: 700, color: tk.accent, letterSpacing: 0.2, ...numStyle }}>
              4 × 6–8 reps
            </span>
          </div>
        </div>

        {/* Sets */}
        <div style={{ padding: '0 16px 18px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            {s.sets}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <FStepperInput mode={mode} value="4" />
            <div style={{ flex: 1, padding: '12px 4px', fontSize: 13, color: tk.text2, lineHeight: 1.4 }}>
              {s.setsHelp}
            </div>
          </div>
        </div>

        {/* Reps range */}
        <div style={{ padding: '0 16px 18px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            {s.reps}
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <FStepperInput mode={mode} value="6" sub={s.repsMin} />
            <span style={{ fontSize: 18, color: tk.text3, fontWeight: 300 }}>–</span>
            <FStepperInput mode={mode} value="8" sub={s.repsMax} />
          </div>
          <div style={{ fontSize: 12, color: tk.text3, marginTop: 8, paddingLeft: 2 }}>{s.repsHelp}</div>
        </div>

        {/* Notes */}
        <div style={{ padding: '0 16px 18px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: tk.text3, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            {s.notes} <span style={{ textTransform: 'none', fontWeight: 500, color: tk.text3, letterSpacing: 0 }}>{lang === 'sv' ? '· valfritt' : '· optional'}</span>
          </label>
          <div style={{
            minHeight: 92, borderRadius: 14,
            background: tk.surface, border: `1px solid ${tk.border}`,
            padding: '12px 16px',
            fontSize: 14, color: tk.text2, lineHeight: 1.5, letterSpacing: -0.1,
          }}>
            {lang === 'sv'
              ? 'Pausa 2 min mellan set. Fokus på kontrollerad excentrik (3 sek ned).'
              : 'Rest 2 min between sets. Focus on controlled eccentric (3 sec down).'}
          </div>
        </div>

        {/* Delete affordance */}
        <div style={{ padding: '24px 16px 0' }}>
          <button style={{
            width: '100%', height: 52, borderRadius: 14,
            background: 'transparent', border: `1px solid ${tk.border}`,
            color: tk.danger, fontSize: 15, fontWeight: 600, letterSpacing: -0.2, fontFamily: F_THEME.font,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name="trash" size={16} color={tk.danger} strokeWidth={2} />
            {lang === 'sv' ? 'Ta bort från planen' : 'Remove from plan'}
          </button>
        </div>
      </div>
    </FrameScreen>
  );
}

function FStepperInput({ mode, value, sub }) {
  const tk = F_THEME[mode];
  return (
    <div style={{
      width: 120, height: 64, borderRadius: 14,
      background: tk.surface, border: `1px solid ${tk.borderStrong}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 8px', position: 'relative',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: tk.surface2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tk.text2} strokeWidth="2.4" strokeLinecap="round">
          <path d="M5 12h14" />
        </svg>
      </div>
      <div style={{ textAlign: 'center', position: 'relative' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: tk.text, letterSpacing: -0.5, lineHeight: 1, fontFamily: F_THEME.fontDisplay, ...numStyle }}>{value}</div>
        {sub && <div style={{ fontSize: 9, fontWeight: 700, color: tk.text3, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 3 }}>{sub}</div>}
      </div>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: tk.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="plus" size={14} color={tk.accentText} strokeWidth={2.4} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Finish-workout overlay — Avsluta-passet
// Renders inside the workout screen as a dimmed-bg modal card.
// ─────────────────────────────────────────────────────────────
function FFinishOverlay({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  return (
    <FrameScreen theme={F_THEME} mode={mode} scroll={false}>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* Faded workout content behind */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.35, pointerEvents: 'none' }}>
          <FWorkout mode={mode} t={t} lang={lang} />
        </div>
        {/* Dim scrim */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(2px)',
        }} />
        {/* Card */}
        <div style={{
          position: 'absolute', left: 16, right: 16, top: '50%', transform: 'translateY(-50%)',
          padding: 24, borderRadius: 22,
          background: mode === 'dark' ? tk.surface2 : tk.surface,
          border: `1px solid ${tk.borderStrong}`,
          boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
        }}>
          {/* Trophy icon block */}
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: `linear-gradient(135deg, ${tk.gradFrom}, ${tk.gradTo})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            boxShadow: `0 12px 24px ${tk.accent}40`,
          }}>
            <Icon name="trophy" size={24} color="#fff" strokeWidth={2.2} />
          </div>

          <h2 style={{
            margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.8,
            color: tk.text, fontFamily: F_THEME.fontDisplay,
          }}>{t.finishWorkoutQ}</h2>

          <p style={{ margin: '8px 0 18px', fontSize: 15, color: tk.text2, lineHeight: 1.4, letterSpacing: -0.1 }}>
            {lang === 'sv'
              ? '18 set sparade på 42:18. Lägg gärna en notering om hur passet kändes.'
              : '18 sets logged in 42:18. Add a note about how the session felt.'}
          </p>

          {/* Notes textarea */}
          <div style={{
            minHeight: 80, borderRadius: 12,
            background: mode === 'dark' ? tk.bg : tk.surface2,
            border: `1px solid ${tk.border}`,
            padding: '12px 14px',
            fontSize: 14, color: tk.text2, lineHeight: 1.5, letterSpacing: -0.1,
            marginBottom: 8,
          }}>
            {lang === 'sv'
              ? 'PR på bänk — kunde tagit mer. Axlar trötta från igår.'
              : 'PR on bench — could have gone heavier. Shoulders fatigued from yesterday.'}
          </div>
          <div style={{ fontSize: 11, color: tk.text3, textAlign: 'right', marginBottom: 18, ...numStyle }}>
            72 / 500
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <FFOStat mode={mode} value="18" label={t.sets} />
            <FFOStat mode={mode} value="4 820" label="kg" />
            <FFOStat mode={mode} value="42:18" label="min" />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{
              flex: 1, height: 52, borderRadius: 14,
              background: tk.surface3, color: tk.text,
              border: 'none',
              fontSize: 15, fontWeight: 600, letterSpacing: -0.2, fontFamily: F_THEME.font,
            }}>{t.continue}</button>
            <button style={{
              flex: 1.6, height: 52, borderRadius: 14, border: 'none',
              background: tk.accent, color: tk.accentText,
              fontSize: 15, fontWeight: 600, letterSpacing: -0.2, fontFamily: F_THEME.font,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: `0 6px 16px ${tk.accent}40`,
            }}>
              <Icon name="check" size={16} color={tk.accentText} strokeWidth={2.4} />
              {t.finish}
            </button>
          </div>
        </div>
      </div>
    </FrameScreen>
  );
}

function FFOStat({ mode, value, label }) {
  const tk = F_THEME[mode];
  return (
    <div style={{
      flex: 1, padding: '10px 0', borderRadius: 10,
      background: mode === 'dark' ? tk.bg : tk.surface2,
      border: `1px solid ${tk.border}`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: tk.text, letterSpacing: -0.4, lineHeight: 1, fontFamily: F_THEME.fontDisplay, ...numStyle }}>
        {value}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.8, color: tk.text3, textTransform: 'uppercase', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Active-session banner — used on tab screens while a workout is open
// ─────────────────────────────────────────────────────────────
function FActiveSessionBanner({ mode, t, lang }) {
  const tk = F_THEME[mode];
  return (
    <div style={{
      margin: '0 16px 16px',
      borderRadius: 14,
      padding: '12px 14px',
      background: tk.accentSoft, border: `1px solid ${tk.accent}30`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ position: 'relative', width: 10, height: 10 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 5, background: tk.accent,
          boxShadow: `0 0 12px ${tk.accent}`,
        }} />
        <div style={{
          position: 'absolute', inset: -4, borderRadius: 9,
          border: `2px solid ${tk.accent}`, opacity: 0.4,
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: tk.accent, letterSpacing: -0.2 }}>
          {lang === 'sv' ? 'Pågående pass · 42:18' : 'Workout in progress · 42:18'}
        </div>
        <div style={{ fontSize: 12, color: tk.text2, marginTop: 1 }}>
          Push Day · {lang === 'sv' ? '3 av 6 övningar' : '3 of 6 exercises'} · {lang === 'sv' ? 'tryck för att återgå' : 'tap to return'}
        </div>
      </div>
      <Icon name="chevronRight" size={16} color={tk.accent} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Home WITH active session banner — the cross-tab persistent state
// ─────────────────────────────────────────────────────────────
function FHomeActive({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  return (
    <FrameScreen theme={F_THEME} mode={mode}>
      <div style={{ padding: '0 0 100px' }}>
        {/* Status row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: `linear-gradient(135deg, ${tk.gradFrom}, ${tk.gradTo})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Logo size={20} variant="white" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: tk.text2, textTransform: 'uppercase' }}>
              FitnessMaxxing
            </span>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: tk.surface, border: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="user" size={16} color={tk.text2} />
          </div>
        </div>

        {/* Active session banner — pinned right under header */}
        <div style={{ marginTop: 12 }}>
          <FActiveSessionBanner mode={mode} t={t} lang={lang} />
        </div>

        {/* Page title */}
        <h1 style={{
          fontSize: 36, fontWeight: 700, letterSpacing: -1.2, margin: '4px 20px 16px',
          color: tk.text, fontFamily: F_THEME.fontDisplay,
        }}>{t.myPlans}</h1>

        {/* Plan list compacted */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SAMPLE.plans.slice(0, 4).map((p, i) => (
            <div key={p.id} style={{
              borderRadius: 18, background: tk.surface, border: `1px solid ${tk.border}`,
              padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
              opacity: i === 0 ? 1 : 0.6,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: i === 0 ? `linear-gradient(135deg, ${tk.gradFrom}, ${tk.gradTo})` : tk.surface2,
                border: i === 0 ? 'none' : `1px solid ${tk.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                <Icon name="barbell" size={20} color={i === 0 ? '#fff' : tk.text2} strokeWidth={2} />
                {i === 0 && <div style={{ position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderRadius: 7, background: tk.accent, border: `2px solid ${tk.bg}` }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: tk.text, letterSpacing: -0.3 }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 13, color: tk.text2, marginTop: 2, ...numStyle }}>
                  {i === 0 ? (lang === 'sv' ? 'Pågående · 3/6 övningar klart' : 'In progress · 3/6 exercises done') : `${p.exercises} ${t.exercises} · ${p.lastDays}d`}
                </div>
              </div>
              <Icon name="chevronRight" size={18} color={tk.text3} />
            </div>
          ))}
        </div>
      </div>
      <TabBar theme={F_THEME} mode={mode} active="plans" t={t} />
    </FrameScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// Draft-resume overlay — "Återuppta passet?" — appears on tab return
// after the app was force-quit with an unfinished session.
// ─────────────────────────────────────────────────────────────
function FDraftResumeOverlay({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  const s = lang === 'sv' ? {
    title: 'Återuppta passet?',
    body: 'Du har ett pågående pass från 09:24 med 12 set sparade på Push Day.',
    end: 'Avsluta sessionen', resume: 'Återuppta',
    timeSaved: 'Sparat sedan 09:24',
  } : {
    title: 'Resume workout?',
    body: 'You have a workout in progress from 09:24 with 12 sets logged on Push Day.',
    end: 'End session', resume: 'Resume',
    timeSaved: 'Saved since 09:24',
  };
  return (
    <FrameScreen theme={F_THEME} mode={mode} scroll={false}>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* Faded Home content behind */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.35, pointerEvents: 'none' }}>
          <FHome mode={mode} t={t} lang={lang} />
        </div>
        {/* Dim scrim */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
        }} />
        {/* Card */}
        <div style={{
          position: 'absolute', left: 16, right: 16, top: '50%', transform: 'translateY(-50%)',
          padding: 24, borderRadius: 22,
          background: mode === 'dark' ? tk.surface2 : tk.surface,
          border: `1px solid ${tk.borderStrong}`,
          boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
        }}>
          {/* Pulsing dot icon */}
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: tk.accentSoft, border: `1.5px solid ${tk.accent}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, position: 'relative',
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: 7,
              background: tk.accent, boxShadow: `0 0 16px ${tk.accent}`,
            }} />
            <div style={{
              position: 'absolute', width: 26, height: 26, borderRadius: 13,
              border: `2px solid ${tk.accent}`, opacity: 0.35,
            }} />
          </div>

          <h2 style={{
            margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.8,
            color: tk.text, fontFamily: F_THEME.fontDisplay,
          }}>{s.title}</h2>

          <p style={{ margin: '8px 0 16px', fontSize: 15, color: tk.text2, lineHeight: 1.4 }}>
            {s.body}
          </p>

          {/* Meta strip */}
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: mode === 'dark' ? tk.bg : tk.surface2,
            border: `1px solid ${tk.border}`,
            display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 20,
          }}>
            <Icon name="clock" size={16} color={tk.text2} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: tk.text, letterSpacing: -0.1 }}>
                Push Day
              </div>
              <div style={{ fontSize: 11, color: tk.text3, marginTop: 1, ...numStyle }}>
                {s.timeSaved} · 12 {t.sets}
              </div>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', borderRadius: 6,
              background: tk.accent, color: tk.accentText,
              fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
            }}>
              {lang === 'sv' ? 'Live' : 'Live'}
            </div>
          </div>

          {/* Buttons — primary "Återuppta" (accent), secondary "Avsluta" (danger ghost) */}
          <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
            <button style={{
              width: '100%', height: 56, borderRadius: 14, border: 'none',
              background: tk.accent, color: tk.accentText,
              fontSize: 16, fontWeight: 600, letterSpacing: -0.2, fontFamily: F_THEME.font,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: `0 8px 20px ${tk.accent}40`,
            }}>
              <Icon name="play" size={16} color={tk.accentText} />
              {s.resume}
            </button>
            <button style={{
              width: '100%', height: 52, borderRadius: 14,
              background: 'transparent', color: tk.danger,
              border: `1px solid ${tk.border}`,
              fontSize: 15, fontWeight: 600, letterSpacing: -0.2, fontFamily: F_THEME.font,
            }}>
              {s.end}
            </button>
          </div>
        </div>
      </div>
    </FrameScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// Saved toast — "Passet sparat ✓" — appears after Avsluta completes
// ─────────────────────────────────────────────────────────────
function FSavedToast({ mode = 'dark', t, lang = 'sv' }) {
  const tk = F_THEME[mode];
  return (
    <FrameScreen theme={F_THEME} mode={mode} scroll={false}>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* Home behind */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <FHome mode={mode} t={t} lang={lang} />
        </div>
        {/* Toast pill — bottom-centered above tab bar */}
        <div style={{
          position: 'absolute', bottom: 110, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 18px', borderRadius: 999,
          background: tk.success,
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: `0 16px 32px ${tk.success}40, 0 0 0 1px rgba(255,255,255,0.15) inset`,
          zIndex: 100,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 11,
            background: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="check" size={13} color="#fff" strokeWidth={3} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>
            {lang === 'sv' ? 'Passet sparat' : 'Workout saved'}
          </span>
        </div>
      </div>
    </FrameScreen>
  );
}

Object.assign(window, {
  FSignIn, FSignUp, FHome, FHomeActive, FPlanDetail, FNewPlan, FExercisePicker, FExercisePickerNew, FExerciseEdit, FWorkout, FFinishOverlay, FDraftResumeOverlay, FSavedToast, FHistory, FSessionDetail, FChart, FSettings,
});

import { useEffect, useState, useRef, useCallback } from 'react'

type Scene = {
  id: number
  phase: 'antes' | 'durante' | 'depois'
  phaseLabel: string
  title: string
  subtitle: string
  duration: number // ms
  screen: React.ReactNode
}

// ─── Mini phone frame ──────────────────────────────────────────
function Phone({ children, header, nav }: {
  children: React.ReactNode
  header?: React.ReactNode
  nav?: string
}) {
  const NAV_ITEMS = [
    { label: 'Campeão',  icon: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z' },
    { label: 'Palpites', icon: 'M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z M2 12h20 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z' },
    { label: 'Ranking',  icon: 'M18 20v-10 M12 20v-16 M6 20v-6' },
    { label: 'Regras',   icon: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 8v4 M12 16h.01' },
  ]
  return (
    <div style={{
      width: 210, flexShrink: 0,
      borderRadius: 28, border: '2.5px solid #1a1a1a',
      background: '#111', padding: 5,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    }}>
      <div style={{ width: 56, height: 14, background: '#111', borderRadius: '0 0 10px 10px', margin: '0 auto 3px', position: 'relative', zIndex: 2 }}/>
      <div style={{ borderRadius: 22, overflow: 'hidden', background: '#f8f9fa', minHeight: 380, display: 'flex', flexDirection: 'column' }}>
        {/* App header */}
        {header || (
          <div style={{ background: '#0099CC', padding: '9px 11px 8px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M18 2H6v7a6 6 0 0 0 12 0V2z"/>
              </svg>
            </div>
            <span style={{ fontSize: 10, fontWeight: 500, color: '#fff', flex: 1 }}>Bolão Copa BEL</span>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 500, color: '#fff' }}>EO</div>
          </div>
        )}
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'hidden', padding: '9px 9px 0' }}>
          {children}
        </div>
        {/* Nav */}
        <div style={{ display: 'flex', background: '#fff', borderTop: '0.5px solid #e5e7eb', padding: '3px 0 2px' }}>
          {NAV_ITEMS.map(item => (
            <div key={item.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '2px 0' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={nav === item.label ? '#0099CC' : '#9ca3af'} strokeWidth="1.75" strokeLinecap="round">
                <path d={item.icon}/>
              </svg>
              <span style={{ fontSize: 7, color: nav === item.label ? '#0099CC' : '#9ca3af', fontWeight: 500 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ width: 40, height: 4, background: '#333', borderRadius: 2, margin: '6px auto 3px' }}/>
    </div>
  )
}

// ─── Reusable UI pieces ────────────────────────────────────────
const MatchCard = ({ time, status, home, away, scoreH, scoreA, myPick, pickLabel, pickColor, consensus }: {
  time: string; status: 'upcoming' | 'live' | 'done'
  home: string; away: string; scoreH?: string; scoreA?: string
  myPick?: string; pickLabel?: string; pickColor?: string; consensus?: string
}) => (
  <div style={{ background: '#fff', borderRadius: 9, border: `0.5px solid ${status === 'live' ? '#FECACA' : '#e5e7eb'}`, padding: '7px 8px', marginBottom: 5 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      {status === 'live'     && <span style={{ fontSize: 7, fontWeight: 500, color: '#DC2626', background: '#FEF2F2', padding: '1px 5px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }}/> Ao vivo</span>}
      {status === 'upcoming' && <span style={{ fontSize: 7, fontWeight: 500, color: '#1D4ED8', background: '#EFF6FF', padding: '1px 5px', borderRadius: 4 }}>Em breve</span>}
      {status === 'done'     && <span style={{ fontSize: 7, fontWeight: 500, color: '#6B7280', background: '#F9FAFB', padding: '1px 5px', borderRadius: 4 }}>Encerrado</span>}
      <span style={{ fontSize: 7, color: '#9ca3af' }}>{time}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
      <span style={{ fontSize: 9, fontWeight: 500, color: '#1f2937', textAlign: 'center', flex: 1, lineHeight: 1.2 }}>{home}</span>
      <div style={{ textAlign: 'center' }}>
        {status === 'upcoming' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${scoreH ? '#0099CC' : '#e5e7eb'}`, background: scoreH ? '#EFF6FF' : '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: scoreH ? '#0099CC' : '#d1d5db' }}>{scoreH || '—'}</div>
            <span style={{ fontSize: 8, color: '#d1d5db' }}>x</span>
            <div style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${scoreA ? '#0099CC' : '#e5e7eb'}`, background: scoreA ? '#EFF6FF' : '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: scoreA ? '#0099CC' : '#d1d5db' }}>{scoreA || '—'}</div>
          </div>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 500, color: status === 'live' ? '#DC2626' : '#1f2937' }}>{scoreH} × {scoreA}</span>
        )}
        {myPick && <div style={{ fontSize: 7, fontWeight: 500, padding: '1px 4px', borderRadius: 4, marginTop: 2, background: pickColor || '#DCFCE7', color: pickColor ? undefined : '#166534' }}>{pickLabel}</div>}
        {consensus && <div style={{ fontSize: 7, color: '#9ca3af', marginTop: 2 }}>{consensus}</div>}
      </div>
      <span style={{ fontSize: 9, fontWeight: 500, color: '#1f2937', textAlign: 'center', flex: 1, lineHeight: 1.2 }}>{away}</span>
    </div>
  </div>
)

const RankRow = ({ pos, initials, name, sub, pts, highlight, badge, avatarBg, avatarColor }: {
  pos: number; initials: string; name: string; sub?: string; pts: number | string
  highlight?: boolean; badge?: string; avatarBg: string; avatarColor: string
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 4px', borderRadius: highlight ? 6 : 0, background: highlight ? '#EFF6FF' : 'transparent', borderBottom: highlight ? 'none' : '0.5px solid #f3f4f6' }}>
    <span style={{ fontSize: 10, fontWeight: 500, color: pos <= 3 ? '#B45309' : '#6b7280', width: 14, textAlign: 'center', flexShrink: 0 }}>{pos}</span>
    <div style={{ width: 22, height: 22, borderRadius: '50%', background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 500, color: avatarColor, flexShrink: 0 }}>{initials}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 9, fontWeight: 500, color: highlight ? '#1D4ED8' : '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
      {badge && <span style={{ fontSize: 7, background: '#DCFCE7', color: '#166534', padding: '1px 4px', borderRadius: 3 }}>{badge}</span>}
      {sub && !badge && <span style={{ fontSize: 7, color: '#9ca3af' }}>{sub}</span>}
    </div>
    <span style={{ fontSize: 10, fontWeight: 500, color: '#0099CC', flexShrink: 0 }}>{pts}</span>
  </div>
)

// ─── Scene definitions ─────────────────────────────────────────
const SCENES: Scene[] = [
  {
    id: 1, phase: 'antes', phaseLabel: 'Antes dos jogos', duration: 8000,
    title: 'Faça seus palpites',
    subtitle: 'Informe o placar esperado para cada jogo antes do horário de fechamento.',
    screen: (
      <Phone nav="Palpites">
        <div>
          <div style={{ background: '#EFF6FF', border: '0.5px solid #BFDBFE', borderRadius: 8, padding: '5px 8px', display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 8, color: '#1D4ED8' }}>Palpites fecham em</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#1D4ED8' }}>4h 22m</span>
          </div>
          <p style={{ fontSize: 8, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Fase de grupos</p>
          <MatchCard time="Hoje 15:00" status="upcoming" home="Brasil" away="Mexico" scoreH="2" scoreA="0"/>
          <MatchCard time="Hoje 18:00" status="upcoming" home="Argentina" away="Polonia" scoreH="1" scoreA="1"/>
          <MatchCard time="Amanha 12:00" status="upcoming" home="Franca" away="Australia"/>
          <div style={{ background: '#0099CC', borderRadius: 8, padding: '7px', textAlign: 'center', marginTop: 4 }}>
            <p style={{ fontSize: 10, fontWeight: 500, color: '#fff' }}>Confirmar 2 palpites</p>
          </div>
        </div>
      </Phone>
    ),
  },
  {
    id: 2, phase: 'antes', phaseLabel: 'Antes dos jogos', duration: 8000,
    title: 'Sem pagamento, sem palpite',
    subtitle: 'Quem não pagou pode ver os jogos, mas os campos ficam bloqueados ate confirmar a inscrição.',
    screen: (
      <Phone nav="Palpites">
        <div>
          <div style={{ background: '#FFFBEB', border: '0.5px solid #FCD34D', borderRadius: 8, padding: 8, marginBottom: 6 }}>
            <p style={{ fontSize: 9, fontWeight: 500, color: '#92400E', marginBottom: 2 }}>Pagamento necessario</p>
            <p style={{ fontSize: 7, color: '#B45309', marginBottom: 5 }}>Você pode ver os jogos, mas não pode salvar palpites ate confirmar o pagamento da inscrição.</p>
            <div style={{ background: '#F59E0B', borderRadius: 6, padding: '4px 8px', textAlign: 'center' }}>
              <p style={{ fontSize: 8, fontWeight: 500, color: '#fff' }}>Pagar R$ 10,00 via PIX</p>
            </div>
          </div>
          <div style={{ opacity: .55 }}>
            <MatchCard time="Hoje 15:00" status="upcoming" home="Brasil" away="Mexico"/>
            <MatchCard time="Hoje 18:00" status="upcoming" home="Argentina" away="Polonia"/>
          </div>
          <div style={{ background: '#F59E0B', borderRadius: 8, padding: '7px', textAlign: 'center', marginTop: 4 }}>
            <p style={{ fontSize: 9, fontWeight: 500, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Pagar inscrição para palpitar
            </p>
          </div>
        </div>
      </Phone>
    ),
  },
  {
    id: 3, phase: 'antes', phaseLabel: 'Antes dos jogos', duration: 8000,
    title: 'Escolha seu campeão',
    subtitle: 'Antes dos jogos, vote no campeão, vice e 3º lugar para ganhar pontos bônus.',
    screen: (
      <Phone nav="Campeão">
        <div>
          <div style={{ background: '#003a6e', borderRadius: 10, padding: '10px 10px 8px', marginBottom: 8, textAlign: 'center' }}>
            <p style={{ fontSize: 8, color: 'rgba(255,255,255,.6)', marginBottom: 2 }}>Palpite de campeão</p>
            <p style={{ fontSize: 16, fontWeight: 500, color: '#fff', lineHeight: 1 }}>Copa 2026</p>
            <p style={{ fontSize: 8, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>Bônus: +50 / +25 / +10 pts</p>
          </div>
          {[
            { pos: '1 Lugar', team: 'Brasil', color: '#DCFCE7', text: '#166534' },
            { pos: '2 Lugar', team: 'Argentina', color: '#DBEAFE', text: '#1E40AF' },
            { pos: '3 Lugar', team: 'Franca', color: '#F3E8FF', text: '#5B21B6' },
          ].map(r => (
            <div key={r.pos} style={{ background: '#fff', borderRadius: 8, border: '0.5px solid #e5e7eb', padding: '7px 8px', marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 8, color: '#9ca3af', marginBottom: 1 }}>{r.pos}</p>
                <p style={{ fontSize: 11, fontWeight: 500, color: '#1f2937' }}>{r.team}</p>
              </div>
              <span style={{ fontSize: 8, fontWeight: 500, background: r.color, color: r.text, padding: '2px 6px', borderRadius: 4 }}>Selecionado</span>
            </div>
          ))}
          <div style={{ background: '#0099CC', borderRadius: 8, padding: '7px', textAlign: 'center', marginTop: 2 }}>
            <p style={{ fontSize: 10, fontWeight: 500, color: '#fff' }}>Salvar palpite de campeão</p>
          </div>
        </div>
      </Phone>
    ),
  },
  {
    id: 4, phase: 'durante', phaseLabel: 'Durante os jogos', duration: 8000,
    title: 'Palpites ao vivo',
    subtitle: 'Durante os jogos você vê o placar em tempo real e compara com seu palpite.',
    screen: (
      <Phone nav="Palpites">
        <div>
          <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', display: 'inline-block', animation: 'none' }}/>
            <span style={{ fontSize: 8, color: '#DC2626', fontWeight: 500 }}>2 jogos ao vivo agora</span>
          </div>
          <MatchCard time="67'" status="live" home="Brasil" away="Mexico" scoreH="2" scoreA="0" myPick="2×0" pickLabel="Seu palpite: 2×0" pickColor="#DCFCE7" consensus="Grupo apostou 2×0 (9x)"/>
          <MatchCard time="23'" status="live" home="Argentina" away="Polonia" scoreH="0" scoreA="0" myPick="1×1" pickLabel="Seu palpite: 1×1" pickColor="#FEF9C3" consensus="Grupo apostou 1×0 (7x)"/>
          <p style={{ fontSize: 8, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', margin: '4px 0 3px' }}>Próximos</p>
          <MatchCard time="21:00 hoje" status="upcoming" home="Franca" away="Australia" scoreH="1" scoreA="0"/>
        </div>
      </Phone>
    ),
  },
  {
    id: 5, phase: 'durante', phaseLabel: 'Durante os jogos', duration: 8000,
    title: 'Ranking em tempo real',
    subtitle: 'A classificação atualiza automaticamente após cada resultado confirmado.',
    screen: (
      <Phone nav="Ranking">
        <div>
          <div style={{ background: '#003a6e', margin: '-9px -9px 8px', padding: '10px 10px 8px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,215,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, color: '#FFD700', flexShrink: 0 }}>2</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 500, color: '#fff' }}>Eduardo Oliveira</p>
              <p style={{ fontSize: 8, color: 'rgba(255,255,255,.5)' }}>Subiu 1 posição</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 18, fontWeight: 500, color: '#fff', lineHeight: 1 }}>15</p>
              <p style={{ fontSize: 7, color: 'rgba(255,255,255,.4)' }}>pontos</p>
            </div>
          </div>
          <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 7, padding: '4px 7px', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 7 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }}/>
            <span style={{ fontSize: 8, color: '#DC2626', fontWeight: 500 }}>Atualizando ao vivo</span>
          </div>
          <RankRow pos={1} initials="JV" name="Joao Victor" sub="F10+F7" pts={17} avatarBg="#EFF6FF" avatarColor="#1D4ED8"/>
          <RankRow pos={2} initials="EO" name="Eduardo (você)" sub="F10+F5 +15pts" pts={15} highlight avatarBg="#DBEAFE" avatarColor="#1E40AF"/>
          <RankRow pos={3} initials="MA" name="Maicon Araujo" sub="F7+F5" pts={12} avatarBg="#F0FDF4" avatarColor="#166534"/>
          <RankRow pos={4} initials="EM" name="Erick Moura" sub="F5+F0" pts={5} avatarBg="#FEF9C3" avatarColor="#854D0E"/>
        </div>
      </Phone>
    ),
  },
  {
    id: 6, phase: 'durante', phaseLabel: 'Durante os jogos', duration: 8000,
    title: 'Notificações push',
    subtitle: 'O administrador envia avisos pelo painel. Chegam mesmo com o app fechado.',
    screen: (
      <div style={{ width: 210, flexShrink: 0 }}>
        <div style={{ borderRadius: 28, border: '2.5px solid #1a1a1a', background: '#111', padding: 5, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
          <div style={{ width: 56, height: 14, background: '#111', borderRadius: '0 0 10px 10px', margin: '0 auto 3px' }}/>
          <div style={{ borderRadius: 22, overflow: 'hidden', background: '#1c1c1e', minHeight: 380 }}>
            <div style={{ background: '#1c1c1e', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#30D158', display: 'inline-block' }}/>
              <span style={{ fontSize: 9, color: '#fff', fontWeight: 500, flex: 1 }}>22:47</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>BRT</span>
            </div>
            {[
              { title: 'Brasil venceu! Confira o placar', body: 'Brasil 2×0 Mexico. Palpites para o próximo jogo fecham em 2h.', time: 'agora' },
              { title: 'Jogo em 1 hora!', body: 'Argentina x Polonia comeca as 18h. Ultimo aviso para palpites!', time: '3 min' },
              { title: 'Ranking atualizado', body: 'Você subiu para o 2 lugar! Veja a pontuação completa.', time: '15 min' },
            ].map((n, i) => (
              <div key={i} style={{ background: '#2c2c2e', padding: 10, margin: '0 8px 6px', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: '#0099CC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
                  </div>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,.5)', flex: 1 }}>Bolão Copa BEL</span>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,.35)' }}>{n.time}</span>
                </div>
                <p style={{ fontSize: 9, fontWeight: 500, color: '#fff', marginBottom: 2 }}>{n.title}</p>
                <p style={{ fontSize: 8, color: 'rgba(255,255,255,.55)', lineHeight: 1.4 }}>{n.body}</p>
              </div>
            ))}
          </div>
          <div style={{ width: 40, height: 4, background: '#333', borderRadius: 2, margin: '6px auto 3px' }}/>
        </div>
      </div>
    ),
  },
  {
    id: 7, phase: 'depois', phaseLabel: 'Apos os jogos', duration: 8000,
    title: 'Resultados com pontuação',
    subtitle: 'Cada jogo encerrado exibe seu palpite, a pontuação recebida e o placar mais apostado pelo grupo.',
    screen: (
      <Phone nav="Palpites">
        <div>
          <p style={{ fontSize: 8, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Encerrados</p>
          <MatchCard time="Resultado final" status="done" home="Brasil" away="Mexico" scoreH="2" scoreA="0" myPick="2×0" pickLabel="Placar exato +10pts" pickColor="#DCFCE7" consensus="Grupo apostou 2×0 (11x)"/>
          <MatchCard time="Resultado final" status="done" home="Argentina" away="Polonia" scoreH="0" scoreA="0" myPick="1×1" pickLabel="Palpite: 1×1 · 0pts" pickColor="#F3F4F6" consensus="Grupo apostou 1×0 (8x)"/>
          <MatchCard time="Resultado final" status="done" home="Franca" away="Australia" scoreH="4" scoreA="1" myPick="1×0" pickLabel="Resultado certo +5pts" pickColor="#DBEAFE"/>
          <div style={{ background: '#f9fafb', borderRadius: 8, border: '0.5px solid #e5e7eb', padding: '6px 8px', marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#6b7280' }}>Total da rodada</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#0099CC' }}>+15 pts</span>
          </div>
        </div>
      </Phone>
    ),
  },
  {
    id: 8, phase: 'depois', phaseLabel: 'Apos os jogos', duration: 8000,
    title: 'Ranking final e premiacao',
    subtitle: 'Ao fim do torneio o ranking exibe as conquistas de cada participante e o valor do prêmio por colocação.',
    screen: (
      <Phone nav="Ranking">
        <div>
          <div style={{ background: '#003a6e', margin: '-9px -9px 8px', padding: '10px 10px 8px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,215,0,0.15)', border: '1.5px solid rgba(255,215,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, color: '#FFD700', flexShrink: 0 }}>1</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 500, color: '#fff' }}>Eduardo Oliveira</p>
              <p style={{ fontSize: 8, color: 'rgba(255,255,255,.5)' }}>Campeão do Bolão BEL!</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 18, fontWeight: 500, color: '#FFD700', lineHeight: 1 }}>342</p>
              <p style={{ fontSize: 7, color: 'rgba(255,255,255,.4)' }}>pontos</p>
            </div>
          </div>
          <RankRow pos={1} initials="EO" name="Eduardo (você)" pts={342} highlight badge="Vidente · Lider" avatarBg="#FEF3C7" avatarColor="#92400E"/>
          <RankRow pos={2} initials="JV" name="Joao Victor" pts={318} badge="Atirador Elite" avatarBg="#EFF6FF" avatarColor="#1D4ED8"/>
          <RankRow pos={3} initials="MA" name="Maicon Araujo" pts={295} badge="Zebra" avatarBg="#F0FDF4" avatarColor="#166534"/>
          <RankRow pos={4} initials="EM" name="Erick Moura" pts={241} avatarBg="#FEF9C3" avatarColor="#854D0E"/>
          <div style={{ background: '#FFFBEB', border: '0.5px solid #FCD34D', borderRadius: 8, padding: '7px 8px', marginTop: 6 }}>
            <p style={{ fontSize: 8, fontWeight: 500, color: '#92400E', marginBottom: 4 }}>Prêmio final</p>
            {[
              { pos: '1 Eduardo', pct: '60%', val: 'R$ 108,00' },
              { pos: '2 Joao Victor', pct: '25%', val: 'R$ 45,00' },
              { pos: '3 Maicon', pct: '15%', val: 'R$ 27,00' },
            ].map(r => (
              <div key={r.pos} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '0.5px solid #FEF3C7' }}>
                <span style={{ fontSize: 8, color: '#92400E' }}>{r.pos}</span>
                <span style={{ fontSize: 8, fontWeight: 500, color: '#78350F' }}>{r.val}</span>
              </div>
            ))}
          </div>
        </div>
      </Phone>
    ),
  },
]

const PHASE_COLORS = {
  antes:   { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
  durante: { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' },
  depois:  { bg: '#F0FDF4', text: '#166534', dot: '#22C55E' },
}

// ─── Main modal ────────────────────────────────────────────────
export default function TutorialModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent]     = useState(0)
  const [playing, setPlaying]     = useState(true)
  const [progress, setProgress]   = useState(0)
  const [animIn, setAnimIn]       = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scene       = SCENES[current]

  const goTo = useCallback((idx: number, autoPlay = true) => {
    setAnimIn(false)
    setTimeout(() => {
      setCurrent(idx)
      setProgress(0)
      setAnimIn(true)
      if (autoPlay) setPlaying(true)
    }, 200)
  }, [])

  const next = useCallback(() => {
    if (current < SCENES.length - 1) goTo(current + 1)
    else { setPlaying(false); setProgress(100) }
  }, [current, goTo])

  const prev = useCallback(() => {
    if (current > 0) goTo(current - 1)
  }, [current, goTo])

  // Progress ticker
  useEffect(() => {
    if (progressRef.current) clearInterval(progressRef.current)
    if (!playing) return
    const tick = 50
    const steps = scene.duration / tick
    let step = 0
    progressRef.current = setInterval(() => {
      step++
      setProgress(Math.min((step / steps) * 100, 100))
      if (step >= steps) {
        clearInterval(progressRef.current!)
        next()
      }
    }, tick)
    return () => { if (progressRef.current) clearInterval(progressRef.current) }
  }, [current, playing, scene.duration, next])

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') onClose()
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onClose])

  const pc = PHASE_COLORS[scene.phase]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,10,20,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}
      onClick={onClose}
    >
      <div style={{
        width: '100%', maxWidth: 560,
        background: '#fff', borderRadius: 20,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        maxHeight: '95vh',
      }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '0.5px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#0099CC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1f2937' }}>Tutorial do Bolão Copa BEL</p>
            <p style={{ fontSize: 11, color: '#9ca3af' }}>Cena {current + 1} de {SCENES.length}</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Scene progress bars ── */}
        <div style={{ display: 'flex', gap: 3, padding: '8px 16px 0' }}>
          {SCENES.map((s, i) => (
            <div key={s.id} style={{ flex: 1, height: 3, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden', cursor: 'pointer' }}
              onClick={() => goTo(i)}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: '#0099CC',
                width: i < current ? '100%' : i === current ? `${progress}%` : '0%',
                transition: i === current ? 'none' : 'width .2s',
              }}/>
            </div>
          ))}
        </div>

        {/* ── Phase label ── */}
        <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 500, background: pc.bg, color: pc.text, padding: '2px 8px', borderRadius: 10 }}>
            {scene.phaseLabel}
          </span>
        </div>

        {/* ── Scene title + subtitle ── */}
        <div style={{ padding: '8px 16px 10px' }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: '#1f2937', marginBottom: 3 }}>{scene.title}</p>
          <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{scene.subtitle}</p>
        </div>

        {/* ── Screen display ── */}
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '8px 16px 12px',
          opacity: animIn ? 1 : 0,
          transform: animIn ? 'translateX(0)' : 'translateX(20px)',
          transition: 'opacity .2s, transform .2s',
        }}>
          {scene.screen}
        </div>

        {/* ── Controls ── */}
        <div style={{ padding: '10px 16px 14px', borderTop: '0.5px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Prev */}
          <button onClick={prev} disabled={current === 0}
            style={{ width: 36, height: 36, borderRadius: 8, border: '0.5px solid #e5e7eb', background: '#fff', cursor: current === 0 ? 'not-allowed' : 'pointer', opacity: current === 0 ? .35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          {/* Play/pause */}
          <button onClick={() => setPlaying(p => !p)}
            style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: '#0099CC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {playing
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            }
          </button>

          {/* Scene dots */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 5, flexWrap: 'wrap' }}>
            {SCENES.map((s, i) => (
              <button key={s.id} onClick={() => goTo(i)}
                style={{ width: i === current ? 18 : 7, height: 7, borderRadius: 4, border: 'none', background: i === current ? '#0099CC' : i < current ? '#93C5FD' : '#e5e7eb', cursor: 'pointer', padding: 0, transition: 'width .2s, background .2s' }}
                title={s.title}
              />
            ))}
          </div>

          {/* Next */}
          <button onClick={next} disabled={current === SCENES.length - 1 && progress >= 100}
            style={{ width: 36, height: 36, borderRadius: 8, border: '0.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round"><polyline points="9 6 15 12 9 18"/></svg>
          </button>

          {/* Close when last */}
          {current === SCENES.length - 1 && progress >= 99 && (
            <button onClick={onClose}
              style={{ padding: '0 14px', height: 36, borderRadius: 8, border: 'none', background: '#0099CC', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
              Começar
            </button>
          )}
        </div>

        {/* Keyboard hint */}
        <div style={{ padding: '0 16px 10px', display: 'flex', gap: 10, justifyContent: 'center' }}>
          {[['←→', 'Navegar'], ['Espaco', 'Play/pause'], ['Esc', 'Fechar']].map(([k, l]) => (
            <span key={k} style={{ fontSize: 10, color: '#d1d5db' }}>
              <span style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 4, padding: '1px 5px', fontSize: 9, color: '#9ca3af', marginRight: 4 }}>{k}</span>
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

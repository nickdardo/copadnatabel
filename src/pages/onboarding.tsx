import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Head from 'next/head'
import { generatePixPayload, formatCPF } from '@/lib/pix'

type PixConfig = { cpf: string; nome: string; valor: number; descricao: string; whatsapp?: string }
type Step = 'rules' | 'payment' | 'done'

export default function OnboardingPage() {
  const { player, loading } = useAuth()
  const router = useRouter()

  const [step,       setStep]    = useState<Step>('rules')
  const [pix,        setPix]     = useState<PixConfig | null>(null)
  const [payload,    setPayload] = useState('')
  const [qrUrl,      setQrUrl]  = useState('')
  const [copied,     setCopied]  = useState(false)
  const [showSkipWarning, setShowSkipWarning] = useState(false)

  useEffect(() => {
    if (!loading && !player) router.push('/')
  }, [loading, player])

  useEffect(() => {
    if (!player) return
    supabase.from('pix_config').select('*').limit(1).then(({ data }) => {
      if (data?.[0]) {
        const cfg = data[0] as PixConfig
        setPix(cfg)
        const p = generatePixPayload({
          cpf:      cfg.cpf,
          nome:     cfg.nome,
          valor:    cfg.valor,
          cidade:   'Belem',
          descricao: cfg.descricao || 'Bolao Copa 2026 BEL',
          txid:     `BEL${player.id.slice(0, 8).replace(/-/g, '')}`,
        })
        setPayload(p)
        setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(p)}`)
      }
    })
  }, [player])

  async function copyPayload() {
    try { await navigator.clipboard.writeText(payload) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  if (loading || !player) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/>
    </div>
  )

  return (
    <>
      <Head>
        <title>{step === 'rules' ? 'Regras' : step === 'payment' ? 'Pagamento' : 'Pronto'} · Bolão Copa 2026 BEL</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
        <link rel="icon" type="image/x-icon" href="/favicon.ico"/>
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Progress */}
        <div className="h-1.5 bg-gray-200 flex-shrink-0">
          <div className="h-full bg-[#0099CC] transition-all duration-500 rounded-full"
            style={{ width: step === 'rules' ? '33%' : step === 'payment' ? '66%' : '100%' }}/>
        </div>

        {/* Back button */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-1 max-w-sm mx-auto w-full">
          {step === 'payment' && (
            <button onClick={() => setStep('rules')}
              className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          {step !== 'done' && (
            <button onClick={() => setShowSkipWarning(true)}
              className="ml-auto text-[12px] text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2">
              Pular
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col max-w-sm mx-auto w-full px-4 pb-6">

          {/* ── STEP 1: Regras ─────────────────────────────────── */}
          {step === 'rules' && (
            <div className="flex-1 flex flex-col">
              <div className="text-center mb-5">
                <img src="/copa2026-logo.jpg" alt="Copa 2026"
                  className="h-14 w-14 mx-auto mb-3 rounded-xl object-cover shadow-md"/>
                <h1 className="text-[22px] font-bold text-gray-900">Bem-vindo ao Bolão!</h1>
                <p className="text-[13px] text-gray-400 mt-1">Copa 2026 BEL</p>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto">
                <div className="bg-[#E6F4FA] border border-[#0099CC]/20 rounded-2xl p-4">
                  <p className="text-[13px] font-bold text-[#0099CC] mb-1">🏆 Objetivo</p>
                  <p className="text-[13px] text-gray-700 leading-relaxed">
                    Acerte os placares dos <strong>72 jogos</strong> da Copa 2026. Quem tiver mais pontos vence o <strong>Bolão BEL</strong>!
                  </p>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">⚽ Pontuação</p>
                  <div className="space-y-2">
                    {[
                      { pts:'10', bg:'bg-green-100 text-green-800', label:'Placar exato', sub:'Ex: chutou 2×1, deu 2×1' },
                      { pts:'7',  bg:'bg-blue-100 text-blue-800',   label:'Resultado + 1 placar', sub:'Ex: chutou 2×1, deu 3×1' },
                      { pts:'5',  bg:'bg-amber-100 text-amber-800', label:'Resultado certo', sub:'Vitória / Empate / Derrota' },
                      { pts:'2',  bg:'bg-pink-100 text-pink-800',   label:'1 placar parcial', sub:'Ex: chutou 2×1, deu 2×3' },
                      { pts:'0',  bg:'bg-gray-100 text-gray-500',   label:'Nenhum acerto', sub:'' },
                    ].map(r => (
                      <div key={r.label} className="flex items-center gap-3">
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-lg w-10 text-center flex-shrink-0 ${r.bg}`}>{r.pts}pts</span>
                        <div>
                          <p className="text-[13px] font-semibold text-gray-800">{r.label}</p>
                          {r.sub && <p className="text-[11px] text-gray-400">{r.sub}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">🏅 Bônus Campeão</p>
                  {[
                    { l:'Acertar o campeão',pts:'+50 pts' },
                    { l:'Acertar o vice',   pts:'+25 pts' },
                    { l:'Acertar 3º lugar', pts:'+10 pts' },
                  ].map(b => (
                    <div key={b.l} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-[13px] text-gray-700">{b.l}</span>
                      <span className="text-[13px] font-bold text-[#0099CC]">{b.pts}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide mb-2">⚡ Limites</p>
                  {[
                    'Palpites fecham 5h antes de cada jogo',
                    'Máximo 3 alterações por rodada',
                    'Palpite de campeão: 3 trocas no total',
                  ].map(r => (
                    <p key={r} className="text-[12px] text-amber-700 flex items-start gap-1.5 mt-1">
                      <span className="text-amber-400 mt-0.5 flex-shrink-0">•</span>{r}
                    </p>
                  ))}
                </div>
              </div>

              <button
                onClick={() => pix ? setStep('payment') : router.push('/champion')}
                className="mt-4 w-full py-4 rounded-2xl bg-[#0099CC] text-white font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#007aa8] transition-all active:scale-[.98] shadow-sm">
                {pix ? 'Próximo: Pagar inscrição →' : 'Começar a jogar →'}
              </button>
            </div>
          )}

          {/* ── STEP 2: Pagamento PIX ──────────────────────────── */}
          {step === 'payment' && pix && (
            <div className="flex-1 flex flex-col">
              <div className="text-center mb-4">
                <h1 className="text-[20px] font-bold text-gray-900">Pagar inscrição</h1>
                <p className="text-[13px] text-gray-400 mt-1">Pague via PIX para participar</p>
              </div>

              {/* Value */}
              <div className="bg-gradient-to-br from-[#003a6e] to-[#0099CC] rounded-2xl p-5 text-center mb-4 shadow-md">
                <p className="text-white/70 text-[12px] font-medium uppercase tracking-wide">Inscrição</p>
                <p className="text-white font-bold text-[48px] leading-none mt-1">
                  R${pix.valor.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-white/60 text-[12px] mt-1.5">{pix.descricao}</p>
              </div>

              {/* QR Code card */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-3">
                <p className="text-[13px] font-bold text-gray-700 text-center mb-3">
                  Escaneie com o app do seu banco
                </p>

                <div className="flex justify-center mb-3">
                  {qrUrl ? (
                    <div className="p-3 border-2 border-[#0099CC]/20 rounded-2xl bg-white">
                      <img src={qrUrl} alt="QR Code PIX" width={200} height={200} className="rounded-xl"/>
                    </div>
                  ) : (
                    <div className="w-[200px] h-[200px] bg-gray-100 rounded-2xl flex items-center justify-center">
                      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/>
                    </div>
                  )}
                </div>

                {/* Recipient info */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 mb-3">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-400">Beneficiário</span>
                    <span className="font-semibold text-gray-800">{pix.nome}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-400">Chave PIX (CPF)</span>
                    <span className="font-semibold text-gray-800 font-mono">{formatCPF(pix.cpf)}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-400">Valor</span>
                    <span className="font-bold text-[#0099CC]">R$ {pix.valor.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>

                {/* Copy button */}
                <button onClick={copyPayload}
                  className={`w-full py-3 rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-[.98] ${copied ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
                  {copied ? (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copiado!</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar código PIX</>
                  )}
                </button>
              </div>

              {/* Instructions */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                <p className="text-[11px] font-bold text-amber-800 uppercase mb-2">Como pagar</p>
                {['Abra o app do seu banco', 'PIX → Ler QR Code ou Colar código', `Confirme o valor: R$ ${pix.valor.toFixed(2).replace('.', ',')}`, 'Pague e clique em "Já paguei" abaixo'].map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px] text-amber-700 mt-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-800 text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                    {s}
                  </div>
                ))}
              </div>

              {/* Confirm button */}
              <button onClick={() => setStep('done')}
                className="w-full py-4 rounded-2xl bg-green-500 text-white font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-green-600 transition-all active:scale-[.98] shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Já paguei — aguardar confirmação
              </button>
            </div>
          )}

          {/* ── STEP 3: Aguardando ─────────────────────────────── */}
          {step === 'done' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
              {/* Icon */}
              <div className="w-24 h-24 rounded-full bg-amber-50 border-4 border-amber-200 flex items-center justify-center mb-6 shadow-inner">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="1.75" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>

              <h1 className="text-[22px] font-bold text-gray-900 mb-2">Pagamento enviado!</h1>

              {/* Main message */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-4 text-left w-full">
                <p className="text-[14px] font-bold text-gray-800 mb-2">Próximo passo:</p>
                <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
                  <svg className="flex-shrink-0 mt-0.5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.44 2 2 0 0 1 3.59 2.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17z"/>
                  </svg>
                  <div>
                    <p className="text-[13px] font-bold text-green-800">Envie o comprovante via WhatsApp</p>
                    <p className="text-[12px] text-green-700 mt-0.5 leading-relaxed">
                      Encaminhe o comprovante de pagamento ao gerente <strong>Aristone Figueredo</strong> para que ele confirme sua participação no bolão.
                    </p>
                  </div>
                </div>

                <div className="mt-3 bg-gray-50 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400 mb-1">Status atual</p>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"/>
                    <span className="text-[13px] font-semibold text-gray-700">Aguardando confirmação do admin</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Você será notificado quando confirmado</p>
                </div>
              </div>

              <button onClick={() => router.push('/champion')}
                className="w-full py-4 rounded-2xl bg-[#0099CC] text-white font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#007aa8] transition-all active:scale-[.98] shadow-sm">
                Ir para os palpites
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Skip warning modal */}
      {showSkipWarning && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            {/* Warning header */}
            <div className="bg-amber-50 border-b border-amber-100 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-amber-900 text-[15px]">Atenção!</p>
                <p className="text-[12px] text-amber-700">Sobre a premiação</p>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-[14px] text-gray-700 leading-relaxed">
                Você pode participar do bolão e fazer seus palpites normalmente <strong>sem pagar</strong>.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-[13px] font-bold text-red-700 mb-1">⚠️ Porém, se ganhar:</p>
                <p className="text-[13px] text-red-600 leading-relaxed">
                  Sem o pagamento confirmado, você <strong>não receberá nenhuma premiação</strong>, mesmo que termine em 1º, 2º ou 3º lugar.
                </p>
              </div>
              <p className="text-[12px] text-gray-400 leading-relaxed">
                Você ainda pode pagar depois acessando o botão <strong>"Pagar R$10"</strong> no topo do app.
              </p>
            </div>

            <div className="px-5 pb-5 space-y-2.5">
              {/* Go back and pay */}
              <button onClick={() => { setShowSkipWarning(false); setStep('payment') }}
                className="w-full py-3.5 rounded-xl bg-[#0099CC] text-white font-bold text-[14px] hover:bg-[#007aa8] transition-all active:scale-[.98]">
                Quero pagar e participar da premiação
              </button>
              {/* Skip anyway */}
              <button onClick={() => { setShowSkipWarning(false); router.push('/champion') }}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-[13px] font-medium hover:bg-gray-50 transition-colors">
                Entendi — quero participar sem premiação
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

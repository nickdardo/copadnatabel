import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Head from 'next/head'
import { generatePixPayload, formatPixKeyDisplay, getKeyTypeLabel, PixKeyType } from '@/lib/pix'

type PixConfig = { cpf: string; key_type: PixKeyType; nome: string; valor: number; descricao: string; whatsapp?: string }
type Step = 'rules' | 'payment' | 'waiting'

export default function OnboardingPage() {
  const { player, loading, refreshPlayer } = useAuth()
  const router = useRouter()

  const [step,    setStep]    = useState<Step>('rules')
  const [pix,     setPix]     = useState<PixConfig | null>(null)
  const [payload, setPayload] = useState('')
  const [qrUrl,   setQrUrl]   = useState('')
  const [copied,  setCopied]  = useState(false)
  const [checking,  setChecking]  = useState(false)
  const [whatsapp,  setWhatsapp]  = useState('')

  useEffect(() => {
    if (!loading && !player) router.push('/')
  }, [loading, player])

  useEffect(() => {
    if (!player) return
    supabase.from('pix_config').select('*').limit(1).then(({ data }) => {
      if (data?.[0]) {
        const cfg = data[0] as PixConfig
        setPix(cfg)
        setWhatsapp(cfg.whatsapp || '')
        const p = generatePixPayload({
          key: cfg.cpf, keyType: cfg.key_type || 'cpf',
          nome: cfg.nome, valor: cfg.valor,
          cidade: 'Belem', descricao: cfg.descricao || 'Bolao Copa 2026 BEL',
          txid: `BEL${player.id.slice(0, 8).replace(/-/g, '')}`,
        })
        setPayload(p)
        setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(p)}`)
      }
    })
  }, [player])

  // Poll for payment confirmation every 5s when on waiting step
  const checkPayment = useCallback(async () => {
    if (!player) return
    setChecking(true)
    const { data } = await supabase
      .from('players')
      .select('payment_ok')
      .eq('id', player.id)
      .single()
    setChecking(false)
    if (data?.payment_ok) {
      await refreshPlayer()
      router.push('/champion')
    }
  }, [player])

  useEffect(() => {
    if (step !== 'waiting') return
    // Check immediately
    checkPayment()
    // Then every 5 seconds
    const interval = setInterval(checkPayment, 5000)
    return () => clearInterval(interval)
  }, [step, checkPayment])

  function close() { router.push('/champion') }

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

  // If already paid — show rules only (no payment step)
  const isPaid = player.payment_ok

  return (
    <>
      <Head>
        <title>Regras · Bolão Copa 2026 BEL</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
        <link rel="icon" type="image/x-icon" href="/favicon.ico"/>
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col">

        {/* Progress bar — only show when unpaid and going through payment */}
        {!isPaid && (
          <div className="h-1.5 bg-gray-200 flex-shrink-0">
            <div className="h-full bg-[#0099CC] transition-all duration-500 rounded-r-full"
              style={{ width: step === 'rules' ? '33%' : step === 'payment' ? '66%' : '100%' }}/>
          </div>
        )}

        {/* Header with X close button */}
        <div className="flex items-center justify-between px-4 pt-4 pb-1 max-w-sm mx-auto w-full">
          {/* Back arrow — only on payment step */}
          {step === 'payment' && !isPaid ? (
            <button onClick={() => setStep('rules')}
              className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          ) : <div className="w-9"/>}

          {/* Step label */}
          <span className="text-[12px] text-gray-400 font-medium">
            {step === 'rules' ? 'Regras do bolão' : step === 'payment' ? 'Pagamento' : 'Aguardando confirmação'}
          </span>

          {/* X Close */}
          <button onClick={close}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 shadow-sm transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col max-w-sm mx-auto w-full px-4 pb-6">

          {/* ── RULES ─────────────────────────────────────────── */}
          {step === 'rules' && (
            <div className="flex-1 flex flex-col">
              <div className="text-center mb-4">
                <img src="/copa2026-logo.jpg" alt="Copa 2026"
                  className="h-14 w-14 mx-auto mb-3 rounded-xl object-cover shadow-md"/>
                <h1 className="text-[20px] font-bold text-gray-900">Como funciona o Bolão</h1>
                <p className="text-[13px] text-gray-400 mt-0.5">Copa 2026 BEL</p>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto pb-2">
                <div className="bg-[#E6F4FA] border border-[#0099CC]/20 rounded-2xl p-4">
                  <p className="text-[13px] font-bold text-[#0099CC] mb-1">🏆 Objetivo</p>
                  <p className="text-[13px] text-gray-700 leading-relaxed">
                    Acerte os placares dos <strong>72 jogos</strong> e acumule pontos. Quem tiver mais pontos vence o <strong>Bolão BEL</strong>!
                  </p>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">⚽ Pontuação</p>
                  {[
                    { pts:'10', bg:'bg-green-100 text-green-800', label:'Placar exato', sub:'Ex: chutou 2×1, deu 2×1' },
                    { pts:'7',  bg:'bg-blue-100 text-blue-800',   label:'Resultado + 1 placar', sub:'Ex: chutou 2×1, deu 3×1' },
                    { pts:'5',  bg:'bg-amber-100 text-amber-800', label:'Resultado certo', sub:'Vitória / Empate / Derrota' },
                    { pts:'2',  bg:'bg-pink-100 text-pink-800',   label:'1 placar parcial', sub:'Ex: chutou 2×1, deu 2×3' },
                    { pts:'0',  bg:'bg-gray-100 text-gray-500',   label:'Nenhum acerto', sub:'' },
                  ].map(r => (
                    <div key={r.label} className="flex items-center gap-3 mb-2 last:mb-0">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-lg w-10 text-center flex-shrink-0 ${r.bg}`}>{r.pts}pts</span>
                      <div>
                        <p className="text-[13px] font-semibold text-gray-800">{r.label}</p>
                        {r.sub && <p className="text-[11px] text-gray-400">{r.sub}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">🏅 Bônus Campeão</p>
                  {[{l:'Acertar campeão',p:'+50 pts'},{l:'Acertar vice',p:'+25 pts'},{l:'Acertar 3º lugar',p:'+10 pts'}].map(b => (
                    <div key={b.l} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-[13px] text-gray-700">{b.l}</span>
                      <span className="text-[13px] font-bold text-[#0099CC]">{b.p}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide mb-2">⚡ Limites</p>
                  {['Palpites fecham 5h antes de cada jogo','Máximo 3 alterações por rodada','Palpite de campeão: 3 trocas no total'].map(r => (
                    <p key={r} className="text-[12px] text-amber-700 flex items-start gap-1.5 mt-1">
                      <span className="text-amber-400 mt-0.5 flex-shrink-0">•</span>{r}
                    </p>
                  ))}
                </div>

                {/* Payment status info */}
                {isPaid ? (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <div>
                      <p className="text-[13px] font-bold text-green-800">Pagamento confirmado!</p>
                      <p className="text-[12px] text-green-600">Você está na disputa pela premiação.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                    <p className="text-[12px] font-bold text-gray-700 mb-1">💰 Premiação</p>
                    <p className="text-[12px] text-gray-500 leading-relaxed">
                      Inscrição de <strong>R$ {pix?.valor.toFixed(2).replace('.', ',') || '10,00'}</strong> para concorrer. Pague via PIX e aguarde a confirmação do admin. Sem pagamento, seus palpites não contam para a premiação.
                    </p>
                  </div>
                )}
              </div>

              {/* CTA — only show payment button if unpaid */}
              {!isPaid && pix && (
                <button onClick={() => setStep('payment')}
                  className="mt-4 w-full py-4 rounded-2xl bg-[#0099CC] text-white font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#007aa8] transition-all active:scale-[.98] shadow-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  Pagar inscrição · R$ {pix.valor.toFixed(2).replace('.', ',')}
                </button>
              )}
              {isPaid && (
                <button onClick={close}
                  className="mt-4 w-full py-4 rounded-2xl bg-[#0099CC] text-white font-bold text-[15px] hover:bg-[#007aa8] transition-all active:scale-[.98]">
                  Ir para os palpites →
                </button>
              )}

              {/* WhatsApp support button — shown to all logged-in users when whatsapp is configured */}
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Preciso de ajuda com o Bolão Copa 2026 BEL 🏆')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 w-full py-3 rounded-2xl border border-green-200 bg-green-50 text-green-700 font-semibold text-[13px] flex items-center justify-center gap-2 hover:bg-green-100 transition-all active:scale-[.98]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                  </svg>
                  Suporte via WhatsApp
                </a>
              )}
            </div>
          )}

          {/* ── PAYMENT ───────────────────────────────────────── */}
          {step === 'payment' && pix && !isPaid && (
            <div className="flex-1 flex flex-col">
              <div className="text-center mb-4">
                <h1 className="text-[20px] font-bold text-gray-900">Pagar via PIX</h1>
                <p className="text-[13px] text-gray-400 mt-0.5">Escaneie ou copie o código</p>
              </div>

              <div className="bg-gradient-to-br from-[#003a6e] to-[#0099CC] rounded-2xl p-4 text-center mb-4 shadow-md">
                <p className="text-white/70 text-[12px] uppercase tracking-wide">Inscrição Bolão BEL</p>
                <p className="text-white font-black text-[44px] leading-none mt-1">
                  R${pix.valor.toFixed(2).replace('.', ',')}
                </p>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-3">
                <div className="flex justify-center mb-3">
                  {qrUrl
                    ? <div className="p-3 border-2 border-[#0099CC]/20 rounded-2xl bg-white">
                        <img src={qrUrl} alt="QR Code PIX" width={190} height={190} className="rounded-xl"/>
                      </div>
                    : <div className="w-[190px] h-[190px] bg-gray-100 rounded-2xl flex items-center justify-center">
                        <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/>
                      </div>
                  }
                </div>

                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 mb-3 text-[12px]">
                  <div className="flex justify-between"><span className="text-gray-400">Beneficiário</span><span className="font-semibold">{pix.nome}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Chave ({getKeyTypeLabel(pix.key_type || 'cpf')})</span><span className="font-mono font-semibold">{formatPixKeyDisplay(pix.cpf, pix.key_type || 'cpf')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Valor</span><span className="font-bold text-[#0099CC]">R$ {pix.valor.toFixed(2).replace('.', ',')}</span></div>
                </div>

                <button onClick={copyPayload}
                  className={`w-full py-3 rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-[.98] ${copied ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
                  {copied
                    ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Código copiado!</>
                    : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar código PIX</>
                  }
                </button>
              </div>

              {/* After payment instruction */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                <p className="text-[12px] font-bold text-amber-800 mb-2">Após pagar:</p>
                <div className="flex items-start gap-2.5">
                  <svg className="flex-shrink-0 mt-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.44 2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17z"/></svg>
                  <p className="text-[12px] text-amber-700 leading-relaxed">
                    Envie o comprovante via WhatsApp ao gerente <strong>Aristone Figueredo</strong> para confirmação.
                  </p>
                </div>
              </div>

              <button onClick={() => setStep('waiting')}
                className="w-full py-4 rounded-2xl bg-green-500 text-white font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-green-600 transition-all active:scale-[.98] shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Já paguei — aguardar confirmação
              </button>
            </div>
          )}

          {/* ── WAITING FOR CONFIRMATION ──────────────────────── */}
          {step === 'waiting' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
              <div className="w-20 h-20 rounded-full bg-amber-50 border-4 border-amber-200 flex items-center justify-center mb-5 relative">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                {/* Pulse ring */}
                <div className="absolute inset-0 rounded-full border-4 border-amber-300 animate-ping opacity-30"/>
              </div>

              <h1 className="text-[20px] font-bold text-gray-900 mb-2">Aguardando confirmação</h1>

              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-4 w-full text-left">
                <div className="flex items-center gap-2 mb-3">
                  {checking
                    ? <span className="w-2.5 h-2.5 rounded-full bg-[#0099CC] animate-pulse flex-shrink-0"/>
                    : <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0"/>}
                  <span className="text-[13px] font-semibold text-gray-700">
                    {checking ? 'Verificando pagamento...' : 'Aguardando confirmação do admin'}
                  </span>
                </div>
                <p className="text-[12px] text-gray-400 leading-relaxed">
                  Esta tela verifica automaticamente a cada <strong>5 segundos</strong>. Quando o admin confirmar, você será redirecionado automaticamente! 🎉
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 w-full mb-4">
                <p className="text-[12px] font-bold text-green-800 mb-1">📱 Próximo passo:</p>
                <p className="text-[12px] text-green-700 leading-relaxed">
                  Envie o comprovante via WhatsApp ao gerente <strong>Aristone Figueredo</strong> e aguarde a confirmação.
                </p>
              </div>

              <button onClick={close}
                className="w-full py-3 rounded-2xl border border-gray-200 bg-white text-[13px] font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                Explorar o bolão enquanto aguardo →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Head from 'next/head'
import { generatePixPayload, formatCPF } from '@/lib/pix'

type PixConfig = { cpf: string; nome: string; valor: number; descricao: string }
type Step = 'rules' | 'payment' | 'done'

export default function OnboardingPage() {
  const { player, loading, refreshPlayer } = useAuth()
  const router = useRouter()
  const [step,       setStep]       = useState<Step>('rules')
  const [pix,        setPix]        = useState<PixConfig | null>(null)
  const [payload,    setPayload]    = useState('')
  const [qrUrl,      setQrUrl]      = useState('')
  const [copied,     setCopied]     = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => { if (!loading && !player) router.push('/') }, [loading, player])
  useEffect(() => { if (!loading && player?.payment_ok) router.push('/champion') }, [loading, player])

  useEffect(() => {
    if (!player) return
    supabase.from('pix_config').select('*').limit(1).then(({ data }) => {
      if (data && data[0]) {
        const cfg = data[0] as PixConfig
        setPix(cfg)
        const p = generatePixPayload({
          cpf: cfg.cpf, nome: cfg.nome, valor: cfg.valor,
          cidade: 'Belem', descricao: cfg.descricao || 'Bolao Copa 2026 BEL',
          txid: `BEL${player.id.slice(0,8).replace(/-/g,'')}`,
        })
        setPayload(p)
        setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(p)}`)
      }
    })
  }, [player])

  async function copyPayload() {
    await navigator.clipboard.writeText(payload)
    setCopied(true); setTimeout(() => setCopied(false), 3000)
  }

  async function confirmPaid() {
    setConfirming(true)
    // Mark as pending confirmation — admin will confirm
    await supabase.from('players').update({ payment_ok: false }).eq('id', player!.id)
    await refreshPlayer()
    setStep('done')
    setConfirming(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/></div>

  const IcoCheck = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
  const IcoArrow = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>

  return (
    <>
      <Head>
        <title>Bem-vindo · Bolão Copa 2026 BEL</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
        <link rel="icon" type="image/x-icon" href="/favicon.ico"/>
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div className="h-full bg-[#0099CC] transition-all duration-500"
            style={{ width: step === 'rules' ? '50%' : step === 'payment' ? '85%' : '100%' }}/>
        </div>

        <div className="flex-1 flex flex-col max-w-sm mx-auto w-full px-4 py-6">

          {/* ── STEP 1: Rules ──────────────────────────────── */}
          {step === 'rules' && (
            <div className="flex-1 flex flex-col">
              <div className="text-center mb-6">
                <img src="/copa2026-logo.jpg" alt="Copa 2026" className="h-16 w-auto mx-auto mb-3 rounded-xl"/>
                <h1 className="text-[22px] font-bold text-gray-900">Bem-vindo ao Bolão!</h1>
                <p className="text-[14px] text-gray-400 mt-1">Copa 2026 BEL · Antes de começar, conheça as regras</p>
              </div>

              <div className="space-y-3 flex-1">
                {/* Objective */}
                <div className="bg-[#E6F4FA] border border-[#0099CC]/20 rounded-2xl p-4">
                  <p className="text-[13px] font-bold text-[#0099CC] mb-1">🏆 Objetivo</p>
                  <p className="text-[13px] text-gray-700 leading-relaxed">
                    Acerte os placares dos <strong>72 jogos</strong> da Copa 2026 e acumule pontos. Quem tiver mais pontos ao final vence o Bolão BEL!
                  </p>
                </div>

                {/* Scoring */}
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide mb-3">Pontuação por jogo</p>
                  <div className="space-y-2">
                    {[
                      { pts:'10', bg:'bg-green-100 text-green-800', label:'Placar exato', desc:'Ex: chutou 2×1, deu 2×1' },
                      { pts:'7',  bg:'bg-blue-100 text-blue-800',   label:'Resultado + 1 placar', desc:'Ex: chutou 2×1, deu 3×1' },
                      { pts:'5',  bg:'bg-amber-100 text-amber-800', label:'Resultado certo', desc:'Vitória/empate/derrota' },
                      { pts:'2',  bg:'bg-pink-100 text-pink-800',   label:'1 placar parcial', desc:'Ex: chutou 2×1, deu 2×3' },
                      { pts:'0',  bg:'bg-gray-100 text-gray-500',   label:'Nenhum acerto', desc:'' },
                    ].map(r => (
                      <div key={r.label} className="flex items-center gap-3">
                        <span className={`text-[12px] font-bold px-2 py-1 rounded-lg w-10 text-center flex-shrink-0 ${r.bg}`}>{r.pts}pts</span>
                        <div>
                          <p className="text-[13px] font-semibold text-gray-800">{r.label}</p>
                          {r.desc && <p className="text-[11px] text-gray-400">{r.desc}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bonus */}
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide mb-3">Bônus · Palpite de campeão</p>
                  <div className="space-y-2">
                    {[{ l:'Acertar o campeão', p:'+50 pts' }, { l:'Acertar o vice', p:'+25 pts' }, { l:'Acertar o 3º lugar', p:'+10 pts' }].map(b => (
                      <div key={b.l} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                        <span className="text-[13px] text-gray-700">{b.l}</span>
                        <span className="text-[13px] font-bold text-[#0099CC]">{b.p}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Limits */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-[12px] font-bold text-amber-800 mb-1">⚡ Regras importantes</p>
                  <ul className="space-y-1">
                    {[
                      'Palpites fecham 5h antes de cada jogo',
                      'Máximo de 3 alterações por rodada',
                      'Palpite de campeão: 3 trocas no total',
                    ].map(r => (
                      <li key={r} className="text-[12px] text-amber-700 flex items-start gap-1.5">
                        <span className="text-amber-500 mt-0.5">•</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <button onClick={() => setStep(pix ? 'payment' : 'done')}
                className="mt-5 w-full py-4 rounded-2xl bg-[#0099CC] text-white font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#007aa8] transition-all active:scale-[.98]">
                {pix ? 'Próximo: Pagamento' : 'Começar a jogar'} <IcoArrow/>
              </button>
            </div>
          )}

          {/* ── STEP 2: Payment ────────────────────────────── */}
          {step === 'payment' && pix && (
            <div className="flex-1 flex flex-col">
              <div className="text-center mb-5">
                <h1 className="text-[20px] font-bold text-gray-900">Pagar inscrição</h1>
                <p className="text-[13px] text-gray-400 mt-1">Pague via PIX para participar do bolão</p>
              </div>

              {/* Value highlight */}
              <div className="bg-[#0099CC] rounded-2xl p-5 text-center mb-4 shadow-md">
                <p className="text-white/70 text-[13px]">Valor da inscrição</p>
                <p className="text-white font-bold text-[44px] leading-none mt-1">
                  R$ {pix.valor.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-white/60 text-[12px] mt-2">{pix.descricao}</p>
              </div>

              {/* QR Code */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
                <p className="text-[13px] font-bold text-gray-700 text-center mb-3">Escaneie com seu banco</p>
                <div className="flex justify-center mb-3">
                  {qrUrl ? (
                    <div className="p-3 bg-white border-2 border-[#0099CC]/20 rounded-2xl">
                      <img src={qrUrl} alt="QR Code PIX" width={200} height={200} className="rounded-xl"/>
                    </div>
                  ) : (
                    <div className="w-[200px] h-[200px] bg-gray-100 rounded-2xl flex items-center justify-center">
                      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/>
                    </div>
                  )}
                </div>

                {/* Recipient */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 mb-3 text-[12px]">
                  <div className="flex justify-between"><span className="text-gray-400">Beneficiário</span><span className="font-semibold text-gray-800">{pix.nome}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Chave PIX (CPF)</span><span className="font-semibold text-gray-800">{formatCPF(pix.cpf)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Valor</span><span className="font-bold text-[#0099CC]">R$ {pix.valor.toFixed(2).replace('.', ',')}</span></div>
                </div>

                <button onClick={copyPayload}
                  className={`w-full py-3 rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all ${copied ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
                  {copied ? <><IcoCheck/> Código copiado!</> : <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copiar código PIX
                  </>}
                </button>
              </div>

              {/* Instructions */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                <p className="text-[12px] font-bold text-amber-800 mb-2">Como pagar</p>
                <div className="space-y-1.5">
                  {['Abra o app do seu banco', 'Vá em PIX → Pagar', 'Escaneie o QR Code ou cole o código', 'Confirme o pagamento', 'Clique em "Já paguei" abaixo'].map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px] text-amber-700">
                      <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-800 text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={confirmPaid} disabled={confirming}
                className="w-full py-4 rounded-2xl bg-green-500 text-white font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-green-600 transition-all active:scale-[.98] disabled:opacity-60">
                {confirming
                  ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  : <><IcoCheck/> Já paguei — aguardar confirmação</>}
              </button>

              <button onClick={() => router.push('/champion')} className="mt-2 w-full py-2.5 text-[13px] text-gray-400 hover:text-gray-600 text-center">
                Pular por agora
              </button>
            </div>
          )}

          {/* ── STEP 3: Done ───────────────────────────────── */}
          {step === 'done' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mb-5">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <h1 className="text-[22px] font-bold text-gray-900 mb-2">Pagamento enviado!</h1>
              <p className="text-[14px] text-gray-500 leading-relaxed mb-8">
                Aguardando confirmação pelo admin.<br/>
                Assim que confirmado, o bolão libera sua participação completa.
              </p>
              <button onClick={() => router.push('/champion')}
                className="w-full py-4 rounded-2xl bg-[#0099CC] text-white font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#007aa8] transition-all">
                Ir para os palpites <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

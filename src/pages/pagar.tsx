import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Head from 'next/head'
import { generatePixPayload, formatPixKeyDisplay, getKeyTypeLabel, PixKeyType } from '@/lib/pix'

type PixConfig = { cpf: string; key_type: PixKeyType; nome: string; valor: number; descricao: string }

export default function PagarPage() {
  const { player, loading } = useAuth()
  const router = useRouter()
  const [pix,       setPix]       = useState<PixConfig | null>(null)
  const [payload,   setPayload]   = useState('')
  const [copied,    setCopied]    = useState(false)
  const [fetching,  setFetching]  = useState(true)
  const [qrUrl,     setQrUrl]     = useState('')

  useEffect(() => { if (!loading && !player) router.push('/') }, [loading, player])

  useEffect(() => {
    if (!player) return
    // If already paid, redirect
    if (player.payment_ok) { router.push('/champion'); return }

    supabase.from('pix_config').select('*').limit(1).then(({ data }) => {
      if (data && data[0]) {
        const cfg = data[0] as PixConfig
        setPix(cfg)
        const p = generatePixPayload({
          key: cfg.cpf, keyType: cfg.key_type || 'cpf',
          nome:     cfg.nome,
          valor:    cfg.valor,
          cidade:   'Belem',
          descricao: cfg.descricao || 'Bolao Copa 2026 BEL',
          txid:     `BEL${player.id.slice(0,8).replace(/-/g,'')}`,
        })
        setPayload(p)
        // QR Code via API pública
        setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(p)}`)
      }
      setFetching(false)
    })
  }, [player])

  async function copyPayload() {
    await navigator.clipboard.writeText(payload)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/>
    </div>
  )

  if (!pix) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <p className="text-gray-500 text-[14px]">PIX ainda não configurado pelo admin.</p>
        <button onClick={() => router.push('/champion')} className="mt-4 px-6 py-2.5 bg-[#0099CC] text-white rounded-xl text-[14px] font-semibold">
          Voltar
        </button>
      </div>
    </div>
  )

  return (
    <>
      <Head>
        <title>Pagar Inscrição · Bolão Copa 2026 BEL</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
        <link rel="icon" type="image/x-icon" href="/favicon.ico"/>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-sm mx-auto px-4 h-14 flex items-center gap-3">
            <button onClick={() => router.back()}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="font-bold text-gray-900 text-[15px]">Pagar inscrição</span>
          </div>
        </header>

        <div className="max-w-sm mx-auto px-4 py-6 space-y-4">

          {/* Header card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-center">
            <img src="/copa2026-logo.jpg" alt="Copa 2026" className="h-14 w-auto mx-auto mb-3 rounded-xl"/>
            <h1 className="text-[18px] font-bold text-gray-900">Bolão Copa 2026 BEL</h1>
            <p className="text-[13px] text-gray-400 mt-1">Pague sua inscrição via PIX para participar</p>
          </div>

          {/* Value */}
          <div className="bg-[#0099CC] rounded-2xl p-5 text-center shadow-sm">
            <p className="text-white/70 text-[13px] font-medium">Valor da inscrição</p>
            <p className="text-white font-bold text-[42px] leading-none mt-1">
              R$ {pix.valor.toFixed(2).replace('.', ',')}
            </p>
            <p className="text-white/60 text-[12px] mt-2">{pix.descricao}</p>
          </div>

          {/* QR Code */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className="text-[13px] font-bold text-gray-700 text-center mb-4">
              Escaneie o QR Code com seu banco
            </p>
            <div className="flex justify-center mb-4">
              {qrUrl ? (
                <div className="p-3 bg-white border-2 border-[#0099CC]/20 rounded-2xl shadow-inner">
                  <img src={qrUrl} alt="QR Code PIX" width={220} height={220}
                    className="rounded-xl"
                    onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
                </div>
              ) : (
                <div className="w-[220px] h-[220px] bg-gray-100 rounded-2xl flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/>
                </div>
              )}
            </div>

            {/* Recipient info */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-gray-400">Beneficiário</span>
                <span className="text-[13px] font-semibold text-gray-800">{pix.nome}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-gray-400">Chave PIX (CPF)</span>
                <span className="text-[13px] font-semibold text-gray-800">{formatPixKeyDisplay(pix.cpf, pix.key_type || 'cpf')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-gray-400">Valor</span>
                <span className="text-[13px] font-bold text-[#0099CC]">R$ {pix.valor.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            {/* Copy code button */}
            <button onClick={copyPayload}
              className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 ${
                copied
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-900 text-white hover:bg-gray-800 active:scale-[.98]'
              }`}>
              {copied ? (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Código copiado!</>
              ) : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar código PIX</>
              )}
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-[12px] font-bold text-amber-800 mb-2">Como pagar</p>
            <div className="space-y-2">
              {[
                'Abra o app do seu banco',
                'Acesse a área PIX',
                'Escaneie o QR Code ou cole o código',
                `Confirme o pagamento de R$ ${pix.valor.toFixed(2).replace('.', ',')}`,
                'Avise ao gerente Aristone Figueredo',
                'Aguarde a confirmação no app',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                  <span className="text-[12px] text-amber-700">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pending badge */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <p className="text-[13px] font-bold text-gray-800">Aguardando confirmação</p>
              <p className="text-[12px] text-gray-400 mt-0.5">O admin confirmará após receber o pagamento</p>
            </div>
          </div>

          <button onClick={() => router.push('/champion')}
            className="w-full py-3 rounded-xl text-[13px] font-medium text-gray-400 hover:text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-all">
            Voltar para os palpites
          </button>
        </div>
      </div>
    </>
  )
}

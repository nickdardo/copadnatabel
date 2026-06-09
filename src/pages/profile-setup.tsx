import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, getAvatarUrl } from '@/lib/supabase'
import Head from 'next/head'
import { IconUser, IconCheck, IconArrowRight } from '@/components/Icons'

export default function ProfileSetupPage() {
  const { player, loading, refreshPlayer } = useAuth()
  const router = useRouter()

  const [nickname,    setNickname]    = useState('')
  const [avatarFile,  setAvatarFile]  = useState<File | null>(null)
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null)
  const [uploading,   setUploading]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && !player) router.push('/')
    if (player?.nickname) setNickname(player.nickname)
    if (player?.avatar_url) setPreviewUrl(getAvatarUrl(player.avatar_url))
  }, [loading, player])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Foto muito grande. Máximo 5MB.'); return }
    setAvatarFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setError('')
  }

  async function handleSave() {
    if (!player) return
    const parts = nickname.trim().split(/\s+/)
    if (parts.length < 2) { setError('Informe seu primeiro e último nome.'); return }

    setSaving(true)
    setError('')
    let avatarPath = player.avatar_url || null

    // Upload photo if selected
    if (avatarFile) {
      setUploading(true)
      const ext  = avatarFile.name.split('.').pop()
      const path = `${player.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
      setUploading(false)
      if (upErr) { setError('Erro ao enviar foto. Tente novamente.'); setSaving(false); return }
      avatarPath = path
    }

    // Update player profile
    const { error: updErr } = await supabase
      .from('players')
      .update({ nickname: nickname.trim(), avatar_url: avatarPath })
      .eq('id', player.id)

    setSaving(false)
    if (updErr) { setError('Erro ao salvar perfil.'); return }

    await refreshPlayer()
    setSaved(true)
    setTimeout(() => router.push('/champion'), 1400)
  }

  async function skipPhoto() {
    if (!player || !nickname.trim()) { setError('Informe seu nome antes de continuar.'); return }
    const parts = nickname.trim().split(/\s+/)
    if (parts.length < 2) { setError('Informe seu primeiro e último nome.'); return }
    setSaving(true)
    await supabase.from('players').update({ nickname: nickname.trim() }).eq('id', player.id)
    await refreshPlayer()
    router.push('/champion')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" />
    </div>
  )

  const initials = nickname.trim()
    ? nickname.trim().split(' ').filter(Boolean).map(w => w[0]).slice(0,2).join('').toUpperCase()
    : player?.username?.slice(0,2).toUpperCase() || '?'

  return (
    <>
      <Head>
        <title>Configure seu perfil · Bolão Copa 2026</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </Head>

      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">

          {/* Header */}
          <div className="text-center mb-6">
            <img src="/dnata-logo.png" alt="dnata" className="h-8 w-auto mx-auto mb-4 object-contain" />
            <h1 className="text-xl font-bold text-gray-900">Configure seu perfil</h1>
            <p className="text-[13px] text-gray-400 mt-1">Quase lá! Só falta seu nome e uma foto.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Photo upload */}
            <div className="flex flex-col items-center pt-8 pb-6 px-6 border-b border-gray-100">
              <div className="relative mb-3">
                {previewUrl ? (
                  <img src={previewUrl} alt="Foto de perfil"
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[#E6F4FA] border-4 border-white shadow-md flex items-center justify-center">
                    <span className="text-2xl font-bold text-[#0099CC]">{initials}</span>
                  </div>
                )}
                {/* Camera button */}
                <button onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#0099CC] rounded-full flex items-center justify-center shadow-md border-2 border-white hover:bg-[#007aa8] transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              <p className="text-[12px] text-gray-400 text-center">
                {previewUrl ? 'Foto selecionada' : 'Toque na câmera para adicionar sua foto'}
              </p>
              {previewUrl && (
                <button onClick={() => { setPreviewUrl(null); setAvatarFile(null) }}
                  className="text-[11px] text-red-400 hover:text-red-500 mt-1">
                  Remover foto
                </button>
              )}
            </div>

            {/* Name input */}
            <div className="px-6 py-5">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Seu nome completo
              </label>
              <div className="relative">
                <IconUser size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50
                             text-gray-900 text-[14px] focus:outline-none focus:ring-2
                             focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
                  placeholder="Ex: João Silva"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  maxLength={50}
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-gray-300 mt-1.5 ml-1">
                Primeiro e último nome. Aparece no ranking.
              </p>
            </div>

            {/* Payment notice */}
            <div className="mx-6 mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-amber-800 mb-1">Pagamento obrigatório</p>
                  <p className="text-[12px] text-amber-700 leading-relaxed">
                    Para participar do bolão, realize o pagamento de{' '}
                    <strong>R$ 10,00</strong> para o gerente{' '}
                    <strong>Aristone Figueredo</strong>.
                  </p>
                  <p className="text-[11px] text-amber-600 mt-1.5">
                    Seus palpites só serão contabilizados após a confirmação do pagamento.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mx-6 mb-4 bg-red-50 border border-red-100 text-red-500 text-[12px] rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="px-6 pb-6 space-y-2.5">
              <button onClick={handleSave}
                disabled={saving || !nickname.trim()}
                className="w-full py-3.5 rounded-xl font-semibold text-[15px] text-white
                           flex items-center justify-center gap-2 transition-all active:scale-[.98]
                           bg-[#0099CC] hover:bg-[#007aa8] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                {saved ? (
                  <><IconCheck size={18} /> Perfil salvo! Abrindo palpites...</>
                ) : uploading ? (
                  <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando foto...</>
                ) : saving ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Salvar e continuar <IconArrowRight size={16} /></>
                )}
              </button>

              <button onClick={skipPhoto}
                disabled={saving}
                className="w-full py-2.5 rounded-xl text-[13px] font-medium text-gray-400
                           hover:text-gray-600 hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100">
                Adicionar foto depois
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-gray-400 mt-4">
            Você pode alterar seu perfil a qualquer momento nas configurações.
          </p>
        </div>
      </div>
    </>
  )
}

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, getAvatarUrl } from '@/lib/supabase'
import Head from 'next/head'
import { IconCheck, IconArrowRight } from '@/components/Icons'

export default function ProfileSetupPage() {
  const { player, loading, refreshPlayer } = useAuth()
  const router = useRouter()

  const [firstName,  setFirstName]  = useState('')
  const [lastName,   setLastName]   = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading,  setUploading]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && !player) { router.push('/'); return }
    // Don't pre-fill name — force user to type it
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
    setError('')

    // Validate both names
    if (!firstName.trim()) { setError('Informe seu primeiro nome.'); return }
    if (!lastName.trim())  { setError('Informe seu último nome.'); return }
    if (!avatarFile && !player.avatar_url) {
      setError('Adicione uma foto de perfil para continuar.'); return
    }

    setSaving(true)
    let avatarPath = player.avatar_url || null

    // Upload photo
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

    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const { error: updErr } = await supabase
      .from('players')
      .update({ nickname: fullName, avatar_url: avatarPath })
      .eq('id', player.id)

    setSaving(false)
    if (updErr) { setError('Erro ao salvar perfil.'); return }

    await refreshPlayer()
    setSaved(true)
    setTimeout(() => router.push('/champion'), 1400)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" />
    </div>
  )

  const initials = (firstName[0] || '') + (lastName[0] || '') || player?.username?.slice(0,2).toUpperCase() || '?'

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
            <p className="text-[13px] text-gray-400 mt-1">Preencha seus dados para participar.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Photo upload — obrigatório */}
            <div className="flex flex-col items-center pt-8 pb-6 px-6 border-b border-gray-100">
              <div className="relative mb-3">
                {previewUrl ? (
                  <img src={previewUrl} alt="Foto"
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
                ) : (
                  <div className={`w-24 h-24 rounded-full border-4 border-white shadow-md flex items-center justify-center
                    ${error.includes('foto') ? 'bg-red-50 border-red-200' : 'bg-[#E6F4FA]'}`}>
                    <span className="text-2xl font-bold text-[#0099CC] uppercase">{initials}</span>
                  </div>
                )}
                <button onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-9 h-9 bg-[#0099CC] rounded-full flex items-center justify-center shadow-md border-2 border-white hover:bg-[#007aa8] transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              <p className="text-[12px] font-medium text-gray-500 text-center">
                {previewUrl
                  ? <span className="text-green-600 flex items-center gap-1 justify-center"><IconCheck size={13} /> Foto adicionada</span>
                  : <span className={error.includes('foto') ? 'text-red-500' : 'text-gray-400'}>
                      Toque na câmera para adicionar sua foto <span className="text-red-400">*</span>
                    </span>
                }
              </p>
              {previewUrl && (
                <button onClick={() => { setPreviewUrl(null); setAvatarFile(null) }}
                  className="text-[11px] text-red-400 hover:text-red-500 mt-1.5">
                  Trocar foto
                </button>
              )}
            </div>

            {/* Name fields — separate first/last */}
            <div className="px-6 pt-5 pb-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Primeiro nome <span className="text-red-400">*</span>
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50
                             text-gray-900 text-[14px] focus:outline-none focus:ring-2
                             focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
                  placeholder="Ex: João"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  maxLength={30}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Último nome <span className="text-red-400">*</span>
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50
                             text-gray-900 text-[14px] focus:outline-none focus:ring-2
                             focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
                  placeholder="Ex: Silva"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  maxLength={30}
                />
              </div>
            </div>

            {/* Payment notice */}
            <div className="mx-6 mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-amber-800 mb-1">Pagamento obrigatório</p>
                  <p className="text-[12px] text-amber-700 leading-relaxed">
                    Pague <strong>R$ 10,00</strong> para o gerente{' '}
                    <strong>Aristone Figueredo</strong> para ter seus palpites contabilizados.
                  </p>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mx-6 mb-4 bg-red-50 border border-red-100 text-red-500 text-[12px] rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            {/* Save button only — no skip */}
            <div className="px-6 pb-7">
              <button onClick={handleSave} disabled={saving}
                className="w-full py-3.5 rounded-xl font-semibold text-[15px] text-white
                           flex items-center justify-center gap-2 transition-all active:scale-[.98]
                           bg-[#0099CC] hover:bg-[#007aa8] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                {saved ? (
                  <><IconCheck size={18} /> Perfil salvo!</>
                ) : uploading ? (
                  <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando foto...</>
                ) : saving ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Salvar e continuar <IconArrowRight size={16} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

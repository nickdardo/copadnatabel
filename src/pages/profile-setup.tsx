import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Head from 'next/head'

const IcoCheck  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoArrow  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
const IcoCamera = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>

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

  // Password change state
  const [currentPass,  setCurrentPass]  = useState('')
  const [newPass,      setNewPass]      = useState('')
  const [confirmPass,  setConfirmPass]  = useState('')
  const [passError,    setPassError]    = useState('')
  const [passSuccess,  setPassSuccess]  = useState('')
  const [savingPass,   setSavingPass]   = useState(false)
  const [showCurrent,  setShowCurrent]  = useState(false)
  const [showNew,      setShowNew]      = useState(false)

  useEffect(() => {
    if (!loading && !player) { router.push('/'); return }
    // Pre-fill if already has a real name (not just username)
    if (player?.nickname && player.nickname !== player.username) {
      const parts = player.nickname.split(' ')
      setFirstName(parts[0] || '')
      setLastName(parts.slice(1).join(' ') || '')
    }
    // Load existing avatar
    if (player?.avatar_url) {
      const url = player.avatar_url.startsWith('http')
        ? player.avatar_url
        : supabase.storage.from('avatars').getPublicUrl(player.avatar_url).data.publicUrl
      if (url) setPreviewUrl(url + '?v=' + Date.now())
    }
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
    if (!firstName.trim()) { setError('Informe seu primeiro nome.'); return }
    if (!lastName.trim())  { setError('Informe seu último nome.'); return }

    setSaving(true)
    let avatarPath = player.avatar_url || null

    // Upload photo if selected
    if (avatarFile) {
      setUploading(true)
      const ext  = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${player.id}/avatar.${ext}`

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, {
          upsert: true,
          contentType: avatarFile.type || `image/${ext}`,
        })

      setUploading(false)

      if (upErr) {
        console.error('Upload error:', upErr)
        setError(`Erro ao enviar foto: ${upErr.message}`)
        setSaving(false)
        return
      }
      avatarPath = path
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const { error: updErr } = await supabase
      .from('players')
      .update({ nickname: fullName, avatar_url: avatarPath })
      .eq('id', player.id)

    if (updErr) {
      console.error('Update error:', updErr)
      setError(`Erro ao salvar perfil: ${updErr.message}`)
      setSaving(false)
      return
    }

    await refreshPlayer()
    setSaving(false)
    setSaved(true)
    // Paid users already in the app go back — new users go through onboarding
    const dest = player.payment_ok ? '/ranking' : '/onboarding'
    setTimeout(() => router.push(dest), 800)
  }

  async function handleChangePassword() {
    setPassError(''); setPassSuccess('')
    if (!currentPass) return setPassError('Digite a senha atual')
    if (!newPass)     return setPassError('Digite a nova senha')
    if (newPass.length < 6) return setPassError('A nova senha deve ter pelo menos 6 caracteres')
    if (newPass !== confirmPass) return setPassError('As senhas não coincidem')
    if (newPass === currentPass) return setPassError('A nova senha deve ser diferente da atual')
    setSavingPass(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: player?.id, current_password: currentPass, new_password: newPass }),
    })
    const data = await res.json()
    setSavingPass(false)
    if (data.ok) {
      setPassSuccess('Senha alterada com sucesso!')
      setCurrentPass(''); setNewPass(''); setConfirmPass('')
    } else {
      setPassError(data.error || 'Erro ao alterar senha')
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" />
    </div>
  )

  const initials = ((firstName[0] || '') + (lastName[0] || '')).toUpperCase()
    || player?.username?.slice(0, 2).toUpperCase() || '?'

  return (
    <>
      <Head>
        <title>Configure seu perfil · Bolão Copa 2026 BEL</title>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Back button */}
        <header className="bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="font-semibold text-gray-800 text-[15px]">Editar perfil</span>
        </header>

        <div className="max-w-sm mx-auto px-4 py-6">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src="/copa2026-logo.jpg" alt="Copa 2026" className="h-14 w-auto rounded-xl object-contain" />
          </div>

          {/* Photo upload */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-2">
              {previewUrl ? (
                <img src={previewUrl} alt="Foto"
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#E6F4FA] border-4 border-white shadow-lg flex items-center justify-center">
                  <span className="text-2xl font-bold text-[#0099CC]">{initials}</span>
                </div>
              )}
              <button onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-9 h-9 bg-[#0099CC] rounded-full flex items-center justify-center shadow-md border-2 border-white hover:bg-[#007aa8] transition-colors">
                <IcoCamera />
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
            </div>
            <p className="text-[12px] text-gray-400 text-center">
              {previewUrl
                ? <span className="text-green-600 flex items-center gap-1 justify-center"><IcoCheck /> Foto selecionada</span>
                : 'Toque na câmera para adicionar foto (opcional)'}
            </p>
            {previewUrl && !avatarFile && (
              <p className="text-[11px] text-gray-400 mt-0.5">Foto atual salva</p>
            )}
            {previewUrl && avatarFile && (
              <button onClick={() => { setPreviewUrl(null); setAvatarFile(null) }}
                className="text-[11px] text-red-400 mt-1">Remover foto</button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Name fields */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Primeiro nome <span className="text-red-400">*</span>
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
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
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
                  placeholder="Ex: Silva"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  maxLength={30}
                />
              </div>
            </div>

            {/* Payment notice */}
            <div className="mx-6 mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[12px] font-bold text-amber-800 mb-1">Inscrição: R$ 10,00</p>
              <p className="text-[12px] text-amber-700 leading-relaxed">
                Pague ao gerente <strong>Aristone Figueredo</strong>. O prêmio final só é liberado após a confirmação.
              </p>
            </div>

            {error && (
              <div className="mx-6 mb-4 bg-red-50 border border-red-100 text-red-500 text-[12px] rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            <div className="px-6 pb-6 space-y-2.5">
              <button onClick={handleSave} disabled={saving}
                className="w-full py-3.5 rounded-xl font-semibold text-[15px] text-white flex items-center justify-center gap-2 transition-all active:scale-[.98] bg-[#0099CC] hover:bg-[#007aa8] disabled:opacity-50 shadow-sm">
                {saved      ? <><IcoCheck /> Salvo!</> :
                 uploading  ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando foto...</> :
                 saving     ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> :
                              <>Salvar perfil <IcoArrow /></>}
              </button>
              <button onClick={() => router.back()} disabled={saving}
                className="w-full py-2.5 rounded-xl text-[13px] font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all">
                Voltar sem salvar
              </button>
            </div>
          </div>

          {/* Change password card — separate section */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm mt-4">
            <div className="px-6 py-5">
              <div className="flex items-center gap-2 mb-4">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <p className="text-[13px] font-semibold text-gray-800">Alterar senha</p>
              </div>
              <div className="space-y-3">
                  {/* Current password */}
                  <div className="relative">
                    <label className="block text-[11px] text-gray-500 mb-1">Senha atual (ou temporária)</label>
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      placeholder="••••••"
                      value={currentPass}
                      onChange={e => setCurrentPass(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC] transition-all"
                    />
                    <button type="button" onClick={() => setShowCurrent(v => !v)}
                      className="absolute right-3 top-[30px] text-gray-400 hover:text-gray-600">
                      {showCurrent
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                  {/* New password */}
                  <div className="relative">
                    <label className="block text-[11px] text-gray-500 mb-1">Nova senha</label>
                    <input
                      type={showNew ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC] transition-all"
                    />
                    <button type="button" onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-[30px] text-gray-400 hover:text-gray-600">
                      {showNew
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                  {/* Confirm */}
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Confirmar nova senha</label>
                    <input
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmPass}
                      onChange={e => setConfirmPass(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border bg-gray-50 text-gray-900 text-[14px] focus:outline-none transition-all ${confirmPass && confirmPass !== newPass ? 'border-red-300' : confirmPass && confirmPass === newPass ? 'border-green-400' : 'border-gray-200 focus:border-[#0099CC]'}`}
                    />
                  </div>
                  {passError   && <p className="text-[12px] text-red-500 font-medium">{passError}</p>}
                  {passSuccess && <p className="text-[12px] text-green-600 font-medium flex items-center gap-1"><IcoCheck />{passSuccess}</p>}
                  <button onClick={handleChangePassword} disabled={savingPass || !currentPass || !newPass || !confirmPass}
                    className="w-full py-3 rounded-xl bg-gray-800 text-white text-[13px] font-semibold hover:bg-gray-900 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                    {savingPass
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    }
                    {savingPass ? 'Alterando...' : 'Alterar senha'}
                  </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

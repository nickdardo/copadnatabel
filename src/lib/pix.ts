// Gerador de payload PIX BR (EMV — padrão Banco Central)

export type PixKeyType = 'cpf' | 'telefone' | 'email' | 'aleatoria'

function crc16(str: string): string {
  let crc = 0xFFFF
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    }
  }
  return ((crc & 0xFFFF).toString(16).toUpperCase()).padStart(4, '0')
}

function emv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`
}

// ─── FIX: phone must be +55XXXXXXXXXXX (11 digits after +55) ─────────────────
export function formatPixKey(key: string, type: PixKeyType): string {
  switch (type) {
    case 'cpf':
      return key.replace(/\D/g, '').slice(0, 11)
    case 'telefone': {
      // Strip everything except digits
      const digits = key.replace(/\D/g, '')
      // Remove leading 55 if already present, then rebuild +55...
      const local = digits.startsWith('55') && digits.length > 11
        ? digits.slice(2)
        : digits
      // local must be 10 or 11 digits (DDD + number, with or without 9)
      return `+55${local}`
    }
    case 'email':
      return key.trim().toLowerCase()
    case 'aleatoria':
      return key.trim()
    default:
      return key.trim()
  }
}

export function formatPixKeyDisplay(key: string, type: PixKeyType): string {
  switch (type) {
    case 'cpf': {
      const d = key.replace(/\D/g, '')
      return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    case 'telefone': {
      // key stored as +5511999999999 → show as (11) 99999-9999
      const t = key.replace(/\D/g, '').replace(/^55/, '')
      if (t.length === 11) return t.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
      if (t.length === 10) return t.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
      return key
    }
    case 'email':
      return key.toLowerCase()
    case 'aleatoria':
      return key
    default:
      return key
  }
}

export function getKeyTypeLabel(type: PixKeyType): string {
  const labels: Record<PixKeyType, string> = {
    cpf:      'CPF',
    telefone: 'Telefone',
    email:    'E-mail',
    aleatoria:'Chave aleatória',
  }
  return labels[type] || 'Chave PIX'
}

export function getKeyPlaceholder(type: PixKeyType): string {
  const placeholders: Record<PixKeyType, string> = {
    cpf:      '000.000.000-00',
    telefone: '(11) 99999-9999',
    email:    'exemplo@email.com',
    aleatoria:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  }
  return placeholders[type] || ''
}

export interface PixParams {
  key:       string
  keyType:   PixKeyType
  nome:      string
  valor:     number
  cidade:    string
  descricao?: string
  txid?:     string
}

export function generatePixPayload(params: PixParams): string {
  const key   = formatPixKey(params.key, params.keyType)
  const nome  = params.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 25)
  const cidade = params.cidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 15)
  const valor = params.valor.toFixed(2)
  const desc  = (params.descricao || 'Bolao Copa 2026 BEL')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 72)
  const txid  = (params.txid || 'BOLAOCOPABEL')
    .replace(/[^a-zA-Z0-9]/g, '').slice(0, 25).padEnd(5, '*')

  const pixKey  = emv('01', key)
  const pixDesc = emv('02', desc)
  const mai     = emv('26', emv('00', 'BR.GOV.BCB.PIX') + pixKey + pixDesc)
  const add     = emv('62', emv('05', txid))

  const payload =
    emv('00', '01') +
    emv('01', '12') +
    mai +
    emv('52', '0000') +
    emv('53', '986') +
    emv('54', valor) +
    emv('58', 'BR') +
    emv('59', nome) +
    emv('60', cidade) +
    add +
    '6304'

  return payload + crc16(payload)
}

// Legacy — kept for compatibility
export function formatCPF(cpf: string): string {
  return formatPixKeyDisplay(cpf, 'cpf')
}

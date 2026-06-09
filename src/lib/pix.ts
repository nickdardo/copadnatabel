// Gerador de payload PIX BR (EMV/QR Code estático)
// Spec: Banco Central do Brasil - Manual de Padrões para Iniciação do PIX

function cleanCPF(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

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
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

export function generatePixPayload(params: {
  cpf:      string
  nome:     string
  valor:    number
  cidade:   string
  descricao?: string
  txid?:    string
}): string {
  const cpf   = cleanCPF(params.cpf)
  const nome  = params.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 25)
  const cidade = params.cidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 15)
  const valor = params.valor.toFixed(2)
  const desc  = (params.descricao || 'Bolao Copa 2026 BEL').normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 72)
  const txid  = (params.txid || 'BOLAOCOPABEL').replace(/[^a-zA-Z0-9]/g,'').slice(0,25).padEnd(5,'*')

  // Merchant Account Info (ID 26) - PIX
  const pixKey  = emv('01', cpf)            // chave CPF
  const pixDesc = emv('02', desc)           // descrição
  const mai     = emv('26', emv('00','BR.GOV.BCB.PIX') + pixKey + pixDesc)

  // Additional Data (ID 62)
  const add = emv('62', emv('05', txid))

  const payload =
    emv('00', '01') +                       // payload format
    emv('01', '12') +                       // dynamic (11=static, 12=dynamic but we use static)
    mai +
    emv('52', '0000') +                     // merchant category
    emv('53', '986') +                      // BRL
    emv('54', valor) +                      // amount
    emv('58', 'BR') +                       // country
    emv('59', nome) +                       // merchant name
    emv('60', cidade) +                     // city
    add +
    '6304'                                  // CRC placeholder

  return payload + crc16(payload)
}

export function formatCPF(cpf: string): string {
  const d = cpf.replace(/\D/g,'')
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

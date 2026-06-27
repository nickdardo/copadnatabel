// Redimensiona e comprime uma imagem no navegador antes do upload — usado
// pro avatar do jogador, que ia direto pro Storage sem nenhum tratamento
// (só com limite de 5MB no arquivo original). Fotos de celular hoje
// facilmente passam de 3-4MB e 4000px de largura; exibidas como avatar
// (sempre pequeno, círculo de 32-44px na tela), isso é desperdício puro de
// Cached Egress — o arquivo inteiro é baixado de novo em cada lista de
// jogadores (ranking, "o que o grupo apostou", admin) por cada visitante.
//
// Resultado típico: arquivo de 3-5MB → 20-80KB, sem perda visual perceptível
// num avatar circular pequeno.
export function resizeAndCompressImage(file: File, maxDim = 320, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim }
        else { width = Math.round(width * (maxDim / height)); height = maxDim }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas não suportado')); return }
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        blob => { blob ? resolve(blob) : reject(new Error('Falha ao comprimir imagem')) },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem')) }
    img.src = url
  })
}

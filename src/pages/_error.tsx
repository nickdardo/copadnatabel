import { NextPageContext } from 'next'

function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#003a6e', padding: '24px', textAlign: 'center',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚽</div>
      <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        Algo deu errado
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 24 }}>
        {statusCode ? `Erro ${statusCode}` : 'Erro inesperado no aplicativo'}
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: '#0099CC', color: '#fff', border: 'none',
          borderRadius: 12, padding: '12px 28px',
          fontSize: 15, fontWeight: 700, cursor: 'pointer'
        }}>
        Recarregar app
      </button>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 16 }}>
        Se o erro persistir, feche e abra o app novamente
      </p>
    </div>
  )
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? (err as NodeJS.ErrnoException & { statusCode?: number }).statusCode : 404
  return { statusCode }
}

export default ErrorPage

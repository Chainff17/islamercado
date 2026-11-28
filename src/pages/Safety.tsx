import { Link } from 'react-router-dom'
import { Ban, Flag, KeyRound, MessageCircle, ShieldCheck, Wallet } from 'lucide-react'
import { SafetyTips } from '../components/Security'

/** /seguridad — normas de la comunidad y consejos para comprar y vender seguro. */
export default function Safety() {
  return (
    <div className="page safety-page">
      <div className="page-head">
        <h1 className="page-title">
          <ShieldCheck size={24} strokeWidth={1.6} className="title-icon" /> Compra y vende seguro
        </h1>
        <p className="page-sub">Así protegemos a la comunidad de IslaMercado, y lo que puedes hacer tú.</p>
      </div>

      <div className="safety-grid">
        <SafetyTips variant="listing" />
        <SafetyTips variant="checkout" />

        <div className="card safety-card">
          <h3 className="card-h">
            <Wallet size={18} /> Pagos
          </h3>
          <p>
            Paga solo cuando tengas claro qué recibes. Con Transfermóvil, EnZona o Zelle guarda siempre el comprobante.
            Desconfía si te piden pagar a un tercero, o si te mandan enlaces raros para “confirmar” el pago.
          </p>
        </div>

        <div className="card safety-card">
          <h3 className="card-h">
            <MessageCircle size={18} /> Conversaciones
          </h3>
          <p>
            Habla por los mensajes de IslaMercado antes de pasar a WhatsApp. Si alguien te presiona, cambia el precio a
            última hora o se niega a que veas el producto, no sigas.
          </p>
        </div>

        <div className="card safety-card">
          <h3 className="card-h">
            <Ban size={18} /> Prohibido publicar
          </h3>
          <ul>
            <li>Armas, drogas, medicamentos controlados o productos robados.</li>
            <li>Documentos de identidad, cuentas bancarias o tarjetas.</li>
            <li>Anuncios engañosos, duplicados o con precios falsos.</li>
            <li>Contenido ofensivo, discriminatorio o para adultos.</li>
          </ul>
        </div>

        <div className="card safety-card">
          <h3 className="card-h">
            <Flag size={18} /> Denuncia
          </h3>
          <p>
            En cada anuncio y perfil de vendedor tienes el botón <strong>Denunciar</strong>. El equipo revisa cada caso y
            puede bloquear anuncios o suspender cuentas. Las cuentas suspendidas no pueden publicar, comprar ni escribir.
          </p>
        </div>

        <div className="card safety-card">
          <h3 className="card-h">
            <KeyRound size={18} /> Tu cuenta
          </h3>
          <p>
            Usa una contraseña única de al menos 8 caracteres y activa la{' '}
            <Link to="/perfil">verificación en 2 pasos</Link>. Nadie de IslaMercado te pedirá tu contraseña ni códigos.
            Si la olvidaste, <Link to="/recuperar">recupérala aquí</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}

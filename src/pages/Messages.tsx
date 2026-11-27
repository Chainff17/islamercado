import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Listing, Message, Profile } from '../lib/types'
import { formatDateTime, timeAgo } from '../lib/format'
import { Alert, EmptyState, LoadingBlock } from '../components/Pagination'

interface Conversation {
  listing_id: string
  listing_title: string
  listing_image: string
  other: Profile | null
  last: Message
  unread: number
}

export default function Messages() {
  const { listingId } = useParams<{ listingId: string }>()
  const [searchParams] = useSearchParams()
  const toUser = searchParams.get('to')
  const presetText = searchParams.get('text') ?? ''
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [active, setActive] = useState<string | null>(listingId ?? null)
  const [thread, setThread] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [text, setText] = useState(presetText)
  const [error, setError] = useState<string | null>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setText(presetText)
  }, [presetText])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    (async () => {
      const { data, error: err } = await supabase
        .from('messages')
        .select('id, listing_id, sender_id, receiver_id, body, read_at, created_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(500)
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      const msgs = (data as Message[]) ?? []

      // Agrupamos por conversación (listing + contraparte)
      const byKey = new Map<string, Conversation>()
      for (const m of msgs) {
        const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
        const key = `${m.listing_id}__${otherId}`
        const existing = byKey.get(key)
        if (!existing || m.created_at > existing.last.created_at) {
          byKey.set(key, {
            listing_id: m.listing_id,
            listing_title: '',
            listing_image: '',
            other: null,
            last: m,
            unread: 0,
          })
        }
      }
      const convs = Array.from(byKey.values())

      // Datos de las publicaciones y perfiles de los participantes
      const listingIds = Array.from(new Set(convs.map((c) => c.listing_id)))
      const otherIds = Array.from(new Set(convs.map((c) => (c.last.sender_id === user.id ? c.last.receiver_id : c.last.sender_id))))

      const [lRes, pRes] = await Promise.all([
        supabase
          .from('listings')
          .select('id, title, images, status')
          .in('id', listingIds),
        supabase
          .from('profiles')
          .select('id, username, phone, avatar_url, created_at')
          .in('id', otherIds),
      ])
      const listingMap = new Map((lRes.data as Listing[]).map((l) => [l.id, l]))
      const profileMap = new Map((pRes.data as Profile[]).map((p) => [p.id, p]))

      const finalConvs = convs.map((c) => {
        const otherId = c.last.sender_id === user.id ? c.last.receiver_id : c.last.sender_id
        const lp = listingMap.get(c.listing_id)
        const unread = c.last.receiver_id === user.id && !c.last.read_at ? 1 : 0
        return {
          ...c,
          listing_title: lp?.title ?? 'Publicación',
          listing_image: lp?.images?.[0] ?? '',
          other: profileMap.get(otherId) ?? null,
          unread,
        }
      })
      setConversations(finalConvs)
      if (active && !finalConvs.find((c) => c.listing_id === active && c.last.sender_id !== c.last.receiver_id)) {
        // si active no está en conversaciones, lo re-cualificamos
      }
      setLoading(false)
    })()
  }, [user, active])

  // Si llegamos con ?to= y sin conversación activa, crear/abrir la conversación
  useEffect(() => {
    if (!user || !toUser || active) return
    (async () => {
      const conv = await ensureConversation(user.id, toUser, listingId ?? '')
      if (conv) setActive(conv.listing_id)
    })()
  }, [user, toUser, active, listingId])

  async function ensureConversation(
    userId: string,
    otherId: string,
    listingIdRaw: string
  ): Promise<Conversation | null> {
    // Si no hay listing_id, usamos la primera publicación del otro usuario
    let listingId = listingIdRaw
    if (!listingId) {
      const { data } = await supabase
        .from('listings')
        .select('id')
        .eq('seller_id', otherId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
      listingId = (data?.[0] as { id: string } | undefined)?.id ?? ''
    }
    if (!listingId) return null
    // Verificar si ya existe conversación
    const { data } = await supabase
      .from('messages')
      .select('id, listing_id')
      .eq('listing_id', listingId)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .limit(1)
    const existing = data?.[0]
    if (existing) return { listing_id: existing.listing_id, listing_title: '', listing_image: '', other: null, last: null as unknown as Message, unread: 0 }
    return null
  }

  useEffect(() => {
    if (!user || !active) {
      setThread([])
      return
    }
    (async () => {
      const conv = conversations.find((c) => c.listing_id === active)
      if (!conv) return
      const otherId = conv.last.sender_id === user.id ? conv.last.receiver_id : conv.last.sender_id
      const { data } = await supabase
        .from('messages')
        .select('id, listing_id, sender_id, receiver_id, body, read_at, created_at')
        .eq('listing_id', active)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .or(`sender_id.eq.${otherId},receiver_id.eq.${otherId}`)
        .order('created_at', { ascending: true })
        .limit(200)
      setThread((data as Message[]) ?? [])
    })
  }, [active, conversations, user])

  // Marcar como leída
  useEffect(() => {
    if (!user || !active || thread.length === 0) return
    const unread = thread.filter((m) => m.receiver_id === user.id && !m.read_at)
    if (unread.length === 0) return
    (async () => {
      const { error: err } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', unread[0].id)
      if (err) console.error(err)
      setConversations((prev) =>
        prev.map((c) =>
          c.listing_id === active
            ? { ...c, unread: c.unread > 0 ? 0 : c.unread, last: { ...c.last, read_at: new Date().toISOString() } }
            : c
        )
      )
    })()
  }, [active, thread, user])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  const activeConv = useMemo(
    () => conversations.find((c) => c.listing_id === active),
    [conversations, active]
  )

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !active || !text.trim()) return
    setSending(true)
    setError(null)
    const receiver = activeConv?.other?.id ?? ''
    const { error: err } = await supabase.from('messages').insert({
      listing_id: active,
      sender_id: user.id,
      receiver_id: receiver,
      body: text.trim(),
    })
    if (err) {
      setError(err.message)
      setSending(false)
      return
    }
    setText('')
    setSending(false)
  }

  if (authLoading) return <LoadingBlock />
  if (!user) {
    return (
      <EmptyState
        icon="🔐"
        title="Inicia sesión para ver tus mensajes"
        action={
          <button className="btn btn-primary" onClick={() => navigate('/entrar')}>
            Ingresar
          </button>
        }
      />
    )
  }

  if (loading) return <LoadingBlock />

  return (
    <div className="messages">
      <div className="messages-layout">
        <div className="conv-list">
          <h2>Conversaciones</h2>
          {conversations.length === 0 ? (
            <p className="muted">Aún no hay mensajes. Empieza una conversación desde una publicación.</p>
          ) : (
            <ul className="conv-items">
              {conversations.map((c) => {
                const key = `${c.listing_id}__${c.last.sender_id === user.id ? c.last.receiver_id : c.last.sender_id}`
                const other = c.other
                return (
                  <li key={key}>
                    <button
                      className={`conv-item ${active === c.listing_id ? 'conv-active' : ''}`}
                      onClick={() => setActive(c.listing_id)}
                    >
                      <span className="avatar">{other?.username?.charAt(0).toUpperCase() ?? '👤'}</span>
                      <div className="conv-info">
                        <div className="conv-top">
                          <span className="conv-name">{other?.username ?? 'Usuario'}</span>
                          <span className="conv-time">{timeAgo(c.last.created_at)}</span>
                        </div>
                        <div className="conv-bottom">
                          <span className="conv-preview">{c.last.body}</span>
                          {c.unread > 0 && <span className="conv-dot" />}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="thread">
          {!active || !activeConv ? (
            <div className="thread-empty">
              <div className="state-icon">✉️</div>
              <h3>Selecciona una conversación</h3>
              <p>Las conversaciones se generan cuando contactas a un vendedor.</p>
            </div>
          ) : (
            <>
              <div className="thread-head">
                <div className="thread-head-info">
                  <Link to={`/publicacion/${active}`} className="thread-listing">
                    {activeConv.listing_title || 'Ver publicación'}
                  </Link>
                  <span className="thread-peer">
                    {activeConv.other?.username ?? 'Usuario'}
                  </span>
                </div>
              </div>
              <div className="thread-messages">
                {thread.length === 0 ? (
                  <p className="muted">Escribe el primer mensaje para iniciar la conversación.</p>
                ) : (
                  thread.map((m) => (
                    <div
                      key={m.id}
                      className={`bubble ${m.sender_id === user.id ? 'bubble-me' : 'bubble-other'}`}
                    >
                      <div className="bubble-text">{m.body}</div>
                      <div className="bubble-time">{formatDateTime(m.created_at)}</div>
                    </div>
                  ))
                )}
                <div ref={threadEndRef} />
              </div>
              <form className="thread-input" onSubmit={send}>
                <textarea
                  placeholder="Escribe tu mensaje…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                />
                <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()}>
                  {sending ? 'Enviando…' : 'Enviar'}
                </button>
              </form>
              {error && <Alert kind="error">{error}</Alert>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

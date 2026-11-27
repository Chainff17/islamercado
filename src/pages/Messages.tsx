import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Listing, Message } from '../lib/types'
import { formatPrice, timeAgo } from '../lib/format'
import { storageUrl } from '../lib/images'
import { LoadingBlock, EmptyState, Alert } from '../components/Pagination'
import { useAuth } from '../context/AuthContext'

interface Conversation {
  listingId: string
  listingTitle: string
  listingImage: string
  listingPrice: number
  listingCurrency: string
  otherId: string
  otherName: string
  messages: Message[]
  lastAt: string
  unread: number
}

export default function Messages() {
  const { listingId } = useParams<{ listingId: string }>()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)

  const target = listingId ?? params.get('to')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    supabase
      .from('messages')
      .select(
        `id, listing_id, sender_id, receiver_id, body, read_at, created_at,
         listings ( title, price_usd, currency, images, status ),
         profiles ( username )`,
      )
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!active) return
        if (err) {
          setLoading(false)
          return
        }
        const rows = data as unknown as Array<
          Message & { listings?: Partial<Listing>; profiles?: { username: string | null } }
        >
        const grouped = new Map<string, Conversation>()
        for (const m of rows) {
          const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
          const key = `${m.listing_id}__${otherId}`
          if (!grouped.has(key)) {
            grouped.set(key, {
              listingId: m.listing_id,
              listingTitle: m.listings?.title ?? 'Publicación',
              listingImage: m.listings?.images?.[0] ?? '',
              listingPrice: m.listings?.price_usd ?? 0,
              listingCurrency: m.listings?.currency ?? 'USD',
              otherId,
              otherName: m.profiles?.username ?? 'Vendedor',
              messages: [],
              lastAt: m.created_at,
              unread: 0,
            })
          }
          const conv = grouped.get(key)!
          if (m.created_at > conv.lastAt) conv.lastAt = m.created_at
          if (m.receiver_id === user.id && !m.read_at) conv.unread += 1
          conv.messages.push(m)
        }
        const list = Array.from(grouped.values()).map((c) => ({
          ...c,
          messages: [...c.messages].sort((a, b) =>
            a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0,
          ),
        }))
        list.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1))
        setConversations(list)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    if (target && conversations.length > 0) {
      const match = conversations.find((c) => c.listingId === target)
      if (match) setActive(`${match.listingId}__${match.otherId}`)
    }
  }, [target, conversations])

  const current = conversations.find((c) => c.listingId && `${c.listingId}__${c.otherId}` === active)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [current?.messages.length])

  useEffect(() => {
    if (!active || !user) return
    supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('listing_id', current?.listingId)
      .eq('receiver_id', user.id)
      .neq('read_at', null)
      .then(() => setConversations((prev) => prev.map((c) => ({ ...c, unread: 0 }))))
  }, [active, user, current?.listingId])

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!user || !current || !body.trim()) return
    setError('')
    const { error: err } = await supabase.from('messages').insert({
      listing_id: current.listingId,
      sender_id: user.id,
      receiver_id: current.otherId,
      body: body.trim(),
    })
    if (err) {
      setError(err.message)
      return
    }
    setBody('')
    supabase
      .from('messages')
      .select(
        `id, listing_id, sender_id, receiver_id, body, read_at, created_at,
         listings ( title, price_usd, currency, images, status ),
         profiles ( username )`,
      )
      .eq('listing_id', current.listingId)
      .eq('receiver_id', current.otherId)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .then(({ data }) => {
        const row = data?.[0] as Message
        if (!row) return
        setConversations((prev) => {
          const idx = prev.findIndex((c) => `${c.listingId}__${c.otherId}` === active)
          const copy = [...prev]
          if (idx === -1) return copy
          copy[idx] = {
            ...copy[idx],
            messages: [...copy[idx].messages, row],
            lastAt: row.created_at,
          }
          return copy
        })
      })
  }

  if (loading) return <LoadingBlock />

  if (!user)
    return (
      <EmptyState
        title="Inicia sesión para ver tus mensajes"
        action={
          <Link to="/entrar" className="btn btn-primary">
            Entrar
          </Link>
        }
      />
    )

  if (conversations.length === 0)
    return (
      <EmptyState
        title="No tienes conversaciones"
        message="Cuando contactes a un vendedor, aquí aparecerá la conversación."
        action={
          <Link to="/buscar" className="btn btn-outline">
            Ir a explorar
          </Link>
        }
      />
    )

  return (
    <div className="messages">
      <aside className={`conv-list ${active ? 'conv-list-hidden' : ''}`}>
        <h2 className="section-title">Conversaciones</h2>
        {conversations.map((c) => (
          <button
            key={`${c.listingId}__${c.otherId}`}
            type="button"
            className={`conv-item ${active === `${c.listingId}__${c.otherId}` ? 'conv-item-active' : ''}`}
            onClick={() => setActive(`${c.listingId}__${c.otherId}`)}
          >
            <div className="conv-avatar">
              {c.otherName.slice(0, 2).toUpperCase()}
            </div>
            <div className="conv-info">
              <div className="conv-top">
                <span className="conv-name">{c.otherName}</span>
                {c.unread > 0 && <span className="conv-unread">{c.unread}</span>}
              </div>
              <div className="conv-listing">{c.listingTitle}</div>
              <div className="conv-last">{c.messages[c.messages.length - 1]?.body}</div>
              <div className="conv-time">{timeAgo(c.lastAt)}</div>
            </div>
          </button>
        ))}
      </aside>

      <section className={`conv-thread ${active ? '' : 'conv-thread-hidden'}`}>
        {current ? (
          <>
            <div className="thread-head">
              <div>
                <Link to={`/publicacion/${current.listingId}`} className="thread-listing">
                  {current.listingImage && (
                    <img className="thread-thumb" src={storageUrl(current.listingImage)} alt="" />
                  )}
                  <span>{current.listingTitle}</span>
                  <span className="thread-price">{formatPrice(current.listingPrice, current.listingCurrency)}</span>
                </Link>
                <div className="thread-with">Con {current.otherName}</div>
              </div>
            </div>
            <div className="thread-messages">
              {current.messages.map((m) => {
                const mine = m.sender_id === user.id
                return (
                  <div key={m.id} className={`msg-bubble ${mine ? 'msg-mine' : 'msg-other'}`}>
                    <div className="msg-body">{m.body}</div>
                    <div className="msg-time">{timeAgo(m.created_at)}</div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
            <form className="msg-send" onSubmit={send}>
              <input
                type="text"
                placeholder="Escribe un mensaje…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary">
                Enviar
              </button>
            </form>
            {error && <Alert kind="error">{error}</Alert>}
          </>
        ) : (
          <div className="conv-empty">
            <p>Selecciona una conversación para ver los mensajes.</p>
          </div>
        )}
      </section>
    </div>
  )
}

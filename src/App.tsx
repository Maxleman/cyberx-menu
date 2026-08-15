import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingBag, Search, X, Plus, Minus, Trash2 } from 'lucide-react';
import { MenuItem, CartItem } from './types';

const RELAY_URL = 'https://cyberxgreen-relay.onrender.com/';
const API_URL = 'https://cyberxgreen-menu.netlify.app/api.php'; // proxy or direct

// ─── CyberX Brand Colors ───
// Background: #111111
// Red accent: #E3001B
// White: #FFFFFF
// Dark card: #1A1A1A
// Border: #2A2A2A
// Font: Montserrat (ExtraBold headings, Medium body)

export default function App() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [selectedCustomizeItem, setSelectedCustomizeItem] = useState<MenuItem | null>(null);
  const [custSelectedSauces, setCustSelectedSauces] = useState<string[]>([]);
  const [custExcludedIngredients, setCustExcludedIngredients] = useState<string[]>([]);
  const [custExtraPatty, setCustExtraPatty] = useState<boolean>(false);
  const [custExtraCheese, setCustExtraCheese] = useState<boolean>(false);
  const [custNotes, setCustNotes] = useState<string>('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [givenCash, setGivenCash] = useState<string>('');

  const categories = [
    { id: 'all', label: 'Всё меню' },
    { id: 'burgers', label: 'Бургеры' },
    { id: 'rolls', label: 'Роллы' },
    { id: 'dogs', label: 'Hot-Dogs' },
    { id: 'appetizers', label: 'Закуски' },
    { id: 'sauces', label: 'Соусы' },
  ];

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery, menuItems]);

  const handleOpenCustomize = (item: MenuItem) => {
    if (item.category === 'sauces') { addToCartDirect(item); return; }
    setSelectedCustomizeItem(item);
    setCustSelectedSauces([]);
    setCustExcludedIngredients([]);
    setCustExtraPatty(false);
    setCustExtraCheese(false);
    setCustNotes('');
  };

  const addToCartDirect = (item: MenuItem) => {
    const cartItemId = `${item.id}-direct`;
    const existingIndex = cart.findIndex(i => i.id === cartItemId);
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      updatedCart[existingIndex].finalPrice = updatedCart[existingIndex].quantity * item.price;
      setCart(updatedCart);
    } else {
      setCart([...cart, { id: cartItemId, menuItem: item, quantity: 1, selectedSauces: [], excludedIngredients: [], extraPatty: false, extraCheese: false, notes: '', finalPrice: item.price }]);
    }
  };

  const currentCustomizedPrice = useMemo(() => {
    if (!selectedCustomizeItem) return 0;
    let base = selectedCustomizeItem.price;
    if (custExtraCheese) base += 1.50;
    if (custExtraPatty) base += 4.00;
    base += custSelectedSauces.length * 1.50;
    return base;
  }, [selectedCustomizeItem, custExtraCheese, custExtraPatty, custSelectedSauces]);

  const handleAddCustomizedToCart = () => {
    if (!selectedCustomizeItem) return;
    const keyParts = [selectedCustomizeItem.id, custExtraCheese ? 'cheese' : '', custExtraPatty ? 'patty' : '', custSelectedSauces.sort().join('_'), custExcludedIngredients.sort().join('_')].filter(Boolean).join('-');
    const existingIndex = cart.findIndex(i => i.id === keyParts);
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      updatedCart[existingIndex].finalPrice = updatedCart[existingIndex].quantity * currentCustomizedPrice;
      setCart(updatedCart);
    } else {
      setCart([...cart, { id: keyParts, menuItem: selectedCustomizeItem, quantity: 1, selectedSauces: [...custSelectedSauces], excludedIngredients: [...custExcludedIngredients], extraPatty: custExtraPatty, extraCheese: custExtraCheese, notes: custNotes, finalPrice: currentCustomizedPrice }]);
    }
    setSelectedCustomizeItem(null);
    setIsCartOpen(true);
  };

  const updateCartQty = (id: string, delta: number) => {
    const index = cart.findIndex(item => item.id === id);
    if (index === -1) return;
    const updated = [...cart];
    updated[index].quantity += delta;
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
    } else {
      let itemPrice = updated[index].menuItem.price;
      if (updated[index].extraCheese) itemPrice += 1.50;
      if (updated[index].extraPatty) itemPrice += 4.00;
      itemPrice += updated[index].selectedSauces.length * 1.50;
      updated[index].finalPrice = itemPrice * updated[index].quantity;
    }
    setCart(updated);
  };

  const removeCartItem = (id: string) => setCart(cart.filter(item => item.id !== id));
  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + item.finalPrice, 0), [cart]);
  const clearCart = () => { setCart([]); setIsCheckoutOpen(false); setOrderStatus('idle'); setOrderId(null); setPaymentMethod('cash'); setGivenCash(''); };

  // Normalize category from Caffesta to QR menu categories
  // Checks both category name AND product name
  const normalizeCategory = (cat: string, name: string = ''): string => {
    const c = (cat || '').toLowerCase().trim();
    const n = (name || '').toLowerCase().trim();
    if (c === 'burgers' || c.includes('бургер') || n.includes('бургер')) return 'burgers';
    if (c === 'rolls' || c.includes('ролл') || n.includes('ролл')) return 'rolls';
    if (c === 'dogs' || c.includes('хот-дог') || c.includes('hot-dog') || n.includes('хот-дог')) return 'dogs';
    if (c === 'sauces' || c.includes('соус') || n.startsWith('соус')) return 'sauces';
    if (c === 'drinks' || c.includes('напит')) return 'drinks';
    return 'appetizers';
  };

  // Load menu from relay (HTTPS)
  useEffect(() => {
    fetch('https://cyberxgreen-relay.onrender.com/?action=get_menu')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.products && d.products.length > 0) {
          const normalized = d.products.map((p: any) => ({
            ...p,
            category: normalizeCategory(p.category, p.name),
          }));
          setMenuItems(normalized);
        }
      })
      .catch(() => {})
      .finally(() => setMenuLoading(false));
  }, []);

  const buildItemNote = (item: CartItem): string => {
    const parts: string[] = [];
    if (item.extraCheese) parts.push('+двойной сыр');
    if (item.extraPatty) parts.push('+двойная котлета');
    if (item.selectedSauces.length > 0) parts.push('соусы: ' + item.selectedSauces.join(', '));
    if (item.excludedIngredients.length > 0) parts.push('БЕЗ: ' + item.excludedIngredients.join(', '));
    if (item.notes) parts.push(item.notes);
    return parts.join(' | ');
  };

  const buildOrderNote = (pm: string, gc: string): string => {
    const cashInfo = pm === 'cash' && gc
      ? `Дал: ${parseFloat(gc).toFixed(2)} BYN, сдача: ${Math.max(0, parseFloat(gc) - cartTotal).toFixed(2)} BYN`
      : '';
    const itemNotes = cart.map(i => {
      const n = buildItemNote(i);
      return n ? `${i.menuItem.name}: ${n}` : '';
    }).filter(Boolean).join(' | ');
    return [cashInfo, itemNotes].filter(Boolean).join(' | ');
  };

  const submitOrder = async () => {
    setOrderStatus('sending');
    const orderNote = buildOrderNote(paymentMethod, givenCash);
    try {
      const response = await fetch(`${RELAY_URL}?action=submit_order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId ?? 'unknown',
          payment_method: paymentMethod,
          given_cash: paymentMethod === 'cash' && givenCash ? parseFloat(givenCash) : null,
          items: cart.map(item => ({
            id: item.menuItem.id,
            name: item.menuItem.name,
            price: item.finalPrice / item.quantity,
            qty: item.quantity,
            extras: {
              extraCheese: item.extraCheese,
              extraPatty: item.extraPatty,
              sauces: item.selectedSauces,
              excluded: item.excludedIngredients,
              notes: item.notes,
            }
          })),
          total: cartTotal,
          note: orderNote,
        })
      });
      const data = await response.json();
      if (data.success) {
        setOrderStatus('success');
        setOrderId(data.order_id);
      } else {
        setOrderStatus('error');
      }
    } catch {
      setOrderStatus('error');
    }
  };

  const urlTableId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('table') ?? null
    : null;

  // Если в URL нет table — используем выбранный вручную
  const tableId = urlTableId ?? selectedTable;

  const tableIdToLabel = (tid: string | null): string | null => {
    if (!tid) return null;
    if (tid.startsWith('lounge')) return `ЛАУНЖ — СТОЛ ${tid.replace('lounge', '')}`;
    if (tid.startsWith('ps')) return `PLAYSTATION ${tid.replace('ps', '')}`;
    return tid.toUpperCase();
  };

  const tableLabel = tableIdToLabel(tableId);

  // ─── Category section renderer ───
  const renderSection = (catId: string, label: string, items: MenuItem[]) => {
    if (activeCategory !== 'all' && activeCategory !== catId) return null;
    if (items.length === 0) return null;
    return (
      <section key={catId} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Section header with diagonal accent */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid #2A2A2A', position: 'relative' }}>
          <div style={{ width: '4px', height: '28px', background: '#E3001B' }} />
          <h3 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '18px', color: '#FFFFFF', letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>
            {label}
          </h3>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '11px', color: '#555', letterSpacing: '0.05em' }}>
            {items.length} позиций
          </span>
        </div>

        {catId === 'sauces' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => addToCartDirect(item)}
                style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#E3001B')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A2A2A')}
              >
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '13px', color: '#FFF' }}>{item.name}</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '14px', color: '#E3001B' }}>1.50 BYN</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>+ В КОРЗИНУ</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {items.map(item => {
              const inCart = cart.filter(i => i.menuItem.id === item.id).reduce((s, x) => s + x.quantity, 0);
              return (
                <div
                  key={item.id}
                  style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', transition: 'border-color 0.2s, transform 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#E3001B'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A2A'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {/* Red diagonal corner accent */}
                  <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 40px 40px 0', borderColor: `transparent #E3001B transparent transparent` }} />

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', padding: '12px 12px 0' }}>
                      {item.tags.map(t => (
                        <span key={t} style={{ background: t === 'HOT' ? '#E3001B' : '#FFFFFF', color: '#111', fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '9px', padding: '3px 8px', letterSpacing: '0.08em' }}>
                          {t === 'HOT' ? <span style={{ color: '#fff' }}>{t}</span> : t}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '15px', color: '#FFFFFF', margin: '0 0 8px', lineHeight: 1.3 }}>
                      {item.name}
                    </h4>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '12px', color: '#888', lineHeight: 1.6, margin: '0 0 8px', flex: 1 }}>
                      {item.description}
                    </p>
                    {item.ingredients && item.ingredients.length > 0 && (
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '10px', color: '#555', lineHeight: 1.6, margin: '0 0 12px' }}>
                        {item.ingredients.join(' · ')}
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid #2A2A2A', paddingTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '18px', color: '#E3001B' }}>
                        {item.price.toFixed(2)} <span style={{ fontSize: '11px', fontWeight: 600, color: '#888' }}>BYN</span>
                      </span>
                      <button
                        onClick={() => handleOpenCustomize(item)}
                        style={{ background: inCart > 0 ? '#E3001B' : 'transparent', border: `1px solid ${inCart > 0 ? '#E3001B' : '#3A3A3A'}`, color: '#FFF', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '11px', padding: '8px 16px', cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onMouseEnter={e => { if (inCart === 0) { e.currentTarget.style.background = '#E3001B'; e.currentTarget.style.borderColor = '#E3001B'; } }}
                        onMouseLeave={e => { if (inCart === 0) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#3A3A3A'; } }}
                      >
                        {inCart > 0 && <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '2px', padding: '0 5px', fontSize: '10px' }}>{inCart}</span>}
                        {inCart > 0 ? 'В КОРЗИНЕ' : '+ ВЫБРАТЬ'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  if (menuLoading) return (
    <div style={{ minHeight: '100vh', background: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', fontFamily: "'Montserrat', sans-serif" }}>
      <style>{'@import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&display=swap"); @keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ width: '40px', height: '40px', border: '3px solid #2A2A2A', borderTop: '3px solid #E3001B', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontWeight: 700, fontSize: '13px', color: '#888', letterSpacing: '0.1em' }}>ЗАГРУЗКА МЕНЮ...</div>
    </div>
  );

  // Если нет table в URL и не выбран вручную — показываем экран выбора места
  if (!urlTableId && !selectedTable) return (
    <div style={{ minHeight: '100vh', background: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Montserrat', sans-serif" }}>
      <style>{'@import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700;800;900&display=swap");'}</style>
      <div style={{ maxWidth: '400px', width: '100%' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ width: '40px', height: '40px', background: '#E3001B', display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: 'polygon(10% 0%,90% 0%,100% 10%,100% 90%,90% 100%,10% 100%,0% 90%,0% 10%)' }}>
            <span style={{ fontWeight: 900, fontSize: '20px', color: '#FFF' }}>X</span>
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: '20px', color: '#FFF', letterSpacing: '0.04em' }}>CYBER<span style={{ color: '#E3001B' }}>X</span>GREEN</div>
            <div style={{ fontWeight: 500, fontSize: '9px', color: '#666', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Компьютерный клуб</div>
          </div>
        </div>

        <div style={{ fontWeight: 800, fontSize: '18px', color: '#FFF', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Где вы находитесь?
        </div>
        <div style={{ fontWeight: 400, fontSize: '12px', color: '#666', marginBottom: '24px', lineHeight: 1.6 }}>
          Выберите ваше место чтобы мы знали куда принести заказ
        </div>

        {/* Lounge tables */}
        <div style={{ fontWeight: 700, fontSize: '10px', color: '#E3001B', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '3px', height: '14px', background: '#E3001B' }} />
          ЛАУНЖ ЗОНА
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '20px' }}>
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => setSelectedTable(`lounge${n}`)}
              style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#FFF', padding: '14px 8px', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#E3001B'; e.currentTarget.style.background = 'rgba(227,0,27,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A2A'; e.currentTarget.style.background = '#1A1A1A'; }}>
              <span style={{ fontSize: '20px' }}>🛋️</span>
              <span style={{ fontSize: '11px', color: '#888' }}>Стол {n}</span>
            </button>
          ))}
        </div>

        {/* PlayStation */}
        <div style={{ fontWeight: 700, fontSize: '10px', color: '#E3001B', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '3px', height: '14px', background: '#E3001B' }} />
          PLAYSTATION
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '24px' }}>
          {[1,2].map(n => (
            <button key={n} onClick={() => setSelectedTable(`ps${n}`)}
              style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#FFF', padding: '14px 8px', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#E3001B'; e.currentTarget.style.background = 'rgba(227,0,27,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A2A'; e.currentTarget.style.background = '#1A1A1A'; }}>
              <span style={{ fontSize: '20px' }}>🎮</span>
              <span style={{ fontSize: '11px', color: '#888' }}>PlayStation {n}</span>
            </button>
          ))}
        </div>

        {/* Skip */}
        <button onClick={() => setSelectedTable('unknown')}
          style={{ width: '100%', background: 'transparent', border: '1px solid #2A2A2A', color: '#555', padding: '10px', fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '11px', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Пропустить
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#111111', color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Google Font import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --red: #E3001B; --black: #111111; --card: #1A1A1A; --border: #2A2A2A; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #1A1A1A; }
        ::-webkit-scrollbar-thumb { background: #E3001B; }
        input::placeholder { color: #555; }
        input:focus { outline: none; }
        button { cursor: pointer; }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{ background: '#E3001B', padding: '6px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '10px', letterSpacing: '0.15em', color: '#FFF', textTransform: 'uppercase' }}>
          ★ МЕЖДУНАРОДНАЯ СЕТЬ КОМПЬЮТЕРНЫХ КЛУБОВ
        </span>
        {tableLabel && (
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '10px', letterSpacing: '0.12em', color: '#FFF', background: 'rgba(0,0,0,0.3)', padding: '2px 10px' }}>
            {tableLabel}
          </span>
        )}
      </div>

      {/* ── STICKY HEADER ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(17,17,17,0.97)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #2A2A2A' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          {/* Logo row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}>
              {/* X Logo */}
              <div style={{ width: '36px', height: '36px', background: '#E3001B', display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: 'polygon(10% 0%, 90% 0%, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0% 90%, 0% 10%)' }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '18px', color: '#FFF', lineHeight: 1 }}>X</span>
              </div>
              <div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '20px', color: '#FFF', letterSpacing: '0.05em', lineHeight: 1 }}>
                  CYBER<span style={{ color: '#E3001B' }}>X</span>GREEN
                </div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '9px', color: '#888', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                  КОМПЬЮТЕРНЫЙ КЛУБ
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Search */}
              <div style={{ position: 'relative', display: 'none' }} className="search-wrap">
                <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#555' }} />
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#FFF', padding: '8px 12px 8px 32px', fontSize: '12px', fontFamily: "'Montserrat', sans-serif", fontWeight: 500, width: '180px' }}
                />
              </div>

              {/* Cart button */}
              <button
                onClick={() => setIsCartOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: cart.length > 0 ? '#E3001B' : '#1A1A1A', border: `1px solid ${cart.length > 0 ? '#E3001B' : '#3A3A3A'}`, color: '#FFF', padding: '10px 18px', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'all 0.2s' }}
              >
                <ShoppingBag style={{ width: '16px', height: '16px' }} />
                <span>КОРЗИНА</span>
                {cart.length > 0 && (
                  <span style={{ background: 'rgba(255,255,255,0.25)', padding: '1px 7px', fontSize: '11px', fontWeight: 800 }}>
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
                {cart.length > 0 && (
                  <span style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '10px', fontSize: '13px', fontWeight: 800 }}>
                    {cartTotal.toFixed(2)} BYN
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Category nav */}
          <nav style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '1px' }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: '9px 18px',
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 700,
                  fontSize: '11px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  border: 'none',
                  borderBottom: activeCategory === cat.id ? '2px solid #E3001B' : '2px solid transparent',
                  background: 'transparent',
                  color: activeCategory === cat.id ? '#E3001B' : '#888',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (activeCategory !== cat.id) e.currentTarget.style.color = '#CCC'; }}
                onMouseLeave={e => { if (activeCategory !== cat.id) e.currentTarget.style.color = '#888'; }}
              >
                {cat.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── HERO BANNER ── */}
      {activeCategory === 'all' && (
        <div style={{ background: 'linear-gradient(135deg, #1A0003 0%, #111111 50%, #1A0003 100%)', padding: '40px 20px', position: 'relative', overflow: 'hidden' }}>
          {/* Decorative diagonal stripes */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(227,0,27,0.03) 20px, rgba(227,0,27,0.03) 21px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', background: '#E3001B' }} />
          <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '11px', color: '#E3001B', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '10px' }}>
              ● ТВОЙ ПУТЬ В КИБЕРСПОРТ
            </div>
            <h1 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 'clamp(32px, 6vw, 64px)', color: '#FFF', lineHeight: 1, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
              CYBER<span style={{ color: '#E3001B' }}>X</span>GREEN<br />
              <span style={{ color: '#888', fontSize: '55%', fontWeight: 700, letterSpacing: '0.05em' }}>МЕНЮ ЗАВЕДЕНИЯ</span>
            </h1>
            {tableLabel && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginTop: '16px', background: '#E3001B', padding: '8px 18px' }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '12px', color: '#FFF', letterSpacing: '0.1em' }}>
                  📍 {tableLabel}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SEARCH BAR (mobile) ── */}
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '20px 20px 0' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#555' }} />
          <input
            type="text"
            placeholder="Поиск по меню..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#FFF', padding: '12px 16px 12px 42px', fontSize: '13px', fontFamily: "'Montserrat', sans-serif", fontWeight: 500, transition: 'border-color 0.2s' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#E3001B')}
            onBlur={e => (e.currentTarget.style.borderColor = '#2A2A2A')}
          />
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '28px 20px 60px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {renderSection('burgers', 'Cyber Бургеры', filteredItems.filter(i => i.category === 'burgers'))}
        {renderSection('rolls', 'Cyber Роллы', filteredItems.filter(i => i.category === 'rolls'))}
        {renderSection('dogs', 'Cyber Hot-Dogs', filteredItems.filter(i => i.category === 'dogs'))}
        {renderSection('appetizers', 'Закуски', filteredItems.filter(i => i.category === 'appetizers'))}
        {renderSection('sauces', 'Соусы', filteredItems.filter(i => i.category === 'sauces'))}

        {filteredItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '48px', color: '#E3001B', marginBottom: '12px' }}>X</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '16px', color: '#888' }}>Ничего не найдено</div>
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#0A0A0A', borderTop: '1px solid #2A2A2A', padding: '24px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '24px', height: '24px', background: '#E3001B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '12px', color: '#FFF' }}>X</span>
            </div>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '13px', color: '#FFF' }}>CYBERXGREEN</span>
          </div>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '11px', color: '#555', letterSpacing: '0.1em' }}>
            © {new Date().getFullYear()} CYBERXGREEN — МЕЖДУНАРОДНАЯ СЕТЬ КЛУБОВ
          </span>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════
          CUSTOMIZATION MODAL
      ══════════════════════════════════════════════ */}
      {selectedCustomizeItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50 }}>
          <div style={{ background: '#111111', border: '1px solid #E3001B', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            {/* Red top bar */}
            <div style={{ background: '#E3001B', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#FFF' }}>
                НАСТРОЙКА ЗАКАЗА
              </span>
              <button onClick={() => setSelectedCustomizeItem(null)} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: '#FFF', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: '14px', height: '14px' }} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Item name */}
              <div>
                <h3 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '20px', color: '#FFF', marginBottom: '6px' }}>
                  {selectedCustomizeItem.name}
                </h3>
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '12px', color: '#888', lineHeight: 1.6 }}>
                  {selectedCustomizeItem.description}
                </p>
              </div>

              {/* Excluded ingredients */}
              {selectedCustomizeItem.ingredients && selectedCustomizeItem.ingredients.length > 0 && (
                <div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '11px', color: '#E3001B', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '3px', height: '14px', background: '#E3001B' }} />
                    УБРАТЬ ИНГРЕДИЕНТЫ
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedCustomizeItem.ingredients.map(ing => {
                      const isExcluded = custExcludedIngredients.includes(ing);
                      return (
                        <button key={ing} onClick={() => setCustExcludedIngredients(isExcluded ? custExcludedIngredients.filter(i => i !== ing) : [...custExcludedIngredients, ing])}
                          style={{ padding: '5px 12px', fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '11px', border: `1px solid ${isExcluded ? '#E3001B' : '#2A2A2A'}`, background: isExcluded ? 'rgba(227,0,27,0.1)' : '#1A1A1A', color: isExcluded ? '#E3001B' : '#888', textDecoration: isExcluded ? 'line-through' : 'none', transition: 'all 0.15s' }}>
                          {ing}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Extras */}
              <div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '11px', color: '#E3001B', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '3px', height: '14px', background: '#E3001B' }} />
                  ДОПОЛНЕНИЯ
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { key: 'cheese', label: 'Двойной сыр чеддер', price: '+1.50 BYN', val: custExtraCheese, set: setCustExtraCheese },
                    { key: 'patty', label: 'Двойная котлета', price: '+4.00 BYN', val: custExtraPatty, set: setCustExtraPatty },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => opt.set(!opt.val)}
                      style={{ padding: '12px 14px', fontFamily: "'Montserrat', sans-serif", border: `1px solid ${opt.val ? '#E3001B' : '#2A2A2A'}`, background: opt.val ? 'rgba(227,0,27,0.08)' : '#1A1A1A', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: opt.val ? '#FFF' : '#AAA' }}>{opt.label}</span>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: '#E3001B' }}>{opt.price}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sauces */}
              <div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '11px', color: '#E3001B', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '3px', height: '14px', background: '#E3001B' }} />
                  СОУСЫ ВНУТРЬ (+1.50 BYN за соус)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {menuItems.filter(i => i.category === 'sauces').map(sauce => {
                    const sel = custSelectedSauces.includes(sauce.name);
                    return (
                      <button key={sauce.id} onClick={() => setCustSelectedSauces(sel ? custSelectedSauces.filter(s => s !== sauce.name) : [...custSelectedSauces, sauce.name])}
                        style={{ padding: '9px 12px', fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '11px', border: `1px solid ${sel ? '#E3001B' : '#2A2A2A'}`, background: sel ? 'rgba(227,0,27,0.1)' : '#1A1A1A', color: sel ? '#E3001B' : '#888', display: 'flex', justifyContent: 'space-between', transition: 'all 0.15s' }}>
                        <span>{sauce.name}</span>
                        <span style={{ color: '#E3001B', fontWeight: 700 }}>+1.50</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '11px', color: '#888', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  ПОЖЕЛАНИЯ К БЛЮДУ
                </div>
                <input type="text" placeholder="Пожелания повару..." value={custNotes} onChange={e => setCustNotes(e.target.value)}
                  style={{ width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#FFF', padding: '10px 14px', fontSize: '13px', fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#E3001B')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#2A2A2A')}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #2A2A2A', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0A0A0A' }}>
              <div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '11px', color: '#555', marginBottom: '2px' }}>ИТОГО:</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '24px', color: '#E3001B' }}>
                  {currentCustomizedPrice.toFixed(2)} <span style={{ fontSize: '13px', fontWeight: 600, color: '#888' }}>BYN</span>
                </div>
              </div>
              <button onClick={handleAddCustomizedToCart}
                style={{ background: '#E3001B', border: 'none', color: '#FFF', padding: '14px 28px', fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                В КОРЗИНУ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          CART SLIDE-OVER
      ══════════════════════════════════════════════ */}
      {isCartOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} onClick={() => setIsCartOpen(false)} />
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '440px', background: '#111111', borderLeft: '1px solid #E3001B', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
            {/* Cart header */}
            <div style={{ background: '#E3001B', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShoppingBag style={{ width: '18px', height: '18px', color: '#FFF' }} />
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FFF' }}>
                  КОРЗИНА
                </span>
                <span style={{ background: 'rgba(0,0,0,0.25)', fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '12px', color: '#FFF', padding: '2px 8px' }}>
                  {cart.reduce((s, i) => s + i.quantity, 0)} шт
                </span>
              </div>
              <button onClick={() => setIsCartOpen(false)} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: '#FFF', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            {/* Cart items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {cart.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '64px', color: '#1A1A1A' }}>X</div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '14px', color: '#555', textAlign: 'center' }}>Корзина пуста</div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '12px', color: '#444', textAlign: 'center', maxWidth: '200px', lineHeight: 1.6 }}>Выберите блюда из меню и добавьте их в корзину</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {cart.map(item => (
                    <div key={item.id} style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1, paddingRight: '12px' }}>
                          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '13px', color: '#FFF', marginBottom: '4px' }}>
                            {item.menuItem.name}
                          </div>
                          {(item.extraCheese || item.extraPatty || item.selectedSauces.length > 0 || item.excludedIngredients.length > 0) && (
                            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '10px', color: '#888', lineHeight: 1.7 }}>
                              {item.extraCheese && <div style={{ color: '#E3001B' }}>+ Двойной сыр (+1.50)</div>}
                              {item.extraPatty && <div style={{ color: '#E3001B' }}>+ Двойная котлета (+4.00)</div>}
                              {item.selectedSauces.length > 0 && <div>Соусы: {item.selectedSauces.join(', ')}</div>}
                              {item.excludedIngredients.length > 0 && <div style={{ color: '#FF4444' }}>Без: {item.excludedIngredients.join(', ')}</div>}
                              {item.notes && <div style={{ fontStyle: 'italic', color: '#666' }}>«{item.notes}»</div>}
                            </div>
                          )}
                        </div>
                        <button onClick={() => removeCartItem(item.id)} style={{ background: 'none', border: 'none', color: '#555', padding: '2px' }}>
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #2A2A2A', paddingTop: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #2A2A2A' }}>
                          <button onClick={() => updateCartQty(item.id, -1)} style={{ background: 'none', border: 'none', color: '#888', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Minus style={{ width: '12px', height: '12px' }} />
                          </button>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '13px', color: '#FFF', padding: '0 10px' }}>{item.quantity}</span>
                          <button onClick={() => updateCartQty(item.id, 1)} style={{ background: 'none', border: 'none', color: '#888', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Plus style={{ width: '12px', height: '12px' }} />
                          </button>
                        </div>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '16px', color: '#E3001B' }}>
                          {item.finalPrice.toFixed(2)} BYN
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart footer */}
            {cart.length > 0 && (
              <div style={{ borderTop: '1px solid #2A2A2A', background: '#0A0A0A', padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '13px', color: '#888' }}>ИТОГО К ОПЛАТЕ:</span>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '24px', color: '#E3001B' }}>{cartTotal.toFixed(2)} BYN</span>
                </div>
                <button onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                  style={{ width: '100%', background: '#E3001B', border: 'none', color: '#FFF', padding: '16px', fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '14px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  ОФОРМИТЬ ЗАКАЗ
                </button>
              </div>
            )}
          </div>
        </div>
      )}


      {/* ══════════════════════════════════════════════
          CHECKOUT MODAL
      ══════════════════════════════════════════════ */}
      {isCheckoutOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50 }}>
          <div style={{ background: '#111111', border: '2px solid #E3001B', maxWidth: '500px', width: '100%', maxHeight: '92vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any }}>

            {/* Header */}
            <div style={{ background: '#E3001B', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '16px', color: '#FFF', letterSpacing: '0.05em' }}>
                  {orderStatus === 'success' ? 'ЗАКАЗ ПРИНЯТ!' : 'ВАШ ЗАКАЗ'}
                </div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '10px', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {orderStatus === 'success' ? 'ПЕРЕДАЁМ НА КУХНЮ' : 'ПОДТВЕРДИТЕ ЗАКАЗ'}
                </div>
              </div>
              {orderStatus !== 'sending' && (
                <button onClick={() => { setIsCheckoutOpen(false); if (orderStatus === 'success') clearCart(); }} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: '#FFF', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X style={{ width: '16px', height: '16px' }} />
                </button>
              )}
            </div>

            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* ── СОСТОЯНИЕ: ОТПРАВКА ── */}
              {orderStatus === 'sending' && (
                <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', border: '3px solid #2A2A2A', borderTop: '3px solid #E3001B', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '14px', color: '#FFF' }}>Отправляем заказ...</div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '12px', color: '#888' }}>Подождите несколько секунд</div>
                </div>
              )}

              {/* ── СОСТОЯНИЕ: УСПЕХ ── */}
              {orderStatus === 'success' && (
                <>
                  <div style={{ background: 'rgba(0,200,80,0.08)', border: '1px solid rgba(0,200,80,0.3)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                    <div style={{ width: '48px', height: '48px', background: '#00C850', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>✓</div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '16px', color: '#00C850' }}>ЗАКАЗ ОТПРАВЛЕН!</div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '12px', color: '#888', lineHeight: 1.6 }}>
                      Ваш заказ передан администратору. Ожидайте — скоро принесём!
                    </div>
                    {orderId && (
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '11px', color: '#555', background: '#1A1A1A', padding: '4px 12px', letterSpacing: '0.05em' }}>
                        ID: {orderId}
                      </div>
                    )}
                  </div>
                  {tableLabel && (
                    <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '12px', color: '#888' }}>Расположение:</span>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '12px', color: '#FFF' }}>{tableLabel}</span>
                    </div>
                  )}
                  <button onClick={clearCart} style={{ width: '100%', background: '#E3001B', border: 'none', color: '#FFF', padding: '14px', fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    ВЕРНУТЬСЯ В МЕНЮ
                  </button>
                </>
              )}

              {/* ── СОСТОЯНИЕ: ОШИБКА ── */}
              {orderStatus === 'error' && (
                <>
                  <div style={{ background: 'rgba(227,0,27,0.08)', border: '1px solid rgba(227,0,27,0.3)', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '14px', color: '#E3001B', marginBottom: '8px' }}>ОШИБКА ОТПРАВКИ</div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '12px', color: '#888', lineHeight: 1.6 }}>
                      Не удалось отправить заказ. Позовите администратора или попробуйте снова.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setOrderStatus('idle')} style={{ flex: 1, background: 'transparent', border: '1px solid #3A3A3A', color: '#888', padding: '12px', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      НАЗАД
                    </button>
                    <button onClick={submitOrder} style={{ flex: 2, background: '#E3001B', border: 'none', color: '#FFF', padding: '12px', fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      ПОВТОРИТЬ
                    </button>
                  </div>
                </>
              )}

              {/* ── СОСТОЯНИЕ: IDLE — состав + оплата ── */}
              {orderStatus === 'idle' && (
                <>
                  {tableLabel && (
                    <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '11px', color: '#888', flexShrink: 0 }}>📍</span>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '12px', color: '#FFF', textAlign: 'right' }}>{tableLabel}</span>
                    </div>
                  )}

                  {/* Состав заказа */}
                  <div style={{ background: '#0A0A0A', border: '1px solid #2A2A2A', padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
                    {cart.map(item => (
                      <div key={item.id} style={{ borderBottom: '1px solid #1A1A1A', paddingBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '12px', color: '#FFF', lineHeight: 1.3 }}>
                            {item.quantity} × {item.menuItem.name}
                          </span>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '12px', color: '#E3001B', flexShrink: 0, whiteSpace: 'nowrap' }}>
                            {item.finalPrice.toFixed(2)} BYN
                          </span>
                        </div>
                        {(item.extraCheese || item.extraPatty || item.selectedSauces.length > 0 || item.excludedIngredients.length > 0 || item.notes) && (
                          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '10px', color: '#777', marginTop: '4px', lineHeight: 1.7, paddingLeft: '8px', borderLeft: '2px solid #2A2A2A' }}>
                            {item.extraCheese && <div style={{ color: '#E3001B' }}>＋ Двойной сыр</div>}
                            {item.extraPatty && <div style={{ color: '#E3001B' }}>＋ Двойная котлета</div>}
                            {item.selectedSauces.length > 0 && <div>🥫 {item.selectedSauces.join(', ')}</div>}
                            {item.excludedIngredients.length > 0 && <div style={{ color: '#FF6666' }}>✕ БЕЗ: {item.excludedIngredients.join(', ')}</div>}
                            {item.notes && <div style={{ fontStyle: 'italic', color: '#555' }}>💬 {item.notes}</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Итого */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#1A1A1A', border: '1px solid #2A2A2A' }}>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '12px', color: '#888' }}>ИТОГО:</span>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '20px', color: '#E3001B', whiteSpace: 'nowrap' }}>{cartTotal.toFixed(2)} BYN</span>
                  </div>

                  {/* Способ оплаты */}
                  <div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '10px', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>СПОСОБ ОПЛАТЫ</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['cash', 'card'] as const).map(m => (
                        <button key={m} onClick={() => { setPaymentMethod(m); setGivenCash(''); }}
                          style={{ flex: 1, padding: '11px 6px', border: `1px solid ${paymentMethod === m ? '#E3001B' : '#2A2A2A'}`, background: paymentMethod === m ? 'rgba(227,0,27,0.1)' : '#1A1A1A', color: paymentMethod === m ? '#FFF' : '#888', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}>
                          {m === 'cash' ? '💵 НАЛИЧНЫЕ' : '💳 КАРТА'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Наличные — быстрые купюры */}
                  {paymentMethod === 'cash' && (() => {
                    const bills = [5, 10, 20, 50, 100].filter(b => b >= cartTotal);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '10px', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>КУПЮРА</div>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {/* Без сдачи */}
                          {(() => {
                            const exactVal = cartTotal.toFixed(2);
                            const isActive = givenCash === exactVal;
                            return (
                              <button onClick={() => setGivenCash(exactVal)}
                                style={{ flex: '1 1 auto', minWidth: '70px', padding: '9px 4px', border: `1px solid ${isActive ? '#00C850' : '#2A2A2A'}`, background: isActive ? 'rgba(0,200,80,0.1)' : '#1A1A1A', color: isActive ? '#00C850' : '#888', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                БЕЗ СДАЧИ
                              </button>
                            );
                          })()}
                          {bills.slice(0, 4).map(b => {
                            const val = String(b);
                            const isActive = givenCash === val;
                            return (
                              <button key={b} onClick={() => setGivenCash(val)}
                                style={{ flex: '1 1 auto', minWidth: '55px', padding: '9px 4px', border: `1px solid ${isActive ? '#E3001B' : '#2A2A2A'}`, background: isActive ? 'rgba(227,0,27,0.1)' : '#1A1A1A', color: isActive ? '#FFF' : '#AAA', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {b} BYN
                              </button>
                            );
                          })}
                        </div>
                        <input type="number" inputMode="numeric" placeholder="Или введите сумму..."
                          value={givenCash} onChange={e => setGivenCash(e.target.value)}
                          style={{ width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#FFF', padding: '10px 12px', fontSize: '16px', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, outline: 'none' }}
                          onFocus={e => (e.currentTarget.style.borderColor = '#E3001B')}
                          onBlur={e => (e.currentTarget.style.borderColor = '#2A2A2A')} />
                        {givenCash && parseFloat(givenCash) >= cartTotal && (
                          <div style={{ padding: '8px 12px', background: 'rgba(0,200,80,0.08)', border: '1px solid rgba(0,200,80,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '11px', color: '#888' }}>СДАЧА:</span>
                            <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '18px', color: '#00C850', whiteSpace: 'nowrap' }}>
                              {(parseFloat(givenCash) - cartTotal).toFixed(2)} BYN
                            </span>
                          </div>
                        )}
                        {givenCash && parseFloat(givenCash) < cartTotal && (
                          <div style={{ padding: '6px 12px', background: 'rgba(227,0,27,0.08)', border: '1px solid rgba(227,0,27,0.3)' }}>
                            <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '10px', color: '#E3001B' }}>
                              Недостаточно — нужно ещё {(cartTotal - parseFloat(givenCash)).toFixed(2)} BYN
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={clearCart} style={{ flex: 1, background: 'transparent', border: '1px solid #3A3A3A', color: '#888', padding: '12px 8px', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      СБРОСИТЬ
                    </button>
                    <button onClick={submitOrder}
                      disabled={paymentMethod === 'cash' && !!givenCash && parseFloat(givenCash) < cartTotal}
                      style={{ flex: 2, background: (paymentMethod === 'cash' && !!givenCash && parseFloat(givenCash) < cartTotal) ? '#333' : '#E3001B', border: 'none', color: '#FFF', padding: '12px 8px', fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: (paymentMethod === 'cash' && !!givenCash && parseFloat(givenCash) < cartTotal) ? 'not-allowed' : 'pointer' }}>
                      ОТПРАВИТЬ
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

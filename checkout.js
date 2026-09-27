(() => {
  const qs = new URLSearchParams(location.search);
  const isBuyNow = qs.get('buynow') === '1';

  let cart;
  if (isBuyNow) {
    let buyNowItem = null;
    try { buyNowItem = JSON.parse(sessionStorage.getItem('yunhong_buynow_item') || 'null'); } catch {}
    cart = buyNowItem ? [buyNowItem] : [];
  } else {
    cart = JSON.parse(localStorage.getItem('yunhong_cart') || '[]');
  }

  const itemsEl = document.getElementById('items'), totalEl = document.getElementById('total'), msg = document.getElementById('msg');
  const submitBtn = document.querySelector('#checkout-form button');
  const escapeHtml = s => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const unitPrice = s => { const m = String(s).match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };

  function persistCart() {
    if (isBuyNow) {
      if (cart.length) sessionStorage.setItem('yunhong_buynow_item', JSON.stringify(cart[0]));
      else sessionStorage.removeItem('yunhong_buynow_item');
    } else {
      localStorage.setItem('yunhong_cart', JSON.stringify(cart));
      if (window.YunhongCart) window.YunhongCart.updateCount();
    }
  }

  function renderItems() {
    if (!cart.length) {
      itemsEl.innerHTML = '<p>' + (isBuyNow ? '商品信息已失效，请返回商品页重新下单。' : '购物车为空，请先选择商品。') + '</p>';
      totalEl.textContent = '¥0.00';
      submitBtn.disabled = true;
      return;
    }
    submitBtn.disabled = false;
    itemsEl.innerHTML = cart.map((i, idx) => {
      const price = unitPrice(i.price);
      const lineTotal = (price * i.qty).toFixed(2);
      return `<div class="order-row"><span>${escapeHtml(i.name)}</span><span class="qty-control"><button type="button" class="qty-btn" data-idx="${idx}" data-delta="-1">−</button><span class="qty-num">${i.qty}</span><button type="button" class="qty-btn" data-idx="${idx}" data-delta="1">+</button></span><span>¥${lineTotal}</span></div>`;
    }).join('');

    const total = cart.reduce((sum, i) => sum + unitPrice(i.price) * i.qty, 0);
    totalEl.textContent = '¥' + total.toFixed(2);

    itemsEl.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        const delta = Number(btn.dataset.delta);
        const item = cart[idx];
        if (!item) return;
        item.qty = Math.min(999, item.qty + delta);
        if (item.qty < 1) cart.splice(idx, 1);
        persistCart();
        renderItems();
      });
    });
  }

  renderItems();
  if (!cart.length) return;

  document.getElementById('checkout-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!cart.length) return;
    msg.textContent = '正在创建订单…';
    const fd = new FormData(e.currentTarget);
    const payload = { customer:{ name:fd.get('name'), phone:fd.get('phone'), email:fd.get('email'), address:fd.get('address'), note:fd.get('note') }, items:cart.map(i => ({id:i.id,qty:i.qty})) };
    try {
      const r = await fetch('/api/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const data = await r.json(); if (!r.ok) throw new Error(data.error || '订单创建失败');
      if (isBuyNow) { sessionStorage.removeItem('yunhong_buynow_item'); } else { localStorage.removeItem('yunhong_cart'); if (window.YunhongCart) window.YunhongCart.updateCount(); }
      const method = fd.get('payment');
      const payResp = await fetch('/api/payment',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:data.orderId,method})});
      const payData = await payResp.json();
      if (!payResp.ok || !payData.ok) {
        location.href = `order.html?id=${encodeURIComponent(data.orderId)}&method=${encodeURIComponent(method)}&payment_error=${encodeURIComponent(payData.message || '支付通道暂不可用')}`;
        return;
      }
      if (method === 'wechat' && payData.codeUrl) {
        location.href = `order.html?id=${encodeURIComponent(data.orderId)}&method=wechat&code_url=${encodeURIComponent(payData.codeUrl)}`;
        return;
      }
      if (method === 'alipay' && payData.paymentHtml) {
        document.open(); document.write(payData.paymentHtml); document.close();
        return;
      }
      location.href = `order.html?id=${encodeURIComponent(data.orderId)}&method=${encodeURIComponent(method)}`;
    } catch(err) { msg.className='error'; msg.textContent=err.message; }
  });
})();

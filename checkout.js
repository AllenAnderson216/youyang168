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
  const escapeHtml = s => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  if (!cart.length) { itemsEl.innerHTML = '<p>' + (isBuyNow ? '商品信息已失效，请返回商品页重新下单。' : '购物车为空，请先选择商品。') + '</p>'; document.querySelector('#checkout-form button').disabled = true; return; }

  // 从加入购物车/立即下单时保存的价格文案（如“¥198/盒”）中提取数字单价，仅用于页面展示预估金额；
  // 真正生效、防篡改的金额以服务器 /api/order 用商品目录重新核算的结果为准。
  const unitPrice = s => { const m = String(s).match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };

  itemsEl.innerHTML = cart.map(i => {
    const price = unitPrice(i.price);
    const lineTotal = (price * i.qty).toFixed(2);
    return `<div class="order-row"><span>${escapeHtml(i.name)} × ${i.qty}</span><span>¥${lineTotal}</span></div>`;
  }).join('');

  const total = cart.reduce((sum, i) => sum + unitPrice(i.price) * i.qty, 0);
  totalEl.textContent = '¥' + total.toFixed(2);

  document.getElementById('checkout-form').addEventListener('submit', async e => {
    e.preventDefault(); msg.textContent = '正在创建订单…';
    const fd = new FormData(e.currentTarget);
    const payload = { customer:{ name:fd.get('name'), phone:fd.get('phone'), email:fd.get('email'), address:fd.get('address'), note:fd.get('note') }, items:cart.map(i => ({id:i.id,qty:i.qty})) };
    try {
      const r = await fetch('/api/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const data = await r.json(); if (!r.ok) throw new Error(data.error || '订单创建失败');
      if (isBuyNow) { sessionStorage.removeItem('yunhong_buynow_item'); } else { localStorage.removeItem('yunhong_cart'); }
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

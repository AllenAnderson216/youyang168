(() => {
  const cart = JSON.parse(localStorage.getItem('yunhong_cart') || '[]');
  const itemsEl = document.getElementById('items'), totalEl = document.getElementById('total'), msg = document.getElementById('msg');
  const escapeHtml = s => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  if (!cart.length) { itemsEl.innerHTML = '<p>购物车为空，请先选择商品。</p>'; document.querySelector('#checkout-form button').disabled = true; return; }
  itemsEl.innerHTML = cart.map(i => `<div class="order-row"><span>${escapeHtml(i.name)} × ${i.qty}</span><span>以服务器最终核价为准</span></div>`).join('');
  totalEl.textContent = '提交后由服务器计算';

  document.getElementById('checkout-form').addEventListener('submit', async e => {
    e.preventDefault(); msg.textContent = '正在创建订单…';
    const fd = new FormData(e.currentTarget);
    const payload = { customer:{ name:fd.get('name'), phone:fd.get('phone'), email:fd.get('email'), address:fd.get('address'), note:fd.get('note') }, items:cart.map(i => ({id:i.id,qty:i.qty})) };
    try {
      const r = await fetch('/api/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const data = await r.json(); if (!r.ok) throw new Error(data.error || '订单创建失败');
      localStorage.removeItem('yunhong_cart');
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

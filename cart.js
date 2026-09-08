/* 周口云鸿商贸 - 购物车 & 询价逻辑 */
(function () {
  const STORAGE_KEY = 'yunhong_cart';

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateCartCount();
  }

  function updateCartCount() {
    const cart = getCart();
    const total = cart.reduce((sum, item) => sum + item.qty, 0);
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = total > 0 ? total : '';
      el.style.display = total > 0 ? 'flex' : 'none';
    });
  }

  function addToCart(id, name, price) {
    const cart = getCart();
    const existing = cart.find(item => item.id === id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ id, name, price: price || '询价', qty: 1 });
    }
    saveCart(cart);
    showToast('已加入购物车');
  }

  function removeFromCart(id) {
    let cart = getCart().filter(item => item.id !== id);
    saveCart(cart);
    renderCartModal();
  }

  function changeQty(id, delta) {
    const cart = getCart();
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      removeFromCart(id);
      return;
    }
    saveCart(cart);
    renderCartModal();
  }

  function showToast(msg) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  function openCartModal() {
    let overlay = document.querySelector('.cart-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'cart-modal-overlay';
      overlay.innerHTML = `
        <div class="cart-modal">
          <div class="cart-modal-header">
            <h3>购物车</h3>
            <button class="cart-close" aria-label="关闭">&times;</button>
          </div>
          <div class="cart-modal-body"></div>
          <div class="cart-modal-footer"></div>
        </div>`;
      document.body.appendChild(overlay);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.classList.contains('cart-close')) {
          overlay.classList.remove('show');
        }
      });
    }
    renderCartModal();
    overlay.classList.add('show');
  }

  function renderCartModal() {
    const cart = getCart();
    const body = document.querySelector('.cart-modal-body');
    const footer = document.querySelector('.cart-modal-footer');
    if (!body || !footer) return;

    if (cart.length === 0) {
      body.innerHTML = '<div class="cart-empty">购物车是空的<br>去产品中心挑选商品吧</div>';
      footer.innerHTML = '';
      return;
    }

    body.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <div class="price">${item.price}</div>
        </div>
        <div class="cart-item-qty">
          <button data-action="minus" data-id="${item.id}">−</button>
          <span>${item.qty}</span>
          <button data-action="plus" data-id="${item.id}">+</button>
        </div>
        <button class="cart-item-remove" data-action="remove" data-id="${item.id}" title="删除">×</button>
      </div>
    `).join('');

    footer.innerHTML = `
      <div class="cart-total">
        <span>共 ${cart.reduce((s, i) => s + i.qty, 0)} 件</span>
        <span>提交订单</span>
      </div>
      <button class="btn" id="cart-checkout-btn" style="width:100%;">立即提交</button>
    `;

    body.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === 'plus') changeQty(id, 1);
        else if (action === 'minus') changeQty(id, -1);
        else if (action === 'remove') removeFromCart(id);
      });
    });

    const checkoutBtn = document.getElementById('cart-checkout-btn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', () => { window.location.href = 'checkout.html'; });
  }

  // 绑定全局
  window.YunhongCart = {
    add: addToCart,
    open: openCartModal,
    get: getCart,
    updateCount: updateCartCount
  };

  // 页面加载
  document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();

    // 购物车按钮
    document.querySelectorAll('.cart-btn').forEach(btn => {
      btn.addEventListener('click', openCartModal);
    });

    // 加入购物车按钮
    document.querySelectorAll('[data-add-cart]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.dataset.id || btn.dataset.addCart;
        const name = btn.dataset.name || '商品';
        const price = btn.dataset.price || '询价';
        addToCart(id, name, price);
      });
    });

    // 询价表单
    const form = document.getElementById('inquiry-form');
    if (form) {
      // 预填购物车内容
      const prefill = sessionStorage.getItem('yunhong_inquiry_prefill');
      if (prefill) {
        const textarea = form.querySelector('[name="message"]');
        if (textarea) textarea.value = prefill;
        sessionStorage.removeItem('yunhong_inquiry_prefill');
      }

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.querySelector('[name="name"]').value.trim();
        const phone = form.querySelector('[name="phone"]').value.trim();
        const email = form.querySelector('[name="email"]').value.trim();
        const message = form.querySelector('[name="message"]').value.trim();

        if (!name || !phone) {
          showToast('请填写姓名和电话');
          return;
        }

        // 构造邮件内容
        const subject = encodeURIComponent('网站询价 - ' + name);
        const body = encodeURIComponent(
          `姓名：${name}\n电话：${phone}\n邮箱：${email || '未填写'}\n\n询价内容：\n${message}`
        );
        const mailto = `mailto:vicent@youyang168.com?subject=${subject}&body=${body}`;

        // 显示成功提示
        const success = form.querySelector('.form-success');
        if (success) success.classList.add('show');

        // 尝试打开邮件客户端
        window.location.href = mailto;

        showToast('正在打开邮件客户端...');
      });
    }
  });
})();

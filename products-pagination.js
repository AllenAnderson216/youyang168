(() => {
  const grid = document.querySelector('.product-grid');
  if (!grid) return;

  const products = [...grid.querySelectorAll('.product-card')];
  const pageSize = 6;
  const pageCount = Math.ceil(products.length / pageSize);
  if (pageCount <= 1) return;

  let page = 1;
  const style = document.createElement('style');
  style.textContent = `
    .product-pagination{display:flex;align-items:center;justify-content:center;gap:10px;margin:28px auto 0}
    .product-pagination button{min-width:40px;height:40px;padding:0 13px;border:1px solid #e5ded6;border-radius:9px;background:#fff;color:#51483f;font:inherit;cursor:pointer}
    .product-pagination button:hover{border-color:#b8845a;color:#9c6b43}
    .product-pagination button[aria-current="page"]{border-color:#b8845a;background:#b8845a;color:#fff}
    .product-pagination button:disabled{opacity:.45;cursor:not-allowed}
    .product-pagination .product-page-status{min-width:110px;color:#7a736c;text-align:center;font-size:13px}
    .product-card[hidden]{display:none!important}
    @media(max-width:480px){.product-pagination{gap:6px}.product-pagination button{min-width:36px;height:36px;padding:0 9px}}
  `;
  document.head.append(style);

  const nav = document.createElement('nav');
  nav.className = 'product-pagination';
  nav.setAttribute('aria-label', '产品分页');
  nav.innerHTML = '<button type="button" data-product-prev>上一页</button><span class="product-pages"></span><span class="product-page-status" aria-live="polite"></span><button type="button" data-product-next>下一页</button>';
  grid.insertAdjacentElement('afterend', nav);

  const pageButtons = nav.querySelector('.product-pages');
  pageButtons.style.display = 'flex';
  pageButtons.style.gap = '6px';
  for (let index = 1; index <= pageCount; index++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(index);
    button.dataset.productPage = String(index);
    button.setAttribute('aria-label', `第 ${index} 页`);
    pageButtons.append(button);
  }

  function render() {
    products.forEach((product, index) => {
      product.hidden = index < (page - 1) * pageSize || index >= page * pageSize;
    });
    pageButtons.querySelectorAll('button').forEach(button => {
      if (Number(button.dataset.productPage) === page) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    nav.querySelector('[data-product-prev]').disabled = page === 1;
    nav.querySelector('[data-product-next]').disabled = page === pageCount;
    nav.querySelector('.product-page-status').textContent = `第 ${page} / ${pageCount} 页 · 共 ${products.length} 件商品`;
  }

  nav.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-product-prev')) page = Math.max(1, page - 1);
    else if (button.hasAttribute('data-product-next')) page = Math.min(pageCount, page + 1);
    else if (button.dataset.productPage) page = Number(button.dataset.productPage);
    render();
    grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  render();
})();

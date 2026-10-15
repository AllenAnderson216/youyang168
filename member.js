/* 会员入口：在导航栏显示 登录/注册 或 我的订单 */
(function () {
  function inject(m) {
    var nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('[data-member]')) return;
    var a = document.createElement('a');
    a.setAttribute('data-member', '1');
    if (m && m.loggedIn) { a.href = 'account.html'; a.textContent = '我的订单'; }
    else { a.href = 'login.html'; a.textContent = '登录/注册'; }
    nav.appendChild(a);
  }
  fetch('/api/me', { cache: 'no-store' }).then(function (r) { return r.json(); })
    .then(inject).catch(function () { inject(null); });
})();

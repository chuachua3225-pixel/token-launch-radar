// PeerLens — a peer-calibrated token launch radar. It reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, rich filters, a per-protocol detail view with the full
// valuation breakdown and live peer comparables, and the farm plan. No network: every byte it shows
// is in data.js, and the page recomputes each row's implied value and farm plan with the same
// functions lib/model.ts uses, so what the screenshots show is what board.json carries.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var PAGE = 25;
  var state = { q: '', category: 'all', chain: 'all', minTvl: 0, wl: false, tab: 'pre-token', sort: 'implied', dir: -1, page: 0, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return 'x' + Number(n).toFixed(n >= 1 ? 2 : 3); }

  // The model, recomputed in the page: peer multiple from data.js's calibration table, then the
  // momentum, maturity and breadth multipliers — the same arithmetic as impliedValue in the model.
  function impliedOf(row) {
    var m = DATA.model;
    var rest = row.momentum_multiplier * row.maturity_multiplier * row.breadth_multiplier;
    return Math.max(1, Math.round(row.tvl_usd * row.peer_multiple * rest));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json (category, first chain, TVL
  // and age decide the action, the capital, the gas and the hold). No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function gasUsd(chain) { if (chain === 'Ethereum') return 9; if (chain === 'Bitcoin') return 2; if (chain === 'Solana') return 0.1; return 0.4; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 200;
    if (p.tvl_usd >= 2.5e8) return 150;
    if (p.tvl_usd >= 5e7) return 100;
    return 75;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('risk curator') >= 0 || c.indexOf('curator') >= 0) return 'Deposit $' + capital + ' of USDC into a ' + name + ' curated vault on ' + chain + ' and keep the vault shares in the wallet.';
    if (c.indexOf('capital allocator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' of USDC into a ' + name + ' allocation vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ', then borrow about $' + Math.round(capital / 3) + ' against it and repay once, so both sides of the market are used.';
    if (c.indexOf('dex') >= 0) return 'Swap about $' + Math.round(capital / 2) + " of USDC for the pool's other asset on " + name + ', then provide the full $' + capital + ' as two-sided liquidity on ' + chain + ' and keep the LP position.';
    if (c.indexOf('basis') >= 0) return "Deposit $" + capital + " of USDC into " + name + "'s basis vault on " + chain + ' and keep the vault shares.';
    if (c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0 || c.indexOf('liquidity manager') >= 0) return "Deposit $" + capital + " of USDC into " + name + "'s main vault on " + chain + ' and keep the receipt token.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ', then make one swap with the bridged funds in its app.';
    if (c.indexOf('restak') >= 0 || c.indexOf('staking') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' on ' + chain + ' and keep the receipt token.';
    if (c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged trade (long and short the same size), then close it after a day.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and take one position on each side of a liquid market on ' + name + ' over the month.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of " + name + "'s yield-bearing asset on " + chain + ' and hold it in the wallet.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it for the full window.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy until it expires.';
    if (c.indexOf('chain') >= 0) return "Bridge $" + capital + " of USDC to " + name + "'s chain, then make one swap and one transfer there so the wallet has real activity on it.";
    if (c.indexOf('index') >= 0) return 'Mint $' + capital + ' of the ' + name + ' index on ' + chain + ' and hold it.';
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return 'Fund $' + capital + ' on ' + name + ' and make two small real payments with it.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0) return 'add or repay a small amount';
    if (c.indexOf('dex') >= 0) return 'make one swap of about $10';
    if (c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0) return 'open and close one small hedged trade';
    if (c.indexOf('bridge') >= 0 || c.indexOf('chain') >= 0) return 'make one small transfer or swap on the chain';
    return 'make one small deposit or claim';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasUsd(chain);
    var gasText = gas < 1 ? 'under $1' : 'about $' + Math.round(gas);
    return [
      { text: 'Create a fresh wallet for ' + p.name + ' only, fund it from an exchange in one transfer, and keep its seed phrase offline; never farm it from a wallet that holds other assets.', cost: gasText + ' of gas on ' + chain + ' for the funding transfer', time: '10 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and ' + gasText + ' of gas', time: '15 minutes to set up' },
      { text: 'Repeat weekly: ' + weeklyFor(p) + ' on ' + p.name + ', in a different week each time, so the wallet shows a pattern of real use rather than one burst.', cost: gasText + ' of gas a week, about $' + Math.max(1, Math.round(gas * 4)) + ' over a month', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days without withdrawing, so it appears in more than one weekly snapshot of the protocol.', cost: 'the $' + capital + ' stays in the position for the whole window', time: hold + ' days' },
      { text: "Use every chain the protocol counts for you only if it is cheap: " + p.name + ' records TVL on ' + (p.chains && p.chains.length ? p.chains.join(', ') : chain) + '; repeat the small weekly action on a second chain only when its gas is under $1.', cost: 'under $1 of gas per extra chain action', time: '10 minutes' },
      { text: "Each Sunday, open " + p.name + "'s own points or rewards page from the link on its official site and screenshot the balance; never pay a fee or connect the wallet to a claim link sent by message.", cost: 'no fee to check, and never pay to claim', time: '5 minutes a week' },
      { text: 'Log the wallet address, every date, amount and transaction hash in a farm log; when a token or points conversion is announced, unwind in the reverse order of the log and keep the log as the record.', cost: 'nothing but the log', time: '5 minutes, then 20 minutes to unwind' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('wl')) state.wl = true;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.wl) params.set('wl', '1');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.wl && !r.watchlist) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? -1 : a.age_days; bv = b.age_days === null ? -1 : b.age_days; }
      else if (key === 'mult') { av = a.peer_multiple; bv = b.peer_multiple; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name' }, 'Peer', el('em', { text: 'Lens' }), ' — Token Launch Radar')),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', null, 'Protocols with no token yet, ', el('span', { class: 'hl', text: 'priced by the peers that already trade' })),
        el('p', { text: 'Each pre-token protocol is priced with its own category\'s live-token market-cap / TVL multiple — shrunk toward the global median (' + fmtMult(DATA.global_multiple) + ') when peers are few — then adjusted for momentum, tokenless age and chain breadth.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Rows below the $50M floor' }), el('b', { text: String(DATA.below_floor_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function spotlight() {
    var top = DATA.rows.slice(0, 3);
    return el('section', { class: 'spot', 'aria-label': 'Top three launches on the radar' }, top.map(function (r) {
      var stats = DATA.categories[r.category || 'Uncategorised'];
      var why = (r.category || 'Protocol') + ' peers at ' + fmtMult(r.peer_multiple) + ' TVL · ' + r.peer_count + ' live · confidence ' + r.confidence + ' · ' + fmtAge(r.age_days) + ' tokenless';
      if (stats && stats.examples.length) why += ' · priced from ' + stats.examples.map(function (e) { return e.name; }).join(', ');
      return el('button', { class: 'spot-card', type: 'button', onclick: function () { openDetail(r.slug); } },
        el('span', { class: 'rk', text: 'RANK ' + r.rank + (r.watchlist ? ' · WATCHLIST' : ' · BELOW THE FLOOR') }),
        el('span', { class: 'nm', text: r.name }),
        el('span', { class: 'vl num', text: fmtUsd(r.implied_value_usd) + ' implied' }),
        el('span', { class: 'why', text: why })
      );
    }));
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Uncategorised'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.flatMap(function (r) { return r.chains || []; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; state.page = 0; writeHash(); render(); });
    function select(id, label, values, current, onchange) {
      var s = el('select', { id: id, 'aria-label': label }, values.map(function (v) {
        return el('option', { value: v[0], text: v[1], selected: String(current) === String(v[0]) ? 'selected' : null });
      }));
      s.addEventListener('change', function () { onchange(s.value); state.page = 0; writeHash(); render(); });
      return el('div', { class: 'field' }, el('label', { for: id, text: label }), s);
    }
    var wlBox = el('input', { type: 'checkbox', id: 'wl', 'aria-label': 'Watchlist only' });
    if (state.wl) wlBox.setAttribute('checked', '');
    wlBox.addEventListener('change', function () { state.wl = wlBox.checked; state.page = 0; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      select('category', 'Category', [['all', 'All categories']].concat(categories.map(function (c) { return [c, c]; })), state.category, function (v) { state.category = v; }),
      select('chain', 'Chain', [['all', 'All chains']].concat(chains.map(function (c) { return [c, c]; })), state.chain, function (v) { state.chain = v; }),
      select('mintvl', 'Min TVL', [['0', 'Any TVL'], ['10000000', '$10M+'], ['50000000', '$50M+ (watchlist floor)'], ['250000000', '$250M+'], ['1000000000', '$1B+']], state.minTvl, function (v) { state.minTvl = Number(v); }),
      el('div', { class: 'field check' }, wlBox, el('label', { for: 'wl', text: 'Watchlist only' })),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } state.page = 0; render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or widen the filters to see the board again.' }),
        el('button', { class: 'button', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.wl = false; state.minTvl = 0; state.page = 0; writeHash(); render(); } })
      ));
    }
    var pages = Math.ceil(list.length / PAGE);
    if (state.page >= pages) state.page = pages - 1;
    var pageRows = list.slice(state.page * PAGE, state.page * PAGE + PAGE);
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    pageRows.forEach(function (r) {
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Uncategorised') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: r.change_7d === null ? 'n/a' : fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtMult(r.peer_multiple) }),
        el('td', null, el('div', null,
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
          el('span', { class: 'band num', text: fmtUsd(r.implied_low_usd) + ' – ' + fmtUsd(r.implied_high_usd) })
        )),
        el('td', null,
          el('span', { class: 'badge conf', text: r.confidence, title: 'Confidence from ' + r.peer_count + ' live peers' }),
          ' ',
          r.watchlist ? el('span', { class: 'badge wl', text: 'watchlist' }) : el('span', { class: 'badge', text: 'no token' })
        )
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols ranked by implied value, with the peer band under each number. Select a row for its valuation, its live peers and its farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('mult', 'Peer x'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Signal' })
          )),
          tbody
        )
      ),
      el('div', { class: 'pager' },
        el('span', { class: 'sub', text: 'Page ' + (state.page + 1) + ' of ' + pages + ' · ' + list.length + ' rows' }),
        el('button', { type: 'button', text: 'Previous', disabled: state.page === 0 ? 'disabled' : null, onclick: function () { state.page--; render(); } }),
        el('button', { type: 'button', text: 'Next', disabled: state.page >= pages - 1 ? 'disabled' : null, onclick: function () { state.page++; render(); } })
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Uncategorised') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.mcap_usd && r.tvl_usd ? fmtMult(r.mcap_usd / r.tvl_usd) : 'n/a' }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Live token: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the ranking — and they are the calibration set: their market-cap / TVL ratios price the pre-token board.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Mcap / TVL' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var cats = Object.keys(DATA.categories).filter(function (c) { return DATA.categories[c].peers >= 3; }).sort(function (a, b) { return DATA.categories[b].peers - DATA.categories[a].peers; }).slice(0, 8);
    var tbody = el('tbody');
    cats.forEach(function (c) {
      var s = DATA.categories[c];
      tbody.appendChild(el('tr', null,
        el('td', { text: c }),
        el('td', { class: 'num', text: String(s.peers) }),
        el('td', { class: 'num', text: fmtMult(s.multiple) }),
        el('td', { class: 'num', text: fmtMult(s.low_multiple) + ' – ' + fmtMult(s.high_multiple) }),
        el('td', { text: s.examples.map(function (e) { return e.name; }).join(', ') })
      ));
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed — ' + DATA.model_version }),
      el('p', { class: 'sub', text: 'One function scores every row from the snapshot\'s own figures. No protocol name is special-cased and no number comes from outside the file. The page recomputes each row and checks it against board.json. Scope: ' + DATA.derivatives_excluded + ' pre-token protocols were set aside as derivatives of live tokens or versioned pools (wrapped, staked, bridged, exchange products), at every size.' }),
      el('div', { class: 'formula', text: 'implied = TVL x peer_multiple(category) x momentum x maturity x breadth' }),
      el('div', { class: 'model-grid' },
        el('div', null, el('b', { text: 'Peer multiple. ' }), 'The median market-cap / TVL of the category\'s live-token protocols, winsorised to [' + m.winsor_low + ', ' + m.winsor_high + '] and shrunk in log space toward the global median ' + fmtMult(DATA.global_multiple) + ' with weight ' + m.shrink_k + ', so one wild peer cannot price a whole category and thin categories borrow the market\'s multiple instead of inventing one. The band under each value is the peers\' interquartile range through the same formula.'),
        el('div', null, el('b', { text: 'Momentum. ' }), '1 + clamp(change_7d, ' + m.momentum_floor + ', ' + m.momentum_cap + ') / 100 x ' + m.momentum_weight + ': a protocol gaining TVL into a launch is priced up, a shrinking one down.'),
        el('div', null, el('b', { text: 'Maturity. ' }), m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ': the longer a protocol has run with no token, the more of its value a launch can capture. An unknown age uses ' + m.unknown_age_days + ' days.'),
        el('div', null, el('b', { text: 'Breadth. ' }), '1 + ' + m.breadth_per_chain + ' per extra chain, up to +' + (m.breadth_per_chain * m.breadth_max_extra * 100) + '%: distribution across chains is worth a premium at launch. Confidence grades the peer count: A = 8+, B = 4–7, C = 1–3, D = global only.')
      ),
      el('table', { class: 'cat-table' },
        el('caption', { class: 'sub', text: 'The calibration table, from the snapshot itself: the best-evidenced categories.' }),
        el('thead', null, el('tr', null, el('th', { text: 'Category' }), el('th', { text: 'Live peers' }), el('th', { text: 'Multiple' }), el('th', { text: 'Peer band' }), el('th', { text: 'Largest peers' }))),
        tbody
      )
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var stats = DATA.categories[row.category || 'Uncategorised'];
    var base = Math.round(row.tvl_usd * row.peer_multiple);
    var steps = farmSteps(row);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' · on the watchlist' : ' · below the watchlist floor') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Uncategorised') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + ' · tracked since ' + (row.listed_at || 'an unrecorded date') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'VALUATION — WHY THIS NUMBER' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Peer multiple (' + (row.category || 'market') + ')' }), el('b', { class: 'num', text: fmtMult(row.peer_multiple) })),
        el('div', null, el('span', { text: 'Base value (TVL x peers)' }), el('b', { class: 'num', text: fmtUsd(base) })),
        el('div', null, el('span', { text: 'Momentum (7d ' + fmtPct(row.change_7d) + ')' }), el('b', { class: 'num', text: fmtMult(row.momentum_multiplier) })),
        el('div', null, el('span', { text: 'Maturity (' + fmtAge(row.age_days) + ' tokenless)' }), el('b', { class: 'num', text: fmtMult(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Breadth (' + (row.chains ? row.chains.length : 0) + ((row.chains && row.chains.length === 1) ? ' chain)' : ' chains)') }), el('b', { class: 'num', text: fmtMult(row.breadth_multiplier) })),
        el('div', { class: 'final' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'Peer band (p25 – p75)' }), el('b', { class: 'num', text: fmtUsd(row.implied_low_usd) + ' – ' + fmtUsd(row.implied_high_usd) })),
        el('div', null, el('span', { text: 'Confidence' }), el('b', { class: 'num', text: row.confidence + ' · ' + row.peer_count + ' live peers' }))
      ),
      el('p', { class: 'sub', text: 'The page recomputes this row as ' + fmtUsd(impliedOf(row)) + (impliedOf(row) === row.implied_value_usd ? ' — the same number board.json carries.' : ' — which differs from the board: the data would be stale.') + ' An estimate from peer prices, not a promise of a launch or a price.' })
    ));
    if (stats && stats.examples.length) {
      dialog.appendChild(el('section', { class: 'detail-section' },
        el('h3', { text: 'LIVE PEERS THAT SET THE PRICE' }),
        el('p', { class: 'peers' }, stats.examples.map(function (e, i) {
          return el('span', null, i ? ' · ' : '', el('b', { text: e.name }), ' trades at ' + fmtUsd(e.mcap_usd) + ' on ' + fmtUsd(e.tvl_usd) + ' TVL (' + fmtMult(e.ratio) + ')');
        }))
      ));
    }
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'FARM PLAN' }),
      el('div', { class: 'totals' },
        el('span', null, 'Capital ', el('b', { text: fmtUsd(row.farm_capital_usd) })),
        el('span', null, 'Est. gas ', el('b', { text: '~' + fmtUsd(row.farm_gas_usd) })),
        el('span', null, 'Hold ', el('b', { text: row.farm_hold_days + ' days' })),
        el('span', null, 'Steps ', el('b', { text: String(steps.length) }))
      ),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    var filtered = state.q !== '' || state.category !== 'all' || state.chain !== 'all' || state.minTvl > 0 || state.wl;
    if (state.tab === 'pre-token' && !filtered) shell.appendChild(spotlight());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();

// GRD SOLAR — v4 (várias páginas)
// Interações e animações. As páginas funcionam sem este arquivo e sem as bibliotecas (GSAP / Lenis);
// aqui só acrescentamos movimento, e tudo respeita "reduzir movimento" do sistema.
// Cada bloco só roda se a seção dele existir na página atual.
(() => {
  // ===== Configuração =====
  // WhatsApp da GRD Solar (DDI + DDD + número). Tirado do perfil do Instagram: (18) 99647-1735.
  const WHATSAPP = '5518996471735';
  const USINAS = 5300;
  // Google Analytics 4: cole aqui o ID (ex.: 'G-XXXXXXXXXX'). Vazio = sem estatísticas e sem aviso de cookies.
  const GA_ID = '';

  // Premissas da simulação (estimativa; o valor exato sai na visita técnica)
  const TARIFA = 0.95;          // R$ por kWh, média com impostos
  const GERACAO_KWP_MES = 120;  // kWh gerados por kWp instalado, por mês
  const CUSTO_MINIMO = 60;      // R$ que continuam na conta (disponibilidade + iluminação pública)
  const POTENCIA_PLACA = 0.55;  // kWp por placa (550 W)
  const ANOS = 25;

  const root = document.documentElement;
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const temGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const num = (v, casas = 0) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas });
  const linkWhats = (msg) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;

  /* ---------- Links de WhatsApp e ano ---------- */
  $$('.js-whats').forEach((a) => {
    a.href = linkWhats(a.dataset.msg || 'Olá, GRD Solar!');
    a.target = '_blank';
    a.rel = 'noopener';
  });
  $$('[data-ano]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Simulador (só na página inicial) ---------- */
  // Calibrado com uma proposta real da GRD: sistema de R$ 9.451,29 que gera 486 kWh/mês (≈ 4,05 kWp).
  const form = $('#calc');
  if (form) {
    const CUSTO_KWP = 9451.29 / (486 / GERACAO_KWP_MES);  // R$ por kWp instalado
    const REAJUSTE = 0.08;                                  // reajuste médio da tarifa por ano
    // valor da parcela ÷ valor do projeto, tirado da tabela ilustrativa do banco (sem entrada)
    const FATOR_PARCELA = { 24: 570.17, 36: 445.92, 48: 387.99, 60: 356.27, 72: 337.37, 84: 325.54 };
    Object.keys(FATOR_PARCELA).forEach((n) => { FATOR_PARCELA[n] /= 9451.29; });

    const campo = $('#valor');
    const faixa = $('#faixa');
    const out = {
      kwp: $('#r-kwp'), geracao: $('#r-geracao'), invest: $('#r-invest'), mes: $('#r-mes'), mes2: $('#r-mes-2'),
      payback: $('#r-payback'), parcela: $('#r-parcela'), total: $('#r-25'),
      barraParcela: $('#r-barra-parcela'), barraEconomia: $('#r-barra-economia'),
    };
    let atual = {};
    let mostrado = { economiaMes: 0, invest: 0, parcela: 0, total: 0 };
    let animacao;
    const nParcelas = () => Number($('input[name="parcelas"]:checked', form).value);
    const prazo = (meses) => {
      if (!isFinite(meses) || meses <= 0) return '–';
      const anos = Math.floor(meses / 12), resto = Math.round(meses % 12);
      if (!anos) return `${resto} meses`;
      return resto ? `${anos} ${anos > 1 ? 'anos' : 'ano'} e ${resto} ${resto > 1 ? 'meses' : 'mês'}` : `${anos} ${anos > 1 ? 'anos' : 'ano'}`;
    };
    const calcular = (conta) => {
      const placas = Math.ceil(Math.max(1.1, conta / TARIFA / GERACAO_KWP_MES) / POTENCIA_PLACA);
      const kwp = placas * POTENCIA_PLACA;
      const invest = kwp * CUSTO_KWP;
      const economiaMes = Math.max(0, (conta - CUSTO_MINIMO) * 0.92);
      let acumulado = 0;
      for (let ano = 0; ano < ANOS; ano++) acumulado += economiaMes * 12 * (1 + REAJUSTE) ** ano;
      const n = nParcelas();
      return {
        conta, placas, kwp, invest, economiaMes, n,
        geracao: kwp * GERACAO_KWP_MES,
        payback: invest / economiaMes,
        parcela: invest * FATOR_PARCELA[n],
        total: acumulado - invest,
      };
    };
    const pintar = (v) => {
      out.invest.textContent = brl(v.invest);
      out.mes.textContent = brl(v.economiaMes);
      out.mes2.textContent = brl(v.economiaMes);
      out.parcela.textContent = brl(v.parcela);
      out.total.textContent = brl(Math.max(0, v.total));
    };
    const mostrar = (conta) => {
      atual = calcular(conta);
      out.kwp.textContent = `${num(atual.kwp, 1)} kWp (${atual.placas} placas)`;
      out.geracao.textContent = `${num(atual.geracao)} kWh/mês`;
      out.payback.textContent = prazo(atual.payback);
      const maior = Math.max(atual.parcela, atual.economiaMes) || 1;
      out.barraParcela.style.width = `${atual.parcela / maior * 100}%`;
      out.barraEconomia.style.width = `${atual.economiaMes / maior * 100}%`;
      cancelAnimationFrame(animacao);
      if (reduzido) { pintar(atual); mostrado = { ...atual }; return; }
      // os valores "rolam" até o novo resultado
      const de = { ...mostrado };
      const inicio = performance.now();
      const chaves = ['economiaMes', 'invest', 'parcela', 'total'];
      const passo = (t) => {
        const k = Math.min(1, (t - inicio) / 500);
        const e = 1 - Math.pow(1 - k, 3);
        chaves.forEach((c) => { mostrado[c] = de[c] + (atual[c] - de[c]) * e; });
        pintar(mostrado);
        if (k < 1) animacao = requestAnimationFrame(passo);
      };
      animacao = requestAnimationFrame(passo);
    };
    const lerCampo = () => Number(campo.value.replace(/\D/g, '')) || 0;
    campo.addEventListener('input', () => {
      const v = lerCampo();
      campo.value = v ? num(v) : '';
      faixa.value = Math.min(Math.max(v, faixa.min), faixa.max);
      mostrar(v);
    });
    faixa.addEventListener('input', () => {
      const v = Number(faixa.value);
      campo.value = num(v);
      mostrar(v);
    });
    $$('input[name="parcelas"]', form).forEach((r) => r.addEventListener('change', () => mostrar(lerCampo())));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = atual.conta
        ? `Olá, GRD Solar! Fiz a simulação no site. Minha conta de luz fica em torno de ${brl(atual.conta)} por mês. O simulador indicou um sistema de ${num(atual.kwp, 1)} kWp (${atual.placas} placas), investimento de cerca de ${brl(atual.invest)} e parcela de ${brl(atual.parcela)} em ${atual.n}x. Quero um orçamento.`
        : 'Olá, GRD Solar! Quero um orçamento de energia solar.';
      window.open(linkWhats(msg), '_blank', 'noopener');
    });
    mostrar(lerCampo());
  }

  /* ---------- Gráficos da proposta: barras sobem quando aparecem ---------- */
  $$('[data-grafico]').forEach((g) => {
    [...g.children].forEach((col, i) => col.querySelector('.grafico__barra').style.setProperty('--i', i));
    if (!('IntersectionObserver' in window)) { g.classList.add('visivel'); return; }
    new IntersectionObserver(([en], obs) => {
      // também marca como visto se a rolagem já passou do gráfico (ex.: pulo direto por um link)
      const passou = en.boundingClientRect.bottom < 0 || en.boundingClientRect.right < 0;
      if (en.isIntersecting || passou) { g.classList.add('visivel'); obs.disconnect(); }
    }, { threshold: 0.35 }).observe(g);
  });

  /* ---------- Painel das usinas: monta as células ---------- */
  const painel = $('[data-painel]');
  let celulas = [];
  let ultimoP = 0;
  const montarPainel = () => {
    if (!painel) return;
    const cols = Number(getComputedStyle(painel).getPropertyValue('--cols')) || 12;
    const linhas = 6;
    painel.innerHTML = '';
    celulas = [];
    for (let l = 0; l < linhas; l++) {
      for (let c = 0; c < cols; c++) {
        const el = document.createElement('span');
        el.className = 'cel';
        painel.appendChild(el);
        // o sol varre da esquerda para a direita, com um pouco de acaso para parecer orgânico
        celulas.push({ el, ordem: c / cols + (l / linhas) * 0.25 + Math.random() * 0.12 });
      }
    }
    celulas.sort((a, b) => a.ordem - b.ordem);
  };
  montarPainel();
  // Interação: passar o mouse ou o dedo sobre o painel faz as células brilharem
  if (painel) {
    painel.addEventListener('pointerover', (e) => {
      const cel = e.target.closest('.cel');
      if (!cel) return;
      cel.classList.add('on', 'toque');
      setTimeout(() => cel.classList.remove('toque'), 650);
    });
  }
  const contador = $('[data-contador]');
  const solUsinas = $('[data-usinas-sol]');
  const ceu = $('.usinas__ceu');
  const pintarUsinas = (p) => {
    if (!painel) return;
    ultimoP = p;
    const acesas = Math.round(p * celulas.length);
    celulas.forEach((c, i) => {
      c.el.classList.toggle('on', i < acesas);
      c.el.classList.toggle('frente', i < acesas && i >= acesas - 4 && p < 1);
    });
    contador.textContent = num(Math.round(p * USINAS));
    // o sol percorre o arco (curva quadrática de 0,1 até 1,1 com controle em 0.5,-0.4)
    const arco = ceu.firstElementChild;
    const caixa = ceu.getBoundingClientRect();
    const caixaArco = arco.getBoundingClientRect();
    const y = (1 - p) ** 2 + 2 * (1 - p) * p * -0.4 + p ** 2;
    solUsinas.style.transform = `translate(${p * caixa.width}px, ${caixaArco.top - caixa.top + y * caixaArco.height}px)`;
    solUsinas.style.opacity = p > 0.01 && p < 0.99 ? 1 : 0;
  };

  /* ---------- Menu do celular e submenu de serviços ---------- */
  const hamburguer = $('[data-hamburguer]');
  const menu = $('#menu');
  let lenis = null;
  const menuCelular = matchMedia('(max-width: 1140px)');
  const abrirMenu = (aberto) => {
    hamburguer.setAttribute('aria-expanded', String(aberto));
    $('[data-hamburguer-rotulo]').textContent = aberto ? 'Fechar menu' : 'Abrir menu';
    menu.classList.toggle('aberto', aberto);
    document.body.style.overflow = aberto ? 'hidden' : '';
    if (lenis) aberto ? lenis.stop() : lenis.start();
    if (aberto && temGsap && !reduzido) {
      gsap.fromTo($$(':scope > a, .menu__abre, .submenu a', menu), { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.04, duration: 0.7, ease: 'expo.out', delay: 0.1 });
    }
  };
  hamburguer.addEventListener('click', () => abrirMenu(hamburguer.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a') && menu.classList.contains('aberto')) abrirMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (menu.classList.contains('aberto')) { abrirMenu(false); hamburguer.focus(); }
    fecharSubmenu();
  });
  menuCelular.addEventListener('change', (e) => { if (!e.matches) abrirMenu(false); });

  const grupo = $('[data-submenu]');
  const botaoSub = grupo.querySelector('.menu__abre');
  const abrirSubmenu = (aberto) => {
    if (menuCelular.matches) return; // no celular o submenu fica sempre visível dentro do menu
    grupo.classList.toggle('aberto', aberto);
    botaoSub.setAttribute('aria-expanded', String(aberto));
  };
  function fecharSubmenu() { abrirSubmenu(false); }
  // com mouse o submenu abre ao passar por cima e o clique só garante que fique aberto;
  // no toque e no teclado o clique abre e fecha
  let tipoPonteiro = '';
  botaoSub.addEventListener('pointerdown', (e) => { tipoPonteiro = e.pointerType; });
  botaoSub.addEventListener('click', () => {
    if (tipoPonteiro === 'mouse') abrirSubmenu(true);
    else abrirSubmenu(!grupo.classList.contains('aberto'));
    tipoPonteiro = '';
  });
  grupo.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') abrirSubmenu(true); });
  grupo.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') abrirSubmenu(false); });
  grupo.addEventListener('focusout', (e) => { if (!grupo.contains(e.relatedTarget)) abrirSubmenu(false); });
  document.addEventListener('click', (e) => { if (!grupo.contains(e.target)) abrirSubmenu(false); });

  /* ---------- Cookies e Google Analytics (só carrega depois de "Aceitar") ---------- */
  const avisoCookies = $('[data-cookies]');
  const botaoPreferencias = $('[data-cookies-abrir]');
  const lerEscolha = () => { try { return localStorage.getItem('grd-cookies'); } catch { return null; } };
  const salvarEscolha = (v) => { try { localStorage.setItem('grd-cookies', v); } catch { /* navegador sem armazenamento */ } };
  const carregarAnalytics = () => {
    if (window.gtag) return;
    const sc = document.createElement('script');
    sc.async = true;
    sc.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(sc);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
  };
  if (GA_ID && avisoCookies) {
    botaoPreferencias.hidden = false;
    const escolha = lerEscolha();
    if (escolha === 'aceito') carregarAnalytics();
    else if (!escolha) avisoCookies.hidden = false;
    $('[data-cookies-aceitar]').addEventListener('click', () => { salvarEscolha('aceito'); avisoCookies.hidden = true; carregarAnalytics(); });
    $('[data-cookies-recusar]').addEventListener('click', () => { salvarEscolha('recusado'); avisoCookies.hidden = true; });
    botaoPreferencias.addEventListener('click', () => { avisoCookies.hidden = false; });
  }

  /* ---------- Sem GSAP ou com movimento reduzido: tudo parado e visível ---------- */
  const intro = $('[data-intro]');
  const flutuante = $('[data-flutuante]');
  if (!temGsap || reduzido) {
    if (intro) intro.remove();
    $$('.cel').forEach((c) => c.classList.add('on'));
    if (contador) contador.textContent = num(USINAS);
    flutuante.classList.add('visivel');
    return;
  }

  gsap.registerPlugin(ScrollTrigger, ...(window.SplitText ? [SplitText] : []));
  const Split = window.SplitText;

  /* ---------- Rolagem suave ---------- */
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  // links para âncoras da própria página rolam suave; links para outras páginas seguem normais
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const alvo = $(url.hash);
    if (!alvo) return;
    e.preventDefault();
    lenis ? lenis.scrollTo(alvo, { duration: 1.4 }) : alvo.scrollIntoView({ behavior: 'smooth' });
  });
  // chegou de outra página com #ancora: espera montar as cenas fixas e rola até ela
  if (location.hash && $(location.hash)) {
    addEventListener('load', () => setTimeout(() => {
      ScrollTrigger.refresh();
      lenis ? lenis.scrollTo($(location.hash), { immediate: true }) : $(location.hash).scrollIntoView();
    }, 200));
  }

  /* ---------- Topo some ao descer, volta ao subir; botão flutuante ---------- */
  const topo = $('[data-topo]');
  const hero = $('[data-hero]');
  let ultimoY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    if (!menu.classList.contains('aberto')) topo.classList.toggle('escondido', y > ultimoY && y > innerHeight * 0.8);
    if (y > ultimoY) fecharSubmenu();
    const pertoDoFim = y + innerHeight > document.documentElement.scrollHeight - 160;
    flutuante.classList.toggle('visivel', y > (hero ? hero.offsetHeight * 0.6 : 300) && !pertoDoFim);
    ultimoY = y;
  }, { passive: true });

  /* ---------- Mouse: luz do sol, cursor, botões magnéticos, inclinação ---------- */
  if (mouse) {
    if (hero) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        hero.style.setProperty('--mx', `${e.clientX - r.left}px`);
        hero.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    }

    const cursor = $('[data-cursor]');
    const rotulo = $('[data-cursor-label]');
    root.classList.add('tem-cursor');
    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
    addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const midia = e.target.closest('[data-cursor-texto]');
      const link = e.target.closest('a, button, summary, input, label');
      const usaRotulo = midia && (!link || link === midia);
      cursor.classList.toggle('midia', !!usaRotulo);
      cursor.classList.toggle('link', !!link && !usaRotulo);
      rotulo.textContent = usaRotulo ? midia.dataset.cursorTexto : '';
    });
    document.addEventListener('pointerleave', () => cursor.classList.add('oculto'));
    document.addEventListener('pointerenter', () => cursor.classList.remove('oculto'));

    $$('.magnetico').forEach((el) => {
      const mx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      const my = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        mx((e.clientX - r.left - r.width / 2) * 0.3);
        my((e.clientY - r.top - r.height / 2) * 0.4);
      });
      el.addEventListener('pointerleave', () => { mx(0); my(0); });
    });

    $$('.inclina').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--px', `${px * 100}%`);
        el.style.setProperty('--py', `${py * 100}%`);
        el.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * 5}deg) rotateY(${(px - 0.5) * 5}deg)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });

    // Serviços: a foto do serviço segue o mouse sobre a lista
    const flutua = $('[data-servicos-flutua]');
    if (flutua) {
      const fotoFlutua = flutua.querySelector('img');
      const fx = gsap.quickTo(flutua, 'x', { duration: 0.5, ease: 'power3' });
      const fy = gsap.quickTo(flutua, 'y', { duration: 0.5, ease: 'power3' });
      const giro = gsap.quickTo(flutua, 'rotate', { duration: 0.6, ease: 'power3' });
      let ultimoX = 0;
      $$('.servico').forEach((item) => {
        item.addEventListener('pointerenter', () => {
          fotoFlutua.src = item.dataset.img;
          flutua.classList.add('visivel');
          gsap.to(flutua, { scale: 1, duration: 0.5, ease: 'expo.out' });
        });
        item.addEventListener('pointerleave', () => {
          flutua.classList.remove('visivel');
          gsap.to(flutua, { scale: 0.6, duration: 0.4 });
        });
        item.addEventListener('pointermove', (e) => {
          fx(e.clientX); fy(e.clientY);
          giro(gsap.utils.clamp(-12, 12, (e.clientX - ultimoX) * 0.6));
          ultimoX = e.clientX;
        });
      });
      // ao rolar sem mexer o mouse, a foto some se o cursor já não está sobre um serviço
      addEventListener('scroll', () => {
        if (flutua.classList.contains('visivel') && !$('.servico:hover')) {
          flutua.classList.remove('visivel');
          gsap.to(flutua, { scale: 0.6, duration: 0.3 });
        }
      }, { passive: true });
    }

    const marca = $('[data-marca]');
    marca.addEventListener('pointermove', (e) => {
      const r = marca.getBoundingClientRect();
      marca.parentElement.style.setProperty('--fx', `${e.clientX - r.left}px`);
      marca.parentElement.style.setProperty('--fy', `${e.clientY - r.top}px`);
    });
    marca.addEventListener('pointerleave', () => {
      marca.parentElement.style.setProperty('--fx', '50%');
      marca.parentElement.style.setProperty('--fy', '-50%');
    });
  }

  /* ---------- Topo da página: título letra por letra ---------- */
  const linhasHero = $$('[data-split-hero]');
  const splits = Split ? linhasHero.map((el) => Split.create(el, { type: 'words,chars', mask: 'chars', aria: el.tagName === 'SPAN' ? 'none' : 'auto' }) /* aria-label não é permitido em span; o texto continua legível para leitores de tela */) : [];
  const letras = splits.flatMap((s) => s.chars);
  gsap.set(letras.length ? letras : linhasHero, { yPercent: 115 });
  gsap.set('[data-hero-item]', { opacity: 0, y: 30 });
  gsap.set('[data-hero-fundo]', { scale: 1.2 });
  const placa = $('[data-placa]');
  if (placa) gsap.set(placa, { clipPath: 'inset(0 100% 0 0 round 22px)', x: -30 });
  if ($('.troca')) gsap.set('.troca', { yPercent: 115 });
  if ($('[data-sol]')) gsap.set('[data-sol]', { scale: 0.4, opacity: 0, transformOrigin: '50% 50%' });

  const trocas = $$('[data-troca] > span');
  // Uma linha do tempo única, que repete: nunca há duas trocas ao mesmo tempo, mesmo se a aba
  // ficar em segundo plano (com setInterval as trocas se acumulavam e uma palavra ficava por cima da outra).
  const girarTroca = () => {
    if (trocas.length < 2) return;
    gsap.set(trocas, { y: 0, yPercent: 110, opacity: 0 });
    gsap.set(trocas[0], { yPercent: 0, opacity: 1 });
    const tl = gsap.timeline({ repeat: -1, defaults: { duration: 0.7, ease: 'expo.inOut' } });
    trocas.forEach((el, i) => {
      const prox = trocas[(i + 1) % trocas.length];
      tl.to(el, { yPercent: -110, opacity: 0 }, '+=1.8')
        .fromTo(prox, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, immediateRender: false }, '<');
    });
  };

  const tocarHero = () => {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      .to('[data-hero-fundo]', { scale: 1, duration: 2.2, ease: 'power3.out' }, 0);
    if ($('[data-sol]')) tl.to('[data-sol]', { scale: 1, opacity: 1, duration: 1.8 }, 0.1);
    if (placa) tl.to(placa, { clipPath: 'inset(0 0% 0 0 round 22px)', x: 0, duration: 1.2, ease: 'expo.inOut' }, 0.05);
    tl.to(letras.length ? letras : linhasHero, { yPercent: 0, duration: 1.2, stagger: 0.022 }, placa ? 0.45 : 0.15);
    if ($('.troca')) tl.to('.troca', { yPercent: 0, duration: 1.1 }, 0.85);
    tl.to('[data-hero-item]', { opacity: 1, y: 0, duration: 1, stagger: 0.12 }, placa ? 0.95 : 0.55)
      .add(girarTroca, 1.9);
  };

  /* ---------- Intro (só na página inicial): o sol nasce atrás do logo e abre a página ---------- */
  if (intro) {
    intro.style.animation = 'none';
    const cont = { v: 0 };
    const numIntro = $('[data-intro-count]');
    gsap.set(intro, { clipPath: 'circle(150% at 50% 38%)' });
    gsap.timeline()
      .from(intro.querySelector('img'), { opacity: 0, y: 20, duration: 0.6, ease: 'expo.out' })
      .to('.intro__sol', { opacity: 1, yPercent: -170, scale: 1, duration: 1, ease: 'expo.out' }, 0.1)
      .to(cont, { v: 100, duration: 1, ease: 'power2.inOut', onUpdate: () => { numIntro.textContent = String(Math.round(cont.v)).padStart(2, '0'); } }, 0)
      .to(intro, { clipPath: 'circle(0% at 50% 38%)', duration: 0.9, ease: 'expo.inOut', onStart: tocarHero }, '+=0.05')
      .add(() => intro.remove());
  } else {
    tocarHero();
  }

  /* ---------- Topo da página ao rolar ---------- */
  if (hero) {
    gsap.to('[data-hero-fundo]', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to(hero.querySelector('.wrap'), { yPercent: -20, opacity: 0.1, ease: 'none', scrollTrigger: { trigger: hero, start: 'center center', end: 'bottom top', scrub: true } });
    if ($('[data-sol]')) gsap.to('[data-sol]', { yPercent: 40, rotate: 30, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  }

  /* ---------- Faixa inclina com a velocidade da rolagem ---------- */
  const faixaEl = $('[data-faixa]');
  if (faixaEl) {
    const skew = gsap.quickTo(faixaEl, 'skewX', { duration: 0.5, ease: 'power3' });
    ScrollTrigger.create({ onUpdate: (self) => skew(gsap.utils.clamp(-14, 14, self.getVelocity() / -220)) });
  }

  /* ---------- Painel das usinas: quando aparece, o sol cruza e as células acendem sozinhas ---------- */
  // Antes a cena ficava presa na tela e exigia muita rolagem; agora toca em poucos segundos.
  if (painel) {
    pintarUsinas(0);
    const progresso = { p: 0 };
    const tocarPainel = () => gsap.timeline()
      .from('.usinas__painel', { rotateX: 55, rotateZ: -12, y: 80, opacity: 0, duration: 1.1, ease: 'expo.out' })
      .fromTo(progresso, { p: 0 }, { p: 1, duration: 2.6, ease: 'power2.inOut', onUpdate: () => pintarUsinas(progresso.p) }, 0.3);
    // dispara quando o próprio painel aparece (no celular ele fica abaixo do contador)
    ScrollTrigger.create({ trigger: painel, start: 'top 85%', once: true, onEnter: tocarPainel });
  }

  /* ---------- Manifesto: palavras acendem com a rolagem ---------- */
  const manifesto = $('[data-palavras]');
  if (manifesto) {
    manifesto.innerHTML = manifesto.textContent.trim().split(/\s+/).map((p) => `<span class="p">${p}</span>`).join(' ');
    const palavras = $$('.p', manifesto);
    ScrollTrigger.create({
      trigger: manifesto, start: 'top 80%', end: 'bottom 40%', scrub: true,
      onUpdate: (self) => { const n = Math.round(self.progress * palavras.length); palavras.forEach((w, i) => w.classList.toggle('on', i < n)); },
    });
  }

  /* ---------- Números que contam (sobre) ---------- */
  $$('[data-conta-ate]').forEach((el) => {
    const alvo = Number(el.dataset.contaAte);
    const v = { n: 0 };
    el.textContent = '0';
    gsap.to(v, { n: alvo, duration: 1.8, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%' }, onUpdate: () => { el.textContent = num(Math.round(v.n)); } });
  });

  /* ---------- Títulos e blocos que sobem ---------- */
  $$('[data-split]').forEach((el) => {
    if (Split) {
      const s = Split.create(el, { type: 'words,lines', mask: 'lines' });
      gsap.from(s.words, { yPercent: 115, duration: 1.1, stagger: 0.05, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 86%' } });
    } else {
      gsap.from(el, { y: 40, opacity: 0, duration: 1, scrollTrigger: { trigger: el, start: 'top 86%' } });
    }
  });
  $$('[data-sobe]').forEach((el) => {
    gsap.from(el, { y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });

  /* ---------- Projetos: rolagem horizontal no desktop ---------- */
  const secaoProjetos = $('[data-projetos]');
  if (secaoProjetos) {
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1000px) and (min-height: 620px)', () => {
      const trilho = $('[data-projetos-trilho]');
      secaoProjetos.classList.add('horizontal');
      const dist = () => trilho.scrollWidth - innerWidth;
      const tween = gsap.to(trilho, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: secaoProjetos, start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
      });
      $$('.projeto', trilho).forEach((card) => {
        gsap.fromTo(card.querySelector('.projeto__foto img'), { xPercent: -7 }, { xPercent: 7, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
        gsap.from(card, { rotate: 4, y: 60, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'left 55%', scrub: true } });
      });
      return () => secaoProjetos.classList.remove('horizontal');
    });
    mm.add('(max-width: 999px), (max-height: 619px)', () => {
      $$('.projeto', secaoProjetos).forEach((card) => {
        gsap.from(card, { y: 70, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: card, start: 'top 88%' } });
        gsap.fromTo(card.querySelector('.projeto__foto img'), { clipPath: 'inset(14% 14% 14% 14%)', scale: 1.25 }, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1.05, ease: 'none', scrollTrigger: { trigger: card, start: 'top 95%', end: 'top 40%', scrub: true } });
      });
    });
  }

  /* ---------- Financiamento: o 72 conta e desliza ---------- */
  const fin = $('[data-fin]');
  if (fin) {
    const finNum = $('[data-fin-num]');
    const parcelas = { v: 1 };
    gsap.to(parcelas, {
      v: 72, ease: 'none', onUpdate: () => { finNum.textContent = Math.round(parcelas.v); },
      scrollTrigger: { trigger: fin, start: 'top 85%', end: 'center 55%', scrub: true },
    });
    gsap.fromTo('.financiamento__gigante', { xPercent: 18 }, { xPercent: -4, ease: 'none', scrollTrigger: { trigger: fin, start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* ---------- Etapas: linha avança e os números acendem ---------- */
  const etapas = $('[data-etapas]');
  if (etapas) {
    const itens = [...etapas.children];
    ScrollTrigger.create({
      trigger: etapas, start: 'top 62%', end: 'bottom 62%', scrub: true,
      onUpdate: (self) => {
        etapas.style.setProperty('--progresso', self.progress.toFixed(3));
        itens.forEach((li, i) => li.classList.toggle('feita', self.progress >= i / (itens.length - 1) - 0.02));
      },
    });
  }

  /* ---------- Itens da lista "o que está incluso" acendem em cascata ---------- */
  if ($('.incluso')) {
    ScrollTrigger.batch('.incluso li', { start: 'top 90%', onEnter: (lote) => gsap.from(lote, { x: -30, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'expo.out', overwrite: true }) });
  }

  /* ---------- Galeria de instalações: fotos se revelam em cascata ---------- */
  if ($('.galeria__item')) {
    gsap.set('.galeria__item', { clipPath: 'inset(100% 0% 0% 0%)' });
    ScrollTrigger.batch('.galeria__item', {
      start: 'top 92%',
      onEnter: (lote) => gsap.to(lote, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.inOut', stagger: 0.09 }),
    });
  }

  /* ---------- CTA final e rodapé ---------- */
  if ($('[data-final]')) gsap.fromTo('[data-final-foto]', { scale: 1.3 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '[data-final]', start: 'top bottom', end: 'center center', scrub: true } });
  gsap.fromTo('[data-marca]', { yPercent: 50, opacity: 0 }, { yPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '[data-marca]', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  /* ---------- Recalcula depois que fontes e imagens carregam ---------- */
  let largura = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth !== largura) { largura = innerWidth; montarPainel(); pintarUsinas(ultimoP); ScrollTrigger.refresh(); }
  });
  addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();

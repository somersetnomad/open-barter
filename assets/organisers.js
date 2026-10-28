// The organisers' guide (#/organisers) and the printable poster (#/poster).
import cfg from '../config.js';
import * as share from './share.js';

export function organiserViews({ rpc, esc, toast, busy, main }) {
  const $ = s => main.querySelector(s);

  async function examples() {
    try {
      const res = await rpc('list_listings', { p_kind: 'offer', p_limit: 30 });
      const seen = new Set();
      return res.items.map(x => x.title).filter(t => !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 4);
    } catch { return []; }
  }

  function messages(url, stats, ex) {
    const exLine = ex.length ? ex.slice(0, 3).join(', ') : 'homemade food, bike repairs and lessons';
    const n = cfg.name;
    return [
      ['WhatsApp or text message',
`Hi! We've started ${n}, a free way to swap things and skills with neighbours. No money needed. You post what you can offer and what you need, and it finds swaps for you, even three-way ones. Have a look: ${url}`],
      ['Post for a Facebook, Nextdoor or local forum group',
`🔄 ${n}: swap, don't shop

Got things you don't use, or skills you could share? ${n} is a free, local swap site run by volunteers. Right now people are offering ${exLine}.

How it works:
• Post what you can offer and what you're looking for
• The site spots matches, including circles where three or more people each get what they want
• Agree the swap, meet up, done. Community ${cfg.creditName} cover the gaps, and no money changes hands

${stats.members ? `${stats.members} neighbours have joined so far. ` : ''}Join here: ${url}

(Admins: happy to remove this if it's not OK for the group.)`],
      ['Noticeboard, newsletter or parish magazine',
`${n} is a free community swap site for local people. Members list things and skills they can offer, such as ${exLine}, and things they need. The site matches people up, including three-way swaps, and uses community ${cfg.creditName} instead of money so everyone can take part. It's run by volunteers and costs nothing to join. Find it at ${share.shortUrl()}.`],
      ['Email asking a library, café or community centre for help',
`Subject: Could you help us spread the word about ${n}?

Hello,

I'm one of the volunteers behind ${n}, a free website where local people swap things and skills without money. It helps people save money, reduces waste and gets neighbours talking.

Would you be willing to put up a poster, or mention us in your newsletter or social media? I can drop off printed posters. They have a QR code, so people can join straight away.

Thank you,
[Your name]
[Your phone or email]
${url}`],
      ['Short press release for local paper or radio',
`FOR IMMEDIATE RELEASE

Neighbours launch free swap site: ${n}

[Your area], [date]: Local volunteers have launched ${n}, a free website where residents swap goods and skills without money. ${cfg.tagline}

Members post what they can offer and what they need. The site then finds matches, including "trade circles" where three or more people each get something they asked for. Community ${cfg.creditName} make up any difference.

"[A sentence from you about why you started it]," said [your name], one of the organisers.

${stats.completed_trades ? `Since launch, members have completed ${stats.completed_trades} swaps. ` : ''}Anyone living locally can join at ${share.shortUrl()}.

Contact: [your name], [phone], [email]`]
    ];
  }

  const organisers = async () => {
    const [stats, ex] = await Promise.all([rpc('community_stats'), examples()]);
    const url = share.siteUrl();
    const msgs = messages(url, stats, ex);
    const sections = [['launch', 'Before you launch'], ['free', 'Free ways to spread the word'], ['posts', 'Ready-made posts'],
      ['print', 'Posters and pictures'], ['keep', 'Keep it growing'], ['care', 'Do it the right way'], ['domain', 'Your own web address']];
    main.innerHTML = `<div class="guide">
    <h1>For organisers</h1>
    <p class="lede-sm">A swap site only works when enough neighbours use it. Here's how to get it going without spending money.</p>
    <nav class="toc" aria-label="On this page">${sections.map(([id, t]) => `<button class="linkbtn" data-jump="${id}">${t}</button>`).join('')}</nav>

    <section id="g-launch"><h2>Before you launch</h2>
      <p>An empty site puts people off. The first visitors need to see plenty already there, so do these in order.</p>
      <ol class="steps">
        <li><b>Set up the site and make yourself a moderator.</b> Ask one or two friends to be moderators too, so it never depends on one person.</li>
        <li><b>Recruit 10 to 20 founding members.</b> Friends, neighbours, people from a club you're in. Ask each to post at least two offers and one want.</li>
        <li><b>Aim for 30 or more listings before you tell anyone else.</b> Mix everyday things (food, lifts, lending tools) with skills (repairs, lessons, tech help).</li>
        <li><b>Do a few real swaps among yourselves.</b> Completed trades and feedback on profiles help newcomers trust it.</li>
        <li><b>Pick a launch date tied to something happening anyway:</b> a fête, a market, a school event or a repair café.</li>
        <li><b>Print posters and line up where they'll go</b> (see below), then launch everything in the same week.</li>
      </ol>
      <p class="notice">Right now: <b>${stats.members}</b> members, <b>${stats.offers}</b> offers, <b>${stats.wants}</b> wants and <b>${stats.completed_trades}</b> completed trades.</p>
    </section>

    <section id="g-free"><h2>Free ways to spread the word</h2>
      <div class="tactics">
        <div><h3>Noticeboards and paper</h3><ul>
          <li>Libraries, community centres, village halls and leisure centres</li>
          <li>Supermarket community boards, laundrettes, corner shops and cafés</li>
          <li>GP surgeries, pharmacies, places of worship and allotment sheds</li>
          <li>School, parish, residents' association and church newsletters</li>
          <li>Tear-off posters: people take the address home with them</li></ul></div>
        <div><h3>Local groups online</h3><ul>
          <li>Facebook community and buy-nothing groups (ask the admin first)</li>
          <li>Nextdoor, local Reddit and forum boards</li>
          <li>WhatsApp groups for streets, schools, clubs and mutual aid</li>
          <li>Your council's or MP's community newsletter</li>
          <li>Share a "swap of the week" picture from a real listing</li></ul></div>
        <div><h3>Face to face</h3><ul>
          <li>A table at fêtes, farmers' markets and car boot sales</li>
          <li>Hold a monthly in-person swap meet. People post their leftovers afterwards</li>
          <li>Talk at a residents' meeting, WI, Men's Shed or PTA</li>
          <li>Partner with repair cafés, tool libraries and community fridges</li>
          <li>Find one "ambassador" per area to recruit their street</li></ul></div>
        <div><h3>Local media</h3><ul>
          <li>Local papers, community radio and hyperlocal news sites want local good-news stories</li>
          <li>Pitch a human story: a three-way swap, or a neighbour who learnt guitar</li>
          <li>Send a short press release (there's one below) with a photo</li>
          <li>Follow up a week later with your numbers</li></ul></div>
      </div>
    </section>

    <section id="g-posts"><h2>Ready-made posts</h2>
      <p class="muted">These use your site's name and address. Copy one, change it to sound like you, and post it.</p>
      <div class="stack">${msgs.map(([title, body], i) => `<div class="panel"><div class="section-head"><h3 style="margin:0">${esc(title)}</h3>
        <button class="btn small" data-copy="${i}">Copy</button></div>
        <textarea class="msgbox" id="msg-${i}" rows="${Math.min(14, body.split('\n').length + 2)}" aria-label="${esc(title)}">${esc(body)}</textarea></div>`).join('')}</div>
    </section>

    <section id="g-print"><h2>Posters and pictures</h2>
      <div class="print-grid">
        <div class="panel stack"><h3 style="margin:0">Printable poster</h3>
          <p class="muted" style="margin:0">A4 poster with a QR code and tear-off strips, filled in with things people are offering right now.</p>
          <a class="btn primary" href="#/poster">Open the poster</a></div>
        <div class="panel stack"><h3 style="margin:0">Square picture for social media</h3>
          <p class="muted" style="margin:0">For Instagram, Facebook and WhatsApp status updates.</p>
          <button class="btn" id="dl-square">Download picture</button></div>
        <div class="panel stack"><h3 style="margin:0">Link preview picture</h3>
          <p class="muted" style="margin:0">The picture that shows when someone pastes your link into Facebook, WhatsApp or X.
            Download it, save it in your copy of the code as <code>assets/social-card.png</code>, and check the address in <code>index.html</code> (see below).</p>
          <button class="btn" id="dl-og">Download link preview</button></div>
      </div>
      <p class="muted small">Every listing also has its own share buttons and a downloadable picture with a QR code. Encourage members to share their own listings in local groups.</p>
    </section>

    <section id="g-keep"><h2>Keep it growing</h2><ul class="rules">
      <li><b>Post regularly, briefly.</b> One "swap of the week" or "wanted this week" picture a week beats a burst of posts.</li>
      <li><b>Celebrate real swaps</b>, with permission from the people involved. Stories travel further than adverts.</li>
      <li><b>Answer every want.</b> If someone asks for something nobody offers, post it in a local group. That's how new members arrive.</li>
      <li><b>Welcome newcomers personally.</b> A short message through a trade or in a group goes a long way.</li>
      <li><b>Run a monthly swap meet</b> at a library or community centre, and help people post what's left over.</li>
      <li><b>Share your numbers</b> every month or two: members, swaps completed, things kept out of landfill.</li>
      <li><b>Ask for feedback</b> and act on it. Keep the community rules short and fair.</li></ul>
    </section>

    <section id="g-care"><h2>Do it the right way</h2><ul class="rules">
      <li><b>Ask before you post.</b> Get permission for noticeboards, and read each online group's rules or ask the admin. Spamming groups gets you banned and puts people off.</li>
      <li><b>Don't flypost.</b> Putting posters on lamp posts, walls or bus stops without permission is illegal in many places, including the UK.</li>
      <li><b>Respect people's data.</b> Only add people to a mailing list or WhatsApp group if they've said yes, and let them leave easily.</li>
      <li><b>Share listings, not people.</b> Listing pictures don't include names or contact details. Keep it that way when you repost.</li>
      <li><b>Be honest</b> that it's volunteer-run, that ${esc(cfg.creditName)} have no cash value, and how to report problems.</li></ul>
    </section>

    <section id="g-domain"><h2>Your own web address</h2>
      <p>Your site already works at <b>${esc(share.shortUrl())}</b> for free. A short address of your own, like <b>riversideswap.org</b>, is easier to say out loud and to put on posters.</p>
      <h3>Free option: borrow a sub-address</h3>
      <p>If your village hall, residents' association or another local group already has a website, ask whoever manages it to add <b>swap.their-domain.org</b> for you. They add one DNS record (step 4 below), and you do the rest.</p>
      <h3>Buying your own</h3>
      <p>A domain usually costs from a few pounds to around £15 a year, depending on the ending (.uk, .org.uk, .org, .com) and the company. Any registrar works; some well-known ones are Cloudflare Registrar, Porkbun, Namecheap and Gandi. Check the price for <b>renewing</b>, not just the first year, and turn on auto-renew so your address doesn't lapse.</p>
      <ol class="steps">
        <li><b>Buy the domain</b> with a registrar of your choice.</li>
        <li><b>Verify it with GitHub first.</b> On GitHub: your profile picture → Settings → Pages → Add a domain. GitHub gives you a TXT record to add at your registrar. This stops anyone else using your domain.</li>
        <li><b>Tell GitHub Pages about it.</b> In your repository: Settings → Pages → Custom domain. Type the address and save. GitHub adds a <code>CNAME</code> file to your code.</li>
        <li><b>Point the domain at GitHub</b> in your registrar's DNS settings:
          <table class="dns"><thead><tr><th>Using</th><th>Type</th><th>Name</th><th>Value</th></tr></thead><tbody>
            <tr><td>A sub-address (swap.example.org)</td><td>CNAME</td><td>swap</td><td>${esc(githubHost())}</td></tr>
            <tr><td rowspan="4">The main address (example.org)</td><td>A</td><td>@</td><td>185.199.108.153</td></tr>
            <tr><td>A</td><td>@</td><td>185.199.109.153</td></tr>
            <tr><td>A</td><td>@</td><td>185.199.110.153</td></tr>
            <tr><td>A</td><td>@</td><td>185.199.111.153</td></tr>
            <tr><td>Plus www</td><td>CNAME</td><td>www</td><td>${esc(githubHost())}</td></tr></tbody></table>
          <p class="muted small">Optional IPv6: four AAAA records for @ with 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153 and 2606:50c0:8003::153. Never use a wildcard (*) record: it lets other people take over your sub-addresses.</p></li>
        <li><b>Wait, then turn on HTTPS.</b> DNS changes can take up to a day. When GitHub shows the domain is working, tick <b>Enforce HTTPS</b> on the Pages settings.</li>
        <li><b>Update the sign-in settings.</b> In Supabase → Authentication → URL Configuration, change the Site URL and add the new address to Redirect URLs, or sign-in links will go to the old address.</li>
        <li><b>Update your code:</b> set <code>siteUrl</code> in <code>config.js</code> to the new address, and change the addresses in the link-preview tags at the top of <code>index.html</code>.</li>
        <li><b>Reprint your posters</b> so the QR code uses the new address. The old github.io address will redirect to the new one.</li>
      </ol>
      <p class="muted small">If you use your own email provider for sign-in emails, you can also send them from your domain (e.g. hello@riversideswap.org). Your email provider will ask you to add a few DNS records to prove you own it.</p>
    </section>
  </div>`;

    main.querySelectorAll('[data-jump]').forEach(b => b.onclick = () =>
      document.getElementById('g-' + b.dataset.jump).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
    main.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () =>
      toast(await share.copyText($('#msg-' + b.dataset.copy).value) ? 'Copied. Paste it wherever you like' : 'Could not copy. Select the text instead.'));
    $('#dl-og').onclick = e => busy(e.target, async () => share.download(await share.communityImage(), 'social-card.png'));
    $('#dl-square').onclick = e => busy(e.target, async () =>
      share.download(await share.communityImage({ width: 1080, height: 1080 }), `${share.slug(cfg.name)}-square.png`));
  };

  function githubHost() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    return m ? `${m[1]}.github.io` : 'your-github-username.github.io';
  }

  const poster = async () => {
    const ex = await examples();
    const url = share.siteUrl();
    const headlines = ['Swap, don\'t shop', cfg.heroTitle || 'Trade what you have for what you need', 'Got it? Need it? Swap it.', `Join ${cfg.name}`];
    main.innerHTML = `<div class="poster-controls panel">
      <h1 style="font-size:1.8rem">Printable poster</h1>
      <form id="pc" class="row" style="align-items:end">
        <label style="flex:1;min-width:220px">Headline<select name="headline">${headlines.map((h, i) => `<option value="${i}">${esc(h)}</option>`).join('')}</select></label>
        <label class="check" style="margin-bottom:10px"><input type="checkbox" name="tabs" checked><span>Tear-off strips</span></label>
        <label class="check" style="margin-bottom:10px"><input type="checkbox" name="examples" ${ex.length ? 'checked' : 'disabled'}><span>Show current offers</span></label>
        <button type="button" class="btn primary" id="print">Print</button>
      </form>
      <p class="muted small" style="margin:8px 0 0">Prints on A4. Ask permission before putting it up, and check the QR code scans before printing lots.</p>
    </div>
    <article class="poster" id="poster"></article>`;
    const draw = () => {
      const o = Object.fromEntries(new FormData($('#pc')));
      $('#poster').innerHTML = `
        <div class="poster-top"><span class="brand-mark" aria-hidden="true"></span><span>${esc(cfg.name)}</span></div>
        <h2 class="poster-head">${esc(headlines[o.headline || 0])}</h2>
        <p class="poster-sub">${esc(cfg.tagline)}</p>
        ${o.examples && ex.length ? `<div class="poster-ex"><b>On offer right now:</b><ul>${ex.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
        <div class="poster-mid">
          <ol class="poster-steps"><li><b>Post</b> what you can offer and what you need.</li>
            <li><b>Get matched</b>, even in three-way swaps.</li>
            <li><b>Meet up and swap.</b> Community ${esc(cfg.creditName)} cover the gaps.</li></ol>
          <div class="poster-qr">${share.qrSvg(url, 'QR code for ' + url)}<span>Scan to join</span></div>
        </div>
        <p class="poster-url">${esc(share.shortUrl())}</p>
        <p class="poster-small">Free and run by volunteers. No money changes hands.</p>
        ${o.tabs ? `<div class="tabs">${Array.from({ length: 8 }, () => `<span><b>${esc(cfg.name)}</b><br>${esc(share.shortUrl())}</span>`).join('')}</div>` : ''}`;
    };
    $('#pc').onchange = draw; draw();
    $('#print').onclick = () => window.print();
  };

  return { organisers, poster };
}

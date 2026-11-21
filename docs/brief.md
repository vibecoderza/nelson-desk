# Nelson Desk and Client Portal: project brief

Nov 19, 2026 · @Alan

Business logic and technical build for the desk, portal, dashboard and master boards on the "Nelson · 6 Panel Cap" canvas. v2: the designs are the whole back office, not a quote tool.

## 1. The verdict

The designs are not a quote desk. They are Nelson's back office and its customer portal: every enquiry, quote, order, proof, payment, delivery and reorder, for cart orders and quote orders alike. Build it as one separate project with two front ends on one database: **the Desk** for staff and **the Portal** for clients.

Nelson keeps what it already owns: the catalogue, the customiser, the price, the print spec, the mockup render and the order pack. The Desk and Portal own the people, the conversations, the money trail and the dates. The two meet at one versioned contract.

Three rules hold the seam. Break any one and you run two businesses.

1. **One price rule.** The Desk asks Nelson for every price. It never holds the formula. The designs show a "Mark-up 30%" column per line; that column is the single biggest open decision in this brief (section 9, decision 1).
2. **One product truth.** Shopify plus Nelson's spec, by our product code. Supplier names, codes and costs show to staff on the Desk and never leave it.
3. **One order file.** Every order, from the cart or from a quote, produces the same `nelson.order-pack/1`, and every order lands on the same Desk board.

The design principle that makes it buildable is already on the master board: **one event, three effects.** Every trigger writes one event. The portal, the desk and the message all read that event, so they cannot disagree. That line is the architecture.

**Lean v1:** clients, quotes with versions, the client's quote page with accept and decline, the official PDF, email, and an order board that cart and quote orders both land on. WhatsApp, proof sign-off, Xero, brand kit, mockup shop, agents and the business view stack on that without rework.

## 2. What the designs contain

40 artboards. The 27 that this project builds, grouped by module:

| Module | Boards | Front end |
| --- | --- | --- |
| Today | Dashboard · Nelson desk, Today (desktop, phone) | Desk |
| Inbox | Desk 2 · Inbox, every channel | Desk |
| Quotes | Desk 3 · Quote builder · Desk 5 · Official quote document · Desk 11 · Pipeline · Master · Messages | Desk |
| Suppliers | Desk 4 · Suppliers and costing requests | Desk |
| Orders | Desk 6 · Orders and production · Desk 7 · Order, dispatch and updates | Desk |
| Clients | Desk 8 · Client profile | Desk |
| Business | Desk 9 · Money and where clients come from | Desk |
| Settings | Desk 10 · Connections and agents | Desk |
| Lifecycle | Master · the whole cycle, every trigger (18 triggers) | Both |
| Portal home | Dashboard · Client portal, Home (desktop, phone) | Portal |
| Portal quotes | Portal 2 · Quotes · Portal 3 · Quote, version 3 · Portal 12 · Accept or tell us why not | Portal |
| Portal orders | Portal 1 · How an order happens · Portal 4 · Order · Portal 5 · Proof sign-off | Portal |
| Portal brand | Portal 6 · Mockup shop · Portal 7 · Brand kit · Portal 8 · Artwork | Portal |
| Portal account | Portal 9 · Settings · Portal 11 · Sign in · Portal 10 · Where a design lands | Portal |

The other 13 boards (product page, customiser on every device, preview, cap template, artwork renderer) belong to the customiser thread, "Build the new customiser, ready to wire in". This project consumes their output (section 6.3).

## 3. The domain

### 3.1 The objects

| Object | Id shape | What it is |
| --- | --- | --- |
| Client | `c_…` | A company (Mother Moon Herbals). Holds people, addresses, brand kit, artwork, store, projects, notes, source |
| Person | `p_…` | Someone at a client. Role: Owner, Buyer (with a spend limit), Viewer |
| Project | `pr_…` | A group of quotes, orders and artwork with a budget (Year-end 2026, R 45 000) |
| Enquiry | `e_…` | One incoming ask, read into a brief. Becomes or joins a quote |
| Conversation and message | `cv_…`, `m_…` | Every message in and out, every channel, tied to a client |
| Quote | `Q-00007` | A priced offer that moves back and forth. Has versions |
| Quote version | `Q-00007 v3` | Immutable once sent. Every answered round is a new version |
| Quote line | `ql_…` | Product code, colour, quantity, design ref and rev, decoration, price, state |
| Amendment | `am_…` | A client change (made in the customiser or in words) waiting for Nelson's answer |
| Costing request | `CR-0031` | A pack sent to a manual supplier for a cost Nelson does not hold, with an answer timer |
| Order | `N-1042` | Fixed, only moves forward. From the cart ("Buy now") or from a quote |
| Proof | `PP-1042` | The print proof sheet from the print house, checked by Nelson, signed by the client |
| Payment | `pay_…` | Card (through Shopify) or EFT (matched by hand at first). Deposit or full |
| Invoice | Xero's number | Raised and reconciled in Xero. The Desk links to it and keeps no second set of books |
| Shipment | `sh_…` | Courier, service, cartons, waybill, tracking events |
| Event | `ev_…` | One row per trigger. The source every screen and message reads |
| Notification | `n_…` | One row per message sent, per channel, with delivery and read status |
| Brand kit | `bk_…` | Logos, colours with the nearest thread, fonts, brand rules, read from a guide |
| Artwork file | `af_…` | A client file with its check result (vector or pixels, sharpest print size, colour count) |
| Store item | `si_…` | A saved design or overnight mockup in the client's mockup shop |
| Agent | `ag_…` | A helper with its own key, job, log and off switch |

Customer-facing numbers stay short and ours: `Q-00007`, `N-1042`, `PP-1042`, `CR-0031`. A Shopify order number maps to an `N-` number at the first webhook. Supplier references (Amrod `SO-88214`) live on the order's supply chain panel, Desk only.

### 3.2 The quote

**States.**

| State | Meaning | Client can | Exits |
| --- | --- | --- | --- |
| Draft | Being built on the Desk. Not sent | Nothing | Sent |
| Working | Sent. Lines can still change on either side | Change quantity, colour, design; add a product; ask | Final, Declined, Expired |
| Final | Every line Agreed. Nothing waits on either side | Accept and pay, decline, ask | Accepted, Declined, Expired, back to Working if anyone changes a line |
| Accepted | Paid (or deposit paid). Becomes an order and leaves Quotes | View | n/a |
| Declined | Client said no, with a reason | Re-open before the validity date | Working (re-work) |
| Expired | Day 10 with no answer ("No reply"), or past the validity date | Ask again | Working (new version) |

**Versions.** Sending creates v1. Every answered round of changes is the next version. A version is immutable once sent: its lines, prices, mockups, terms and total are frozen. The client sees "What changed in v3" against v2. The official PDF is made from a version, never typed.

**Line states.** One per line, shown to both sides in different words:

| Line state | Portal words | Desk words |
| --- | --- | --- |
| Agreed | Agreed | Agreed |
| Waiting on Nelson | Your change · waiting on Nelson | Client change to answer |
| Nelson suggests | Nelson suggests | Suggested, waiting on client |
| Waiting on supplier | Due 2 Dec | Costing request out, with timer |

Accept and pay unlocks only when every line reads Agreed. That is the definition of Final.

**Amendments.** A client is free to design; Nelson has the final say. A client change in the customiser saves at once as a new design revision. It joins the quote only when Nelson answers:

- **Accept:** the line takes the new revision, Nelson re-prices it, the version moves on.
- **Suggest:** Nelson offers the nearest thing it can make (for example 15 mm, because laser needs 15 mm minimum). The line reads "Nelson suggests" until the client takes it or edits again.
- **Decline:** the line keeps its agreed revision, with a reason.

The Desk shows the design-check result beside each amendment ("Passes: above the 25 mm minimum, 4 100 stitches"), from Nelson's `design-check`.

**Follow-ups.** Day 3 check-in. Day 7 the video ask, with Accept and Not going ahead. Day 10 the quote closes as "No reply". The days are a setting. A follow-up is due on its day and overdue the day after; overdue ones lead Today. Every follow-up waits for Alan's send.

**Declines.** A decline always asks the reason: Too expensive, Timing, Went elsewhere, Budget cut, Just exploring, Something else. "Too expensive" asks for the budget figure and opens a re-work request on the Desk.

**Validity.** The quote carries a valid-until date. The designs show 12 to 14 days ("valid to 30 Nov" on an 18 Nov version); the 13 Nov spec recommended 7. Both the validity length and the day-10 close are settings, and decision 4 sets the default.

### 3.3 The order

**Two ways in, one order.**

- **Buy now:** standard product, in stock, priced by code, 300 or fewer. Pay first, proof second.
- **Quote:** ranges, big runs, anything sourced. Agree first, then pay.

Both become an order with one target delivery date and one job log.

**States, forward only.**

| Order state | Entered when | Who fires it |
| --- | --- | --- |
| Paid | Card payment webhook, or Alan matches an EFT | Auto, EFT by Alan |
| Proof · with Nelson | The print house's proof sheet arrives | Auto |
| Proof · with client | Alan approves the sheet | Alan, then auto |
| Signed · place order | The client signs. Design locked | Auto |
| In production | Alan places the supplier and print orders | Alan's click |
| Dispatched | Alan saves the waybill | Alan's click |
| Delivered | The courier confirms | Auto |

Side states: **On hold** (stock short, client to call) and **Cancelled**. Neither moves the target date silently: both tell the client.

The order mirrors Nelson's pack status (`order_packs.status`: placed, proof\_approved, in\_production, dispatched, delivered, cancelled). Nelson writes pack status; the Desk writes the client-facing order state; one event carries both.

**Board colours.** A card turns amber when its next step is due today and red when its target date is at risk. The Desk raises prompts: "enter the waybill", "place the supplier order", "proof not signed, reminder at 14:00 unless you stop it".

**Target date.** Counted from the signed proof:

```
target = sign date + production lead time (working days) + transit (working days)
```

It holds if the client signs today. Each day later moves it by one working day, and the portal says so in those words. Lead times come from Nelson (section 6.4). South African public holidays count as non-working.

**"One click, three things."** Saving a waybill moves the order to Dispatched, updates the client's tracker and sends the WhatsApp. Placing the supplier order moves it to In production and tells the client. These two clicks are Alan's on purpose: they are the news.

### 3.4 The proof

1. The print house uploads its proof sheet through a signed upload link tied to the order. State: with Nelson.
2. Alan checks it against the signed-off design revision and approves, or sends it back.
3. The client sees it in Proofs: the sheet at 100%, position, method, size in mm, threads, stitches. They tick four checks (spelling, colours, size and position, "this is what gets made"), type their name and draw or type a signature.
4. The Desk records the signature, name, time, IP, user agent, the exact words shown, and a SHA-256 fingerprint of the sheet. The design is locked. A signed copy goes by email and WhatsApp. The print house receives the print master.
5. "Ask for a change" sends it back to Nelson with a note. A new sheet restarts the proof.

Rules: nothing is made unsigned. Only an Owner (or a Buyer within their limit, decision 7) can sign. Reminder 24 hours after the proof reaches the client, then daily, each one waiting for no click because it is an order update.

### 3.5 Money

- **Price** comes from Nelson's price endpoint for every line, every time (section 6.2).
- **Deposit.** The designs show "50% deposit over R 20 000". Under that, payment in full. Decision 5 confirms the threshold.
- **Card** goes through a Shopify draft order and its pay link (created by Nelson, section 6.5).
- **EFT** uses the quote number as the reference. Alan matches proof of payment on Today. Bank-feed matching through Xero comes later.
- **Invoice.** Raised in Xero when an order is paid (or when the deposit is due, for quote orders). The Desk shows invoice state and links each to its order. Xero holds the books.
- **No VAT.** Nelson is not VAT registered. The PDF says "No VAT charged". No VAT line, label or step anywhere.
- **Cost moves.** The supplier feed runs nightly. A cost that moves more than 5% lands on Today. Accept re-prices every quote line that is not locked; Hold keeps today's cost until Alan looks again. A line is locked once its version is Final and sent, until its valid-until date.
- **Profit per order.** Sale minus cost of goods (blanks, branding, freight) when each order is paid. Staff only.

### 3.6 Clients, people and permissions

**Client roles.**

| Role | Can |
| --- | --- |
| Owner | Everything: approve proofs, accept and pay, manage team, brand kit, settings |
| Buyer | Request, change and accept quotes up to their limit (R 10 000 in the design). Over the limit, the Owner approves |
| Viewer | See quotes, orders, artwork and the store |

**Sign-in.** No passwords. Google, or a link sent to a work email. First sign-in asks three short steps: company, how we reach you (WhatsApp number, opt-in, site-visit linking), brand. A work email whose domain already has a client offers "Ask to join them".

**How accounts start.**

- Guest who paid: an account is made from the checkout email; the first sign-in link is in the payment message.
- Enquiry by WhatsApp or email: the Desk makes the client; the quote message carries the sign-in link.
- Designing while signed out: the design waits on the device and moves into the account at sign-in or at Add to quote or Add to cart.

**Staff.** Owner sees everything. Further staff roles (sales without margin, production without money) are a setting, not v1.

**Source.** The client's first visit source (ChatGPT, Instagram, Google search, WhatsApp referral, Direct) comes from PostHog's first-touch record, linked when the client opts in to visit linking at sign-in. It shows on the client profile and in Business.

### 3.7 Brand kit, artwork and the mockup shop

- **Brand kit.** The client drops a brand guide (PDF, SVG, AI, EPS, PNG) or gives a website. The Desk reads logos, colours (with the nearest thread Nelson stocks), fonts and rules. Anything uncertain is marked "Guess · confirm". The customiser offers the kit first, and warns, never blocks, when a design breaks a brand rule.
- **Artwork.** Every upload is checked: vector or pixels, the largest size it prints sharp, colour count. "Needs a redraw" offers Nelson's redraw. Redrawn files land in "From Nelson". Files are private to the client's team.
- **Mockup shop.** Everything the client designed or ordered, plus overnight mockups made with their brand kit by the mockup runner. Reorder and Customise on every item. Shareable as a store. Prices shown are a guide at a stated quantity; the price at the client's quantity comes from Nelson at order.
- **Where a design lands** (from the customiser): Save to my store; Add to quote (joins the open working quote as a new line and moves the version on, or starts a new quote; reaches the Desk as a "basket"); Add to cart. Add to cart leads when the order can be priced by code and stock covers it; otherwise Add to quote leads, with one line saying why. This is Nelson's existing cart gate, shown as a button order.

### 3.8 Agents

Every agent has its own key, its own log and an off switch.

| May | May not |
| --- | --- |
| Read enquiries, quotes, orders and artwork. Draft messages. Suggest products. Prepare a quote for Alan to check | Set a price or a mark-up. Send anything to a client or supplier without Alan's click. Approve a proof. See more than its job needs |

Two agents in the designs: **Claude** reads enquiries into briefs, drafts replies, cover notes and follow-ups, and sorts client changes into line edits. **Mockup runner** makes new mockups overnight from each client's brand kit. Clients may connect their own agent from the portal later; it gets the same document contract as the 15 Dec agent spec.

## 4. Every trigger

The master board's 18 triggers, as the build reference. Each writes one event. "Alan" means the action waits for his click.

| # | Trigger | Writes | Portal shows | Desk shows | Message | Fired by |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A message arrives (WhatsApp, email, form, basket) | Enquiry · new | Nothing | Inbox row, read into a brief | Client: "Got it. Quote on its way." | Auto |
| 2 | Client signs in or the Desk creates them | Client · source recorded | Home | Client profile, "Found us" | Welcome and sign-in link | Auto |
| 3 | Artwork is checked | Artwork · ready or needs redraw | Check result on the file | Artwork badge | Client, only if a redraw is needed | Alan |
| 4 | A line needs a cost we do not hold | Costing request · out | Nothing | Suppliers: request with timer | Supplier: pack by email; chase if late | Alan |
| 5 | Alan sends the quote | Quote · working · v1 | Quotes: open; Home: needs you | Pipeline: sent, follow-ups set | Quote link, email and WhatsApp | Alan |
| 6 | Client opens it, or changes a line or design | Event: opened · Amendment: waiting | "Waiting on Nelson" | Today: change to answer | None | Auto |
| 7 | Alan accepts, suggests or declines the change | Quote · next version | "What changed" strip | Lines agreed | "New version is ready" | Alan |
| 8 | No answer by day 3, then day 7 | Follow-up · due, overdue | Nothing | Today and Pipeline | Check-in; then the video ask | Alan |
| 9 | Client declines, or day 10 passes | Quote · declined + reason, or expired | Quote closes; designs stay | Why we lose | Thank you | Auto |
| 10 | Client accepts and pays, or pays from the cart | Order · paid · target set · Xero invoice | Orders: target, job log | Board: Paid; profit | Payment received, receipt | Auto; EFT by Alan |
| 11 | Print proof sheet arrives | Proof · with Nelson | "Preparing your proof" | Today: proof to approve | None | Auto |
| 12 | Alan approves the proof | Proof · with client | Sign on screen; "your move" | Board: Proof | "Proof ready"; reminder after 24 h | Alan, then auto |
| 13 | Client signs | Proof · signed · design locked · signature logged | Milestone ticked; signed copy | Board: Signed · place order | Signed copy; print house gets the print master | Auto |
| 14 | Alan places supplier and print orders | Order · in production | "In production", target | Board: In production | "In production, target date" | Alan |
| 15 | Alan saves the waybill | Order · dispatched · waybill | "On its way", tracking | Board: Dispatched | Waybill and tracking | Alan |
| 16 | Courier confirms delivery | Order · delivered | "Delivered"; Reorder | Board: Delivered | "Delivered" | Auto |
| 17 | 3 days after delivery, no problem logged | Review · asked (once) | Nothing | Profile: review asked | Google review link | Auto |
| 18 | Reorder window (per client) | Reminder · due | Home: "Order again" | Today: reorder nudge | "Time to restock?" | Alan |

**Who presses.** Anything about a price or a quote waits for Alan. Order updates after payment are automatic, except the two clicks that are the news: order placed and waybill saved.

**Channels.** Email always, the portal always, WhatsApp when the client opted in. Each person chooses per kind of update in Settings.

**Words match.** Client words: Paid, Proof, Print master, In production, Dispatched, Delivered. The Desk adds two of its own: Proof with Nelson, and Signed · place order.

## 5. The screens: what each one does

### 5.1 Desk

**Today.** The day's work in one list, oldest first. Sections: Needs you (cost moves, stock short, maker order not sent, proof to approve, client change to answer, EFT received), Chase (follow-ups due, each waiting for a send), Watching (late or at risk), New in. Five numbers: quotes open, value waiting on client, average hours to first quote, win rate this month, late orders. Keyboard: J and K move, A accept, H hold, S send, Enter opens. "Cleared today" with Undo last.

- Logic: Today is a query over open events with a due time, not a table of its own. A row clears when its event resolves. Undo reverts the last state change within 10 minutes where the change sent nothing; a sent message cannot be undone and the button says so.

**Inbox.** One row per conversation, oldest first, every channel. Each row shows the client, the message, what was read from it ("Everyday Shopper × 50 · Cape Town · by 28 Nov") and an artwork badge. Actions: Reply, Add to quote, Start a quote.

- Logic: an inbound message finds its client by WhatsApp number or email; unknown senders get a new client in Draft. The Claude agent reads it into a brief: product codes (matched against the catalogue), quantities, place, deadline, budget. The brief is a suggestion; nothing prices until Alan opens the quote.

**Quote builder.** Per line: product and colour, our product code, supplier, live stock, cost, branding, quantity, mark-up, sell each, margin, state. Client changes to answer with the design-check result. Freight options that re-price when the address or date changes, with carton count from product data. Totals: cost, setup and freight, sell, margin, waiting on. WhatsApp thread beside the quote. Versions and files. Send by email, WhatsApp, portal.

- Logic: every price cell is Nelson's answer. Supplier, cost and margin come from Nelson's staff view of the same call and never reach the portal. "Refresh stock" re-asks Nelson. "Send v4" freezes the version, makes the PDF and the mockup zip, and fires trigger 5 or 7.

**Suppliers.** Linked suppliers price themselves by feed (Amrod: products, cost, branding tables, stock, incoming stock). Manual suppliers (an embroidery house) are costed by request. Costing requests list: request, for which quote line, sent, answer due, state.

- Logic: a costing request is a pack (vector artwork, mockup, size sheet in mm, quantities, date) sent by email with one reply link. No client name, no prices in the pack. The answer is typed into the Desk or parsed from the reply page. The 24-hour answer window is a placeholder per supplier; the Desk records the real time taken. A manual cost goes to Nelson's price endpoint as an input, so the master rule still applies (section 6.2).

**Official quote document.** Made from a version, never typed. Fixed quantities, terms and one total, so a client can put it in for budget approval. "No VAT charged." Terms: free proof before anything is made; delivery in N working days from the signed proof; payment terms. Accept online, or EFT with the quote number as reference. Goes with it: mockup sheet, mockup zip, change log. Never on it: supplier names, costs or margin.

**Orders.** One board: Paid, Proof, Signed · place order, In production, Dispatched, Delivered. Views by target date, by supplier, late or at risk. Prompts: the system asks, Alan clicks.

**Order.** Courier, service and waybill with "Save and tell the client". Who was told what: every message to every party, with channel and read status. What the client sees. The supply chain: blank supplier and their reference, branding, margin. Order pack, signed proof, invoice.

**Client profile.** Found us, lifetime value, open quote, average order, win rate, average margin. Quotes and orders. People with roles and limits. Artwork and brand kit. Mockup shop with "Pause auto-mockups". Notes. All conversations across channels.

**Pipeline.** Open, Accepted, Declined, Expired. Overdue follow-ups lead. Win rate, hours to first quote, days to a decision, why we lose. Follow-up rules and what "seen" means: opened is the portal page opening; video watched is a play in the portal. Neither comes from email tracking.

**Business.** Sales, cost of goods, gross profit, margin against a 25% target, unpaid invoices. Gross profit by month, sales and margin by category, profit per order as each is paid, where clients came from, invoices from Xero.

- Logic: sales and profit come from paid orders on the Desk. Invoices and payment state come from Xero. Ad spend and cost per client fill in when an ads account is connected.

**Settings.** Connections (Xero, Shopify, Amrod via Nelson, WhatsApp, email, PostHog, courier, e-signature), later connections (Instagram, Facebook, TikTok, ads, manual supplier feeds), pricing rules, messages and templates, team, audit trail, agents.

### 5.2 Portal

**Home.** "Good morning, Holly · 2 things need you." Open quote, budget left this quarter, orders in progress, spent with Nelson. Needs you; your orders with a four-step bar; suggested for you, mocked up with their logo.

**Quotes.** Open, Accepted (now in Orders), Closed. "How a quote works" in four lines.

**Quote.** Versions, what changed, each line with its mockup, edit in customiser, quantity choices including "Ask", price each, line total, line state. Add a product, or add from the mockup shop. Total, setup, delivery. Accept and pay unlocks when every line is Agreed. Discussion thread on the quote.

**Accept or decline.** Card or EFT. Download the official quote. Decline with a reason, and for "too expensive" a budget figure and "Ask Nelson to re-work it". Re-open any time before the validity date.

**Order.** Target delivery date with days to go and "holds if you sign today". The six milestones with dates. Your move. Job log with every step and every message sent. Documents: invoice, receipt, signed proof, waybill, delivery note. Where updates go.

**Proof.** Section 3.4.

**Mockup shop, Brand kit, Artwork.** Section 3.7.

**Settings.** You and updates (per-kind, per-channel choices), company and delivery (company name, client's VAT number for their invoices, delivery addresses with receiving contacts), team, projects with budgets, agents and privacy (connected agents, download or delete my data, portal theme from the brand kit).

**Sign in, How an order happens, Where a design lands.** Sections 3.3, 3.6, 3.7.

## 6. The contract with Nelson

### 6.1 Who owns what

| Data | Owner | Everyone else |
| --- | --- | --- |
| Products, prices on the store, stock | Shopify | Read it |
| Print spec, zones, methods, templates | Nelson (Neon `studio`) | `GET /api/v1/spec` |
| Supplier cost, tier, branding tables, cost feed | Nelson (Neon `market`) | Staff view of the price call only |
| Price for any line | Nelson | `POST /api/v1/price` |
| Designs, revisions, mockups, design checks | Nelson (customiser) | The four documents below |
| Order pack and print files | Nelson | Staff key only |
| Clients, people, conversations, quotes, orders' client state, proofs, approvals, notifications, brand kits, artwork, store | Desk | Portal reads; Nelson reads via events |
| Invoices and payments | Xero | Desk reads and writes through Xero's API |
| First-touch source | PostHog | Desk reads |

The Desk never connects to Nelson's Neon. Nelson never reads the Desk's database. Integration is HTTPS JSON and signed webhooks.

### 6.2 Price (Nelson builds)

`POST /api/v1/price`, called with the Desk's key. Request: lines (product code, colour, quantity, decoration per position: method, colours, size), delivery address, and optional `manual_cost` lines from a costing request (cost per quantity break, with the request id).

Response, two views of one answer:

| Field | Customer view | Staff view (`view=staff`, staff scope key) |
| --- | --- | --- |
| Unit, setup, line total, ladder, delivery price, valid until | Yes | Yes |
| `price_version`, line `status` (priced, quote\_only, needs\_human), `below_floor` | Yes | Yes |
| Supplier, supplier code, stock and incoming stock | No | Yes |
| Cost per unit, branding cost, mark-up applied, margin | No | Yes |

Rules:

- One rule computes every price: supplier cost × 1.15 × 1.33, whole cents half up, unit prices on the 50c ladder, no VAT step. It lives in Nelson (`server/markup.js`, pinned by `test/master-rule.test.js`). The Desk has no copy.
- `price_version` changes when any cost, tier or rule behind a price changes. A sent version stores the whole response.
- `needs_human` lines (no stock, no cost) take a manual price only with Alan's name and a reason on the line. Logged. Reviewed monthly.
- The portal only ever receives the customer view.

### 6.3 Designs and mockups (the customiser thread builds)

The customiser publishes four documents, with JSON Schemas in `customiser/studio-engine/contracts/` (target 23 Nov):

| Document | The Desk uses it for |
| --- | --- |
| `nelson.design/1` | Quote lines, amendments, store items. Pinned by ref and revision |
| `nelson.mockup-set/1` | Mockups per colour and angle, front first, signed short-lived URLs, `source` photo or drawing. The Desk snapshots them into its own private store when a version is sent |
| `nelson.design-check/1` | Pass or fail with codes, shown beside an amendment and on artwork |
| `nelson.order-pack/1` | Production. Staff key only, because it names the supplier |

Endpoints on the studio host: `GET /api/design?ref=`, `POST /api/design-check`, `POST /api/mockups`, and `/api/order-pack` (staff key).

Agreed with the customiser thread on 19 Nov and written into `plans/new-customiser.md` section 3:

1. **Immutable revisions.** A design is ref plus rev. A quote line and an order pin a rev; an edit makes a new rev.
2. **Owner.** `owner` is the Portal client account id.
3. **Handoff events.** `design.saved` and `quote.basket_added` are posted server-side to the Desk webhook, HMAC signed, carrying ref, rev, owner and quantities.
4. **Brand kit.** The customiser reads it from the Desk at `GET /api/v1/brand-kit?client=`. The Desk owns it.
5. **Design check.** Stable codes with the limit that failed, plus an embroidery stitch estimate.
6. **Mockup runner.** `POST /api/mockups` also takes `{product_code, logo, colours}` and uses Nelson's default placement.

Out of scope for now (Alan, 19 Nov): Templates, Graphics and the AI section of the customiser. The Desk and Portal must not depend on them.

### 6.4 Lead time and delivery (Nelson builds)

`POST /api/v1/delivery-estimate`: lines, address, sign date. Returns production days, transit days, target date, freight options (economy, express) with sell prices and carton count. Nelson owns the lead-time table and the holiday calendar. Until Alan sets lead times, one flat default he approves. The Desk never invents a date.

### 6.5 Orders (Nelson builds)

- `POST /api/v1/orders/from-quote`: quote ref, version, `price_version`, lines with design ref and revision, contact, ship-to, deposit or full. Nelson re-checks every price (a mismatch is `409 price_changed`), creates a Shopify draft order with the same line properties the cart carries, and returns the pay link.
- Payment, from the cart or a quote, reaches Nelson as Shopify's `orders/paid` webhook (already wired for freight). Nelson builds the pack and emits `order.paid` to the Desk, which creates or updates the `N-` order.
- An EFT payment: Alan marks it received on the Desk; the Desk calls `POST /api/v1/orders/{ref}/mark-paid`; Nelson marks the Shopify order paid and builds the pack. One path for both.
- `POST /api/v1/orders/{ref}/status` for the two Alan clicks (supplier order placed, waybill saved), so pack status keeps one writer.

### 6.6 Events, both ways

One envelope, `nelson.event/1`: `{ id, type, occurred_at, subject: { type, id }, data }`. Signed with HMAC-SHA256 over the raw body with a timestamp, five-minute tolerance, at least once, deduped by `id`. Every POST carries an `Idempotency-Key`.

| From | Events |
| --- | --- |
| Nelson → Desk | `order.paid`, `order_pack.status_changed`, `order.cancelled`, `cost.moved` (nightly digest of moves over the threshold), `design.saved`, `quote.basket_added` |
| Desk → Nelson | `quote.sent`, `quote.accepted`, `quote.declined`, `quote.expired`, `proof.signed` (with fingerprint, for the pack's proof block) |

### 6.7 Identity across the two

The Portal owns client sign-in. The customiser on the product page shows "Saved to Mother Moon" by asking the Portal for a short-lived signed token (15 minutes, audience `studio`), passed to the studio host on its API calls. A Shopify customer links to a Portal client by email at the first order. No shared cookies across domains. The customiser holds no session of its own.

Two credentials hold this seam: the shared webhook secret (`DESK_WEBHOOK_SECRET`) and the token signing key (`PORTAL_TOKEN_SIGNING_KEY`). Alan sets both, in both projects' environments. They are named here; their values never appear in a brief, a repo, a ticket or a chat.

### 6.8 Change control

Paths start `/api/v1`. Additive changes keep `/1`; a removed or renamed field is `/2` with both live until the Desk moves. Nelson publishes OpenAPI 3.1, schemas and fixtures; the Desk runs a mock server from them and contract tests in CI against a Nelson preview before every release. This is a new data path, so it goes into the Architecture blueprint as section h before any Nelson card for it (decision 2).

## 7. Technical architecture

### 7.1 System map

```
                 Shopify (products, prices, stock, checkout, draft orders)
                    │ webhooks                         ▲ draft orders, mark paid
                    ▼                                  │
 ┌──────────── Nelson studio host (existing) ──────────────────────────┐
 │ customiser · /api/v1/spec · /api/v1/price · /api/v1/delivery-estimate│
 │ /api/design · /api/design-check · /api/mockups · /api/order-pack     │
 │ /api/v1/orders/* · event out/in                                      │
 │ Neon: studio (spec, designs, packs) · market (supplier feeds, cost)  │
 └───────────────▲──────────────────────────────┬──────────────────────┘
      key-signed │ HTTPS JSON                    │ signed events
                 │                               ▼
 ┌──────────── Desk and Portal (new project) ──────────────────────────┐
 │ desk.dearnelson.co.za   staff, 2FA       my.dearnelson.co.za client │
 │ Next.js app · server-rendered · one codebase, two surfaces          │
 │ Postgres (own Neon project) · private Blob · outbox and cron jobs   │
 └──┬─────────┬───────────┬────────────┬───────────┬──────────┬───────┘
    │         │           │            │           │          │
  WhatsApp  Resend      Xero        Courier     PostHog   Anthropic API
  Cloud API in and out  invoices,   (via Nelson first-touch (agents: briefs,
            quotes@     payments    freight)    source     drafts)
```

### 7.2 One codebase, two surfaces

One Next.js app serves two hostnames with separate sessions, separate cookies and separate route trees:

|  | Desk | Portal |
| --- | --- | --- |
| Host | `desk.dearnelson.co.za` | `my.dearnelson.co.za` |
| Who | Alan and named staff | Clients |
| Sign-in | Email link on an allow-list plus a second factor | Google or email link |
| Sees cost and supplier | Yes, server-rendered only | Never |
| Exposure test | Staff build: no cost in any cacheable response, no public routes | Every page and JSON response walked for Nelson's private keys and supplier names |

One database, one event log, one deploy. Two apps would double the release work for one builder.

### 7.3 The event backbone

"One event, three effects" is built as:

1. Every state change is a function that writes the new state and one `event` row in the same transaction.
2. An `outbox` row per effect is written in that transaction too: the message to send, the webhook to Nelson, the Xero call.
3. A worker (Vercel Cron every minute, plus an immediate kick after commit) sends each outbox row, retries with backoff, and marks it done. Failures surface on Today, never silently.
4. Today, the portal's job log, the Desk's "who was told what" and the client's milestones are all read from `event` and `notification`. Nothing writes those screens directly.

### 7.4 Data model

Postgres, own Neon project. Money in integer cents ZAR. Time stored UTC, shown SAST. Every table: `id`, `created_at`, `updated_at`.

| Group | Tables |
| --- | --- |
| Clients | `client`, `person`, `person_role` (role, spend limit), `address`, `project` (budget), `client_source`, `client_note` |
| Channels | `channel_identity` (email, WhatsApp, verified, opt-in wording and time), `conversation`, `message`, `attachment` |
| Enquiries | `enquiry`, `brief` (agent-read fields, confidence) |
| Quotes | `quote`, `quote_version` (immutable JSON snapshot, price response, PDF key, mockup keys), `quote_line`, `amendment`, `follow_up`, `decline` (reason, budget) |
| Suppliers | `supplier` (linked or manual, answer window), `costing_request`, `costing_answer` |
| Orders | `order` (N- number, source cart or quote, target date, state), `order_line` (design ref and revision), `payment`, `invoice_link` (Xero id), `proof`, `signature` (name, time, IP, agent, words, fingerprint), `shipment`, `shipment_event`, `hold` |
| Brand | `brand_kit`, `brand_logo`, `brand_colour` (hex, nearest thread), `brand_font`, `brand_rule`, `artwork_file` (check result), `store_item` |
| Messaging | `notification`, `template` (WhatsApp name, category, approval), `preference` (per person, per kind, per channel) |
| Platform | `event`, `outbox`, `webhook_inbox`, `staff_user`, `agent` (key hash, scopes, enabled), `agent_log`, `audit_log`, `setting` |

Staff-only columns (supplier, cost, margin) live only on `quote_line_staff` and `order_line_staff`, populated from Nelson's staff view. The Portal's data layer cannot select from them: it reads through views that do not include them. That is the second wall behind the hostname split.

### 7.5 Integrations

| Service | Use | Notes |
| --- | --- | --- |
| WhatsApp Cloud API (Meta, direct) | Inbound chats, outbound templates and replies, video header on the day-7 ask | Business verification first; check coexistence for South Africa before choosing the number; 24-hour window; utility templates approved in advance; opt-in recorded |
| Resend | Outbound mail, inbound on the quotes subdomain | Domain already authenticated |
| Xero | Invoice on payment or deposit, payment state, overdue | Desk writes invoices and reads payments. Books live in Xero |
| Shopify | Through Nelson only for writes. The Desk reads catalogue through the Storefront API (no cost in it) | No Admin token in the Desk |
| Courier | Rates through Nelson's freight module; waybill saved by Alan; tracking by webhook or a two-hourly poll while in transit | Courier choice is open; the designs use a placeholder name |
| PostHog | First-touch source per client | Linked at sign-in with consent |
| E-signature | Built in: drawn or typed signature plus the evidence record | A paid provider is optional (decision 8) |
| Anthropic API | Claude agent: briefs, drafts, change sorting | Its own key and log; tools limited to read and draft |
| Print house | Signed upload link per order for proof sheets; print master sent on signature | No account needed |

### 7.6 Security

- Nothing exposed (North Star 3.10): the Portal never receives supplier, cost, tier or margin. Staff pages are server-rendered with `Cache-Control: private, no-store`.
- Two hostnames, two session cookies, scoped to their host.
- Staff sign-in needs a second factor, because the Desk shows cost.
- Client files, proofs, mockups and signed copies in private storage, served by signed links that expire.
- Quote, proof and upload links are 128-bit random tokens, revocable.
- Rate limits on every public route. HMAC on every webhook. Idempotency on every POST.
- No source maps, minified builds, previews behind a login.
- POPIA: a privacy notice, recorded opt-ins, "download or delete my data" in Portal settings.

### 7.7 Stack

| Layer | Choice |
| --- | --- |
| Repo | New private repo, `nelson-desk` |
| App | Next.js App Router, TypeScript strict, server components for anything with money in it |
| Database | Own Neon project. Prisma, to match Nelson Admin |
| Storage | Private Blob. Region follows Nelson's D11 decision |
| Jobs | Outbox table, Vercel Cron, immediate kick after commit |
| PDF | Server-side, `@react-pdf/renderer` |
| Auth | Email link and Google for clients; email link plus a second factor for staff |
| Messages | WhatsApp Cloud API, Resend |
| Analytics | PostHog, Nelson's project |
| Tests | Contract tests, two exposure tests (portal and staff), state-machine tests for quote, order and proof, price-drift test, evidence-record test |

### 7.8 Rules the project inherits

From Nelson's `CLAUDE.md`, copied into the new repo on day one: nothing exposed; no supplier names or codes in anything a client sees; prices only from Nelson; British English; no AI product photos; every new public surface gets an exposure check that is never weakened; never touch the live MAIN theme or the live `piobox-pdp.js`; no card, no work; no lesson, no close.

## 8. Phasing

Sizes are sizing for one builder thread, not commitments.

| Phase | Delivers | Waits on | Size |
| --- | --- | --- | --- |
| **0. Contract and accounts** | OpenAPI, schemas, fixtures, mock server; Nelson cards written; repo, Neon project, domains; Meta verification started | Decisions 1, 2, 3 | 4 days |
| **1. Quotes** | Clients and people, quote builder with versions and line states, official PDF, Portal sign-in, Quotes, Quote, Accept or decline, email. Today (quotes only). Pipeline with follow-ups | Phase 0. Mocks until Nelson's price and spec land | 12 days |
| **2. Orders** | Order board for cart and quote orders, order page, payments (card through Nelson, EFT by hand), Xero invoices, target dates, waybill, job log, Portal orders | Nelson's orders, events and delivery estimate | 10 days |
| **3. Proofs** | Print-house upload link, Nelson check, Portal sign-off with the evidence record, print master | Phase 2 | 5 days |
| **4. WhatsApp and inbox** | Inbox across email and WhatsApp, templates, preferences, the 18 triggers' messages, video ask | Meta approval | 6 days |
| **5. Brand and store** | Brand kit reading, artwork checks and redraw requests, mockup shop, mockup runner, team roles, budgets, buyer limits | Customiser documents; Nelson mockups | 8 days |
| **6. Business and agents** | Business view, source attribution, Claude agent (briefs, drafts), cost-move handling, costing requests to manual suppliers | Xero, PostHog | 6 days |

**Gates.** Decisions 1 to 3, then blueprint section h, then Nelson cards after the 27 Nov freeze, then contract tests green on a Nelson preview, then a test order end to end on a preview theme. Live payments only behind Nelson's own checkout gate (30 Nov regression passed, order-file link working).

**Before then.** The Desk is built against mocks. No change to the live MAIN theme, the catalogue lanes, Nelson's Neon or the pricing files.

## 9. Decisions for Alan

Money, direction, accounts and legal only. Each with a recommendation.

| # | Decision | Recommendation |
| --- | --- | --- |
| 1 | **The designs show a 30% mark-up per line (23% margin). The master rule is cost × 1.15 × 1.33 (52.95% on cost, 34.6% margin), one formula for everything.** Which rules the Desk? | The master rule. The mark-up column shows the rule, read-only. Any other number is a manual price with your name on it. If you want per-quote mark-ups, that is a change to the master rule, and it lands in Nelson, never in the Desk |
| 2 | Approve the Desk and Portal as a second app with this seam, and add it to the blueprint as section h | Yes |
| 3 | New repo, Neon project and Vercel project; hostnames `desk.` and `my.` on dearnelson.co.za | Yes, all separate from Nelson |
| 4 | Quote validity length, and the day-10 close | 14 days valid, close at day 10 for no reply. Both settings |
| 5 | Deposit rule | 50% over R 20 000, in full below. Your number |
| 6 | Lead times, from signed proof | One flat default now, per product later. "Your proof follows within one working day" needs an owner before it goes on the site |
| 7 | Who may sign a proof and accept a quote: Owner only, or Buyers within their limit | Owner signs proofs. Buyers accept within their limit |
| 8 | E-signature: built in, or a paid provider | Built in with the evidence record. Revisit if a client's legal team asks |
| 9 | "Buy now" limit of 300 units (from Portal 1) | Yes, as a setting |
| 10 | Meta business verification, which number, monthly cap | Start now. Check coexistence first |
| 11 | Privacy notice, opt-in wording, proof-approval terms, quote terms | Yours, before the Portal opens to clients |
| 12 | Margin on the Desk for future staff | Owner only by default |
| 13 | Twenty (D17, 20 Oct) for the back office | Dropped. This project replaces it |
| 14 | Set the webhook secret and the portal token signing key in both projects | Yours, at phase 0. Never pasted into a chat or a repo |

## 10. Where the designs and the standing rules disagree

| # | Design says | Rule says | Resolution |
| --- | --- | --- | --- |
| 1 | Mark-up 30% per line, margin 23% | Cost × 1.15 × 1.33 for every product and branding | Decision 1 |
| 2 | PDF header "Company and VAT details" | Not VAT registered; no VAT label | PDF says "No VAT charged" and drops the header line |
| 3 | Validity to 30 Nov on an 18 Nov version | 13 Nov spec: 7 days | Decision 4 |
| 4 | Product codes like HW-2291, DW-1187 on the Desk | Customers see our product code only | Fine on the Desk. Confirm they are Nelson codes, not supplier codes, before any reaches the Portal |
| 5 | "Proof follows within one working day" | Proof owner PROPOSED, not confirmed (North Star v3) | Decision 6 |
| 6 | Every step sends a WhatsApp | WhatsApp needs opt-in and approved templates | Email always; WhatsApp when opted in |
| 7 | Prices in the mockup shop ("R 148 at 50") | Prices come from Nelson | Shown as a guide at a stated quantity, from Nelson's ladder |
| 8 | Notes say the cap uses drawn stand-ins until real photos are shot | No shoots; supplier photos and recoloured drawings only | Mockups use supplier photos where given, drawings where not. No shoots |

## 11. Stress-test

- **Two prices.** Prevented by design: the Desk has no formula and Nelson re-checks every amount at order.
- **A promise the system cannot keep.** Target dates need lead times; a missed step turns the card red the same hour and the client hears before they ask.
- **Alan is the bottleneck.** Every quote message waits for his click by design. Today, keyboard actions and agent drafts keep a click to seconds. Auto-send for standard quotes under a value is a later setting.
- **WhatsApp.** Verification, the 24-hour window and template approval all have email as the fallback.
- **The seam grows.** Nine Nelson endpoints, no more, until phase 2 is live.
- **Focus.** This competes with the catalogue for one person's attention. The freeze holds the lanes to 27 Nov; the Desk builds against mocks until then.

## 12. Handover

**First session, in order**

1. Create the repo with a `CLAUDE.md` carrying section 7.8, and the phase 0 cards.
2. Write the OpenAPI file and schemas for section 6, with fixtures, and run a mock server.
3. Build the state machines for quote, line, amendment, order and proof as pure functions with tests, before any screen.
4. Database, event backbone, outbox, both exposure tests.
5. Phase 1 screens against the mock.

**Kickoff text for the builder**

> You are building Nelson Desk and Portal as a separate project. Read `quote-desk-project-brief-2026-11-19.md` and the desk and portal boards on the "Nelson · 6 Panel Cap" canvas. The seam in section 6 is fixed: prices from Nelson only, product truth from Shopify and Nelson's spec by our code, one order file. Supplier, cost and margin show on the Desk and never reach the Portal. One event, three effects. Start with phase 0. Build against mocks. Touch nothing in `nelson-master`.

**Sources**

| Source | Where |
| --- | --- |
| Designs | [Nelson · 6 Panel Cap canvas](https://claude.ai/artifact/596ueLSQatRoXpEFUoBndX) (desk, portal, dashboard and master boards) |
| Customiser output contract | `/mnt/project-files/plans/new-customiser.md` section 3 |
| North Star v3 | [Notion, North Star v3](https://app.notion.com/p/41458d7e50f881e98410fc6ba3a89055) |
| Architecture blueprint | Notion, sections a, d, f, g |
| Advert-style proof page | Notion Ideas, 4 Nov |
| Quote desk spec, 13 Nov | [Quote desk spec](https://claude.ai/artifact/HvwcR7hzXeJaSmiGEC3ncG) |
| Master price rule | `customiser/studio-engine/server/markup.js`, `test/master-rule.test.js` (on `studio-next`) |
| Spec, order pack, design record, signed links, quote intake | `customiser/api/` on `studio-next` |
| Order and status tables | `customiser/studio-engine/schema.sql` |
| Exposure rules | `docs/decisions/008-nothing-exposed.md`, `test/exposure.test.js` |
